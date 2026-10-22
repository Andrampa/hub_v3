import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MicrodataDocumentation } from './MicrodataDocumentation'
import { FlowActions, FlowStepList, FlowStepPanel, useStepHeadingFocus } from './SurveyFlowNav'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { MicrodataLicence, type MicrodataAccess } from './MicrodataLicence'
import { formatNumber } from '../lib/format'
import { FLOW_STEPS, describeRequestOutcome, guardedStep, resolveSurveyRequest, type FlowStep, type SurveyRequest } from '../lib/surveyFlow'
import { MICRODATA_PACKAGE_BUDGET, MICRODATA_SURVEY_LIMIT, buildMicrodataParts, type MicrodataPart, outputFilesPerTable, preflightMicrodataPackage } from '../services/microdataBundle'
import { componentHasAudit, type MicrodataValues } from '../services/microdataLabels'
import type { BundleProgress } from '../services/surveyBundle'
import { type GrantDiscovery } from '../services/microdataGrants'
import { discoverMicrodataAccess, microdataSourceFingerprint, type MicrodataAccessResult } from '../services/microdataSurveyAccess'
import { GENERATIONS } from '../services/protectedData'

const STORAGE_PREFIX = 'diem.microdata-selection.v1'
const STEPS = FLOW_STEPS.microdata

function storedKeys(account: string, scope: string): string[] {
  if (!account) return []
  try {
    const value = JSON.parse(sessionStorage.getItem(`${STORAGE_PREFIX}.${account}.${scope}`) || '[]')
    return Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === 'string'))].slice(0, MICRODATA_SURVEY_LIMIT) : []
  } catch { return [] }
}

/**
 * The guided microdata route: Surveys → Options → Review → Licence → Download.
 *
 * Every step stays mounted, so the selection, a finished access check, the
 * licence acceptance and prepared parts (with their object URLs) survive moving
 * between steps. The page owns the URL; this component decides which step its
 * own state allows and asks the page to correct the URL when it must.
 *
 * The workspace owns grant discovery; its promise lets independent inventory checks start early.
 */
export function MicrodataPackagePicker({ grantDiscovery, grantPending, grantChecking, householdData, contributor, testMode, licenceAccess, collectionDates, onLoadingChange, onBusyChange, onRecheck, active = true, requested = 'surveys', onStep, request, onRequestApplied }: {
  grantPending?: Promise<GrantDiscovery>
  grantDiscovery?: GrantDiscovery
  grantChecking: boolean
  householdData: boolean
  contributor: boolean
  testMode: boolean
  collectionDates?: Map<string, string>
  licenceAccess: MicrodataAccess
  onBusyChange?: (busy: boolean) => void
  onRecheck?: () => void
  onLoadingChange?: (loading: boolean) => void
  /** Whether this route is the one on screen; a hidden route never touches the URL. */
  active?: boolean
  requested?: FlowStep
  onStep?: (step: FlowStep, options?: { replace?: boolean }) => void
  /** A link's survey request, applied once against the surveys this account can open. */
  request?: SurveyRequest
  onRequestApplied?: (notice?: string) => void
}) {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const inventory = useRef<HTMLElement>(null)
  const account = auth.user?.username || ''
  const scope = testMode ? 'test' : 'production'
  const [result, setResult] = useState<MicrodataAccessResult>()
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string>()
  const [retry, setRetry] = useState(0)
  const [deferredResult, setDeferredResult] = useState<MicrodataAccessResult>()
  const workBusy = useRef(false)
  const [selection, setSelection] = useState<{ account: string; scope: string; keys: string[] }>(() => ({
    account, scope, keys: storedKeys(account, scope),
  }))
  const keys = selection.account === account && selection.scope === scope
    ? selection.keys : storedKeys(account, scope)
  const [search, setSearch] = useState('')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const [openCountries, setOpenCountries] = useState<Set<string>>(() => new Set())
  const [includeOptional, setIncludeOptional] = useState(false)
  const [valuesChoice, setValuesChoice] = useState<MicrodataValues>('codes')
  // Accepted once per visit and account: the terms are the same for every
  // package, but a refresh or another account asks again. Never read from the URL.
  const [licenceAccepted, setLicenceAccepted] = useState(false)
  const [limitNotice, setLimitNotice] = useState<string>()
  const [preflight, setPreflight] = useState<{ fingerprint: string; records: number; tables: number; files: number; estimatedBytes?: number }>()
  const [preflightError, setPreflightError] = useState<{ fingerprint: string; message: string }>()
  const [preflightCancelled, setPreflightCancelled] = useState<string>()
  const [preflightProgress, setPreflightProgress] = useState<{ done: number; total: number; label?: string }>()
  const [downloadProgress, setDownloadProgress] = useState<BundleProgress>()
  const [downloadError, setDownloadError] = useState<string>()
  const [downloadOutcome, setDownloadOutcome] = useState<string>()
  const [downloadCancelled, setDownloadCancelled] = useState(false)
  const [parts, setParts] = useState<Array<MicrodataPart & { url: string; requested: boolean }>>([])
  const partUrls = useRef<string[]>([])
  const failureMessage = useRef<HTMLParagraphElement | null>(null)
  const preflightAbort = useRef<AbortController | undefined>(undefined)
  const downloadAbort = useRef<AbortController | undefined>(undefined)
  /** The package configuration an automatic check last started for. */
  const preflightAttempted = useRef<string | undefined>(undefined)
  const downloadButton = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setLicenceAccepted(false)
  }, [account])

  workBusy.current = Boolean(preflightProgress || downloadProgress)
  useEffect(() => {
    onBusyChange?.(checking || Boolean(preflightProgress || downloadProgress))
  }, [checking, preflightProgress, downloadProgress, onBusyChange])
  useEffect(() => {
    if (deferredResult && !workBusy.current) { setResult(deferredResult); setDeferredResult(undefined) }
  }, [deferredResult, preflightProgress, downloadProgress])
  useEffect(() => () => onBusyChange?.(false), [onBusyChange])
  function recheck() {
    if (onRecheck) onRecheck()
    else setRetry((value) => value + 1)
  }
  const discoveryInput = grantPending || grantDiscovery
  useEffect(() => {
    onLoadingChange?.(grantChecking || !grantDiscovery || checking || (!result && !error))
  }, [checking, error, grantChecking, grantDiscovery, onLoadingChange, result])

  const remember = useCallback((next: string[]) => {
    if (!account) return
    try { sessionStorage.setItem(`${STORAGE_PREFIX}.${account}.${scope}`, JSON.stringify(next)) } catch { /* optional convenience */ }
  }, [account, scope])

  useEffect(() => {
    if (auth.status !== 'authenticated') { setResult(undefined); return }
    if (!grantPending && !grantDiscovery) return
    const controller = new AbortController()
    setChecking(true)
    setError(undefined)
    void discoverMicrodataAccess(auth.requestProtected, grantPending ? grantPending.then((value) => value.bundles) : grantDiscovery!.bundles, {
      contributor, householdData, includeTestData: testMode, signal: controller.signal, reuseDiscoveryDefinitions: Boolean(grantPending) && retry === 0,
    }).then((value) => {
      if (controller.signal.aborted) return
      if (import.meta.env.DEV && (value.grantCheckFailed || value.master.unavailableSourceCount > 0)) {
        const reasons = value.grantIssues.reduce<Record<string, number>>((counts, issue) => {
          counts[issue.reason] = (counts[issue.reason] || 0) + 1
          return counts
        }, {})
        console.info('Microdata inventory check:', JSON.stringify({ grantIssueReasons: reasons, unavailableSourceCount: value.master.unavailableSourceCount || 0, pendingSourceCount: value.master.pendingSourceCount || 0 }))
      }
      if (workBusy.current) setDeferredResult(value)
      else setResult(value)
    }).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError((failure as Error)?.message || 'Microdata access could not be checked.')
    }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [auth.requestProtected, auth.status, contributor, discoveryInput, householdData, retry, testMode])

  const surveys = useMemo(() => (result?.surveys || []).filter((survey) => survey.testData === testMode), [result, testMode])
  const exportEnabled = (survey: (typeof surveys)[number]) => survey.components.some((part) => (
    part.component === (survey.generation === 'v3' ? 'mandatory' : 'household') && part.bulkExportEnabled
  ))
  useEffect(() => { setResult(undefined); setDeferredResult(undefined) }, [account, auth.requestProtected, testMode])
  useEffect(() => {
    if (!result || !['#step-microdata-package', '#temporary-microdata', '#step-microdata'].includes(location.hash)) return
    inventory.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' })
    navigate(location.pathname + location.search, { replace: true })
  }, [result, location.hash, location.pathname, location.search, navigate])
  const available = useMemo(() => new Set(surveys.filter(exportEnabled).map((survey) => survey.key)), [surveys])
  const selected = useMemo(() => surveys.filter((survey) => keys.includes(survey.key)), [keys, surveys])
  const pending = result?.master.pendingSourceCount || 0
  const complete = Boolean(result && pending === 0 && !result.grantCheckFailed && !grantDiscovery?.error)

  useEffect(() => {
    if (!complete) return
    setSelection((old) => {
      const current = old.account === account && old.scope === scope ? old.keys : storedKeys(account, scope)
      const next = current.filter((key) => available.has(key))
      if (next.length !== current.length) remember(next)
      return old.account === account && old.scope === scope && next.length === old.keys.length
        ? old : { account, scope, keys: next }
    })
  }, [available, complete])

  /*
   * A link's request is applied once the inventory has answered, and only to
   * surveys whose bulk export is approved for this account. A request that
   * arrives while the check is incomplete waits for the complete answer, unless
   * a source failed: then it is applied to what was confirmed, and the rest is
   * reported as unconfirmed rather than as access denied.
   */
  const inventorySettled = Boolean(result) && !checking && !grantChecking && pending === 0
  useEffect(() => {
    if (!active || !request || !inventorySettled) return
    const offered = surveys.filter((survey) => available.has(survey.key))
    const outcome = resolveSurveyRequest(request, offered, MICRODATA_SURVEY_LIMIT)
    if (outcome.countries.length) setOpenCountries((current) => new Set([...current, ...outcome.countries]))
    // A link naming surveys replaces the selection even when none could be
    // selected; a country-only link keeps it.
    if (outcome.keys.length || request.keys.length || request.round !== undefined) {
      setSelection({ account, scope, keys: outcome.keys })
      remember(outcome.keys)
    }
    onRequestApplied?.(describeRequestOutcome({ ...outcome, complete, limit: MICRODATA_SURVEY_LIMIT }))
  }, [account, active, available, complete, inventorySettled, onRequestApplied, remember, request, scope, surveys])

  const visible = surveys.filter((survey) => {
    if (selectedOnly && !keys.includes(survey.key)) return false
    const needle = search.trim().toLocaleLowerCase()
    return !needle || `${survey.countryName} ${survey.adm0Iso3} ${survey.round} ${survey.generation}`.toLocaleLowerCase().includes(needle)
  })
  const countryGroups = [...visible.reduce((groups, survey) => {
    const group = groups.get(survey.adm0Iso3) || []
    group.push(survey)
    groups.set(survey.adm0Iso3, group)
    return groups
  }, new Map<string, typeof visible>()).values()]
  const optionalUnusable = selected.filter((survey) => {
    if (survey.generation !== 'v3') return false
    const mandatory = survey.components.find((part) => part.component === 'mandatory')
    const optional = survey.components.find((part) => part.component === 'optional')
    return !mandatory || !optional || !optional.bulkExportEnabled || mandatory.source !== optional.source
      || (mandatory.source === 'grant' && mandatory.grantId !== optional.grantId)
  })
  const sourceTables = selected.length + (includeOptional ? selected.filter((survey) => survey.generation === 'v3').length : 0)
  // The tables this package would read, deduplicated; labels need every one of them audited.
  const unauditedTables = [...new Set(selected.flatMap((survey) => (
    survey.generation === 'v3'
      ? ['mandatory' as const, ...(includeOptional ? ['optional' as const] : [])]
      : ['household' as const]
  ).filter((component) => !componentHasAudit(survey.generation, component))
    .map((component) => `${GENERATIONS[survey.generation].label} ${component === 'household' ? 'household' : component} table`)))]
  const values: MicrodataValues = unauditedTables.length ? 'codes' : valuesChoice
  const outputFiles = sourceTables * outputFilesPerTable(values)
  const fingerprint = JSON.stringify({
    account, scope, includeOptional, values,
    sources: microdataSourceFingerprint(selected),
  })
  const selectedGenerations = [...new Set(selected.map((survey) => survey.generation))]

  const selectionFingerprint = JSON.stringify({ account, status: auth.status, scope, includeOptional, values, keys: [...keys].sort() })
  const checked = preflight?.fingerprint === fingerprint
  const checkFailed = preflightError?.fingerprint === fingerprint
  const optionalBlocked = Boolean(optionalUnusable.length && includeOptional)
  const downloadReady = checked && licenceAccepted && !optionalBlocked && !downloadProgress && !preflightProgress
  let downloadHint = 'Ready to prepare download parts.'
  if (!selected.length) downloadHint = 'Select at least one survey to build a package.'
  else if (optionalBlocked) downloadHint = 'Resolve the optional-table issue in Options first.'
  else if (downloadProgress) downloadHint = 'Preparing your files. You can cancel preparation below.'
  else if (preflightProgress) downloadHint = 'Checking access and counting records. Please wait.'
  else if (checkFailed) downloadHint = 'The access check failed. Return to Review and check again.'
  else if (downloadError) downloadHint = 'Preparation failed. Read the error below; completed parts remain available.'
  else if (!checked) downloadHint = 'Return to Review to check access and count records.'
  else if (!licenceAccepted) downloadHint = 'Accept the microdata licence to download.'
  else if (parts.length) downloadHint = 'Download the prepared parts below. Preparing again replaces them.'

  useEffect(() => () => preflightAbort.current?.abort(), [fingerprint])
  useEffect(() => () => downloadAbort.current?.abort(), [fingerprint])
  useEffect(() => {
    setPreflight(undefined)
    setPreflightError(undefined)
    setPreflightCancelled(undefined)
    setPreflightProgress(undefined)
  }, [fingerprint])
  useEffect(() => {
    setDownloadError(undefined)
    setDownloadOutcome(undefined)
    setDownloadCancelled(false)
    clearParts()
  }, [selectionFingerprint])
  function clearParts() {
    partUrls.current.forEach((url) => URL.revokeObjectURL(url))
    partUrls.current = []
    setParts([])
  }
  useEffect(() => () => partUrls.current.forEach((url) => URL.revokeObjectURL(url)), [])
  useEffect(() => {
    if (downloadError || checkFailed) {
      failureMessage.current?.focus()
      failureMessage.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }
  }, [downloadError, checkFailed])

  /**
   * One access check, owned by its controller.
   *
   * The result, failure, cancellation and every progress update are written
   * only while this run is still the current one, so a check superseded by a
   * new selection, a step change or another account cannot overwrite the state
   * of the one that replaced it.
   */
  async function countSelected() {
    preflightAbort.current?.abort()
    const controller = new AbortController()
    const runFingerprint = fingerprint
    preflightAbort.current = controller
    const current = () => preflightAbort.current === controller && !controller.signal.aborted
    setPreflight(undefined)
    setPreflightError(undefined)
    setPreflightCancelled(undefined)
    setPreflightProgress({ done: 0, total: sourceTables })
    try {
      const result = await preflightMicrodataPackage({
        surveys: selected, includeV3Optional: includeOptional, contributor, values,
        requester: auth.requestProtected, budget: MICRODATA_PACKAGE_BUDGET, signal: controller.signal,
        splitParts: true, estimateSize: true,
        onProgress: (progress) => { if (current()) setPreflightProgress({ done: progress.completed, total: progress.total, label: progress.label }) },
      })
      if (current()) setPreflight({ fingerprint: runFingerprint, records: result.recordCount, tables: result.sourceTableCount, files: result.outputFileCount, estimatedBytes: result.estimatedBytes })
    } catch (failure) {
      if (current()) setPreflightError({ fingerprint: runFingerprint, message: (failure as Error)?.message || 'The package could not be checked.' })
      else if (preflightAbort.current === controller) setPreflightCancelled(runFingerprint)
    } finally {
      if (preflightAbort.current === controller) {
        preflightAbort.current = undefined
        setPreflightProgress(undefined)
      }
    }
  }

  async function downloadPackage() {
    clearParts()
    const controller = new AbortController()
    downloadAbort.current = controller
    setDownloadError(undefined)
    setDownloadOutcome(undefined)
    setDownloadCancelled(false)
    setDownloadProgress({ stage: 'preparing', completed: 0, total: sourceTables })
    const prepared: Array<MicrodataPart & { url: string; requested: boolean }> = []
    try {
      const outcome = await buildMicrodataParts({
        surveys: selected, includeV3Optional: includeOptional, contributor, values,
        requester: auth.requestProtected,
        budget: MICRODATA_PACKAGE_BUDGET, signal: controller.signal,
        onProgress: setDownloadProgress,
        onPart: (part) => {
          if (controller.signal.aborted) return
          const url = URL.createObjectURL(part.blob)
          partUrls.current.push(url)
          prepared.push({ ...part, url, requested: false })
          setParts((existing) => [...existing, { ...part, url, requested: false }])
        },
      })
      if (outcome.partCount === 1 && !controller.signal.aborted) {
        const anchor = document.createElement('a')
        anchor.href = prepared[0].url
        anchor.download = prepared[0].fileName
        anchor.hidden = true
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
        setParts((existing) => existing.map((part) => ({ ...part, requested: true })))
      }
      setDownloadOutcome(outcome.partCount === 1
        ? `Download requested with ${formatNumber(outcome.recordCount)} records. Check your browser; the link below is a fallback.`
        : `${outcome.partCount} parts ready with ${formatNumber(outcome.recordCount)} records. Download each part below.`)
    } catch (failure) {
      if (controller.signal.aborted) setDownloadCancelled(true)
      else setDownloadError((failure as Error)?.message || 'The package could not be built.')
    } finally {
      if (downloadAbort.current === controller) {
        downloadAbort.current = undefined
        setDownloadProgress(undefined)
      }
    }
  }

  function toggle(key: string) {
    setLimitNotice(undefined)
    setSelection((state) => {
      const old = state.account === account && state.scope === scope ? state.keys : storedKeys(account, scope)
      if (old.includes(key)) {
        const next = old.filter((entry) => entry !== key)
        remember(next)
        return { account, scope, keys: next }
      }
      if (old.length >= MICRODATA_SURVEY_LIMIT) { setLimitNotice(key); return state }
      const next = [...old, key]
      remember(next)
      return { account, scope, keys: next }
    })
  }

  /*
   * Which steps the current state allows. A stored selection is not confirmed
   * until the inventory has answered, so while it is loading only the first
   * step is shown and the URL is left alone.
   */
  const ready = (step: FlowStep) => {
    if (step === 'surveys') return true
    if (step === 'options') return selected.length > 0
    if (step === 'review') return selected.length > 0 && !optionalBlocked
    if (step === 'licence') return selected.length > 0 && !optionalBlocked && checked
    return selected.length > 0 && !optionalBlocked && checked && licenceAccepted
  }
  const loaded = Boolean(result) && !request
  const current: FlowStep = loaded ? guardedStep(STEPS, requested, ready) : 'surveys'
  useEffect(() => {
    if (active && loaded && current !== requested) onStep?.(current, { replace: true })
  }, [active, current, loaded, onStep, requested])
  useStepHeadingFocus('microdata-step', current)

  // Review checks access by itself, once for each package configuration.
  useEffect(() => {
    if (!active || current !== 'review' || !selected.length || optionalBlocked) return
    if (checked || preflightAbort.current || preflightAttempted.current === fingerprint) return
    preflightAttempted.current = fingerprint
    void countSelected()
    // countSelected reads the current selection; the fingerprint identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, checked, current, fingerprint, optionalBlocked, selected.length])
  // Leaving Review, or the route, stops a check in progress. Coming back offers
  // Check again instead of restarting it.
  useEffect(() => {
    if (current !== 'review' || !active) preflightAbort.current?.abort()
  }, [active, current])

  /** After Review the licence step is skipped once it has been accepted in this visit. */
  const afterReview: FlowStep = licenceAccepted ? 'download' : 'licence'
  const go = (step: FlowStep) => onStep?.(step)

  const inventoryWarning = result && (pending > 0 || result.grantCheckFailed || result.master.unavailableSourceCount > 0)

  return (
    <section ref={inventory} id="step-microdata-package" className="microdata-flow" aria-labelledby="microdata-package-heading">
      <h2 id="microdata-package-heading" className="sr-only">Download household microdata</h2>
      {testMode && <p className="survey-limit-note">TEST DATA: simulated records for infrastructure review, not survey results.</p>}
      {(checking || grantChecking || !grantDiscovery) && <p role="status" className="package-status">{result ? 'Re-checking access… The current list may change.' : 'Checking the household surveys your account can access…'}</p>}
      {(error || grantDiscovery?.error) && <p className="package-error" role="alert">Access could not be fully checked. {error || grantDiscovery?.error} <button type="button" className="inline-action" onClick={recheck}>Check again</button></p>}
      {result && (
        <>
          <FlowStepList
            id="microdata-steps"
            steps={STEPS}
            current={current}
            done={(step) => step === 'licence' ? licenceAccepted : STEPS.indexOf(step) < STEPS.indexOf(current)}
            reachable={(step) => guardedStep(STEPS, step, ready) === step}
            onSelect={go}
          />
          <p className="flow-selection" aria-live="polite">
            {formatNumber(selected.length)} of up to {MICRODATA_SURVEY_LIMIT} surveys selected
            {selected.length > 0 && `: ${selected.slice(0, 4).map((survey) => `${survey.countryName} round ${survey.round}`).join(', ')}${selected.length > 4 ? ` and ${formatNumber(selected.length - 4)} more` : ''}`}
          </p>

          <FlowStepPanel id="microdata-step" step="surveys" current={current} title={<><span>1</span>Choose surveys</>}>
            {inventoryWarning && (
              <p className="package-blocker" role="status">Some household sources could not be checked, so this list may be incomplete. Saved choices have been kept. <button type="button" className="inline-action" onClick={recheck}>Check again</button></p>
            )}
            {surveys.length ? (
              <>
                <p>Household surveys your account can open. Each survey stays in its own folder; microdata from different surveys is never merged.</p>
                <div className="survey-filter-bar">
                  <label htmlFor="microdata-survey-search">Find a survey</label>
                  <input id="microdata-survey-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Country, code or round"/>
                  <label><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}/> Selected only</label>
                </div>
                <p className="survey-list-count">{formatNumber(selected.length)} survey{selected.length === 1 ? '' : 's'} selected · {formatNumber(visible.length)} shown</p>
                <fieldset className="microdata-survey-list">
                  <legend className="sr-only">Available household surveys</legend>
                  {countryGroups.map((group) => {
                    const iso3 = group[0].adm0Iso3
                    const open = Boolean(search.trim() || selectedOnly || countryGroups.length === 1) || openCountries.has(iso3)
                    return (
                      <details className="microdata-country" key={iso3} open={open || undefined}
                        onToggle={(event) => {
                          const isOpen = event.currentTarget.open
                          setOpenCountries((existing) => {
                            if (isOpen === existing.has(iso3)) return existing
                            const next = new Set(existing)
                            if (isOpen) next.add(iso3)
                            else next.delete(iso3)
                            return next
                          })
                        }}>
                        <summary><strong>{group[0].countryName}</strong><span>{iso3} · {formatNumber(group.length)} round{group.length === 1 ? '' : 's'} · {formatNumber(group.filter((survey) => keys.includes(survey.key)).length)} selected</span></summary>
                        {group.map((survey) => (
                          <div className="microdata-survey-row" key={survey.key}>
                            <label>
                              <input type="checkbox" checked={keys.includes(survey.key)} disabled={!exportEnabled(survey) || Boolean(downloadProgress)} aria-disabled={!keys.includes(survey.key) && keys.length >= MICRODATA_SURVEY_LIMIT || undefined}
                                aria-label={`${survey.countryName}, round ${survey.round}`} onChange={() => toggle(survey.key)}/>
                              <span><strong>Round {survey.round}</strong><small>{GENERATIONS[survey.generation].label}{survey.testData ? ' · Test data' : ''}{collectionDates?.get(`${survey.adm0Iso3}:${survey.round}`) ? ' · ' + collectionDates.get(`${survey.adm0Iso3}:${survey.round}`) : ''}</small></span>
                            </label>
                            <span>{!exportEnabled(survey) ? 'Explore only — bulk export not approved' : survey.generation === 'v3' ? 'Mandatory table' + (survey.components.some((part) => part.component === 'optional' && part.bulkExportEnabled) ? ' + optional available' : '') : 'Household table'}</span>
                            {limitNotice === survey.key && <p className="survey-row-limit" role="alert">One package holds at most {MICRODATA_SURVEY_LIMIT} surveys. Remove one to select this round.</p>}
                          </div>
                        ))}
                      </details>
                    )
                  })}
                  {!visible.length && <p className="survey-empty">No surveys match these filters.</p>}
                </fieldset>
              </>
            ) : <p className="survey-empty">{complete ? 'You currently have no access to microdata, or your access has expired.' : 'No household surveys have been confirmed yet.'}</p>}
            <FlowActions
              id="microdata-surveys"
              onNext={() => go('options')}
              nextDisabled={!ready('options')}
              nextLabel="Next: options"
              hint={ready('options') ? undefined : 'Select at least one survey to continue.'}
            />
          </FlowStepPanel>

          <FlowStepPanel id="microdata-step" step="options" current={current} title={<><span>2</span>Choose files</>}>
            {selected.length ? <>
              <p>Coded values and, for {GENERATIONS.v3.label} surveys, the mandatory table only are the defaults. Changing a choice here means access is checked again.</p>
              {selected.some((survey) => survey.generation === 'v3') && (
                <fieldset className="package-layout-choice">
                  <legend>{GENERATIONS.v3.label} tables</legend>
                  <div className="package-layout-options">
                    <label><input type="radio" name="microdata-v3-choice" checked={!includeOptional} disabled={Boolean(downloadProgress)} onChange={() => setIncludeOptional(false)}/><span><strong>Mandatory fields only</strong><small>One {GENERATIONS.v3.label} table per survey.</small></span></label>
                    <label><input type="radio" name="microdata-v3-choice" checked={includeOptional} disabled={Boolean(downloadProgress)} onChange={() => setIncludeOptional(true)}/><span><strong>Mandatory and optional fields</strong><small>Two separate {GENERATIONS.v3.label} tables per survey, joined by adm0_iso3 + round + survey_id.</small></span></label>
                  </div>
                </fieldset>
              )}
              {includeOptional && optionalUnusable.length > 0 && <p className="package-blocker" role="alert">Optional data is not available from the same authorized source for {optionalUnusable.map((survey) => `${survey.countryName} round ${survey.round}`).join(', ')}. Choose mandatory fields only or remove those surveys.</p>}
              <fieldset className="package-layout-choice">
                <legend>Values</legend>
                <div className="package-layout-options">
                  {([
                    ['codes', 'Coded values', 'As stored, e.g. 1, 2, 3. Pair with the codebook or value_labels.csv.'],
                    ['labels', 'Labels', 'Codes replaced by their labels in the same columns.'],
                    ['both', 'Both', 'A coded and a labelled CSV per table, same rows and order. Roughly doubles the package size.'],
                  ] as const).map(([option, title, hint]) => (
                    <label key={option}>
                      <input type="radio" name="microdata-values-choice" checked={values === option}
                        disabled={Boolean(downloadProgress) || (option !== 'codes' && unauditedTables.length > 0)}
                        onChange={() => setValuesChoice(option)}/>
                      <span><strong>{title}</strong><small>{hint}</small></span>
                    </label>
                  ))}
                </div>
                {unauditedTables.length > 0 && <p className="survey-limit-note">Labelled values are not yet available for the {unauditedTables.join(', ')}: {unauditedTables.length === 1 ? 'its' : 'their'} value labels have not passed the label audit. This package uses coded values.</p>}
              </fieldset>
            </> : <p>Select a survey first.</p>}
            <FlowActions
              id="microdata-options"
              onBack={() => go('surveys')}
              onNext={() => go('review')}
              nextDisabled={!ready('review')}
              nextLabel="Next: review"
              hint={ready('review') ? undefined : optionalBlocked ? 'Choose mandatory fields only, or remove the surveys named above.' : 'Select at least one survey to continue.'}
            />
          </FlowStepPanel>

          <FlowStepPanel id="microdata-step" step="review" current={current} title={<><span>3</span>Review and check access</>}>
            {selected.length ? <>
              <dl className="package-summary">
                <div><dt>Surveys</dt><dd>{formatNumber(selected.length)}</dd></div>
                <div><dt>Source tables</dt><dd>{formatNumber(sourceTables)}</dd></div>
                <div><dt>Data files</dt><dd>{formatNumber(outputFiles)} CSV{outputFiles === 1 ? '' : 's'} ({values === 'codes' ? 'coded values' : values === 'labels' ? 'labels' : 'coded and labelled'})</dd></div>
                <div><dt>Layout</dt><dd>One folder per survey</dd></div>
                <div><dt>Documentation</dt><dd>Field descriptions and codebook links for {selectedGenerations.map((generation) => GENERATIONS[generation].label).join(' and ')}{selectedGenerations.includes('v3') ? `; ${GENERATIONS.v3.label} documents are not yet published` : ''}</dd></div>
              </dl>
              <MicrodataDocumentation versions={selectedGenerations} />
              {/* The check starts by itself when this step opens. The buttons
                  are for stopping it, or for trying again after it failed or
                  was stopped; a failure never restarts it on its own. */}
              <div className="package-actions">
                {preflightProgress
                  ? <button type="button" className="package-cancel" onClick={() => preflightAbort.current?.abort()}>Cancel check</button>
                  : <button type="button" disabled={Boolean(downloadProgress) || optionalBlocked} onClick={() => { preflightAttempted.current = fingerprint; void countSelected() }}>{checked ? 'Check access again' : 'Check access and count records'}</button>}
              </div>
              <p className="package-status" aria-live="polite">{preflightProgress
                ? `Checking access: step ${formatNumber(Math.min(preflightProgress.done + 1, preflightProgress.total))} of ${formatNumber(preflightProgress.total)}${preflightProgress.label ? ` — ${preflightProgress.label}` : ''}`
                : ''}</p>
              {checkFailed && <p ref={failureMessage} tabIndex={-1} className="package-error" role="alert">{preflightError!.message} Your selection has been kept.</p>}
              {preflightCancelled === fingerprint && !preflightProgress && <p className="package-outcome" role="status">The check was stopped before it finished. Check again to continue.</p>}
              {checked && <p className="package-ready" role="status">Access confirmed: {formatNumber(preflight!.records)} records from {formatNumber(preflight!.tables)} table{preflight!.tables === 1 ? '' : 's'}, written as {formatNumber(preflight!.files)} CSV file{preflight!.files === 1 ? '' : 's'}.{preflight!.estimatedBytes !== undefined && ` Estimated CSV size: about ${formatNumber(Math.ceil(preflight!.estimatedBytes / 1_000_000))} MB, from a sample with a 20% margin.`}</p>}
              <p className="survey-limit-note">The download is prepared in parts, each holding whole surveys: up to {formatNumber(MICRODATA_PACKAGE_BUDGET.records)} source records, {formatNumber(MICRODATA_PACKAGE_BUDGET.uncompressedBytes / 1_000_000)} MB of uncompressed CSV and {formatNumber(MICRODATA_PACKAGE_BUDGET.sourceTables)} source tables per part. The parts are decided from the actual file sizes while preparing, so their number can differ from this estimate. A single survey above these limits cannot be packaged.</p>
            </> : <p>Select a survey first.</p>}
            <FlowActions
              id="microdata-review"
              onBack={() => go('options')}
              onNext={() => go(afterReview)}
              nextDisabled={!ready('licence')}
              nextLabel={licenceAccepted ? 'Next: download' : 'Next: licence'}
              hint={ready('licence') ? undefined : preflightProgress ? 'Checking access. Please wait.' : 'Access must be confirmed for this package before you continue.'}
            />
          </FlowStepPanel>

          <FlowStepPanel id="microdata-step" step="licence" current={current} title={<><span>4</span>Accept the microdata licence</>}>
            <MicrodataLicence access={licenceAccess}/>
            <label className="licence-accept">
              <input type="checkbox" checked={licenceAccepted} onChange={(event) => setLicenceAccepted(event.target.checked)}/>
              <span>I have read the microdata licence and accept its conditions for the data in this package.</span>
            </label>
            <FlowActions
              id="microdata-licence"
              onBack={() => go('review')}
              onNext={() => go('download')}
              nextDisabled={!ready('download')}
              nextLabel="Next: download"
              hint={licenceAccepted ? undefined : 'Accept the licence to continue.'}
            />
          </FlowStepPanel>

          <FlowStepPanel id="microdata-step" step="download" current={current} title={<><span>5</span>Prepare and download</>}>
            <p>Preparing reads the household records again, under your current access, and packages them in your browser. Nothing is downloaded until you start it.</p>
            <div className="package-actions">
              <button ref={downloadButton} type="button" className="package-download" disabled={!downloadReady} aria-describedby="microdata-download-hint" onClick={() => void downloadPackage()}>
                {downloadProgress ? 'Preparing microdata parts…' : 'Prepare microdata downloads'}
              </button>
              {downloadProgress && <button type="button" onClick={() => downloadAbort.current?.abort()}>Cancel preparation</button>}
            </div>
            <p id="microdata-download-hint" className="download-hint" aria-live="polite">{downloadHint}</p>
            {downloadProgress && <p className="package-status" role="status">{downloadProgress.stage.replace('-', ' ')}{downloadProgress.label ? ` — ${downloadProgress.label}` : ''}{downloadProgress.total > 1 ? ` (${downloadProgress.completed} of ${downloadProgress.total})` : ''}</p>}
            {downloadError && <p ref={failureMessage} tabIndex={-1} className="package-error" role="alert">Preparation stopped. {downloadError} Your selection has been kept. Any completed parts remain available below.</p>}
            {downloadCancelled && <p className="package-outcome" role="status">Preparation was cancelled. Any completed parts remain available below; no partial survey is offered.</p>}
            {downloadOutcome && <p className="package-outcome" role="status">{downloadOutcome}</p>}
            {parts.length > 0 && <div aria-label="Prepared microdata parts">
              {parts.map((part) => <div className="package-actions" key={part.partNumber}>
                <a className="package-part-download" href={part.url} download={part.fileName}
                  onClick={() => setParts((existing) => existing.map((entry) => entry.partNumber === part.partNumber ? { ...entry, requested: true } : entry))}>Download part {part.partNumber}</a>
                {' '}{formatNumber(part.recordCount)} records in {part.fileCount} data files · {part.requested ? 'Download requested — check your browser' : 'Ready'}
              </div>)}
              <div className="package-actions"><button type="button" disabled={Boolean(downloadProgress)} onClick={clearParts}>Clear prepared parts</button></div>
            </div>}
            <details className="microdata-help"><summary>Microdata licence (accepted)</summary><MicrodataLicence access={licenceAccess}/></details>
            <FlowActions id="microdata-download" onBack={() => go('review')} backLabel="Back to review"/>
          </FlowStepPanel>
        </>
      )}
      {!result && <MicrodataLicence access={licenceAccess}/>}
      <p><Link to="/data/microdata-request">Need access to another survey? Request direct access.</Link></p>
    </section>
  )
}
