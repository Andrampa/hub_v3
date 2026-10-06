import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MicrodataDocumentation } from './MicrodataDocumentation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { MicrodataLicence, type MicrodataAccess } from './MicrodataLicence'
import { formatNumber } from '../lib/format'
import { MICRODATA_PACKAGE_BUDGET, MICRODATA_SURVEY_LIMIT, buildMicrodataParts, type MicrodataPart, outputFilesPerTable, preflightMicrodataPackage } from '../services/microdataBundle'
import { componentHasAudit, type MicrodataValues } from '../services/microdataLabels'
import type { BundleProgress } from '../services/surveyBundle'
import { type GrantDiscovery } from '../services/microdataGrants'
import { discoverMicrodataAccess, microdataSourceFingerprint, type MicrodataAccessResult } from '../services/microdataSurveyAccess'
import { GENERATIONS } from '../services/protectedData'

const STORAGE_PREFIX = 'diem.microdata-selection.v1'

function storedKeys(account: string, scope: string): string[] {
  if (!account) return []
  try {
    const value = JSON.parse(sessionStorage.getItem(`${STORAGE_PREFIX}.${account}.${scope}`) || '[]')
    return Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === 'string'))].slice(0, MICRODATA_SURVEY_LIMIT) : []
  } catch { return [] }
}

/** The workspace owns grant discovery; its promise lets independent inventory checks start early. */
export function MicrodataPackagePicker({ grantDiscovery, grantPending, grantChecking, householdData, contributor, testMode, licenceAccess, collectionDates, onLoadingChange, onBusyChange, onRecheck }: {
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
  const [includeOptional, setIncludeOptional] = useState(false)
  const [valuesChoice, setValuesChoice] = useState<MicrodataValues>('codes')
  // Acknowledged once per visit; the terms are the same for every package.
  const [licenceAccepted, setLicenceAccepted] = useState(false)
  const [licenceOpen, setLicenceOpen] = useState(false)
  const [limitNotice, setLimitNotice] = useState<string>()
  const [preflight, setPreflight] = useState<{ fingerprint: string; records: number; tables: number; files: number; estimatedBytes?: number }>()
  const [preflightError, setPreflightError] = useState<string>()
  const [preflightProgress, setPreflightProgress] = useState<{ done: number; total: number }>()
  const [downloadProgress, setDownloadProgress] = useState<BundleProgress>()
  const [downloadError, setDownloadError] = useState<string>()
  const [downloadOutcome, setDownloadOutcome] = useState<string>()
  const [downloadCancelled, setDownloadCancelled] = useState(false)
  const [parts, setParts] = useState<Array<MicrodataPart & { url: string; requested: boolean }>>([])
  const partUrls = useRef<string[]>([])
  const failureMessage = useRef<HTMLParagraphElement | null>(null)
  const preflightAbort = useRef<AbortController | undefined>(undefined)
  const downloadAbort = useRef<AbortController | undefined>(undefined)
  const licenceSummary = useRef<HTMLElement | null>(null)
  const downloadButton = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setLicenceAccepted(false)
    setLicenceOpen(false)
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

  function remember(next: string[]) {
    if (!account) return
    try { sessionStorage.setItem(`${STORAGE_PREFIX}.${account}.${scope}`, JSON.stringify(next)) } catch { /* optional convenience */ }
  }

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

  const selectionFingerprint = JSON.stringify({ account, status: auth.status, scope, includeOptional, values, keys: [...keys].sort() })
  const checked = preflight?.fingerprint === fingerprint
  const optionalBlocked = Boolean(optionalUnusable.length && includeOptional)
  const downloadReady = checked && licenceAccepted && !optionalBlocked && !downloadProgress && !preflightProgress
  let downloadHint = 'Ready to prepare download parts.'
  if (!selected.length) downloadHint = 'Select at least one survey to build a package.'
  else if (optionalBlocked) downloadHint = 'Resolve the optional-table issue above first.'
  else if (downloadProgress) downloadHint = 'Preparing your files. You can cancel preparation below.'
  else if (preflightProgress) downloadHint = 'Checking access and counting records. Please wait.'
  else if (preflightError) downloadHint = 'The access check failed. Read the message above, then check again.'
  else if (downloadError) downloadHint = 'Preparation failed. Read the error below; completed parts remain available.'
  else if (!checked && !licenceAccepted) downloadHint = 'Check access above, then open and accept the microdata licence.'
  else if (!checked) downloadHint = 'Check access and count records above to continue.'
  else if (!licenceAccepted) downloadHint = 'Open the microdata licence above and accept it to download.'
  else if (parts.length) downloadHint = 'Download the prepared parts below. Preparing again replaces them.'

  useEffect(() => () => preflightAbort.current?.abort(), [fingerprint])
  useEffect(() => () => downloadAbort.current?.abort(), [fingerprint])
  useEffect(() => {
    setPreflight(undefined)
    setPreflightError(undefined)
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
    if (downloadError || preflightError) {
      failureMessage.current?.focus()
      failureMessage.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    }
  }, [downloadError, preflightError])

  async function countSelected() {
    const controller = new AbortController()
    preflightAbort.current = controller
    setPreflight(undefined)
    setPreflightError(undefined)
    setPreflightProgress({ done: 0, total: sourceTables })
    try {
      const result = await preflightMicrodataPackage({
        surveys: selected, includeV3Optional: includeOptional, contributor, values,
        requester: auth.requestProtected, budget: MICRODATA_PACKAGE_BUDGET, signal: controller.signal,
        splitParts: true, estimateSize: true,
        onProgress: (progress) => setPreflightProgress({ done: progress.completed, total: progress.total }),
      })
      if (!controller.signal.aborted) setPreflight({ fingerprint, records: result.recordCount, tables: result.sourceTableCount, files: result.outputFileCount, estimatedBytes: result.estimatedBytes })
    } catch (failure) {
      if (!controller.signal.aborted) setPreflightError((failure as Error)?.message || 'The package could not be checked.')
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

  return (
    <section ref={inventory} id="step-microdata-package" className="workspace-step" aria-labelledby="microdata-package-heading">
      <h2 id="microdata-package-heading">Download household microdata</h2>
      <p>Select household surveys available to your account. Each survey remains in its own folder; microdata from different surveys is never merged.</p>

      <MicrodataDocumentation versions={surveys.map((survey) => survey.generation)} />
      {testMode && <p className="survey-limit-note">TEST DATA: simulated records for infrastructure review, not survey results.</p>}
      {(checking || grantChecking || !grantDiscovery) && <p role="status">{result ? 'Re-checking access… The current list may change.' : 'Checking the household surveys your account can access…'}</p>}
      {(error || grantDiscovery?.error) && <p className="package-error" role="alert">Access could not be fully checked. {error || grantDiscovery?.error} <button type="button" onClick={recheck}>Check again</button></p>}
      {result && (
        <>
          {(pending > 0 || result.grantCheckFailed || result.master.unavailableSourceCount > 0) && (
            <p className="package-blocker" role="status">Some household sources could not be checked. The list may be incomplete; saved choices have been kept. <button type="button" onClick={recheck}>Check again</button></p>
          )}
          {surveys.length ? (
            <>
              <h3 className="microdata-step-title"><span aria-hidden="true">1</span> Choose surveys</h3>
              <div className="survey-filter-bar">
                <label htmlFor="microdata-survey-search">Find a survey</label>
                <input id="microdata-survey-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Country, code or round"/>
                <label><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}/> Selected only</label>
              </div>
              <p className="survey-list-count">{formatNumber(selected.length)} survey{selected.length === 1 ? '' : 's'} selected · {formatNumber(visible.length)} shown</p>
              <fieldset className="microdata-survey-list">
                <legend className="sr-only">Available household surveys</legend>
                {countryGroups.map((group) => (
                  <details className="microdata-country" key={group[0].adm0Iso3} open={Boolean(search.trim() || selectedOnly || countryGroups.length === 1) || undefined}>
                    <summary><strong>{group[0].countryName}</strong><span>{group[0].adm0Iso3} · {formatNumber(group.length)} round{group.length === 1 ? '' : 's'} · {formatNumber(group.filter((survey) => keys.includes(survey.key)).length)} selected</span></summary>
                    {group.map((survey) => (
                      <div className="microdata-survey-row" key={survey.key}>
                        <label>
                          <input type="checkbox" checked={keys.includes(survey.key)} disabled={!exportEnabled(survey) || Boolean(downloadProgress)} aria-disabled={!keys.includes(survey.key) && keys.length >= MICRODATA_SURVEY_LIMIT || undefined} onChange={() => toggle(survey.key)}/>
                          <span><strong>Round {survey.round}</strong><small>{GENERATIONS[survey.generation].label}{survey.testData ? ' · Test data' : ''}{collectionDates?.get(`${survey.adm0Iso3}:${survey.round}`) ? ' · ' + collectionDates.get(`${survey.adm0Iso3}:${survey.round}`) : ''}</small></span>
                        </label>
                        <span>{!exportEnabled(survey) ? 'Explore only — bulk export not approved' : survey.generation === 'v3' ? 'Mandatory table' + (survey.components.some((part) => part.component === 'optional' && part.bulkExportEnabled) ? ' + optional available' : '') : 'Household table'}</span>
                        {limitNotice === survey.key && <p className="survey-row-limit" role="alert">One package holds at most {MICRODATA_SURVEY_LIMIT} surveys. Remove one to select this round.</p>}
                      </div>
                    ))}
                  </details>
                ))}
                {!visible.length && <p className="survey-empty">No surveys match these filters.</p>}
              </fieldset>
            </>
          ) : <p className="survey-empty">{complete ? 'You currently have no access to microdata, or your access has expired.' : 'No household surveys have been confirmed yet.'}</p>}
          <div className="microdata-package-review">
            <h3 className="microdata-step-title"><span aria-hidden="true">2</span> Choose files and check access</h3>
            {selected.length ? <>
              {selected.some((survey) => survey.generation === 'v3') && (
                <fieldset className="package-layout-choice">
                  <legend>V3 tables</legend>
                  <div className="package-layout-options">
                    <label><input type="radio" name="microdata-v3-choice" checked={!includeOptional} disabled={Boolean(downloadProgress)} onChange={() => setIncludeOptional(false)}/><span><strong>Mandatory fields only</strong><small>One V3 table per survey.</small></span></label>
                    <label><input type="radio" name="microdata-v3-choice" checked={includeOptional} disabled={Boolean(downloadProgress)} onChange={() => setIncludeOptional(true)}/><span><strong>Mandatory and optional fields</strong><small>Two separate V3 tables per survey, joined by adm0_iso3 + round + survey_id.</small></span></label>
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
              <MicrodataDocumentation versions={selected.map((survey) => survey.generation)} />
              <dl className="package-summary">
                <div><dt>Surveys</dt><dd>{formatNumber(selected.length)}</dd></div>
                <div><dt>Tables read</dt><dd>{formatNumber(sourceTables)} of {formatNumber(MICRODATA_PACKAGE_BUDGET.sourceTables)}</dd></div>
                <div><dt>Data files</dt><dd>{formatNumber(outputFiles)} CSV{outputFiles === 1 ? '' : 's'}</dd></div>
                <div><dt>Layout</dt><dd>One folder per survey</dd></div>
                <div><dt>Documentation</dt><dd>Version-matched field descriptions and codebook links; V3 documents are not yet published</dd></div>
              </dl>
              <div className="package-actions"><button type="button" disabled={Boolean(preflightProgress || downloadProgress) || Boolean(optionalUnusable.length && includeOptional)} onClick={() => void countSelected()}>Check access and count records</button><button type="button" disabled={!preflightProgress} onClick={() => preflightAbort.current?.abort()}>Cancel check</button></div>
              {preflightProgress && <p className="package-status" role="status">Checking {formatNumber(preflightProgress.done)} of {formatNumber(preflightProgress.total)} tables…</p>}
              {preflightError && <p ref={failureMessage} tabIndex={-1} className="package-error" role="alert">{preflightError} Your selection has been kept.</p>}
              {preflight?.fingerprint === fingerprint && <p className="package-ready" role="status">Access confirmed: {formatNumber(preflight.records)} records from {formatNumber(preflight.tables)} table{preflight.tables === 1 ? '' : 's'}, written as {formatNumber(preflight.files)} CSV file{preflight.files === 1 ? '' : 's'}.</p>}
              {checked && preflight?.estimatedBytes !== undefined && <p role="status">Estimated CSV size: about {formatNumber(Math.ceil(preflight.estimatedBytes / 1_000_000))} MB. This sample-based estimate includes a 20% margin; actual sizes determine the parts.</p>}
              <p className="package-blocker">Each part holds up to {formatNumber(MICRODATA_PACKAGE_BUDGET.records)} records and {formatNumber(MICRODATA_PACKAGE_BUDGET.uncompressedBytes / 1_000_000)} MB of CSV data. Larger selections split into parts containing whole surveys. A single survey must fit within these limits.</p>
            </> : <p>Select a survey to review the package.</p>}
          </div>
        </>
      )}
      {surveys.length > 0 ? (
        <div className="microdata-download-actions" aria-labelledby="microdata-download-heading">
          <h3 id="microdata-download-heading" className="microdata-step-title"><span aria-hidden="true">3</span> Accept the licence and download</h3>
          <ol className="download-checklist">
            <li className={selected.length ? 'is-done' : undefined}><span className="download-checklist-number" aria-hidden="true">{selected.length ? '✓' : '1'}</span>Select surveys</li>
            <li className={checked ? 'is-done' : undefined}><span className="download-checklist-number" aria-hidden="true">{checked ? '✓' : '2'}</span>Check access</li>
            <li className={licenceAccepted ? 'is-done' : undefined}><span className="download-checklist-number" aria-hidden="true">{licenceAccepted ? '✓' : '3'}</span>Accept the licence</li>
          </ol>
          <details className="licence-disclosure" open={licenceOpen} onToggle={(event) => setLicenceOpen(event.currentTarget.open)}>
            <summary ref={licenceSummary}>
              <span className="licence-disclosure-mark" aria-hidden="true">{licenceAccepted ? '✓' : '§'}</span>
              <span>
                <strong>{licenceAccepted ? 'Microdata licence accepted' : 'Read and accept the microdata licence'}</strong>
                <small>Confidentiality, research and statistical use only, no redistribution, citation.</small>
              </span>
              <span className="licence-disclosure-toggle">{licenceOpen ? 'Hide' : licenceAccepted ? 'Review' : 'Open'}</span>
            </summary>
            <MicrodataLicence access={licenceAccess}/>
            <label className="licence-accept">
              <input type="checkbox" checked={licenceAccepted} onChange={(event) => {
                setLicenceAccepted(event.target.checked)
              }}/>
              <span>I have read the microdata licence and accept its conditions for the data in this package.</span>
            </label>
          </details>
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
        </div>
      ) : <MicrodataLicence access={licenceAccess}/>}
      <p><Link to="/data/microdata-request">Need access to another survey? Request direct access.</Link></p>
    </section>
  )
}
