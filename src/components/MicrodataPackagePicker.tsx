import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { MicrodataLicence, type MicrodataAccess } from './MicrodataLicence'
import { formatNumber } from '../lib/format'
import { MICRODATA_PACKAGE_BUDGET, MICRODATA_SURVEY_LIMIT, buildMicrodataBundle, outputFilesPerTable, preflightMicrodataPackage } from '../services/microdataBundle'
import { componentHasAudit, type MicrodataValues } from '../services/microdataLabels'
import type { BundleProgress } from '../services/surveyBundle'
import { type GrantDiscovery } from '../services/microdataGrants'
import { discoverMicrodataAccess, type MicrodataAccessResult } from '../services/microdataSurveyAccess'
import { GENERATIONS } from '../services/protectedData'

const STORAGE_PREFIX = 'diem.microdata-selection.v1'

function storedKeys(account: string, scope: string): string[] {
  if (!account) return []
  try {
    const value = JSON.parse(sessionStorage.getItem(`${STORAGE_PREFIX}.${account}.${scope}`) || '[]')
    return Array.isArray(value) ? [...new Set(value.filter((key): key is string => typeof key === 'string'))].slice(0, MICRODATA_SURVEY_LIMIT) : []
  } catch { return [] }
}

/** The temporary-grant list owns grant discovery; this picker receives the same live result. */
export function MicrodataPackagePicker({ grantDiscovery, grantChecking, householdData, contributor, testMode, licenceAccess, onLoadingChange }: {
  grantDiscovery?: GrantDiscovery
  grantChecking: boolean
  householdData: boolean
  contributor: boolean
  testMode: boolean
  licenceAccess: MicrodataAccess
  onLoadingChange?: (loading: boolean) => void
}) {
  const auth = useAuth()
  const account = auth.user?.username || ''
  const scope = testMode ? 'test' : 'production'
  const [result, setResult] = useState<MicrodataAccessResult>()
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string>()
  const [retry, setRetry] = useState(0)
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
  const [preflight, setPreflight] = useState<{ fingerprint: string; records: number; tables: number; files: number }>()
  const [preflightError, setPreflightError] = useState<string>()
  const [preflightProgress, setPreflightProgress] = useState<{ done: number; total: number }>()
  const [downloadProgress, setDownloadProgress] = useState<BundleProgress>()
  const [downloadError, setDownloadError] = useState<string>()
  const [downloadOutcome, setDownloadOutcome] = useState<string>()
  const [downloadCancelled, setDownloadCancelled] = useState(false)
  const preflightAbort = useRef<AbortController | undefined>(undefined)
  const downloadAbort = useRef<AbortController | undefined>(undefined)
  const licenceSummary = useRef<HTMLElement | null>(null)
  const downloadButton = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    setLicenceAccepted(false)
    setLicenceOpen(false)
  }, [account])

  useEffect(() => {
    onLoadingChange?.(grantChecking || !grantDiscovery || checking || (!result && !error))
  }, [checking, error, grantChecking, grantDiscovery, onLoadingChange, result])

  function remember(next: string[]) {
    if (!account) return
    try { sessionStorage.setItem(`${STORAGE_PREFIX}.${account}.${scope}`, JSON.stringify(next)) } catch { /* optional convenience */ }
  }

  useEffect(() => {
    if (auth.status !== 'authenticated' || !grantDiscovery || grantChecking) {
      setResult(undefined)
      return
    }
    const controller = new AbortController()
    setChecking(true)
    setError(undefined)
    setResult(undefined)
    void discoverMicrodataAccess(auth.requestProtected, grantDiscovery.bundles, {
      contributor, householdData, includeTestData: testMode, signal: controller.signal,
    }).then(setResult).catch((failure: unknown) => {
      if (!controller.signal.aborted) setError((failure as Error)?.message || 'Microdata access could not be checked.')
    }).finally(() => { if (!controller.signal.aborted) setChecking(false) })
    return () => controller.abort()
  }, [auth.requestProtected, auth.status, contributor, grantChecking, grantDiscovery, householdData, retry, testMode])

  const surveys = useMemo(() => (result?.surveys || []).filter((survey) => survey.testData === testMode), [result, testMode])
  const exportEnabled = (survey: (typeof surveys)[number]) => survey.components.some((part) => (
    part.component === (survey.generation === 'v3' ? 'mandatory' : 'household') && part.bulkExportEnabled
  ))
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
    sources: selected.flatMap((survey) => survey.components.map((part) => `${survey.key}:${part.itemId}:${part.grantId || ''}:${part.bulkExportEnabled}`)),
  })

  const checked = preflight?.fingerprint === fingerprint
  const optionalBlocked = Boolean(optionalUnusable.length && includeOptional)
  const downloadReady = checked && licenceAccepted && !optionalBlocked && !downloadProgress && !preflightProgress
  let downloadHint = 'Ready to download.'
  if (!selected.length) downloadHint = 'Select at least one survey to build a package.'
  else if (optionalBlocked) downloadHint = 'Resolve the optional-table issue above first.'
  else if (downloadProgress) downloadHint = 'Building your package. You can cancel the download below.'
  else if (preflightProgress) downloadHint = 'Checking access and counting records. Please wait.'
  else if (preflightError) downloadHint = 'The access check failed. Read the message above, then check again.'
  else if (!checked && !licenceAccepted) downloadHint = 'Check access above, then open and accept the microdata licence.'
  else if (!checked) downloadHint = 'Check access and count records above to continue.'
  else if (!licenceAccepted) downloadHint = 'Open the microdata licence above and accept it to download.'

  useEffect(() => () => preflightAbort.current?.abort(), [fingerprint])
  useEffect(() => () => downloadAbort.current?.abort(), [fingerprint])
  useEffect(() => {
    setPreflight(undefined)
    setPreflightError(undefined)
    setDownloadError(undefined)
    setDownloadOutcome(undefined)
    setDownloadCancelled(false)
  }, [fingerprint])

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
        onProgress: (progress) => setPreflightProgress({ done: progress.completed, total: progress.total }),
      })
      if (!controller.signal.aborted) setPreflight({ fingerprint, records: result.recordCount, tables: result.sourceTableCount, files: result.outputFileCount })
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
    const controller = new AbortController()
    downloadAbort.current = controller
    setDownloadError(undefined)
    setDownloadOutcome(undefined)
    setDownloadCancelled(false)
    setDownloadProgress({ stage: 'preparing', completed: 0, total: sourceTables })
    try {
      const bundle = await buildMicrodataBundle({
        surveys: selected, includeV3Optional: includeOptional, contributor, values,
        requester: auth.requestProtected,
        budget: MICRODATA_PACKAGE_BUDGET, signal: controller.signal,
        onProgress: setDownloadProgress,
      })
      const url = URL.createObjectURL(bundle.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = bundle.fileName
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setDownloadOutcome(`${bundle.fileName} downloaded with ${formatNumber(bundle.recordCount)} records in ${formatNumber(bundle.fileCount)} data file${bundle.fileCount === 1 ? '' : 's'}.`)
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
    <section className="workspace-step" aria-labelledby="step-microdata-package">
      <h2 id="step-microdata-package">Build a microdata package</h2>
      <p>Select up to {MICRODATA_SURVEY_LIMIT} household surveys available to your account. Each survey remains in its own folder; microdata from different surveys is never merged.</p>
      {testMode && <p className="survey-limit-note">TEST DATA: simulated records for infrastructure review, not survey results.</p>}
      {(checking || grantChecking || !grantDiscovery) && <p role="status">Checking the household surveys your account can access…</p>}
      {(error || grantDiscovery?.error) && <p className="package-error" role="alert">Access could not be fully checked. {error || grantDiscovery?.error} <button type="button" onClick={() => setRetry((value) => value + 1)}>Check again</button></p>}
      {result && !checking && (
        <>
          {(pending > 0 || result.grantCheckFailed || result.master.unavailableSourceCount > 0) && (
            <p className="package-blocker" role="status">Some household sources could not be checked. The list may be incomplete; saved choices have been kept. <button type="button" onClick={() => setRetry((value) => value + 1)}>Check again</button></p>
          )}
          {surveys.length ? (
            <>
              <div className="survey-filter-bar">
                <label htmlFor="microdata-survey-search">Find a survey</label>
                <input id="microdata-survey-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Country, code or round"/>
                <label><input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}/> Selected only</label>
              </div>
              <p className="survey-list-count">{formatNumber(selected.length)} of {MICRODATA_SURVEY_LIMIT} surveys selected · {formatNumber(visible.length)} shown</p>
              <fieldset className="microdata-survey-list">
                <legend className="sr-only">Available household surveys</legend>
                {countryGroups.map((group) => (
                  <details className="microdata-country" key={group[0].adm0Iso3} open={Boolean(search.trim() || selectedOnly) || undefined}>
                    <summary><strong>{group[0].countryName}</strong><span>{group[0].adm0Iso3} · {formatNumber(group.length)} round{group.length === 1 ? '' : 's'} · {formatNumber(group.filter((survey) => keys.includes(survey.key)).length)} selected</span></summary>
                    {group.map((survey) => (
                      <div className="microdata-survey-row" key={survey.key}>
                        <label>
                          <input type="checkbox" checked={keys.includes(survey.key)} disabled={!exportEnabled(survey) || Boolean(downloadProgress)} aria-disabled={!keys.includes(survey.key) && keys.length >= MICRODATA_SURVEY_LIMIT || undefined} onChange={() => toggle(survey.key)}/>
                          <span><strong>Round {survey.round}</strong><small>{GENERATIONS[survey.generation].label}{survey.testData ? ' · Test data' : ''}</small></span>
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
          ) : <p className="survey-empty">{complete ? 'No household surveys are currently available to this account. You can browse published collections in FAM or request access.' : 'No household surveys have been confirmed yet.'}</p>}
          <div className="microdata-package-review">
            <h3>Review your package</h3>
            {selected.length ? <>
              {selected.some((survey) => survey.generation === 'v3') && (
                <fieldset className="package-layout-choice">
                  <legend>V3 tables</legend>
                  <div className="package-layout-options">
                    <label><input type="radio" name="microdata-v3-choice" checked={!includeOptional} disabled={Boolean(downloadProgress)} onChange={() => setIncludeOptional(false)}/><span><strong>Mandatory fields only</strong><small>One V3 table per survey.</small></span></label>
                    <label><input type="radio" name="microdata-v3-choice" checked={includeOptional} disabled={Boolean(downloadProgress)} onChange={() => setIncludeOptional(true)}/><span><strong>Mandatory and optional fields</strong><small>Two separate V3 tables per survey, joined by survey_id + hh_id.</small></span></label>
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
              <dl className="package-summary">
                <div><dt>Surveys</dt><dd>{formatNumber(selected.length)}</dd></div>
                <div><dt>Tables read</dt><dd>{formatNumber(sourceTables)} of {formatNumber(MICRODATA_PACKAGE_BUDGET.sourceTables)}</dd></div>
                <div><dt>Data files</dt><dd>{formatNumber(outputFiles)} CSV{outputFiles === 1 ? '' : 's'}</dd></div>
                <div><dt>Layout</dt><dd>One folder per survey</dd></div>
                <div><dt>Documentation</dt><dd>Version-matched field descriptions and codebook links; V3 documents are not yet published</dd></div>
              </dl>
              <div className="package-actions"><button type="button" disabled={Boolean(preflightProgress || downloadProgress) || Boolean(optionalUnusable.length && includeOptional)} onClick={() => void countSelected()}>Check access and count records</button><button type="button" disabled={!preflightProgress} onClick={() => preflightAbort.current?.abort()}>Cancel check</button></div>
              {preflightProgress && <p className="package-status" role="status">Checking {formatNumber(preflightProgress.done)} of {formatNumber(preflightProgress.total)} tables…</p>}
              {preflightError && <p className="package-error" role="alert">{preflightError} Your selection has been kept.</p>}
              {preflight?.fingerprint === fingerprint && <p className="package-ready" role="status">Access confirmed: {formatNumber(preflight.records)} records from {formatNumber(preflight.tables)} table{preflight.tables === 1 ? '' : 's'}, written as {formatNumber(preflight.files)} CSV file{preflight.files === 1 ? '' : 's'}.</p>}
              <p className="package-blocker">One package can hold up to {formatNumber(MICRODATA_PACKAGE_BUDGET.records)} records and {formatNumber(MICRODATA_PACKAGE_BUDGET.uncompressedBytes / 1_000_000)} MB of CSV data. The final byte limit is checked while building; if it is exceeded, no partial archive is downloaded.</p>
            </> : <p>Select a survey to review the package.</p>}
          </div>
        </>
      )}
      {surveys.length > 0 ? (
        <div className="microdata-download-actions" aria-labelledby="microdata-download-heading">
          <h3 id="microdata-download-heading">Download</h3>
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
                if (event.target.checked) {
                  setLicenceOpen(false)
                  requestAnimationFrame(() => {
                    if (checked) downloadButton.current?.focus()
                    else licenceSummary.current?.focus()
                  })
                }
              }}/>
              <span>I have read the microdata licence and accept its conditions for the data in this package.</span>
            </label>
          </details>
          <div className="package-actions">
            <button ref={downloadButton} type="button" className="package-download" disabled={!downloadReady} aria-describedby="microdata-download-hint" onClick={() => void downloadPackage()}>
              {downloadProgress ? 'Building microdata package…' : 'Download microdata package'}
            </button>
            {downloadProgress && <button type="button" onClick={() => downloadAbort.current?.abort()}>Cancel download</button>}
          </div>
          <p id="microdata-download-hint" className="download-hint" aria-live="polite">{downloadHint}</p>
          {downloadProgress && <p className="package-status" role="status">{downloadProgress.stage.replace('-', ' ')}{downloadProgress.label ? ` — ${downloadProgress.label}` : ''}{downloadProgress.total > 1 ? ` (${downloadProgress.completed} of ${downloadProgress.total})` : ''}</p>}
          {downloadError && <p className="package-error" role="alert">The package was not created. {downloadError} Your selection has been kept.</p>}
          {downloadCancelled && <p className="package-outcome" role="status">The package was cancelled. Nothing was downloaded, and your selection has been kept.</p>}
          {downloadOutcome && <p className="package-outcome" role="status">{downloadOutcome}</p>}
        </div>
      ) : <MicrodataLicence access={licenceAccess}/>}
      <p><Link to="/data/microdata-request">Need access to another survey? Request direct access.</Link></p>
    </section>
  )
}
