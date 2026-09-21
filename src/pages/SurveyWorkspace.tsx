import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import '../survey-workspace.css'
import { useAuth } from '../auth/AuthContext'
import { GRANTS_SECTION_ID } from '../components/MicrodataInvitationDialog'
import { MicrodataLicence, type MicrodataAccess } from '../components/MicrodataLicence'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { TemporaryMicrodataGrants } from '../components/TemporaryMicrodataGrants'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { formatNumber } from '../lib/format'
import {
  DATA_PORTAL,
  DOCUMENTATION_RESOURCES,
  GENERATIONS,
  MICRODATA_RESOURCES,
  REFERENCE_RESOURCES,
  resolveProtectedResource,
  type DataGeneration,
  type ResolvedDataResource,
} from '../services/protectedData'

import {
  buildSurveyBundle,
  bundleFileName,
  isBundleCancelled,
  packageBudgetProblem,
  PACKAGE_BUDGETS,
  type BundleProgress,
} from '../services/surveyBundle'
import {
  countSurveySlices,
  discoverAggregatedSurveys,
  type AvailableSurvey,
  type SurveyDiscoveryResult,
  type SurveySliceCount,
  type SurveySourceResult,
} from '../services/surveyAccess'

const FAM_URL = 'https://microdata.fao.org/index.php/catalog/Emergencies-Monitoring-Surveys/?page=1&sort_by=popularity&sort_order=desc&ps=15&repo=Emergencies-Monitoring-Surveys'

/** Community members build a package from at most this many surveys. */
const SELECTION_LIMIT = 10

const SELECTION_STORAGE_KEY = 'diem.survey-selection'
const SELECTION_SCHEMA_VERSION = 1

type WorkspaceMode = 'aggregated' | 'microdata'
type SelectionScope = 'production' | 'test'

/** Named stages, so a long build says what it is doing rather than only spinning. */
const BUNDLE_STAGE_COPY: Record<BundleProgress['stage'], string> = {
  preparing: 'Checking access',
  'reading-schema': 'Reading the data schema',
  counting: 'Counting records',
  downloading: 'Downloading data',
  metadata: 'Adding documentation',
  compressing: 'Compressing the package',
  ready: 'Ready',
}

const WORKSPACE_MODES: Array<{ id: WorkspaceMode; label: string }> = [
  { id: 'aggregated', label: 'Aggregated data' },
  { id: 'microdata', label: 'Microdata access' },
]

type IconName = 'arrow' | 'check' | 'external' | 'lock' | 'shield' | 'table' | 'flask' | 'search'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 9v11M15 9v11"/></>,
    flask: <><path d="M9 3h6M10 3v6L4.6 18a1.5 1.5 0 0 0 1.3 2.3h12.2a1.5 1.5 0 0 0 1.3-2.3L14 9V3"/><path d="M7.5 15h9"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

/**
 * Only stable survey keys and a schema version are persisted.
 *
 * Counts, grant metadata and resolved permissions are deliberately left out:
 * they are protected or go stale, and the keys are enough to rebuild a selection
 * against fresh discovery. Test selections are stored under their own scope so a
 * production package can never pick one up.
 */
/**
 * Storage is scoped to the signed-in account as well as the selection scope.
 *
 * Two people share a browser tab more often than it sounds: one signs out, the
 * next signs in. Without the account in the key, the second inherits the first
 * one's survey choices.
 */
function storageKey(account: string, scope: SelectionScope) {
  return `${SELECTION_STORAGE_KEY}.${account}.${scope}`
}

function readStoredSelection(account: string, scope: SelectionScope): string[] {
  if (!account) return []
  try {
    const raw = sessionStorage.getItem(storageKey(account, scope))
    if (!raw) return []
    const parsed = JSON.parse(raw) as { version?: number; keys?: unknown }
    if (parsed.version !== SELECTION_SCHEMA_VERSION || !Array.isArray(parsed.keys)) return []
    return parsed.keys.filter((key): key is string => typeof key === 'string')
  } catch {
    return []
  }
}

function writeStoredSelection(account: string, scope: SelectionScope, keys: string[]) {
  if (!account) return
  try {
    sessionStorage.setItem(
      storageKey(account, scope),
      JSON.stringify({ version: SELECTION_SCHEMA_VERSION, keys }),
    )
  } catch {
    // A refresh convenience, never a requirement. Private modes throw here.
  }
}

function clearStoredSelection(account: string, scope: SelectionScope) {
  if (!account) return
  try {
    sessionStorage.removeItem(storageKey(account, scope))
  } catch {
    // Nothing to recover: the selection lives in component state regardless.
  }
}

function SignInGate() {
  const auth = useAuth()
  usePageMetadata({
    title: 'Survey data workspace',
    description: 'Sign in with a DIEM community account to choose surveys and download aggregated household survey data with its documentation.',
  })
  return (
    <main id="top" className="workspace-gate">
      <div className="section-wrap">
        <span className="eyebrow"><span/> Survey data workspace</span>
        <h1>Sign in to choose your surveys</h1>
        <p>The workspace lists the surveys your account can download — country by country, round by round — and packages them with the documentation that belongs to each one. Aggregated survey data is available to any DIEM community account.</p>
        <div className="workspace-gate-actions">
          {/* Sign-in returns here rather than to /data, so the visitor keeps the
              destination they asked for. */}
          <button type="button" onClick={() => void auth.signIn()} disabled={auth.status === 'authenticating'}>
            <Icon name="lock"/>{auth.status === 'authenticating' ? 'Opening sign in…' : 'Sign in or create an account'}
          </button>
          <Link to="/data">What is in DIEM data<Icon name="arrow"/></Link>
        </div>
        <p className="workspace-gate-note"><Icon name="shield"/> Accounts are free. Privileges usually activate within 15 minutes of account creation.</p>
      </div>
    </main>
  )
}

/**
 * Access is described, never overstated.
 *
 * `status` reports whether every source was read; row-level warnings arrive
 * separately as `warningSourceCount`, because a source that answered with an odd
 * row has still been checked and must not be reported as unreachable.
 */
function AggregatedAccessCard({ result, onRetry }: {
  result?: SurveyDiscoveryResult
  onRetry: () => void
}) {
  /*
   * Production sources only, in every mode. With test mode open, discovery also
   * reads the preview sources; their pending, failed or warning states describe
   * simulated data and must not colour the production summary.
   */
  const sources = result?.sources.filter((source) => (
    !source.testData && source.status !== 'excluded-test' && source.status !== 'withheld'
  )) || []
  const pendingCount = sources.filter((source) => source.status === 'checking').length
  const unavailableCount = sources.filter((source) => source.status === 'restricted' || source.status === 'failed').length
  const warningCount = sources.filter((source) => source.status === 'confirmed-with-warnings').length

  if (!result || (sources.length > 0 && pendingCount === sources.length)) {
    return (
      <article className="access-card">
        <h2>Aggregated survey data</h2>
        <p className="access-card-lede">Checking which surveys your account can download…</p>
      </article>
    )
  }

  // Production only, in every mode. Test records are not evidence and must not
  // reach a number a user could repeat as one.
  const surveys = result.surveys.filter((survey) => !survey.testData)
  const generations = new Set(surveys.map((survey) => survey.generation))
  const pending = pendingCount > 0
  // "Available" claims a total. Until every source has answered, the number is
  // only what has been confirmed so far, and the headline says exactly that.
  const incomplete = pending || unavailableCount > 0

  return (
    <article className="access-card">
      <h2>Aggregated survey data</h2>
      <p className="access-card-lede">
        <strong>{formatNumber(surveys.length)}</strong> survey{surveys.length === 1 ? '' : 's'} {incomplete ? 'confirmed so far' : 'available'}
        {/* Counted, never written as a constant: production V3 contributes none
            today, so "three generations" would have shipped already false. */}
        {generations.size > 0 && ` across ${formatNumber(generations.size)} questionnaire generation${generations.size === 1 ? '' : 's'}`}.
      </p>
      {pending && <p className="access-card-state">Still checking {formatNumber(pendingCount)} of {formatNumber(sources.length)} data sources.</p>}
      {!pending && unavailableCount > 0 && (
        <p className="access-card-state access-card-state--warn">
          {formatNumber(unavailableCount)} data source{unavailableCount === 1 ? '' : 's'} could not be checked, so this is not the complete total.
          <button type="button" onClick={onRetry}>Check again</button>
        </p>
      )}
      {!pending && unavailableCount === 0 && warningCount > 0 && (
        <p className="access-card-state">
          Every source was checked. {formatNumber(warningCount)} reported rows that did not match the survey schema; those rows are listed under technical resources.
        </p>
      )}
      {!pending && result.status === 'unavailable' && surveys.length === 0 && (
        <p className="access-card-state access-card-state--warn">
          No aggregated surveys resolved for your account. Access is assigned automatically and usually takes up to 15 minutes after an account is created.
          <button type="button" onClick={onRetry}>Check again</button>
        </p>
      )}
    </article>
  )
}

/**
 * Deliberately states no access level.
 *
 * There are two independent microdata paths - the household-data group and a
 * temporary grant - and this page reads neither yet. Branching on
 * `capabilities.householdData` alone would tell a grant recipient that microdata
 * is "available by request" while they hold an active grant, and tell a group
 * member about a seven-day window that does not describe their access. Neutral
 * wording is the honest option until grant discovery is integrated.
 */
function MicrodataAccessCard({ onOpen }: { onOpen: () => void }) {
  return (
    <article className="access-card">
      <h2>Household microdata</h2>
      <p className="access-card-lede">Household microdata follows its own route, with a stricter licence than aggregated data.</p>
      <p className="access-card-state">Any collection or temporary grant approved for your account is listed under microdata access, below.</p>
      <div className="access-card-links">
        <button type="button" className="access-card-action" onClick={onOpen}>See your microdata<Icon name="arrow"/></button>
        <Link className="access-card-action" to="/data/microdata-request">Request access<Icon name="arrow"/></Link>
      </div>
    </article>
  )
}

function SourceStatusLabel({ source }: { source: SurveySourceResult }) {
  const labels: Record<SurveySourceResult['status'], string> = {
    checking: 'Checking',
    confirmed: 'Published',
    'confirmed-with-warnings': 'Published, with row warnings',
    restricted: 'Additional access required',
    failed: 'Could not be checked',
    'excluded-test': 'Test data, excluded',
    withheld: 'Not released — Contributors only',
  }
  return <span className={`source-status source-status--${source.status}`}>{labels[source.status]}</span>
}

export default function SurveyWorkspace() {
  usePageMetadata({
    title: 'Survey data workspace',
    description: 'Choose DIEM household surveys by country and round, and download aggregated survey data with the documentation that belongs to each generation.',
  })
  const auth = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  // One flag, three consequences: no survey-count cap, access to rows not yet
  // released (opendata = 0), and test-data mode. Same Contributors group the
  // dashboard uses.
  const isContributor = Boolean(auth.user?.capabilities?.contributor)
  // Test surveys are unreleased (opendata = 0), which only a Contributor may see;
  // for anyone else the mode would open onto an empty list, so `?test=1` from
  // a shared link is ignored rather than honoured with nothing.
  const testMode = isContributor && searchParams.get('test') === '1'
  const scope: SelectionScope = testMode ? 'test' : 'production'

  const location = useLocation()
  const arrivingForGrants = location.hash === `#${GRANTS_SECTION_ID}`
  /*
   * The invitation dialog sends an accepted recipient here with the grants hash.
   * The grants live in the microdata tab, and a hidden panel cannot be scrolled
   * to, so arriving that way opens the tab - on first render and on a later
   * navigation to the same page.
   */
  const [mode, setMode] = useState<WorkspaceMode>(arrivingForGrants ? 'microdata' : 'aggregated')
  useEffect(() => {
    if (arrivingForGrants) setMode('microdata')
  }, [arrivingForGrants])

  const householdData = Boolean(auth.user?.capabilities?.householdData)
  const [microdataResources, setMicrodataResources] = useState<ResolvedDataResource[]>()
  // Reported by the grants list itself, so the licence frames the same grants
  // the user can see rather than a second discovery that might disagree.
  const [hasActiveGrant, setHasActiveGrant] = useState(false)
  // Each path held gets named; both at once is its own state rather than one
  // path standing in for the other.
  const microdataAccess: MicrodataAccess = hasActiveGrant
    ? householdData ? 'temporaryGrantAndHouseholdGroup' : 'temporaryGrant'
    : householdData ? 'householdGroup' : 'none'

  /**
   * The household collections, resolved against the signed-in identity.
   *
   * Only asked for when the account holds household-data access: for anyone else
   * every item would come back restricted, which is a list of refusals rather
   * than information. ArcGIS still decides what actually opens.
   */
  useEffect(() => {
    setMicrodataResources(undefined)
    if (auth.status !== 'authenticated' || !householdData) return
    let active = true
    void Promise.all(MICRODATA_RESOURCES.map((resource) => resolveProtectedResource(resource, auth.requestProtected)))
      .then((resolved) => { if (active) setMicrodataResources(resolved) })
    return () => { active = false }
  }, [auth.requestProtected, auth.status, householdData])
  const [result, setResult] = useState<SurveyDiscoveryResult>()
  const [reloadVersion, setReloadVersion] = useState(0)
  const [search, setSearch] = useState('')
  const [generationFilter, setGenerationFilter] = useState<DataGeneration | 'all'>('all')
  const [selectedOnly, setSelectedOnly] = useState(false)
  const accountKey = auth.user?.username || ''
  // One selection per scope, so a test survey can never reach a production package.
  const [selection, setSelection] = useState<Record<SelectionScope, string[]>>({ production: [], test: [] })
  const [droppedCount, setDroppedCount] = useState(0)
  const [themeChoice, setThemeChoice] = useState<'all' | 'custom'>('all')
  const [chosenThemes, setChosenThemes] = useState<string[]>([])
  const [counts, setCounts] = useState<SurveySliceCount[]>()
  const [countProgress, setCountProgress] = useState<{ done: number; total: number }>()
  const [bundleProgress, setBundleProgress] = useState<BundleProgress>()
  const [bundleError, setBundleError] = useState<string>()
  const [bundleReady, setBundleReady] = useState<string>()
  const [bundleCancelled, setBundleCancelled] = useState(false)
  const bundleAbort = useRef<AbortController | undefined>(undefined)
  // Where focus lands when a build ends, so a keyboard or screen-reader user is
  // taken to the outcome instead of being left on a button that just re-enabled.
  const outcomeRef = useRef<HTMLParagraphElement>(null)
  const [focusOutcome, setFocusOutcome] = useState(0)
  // The same for preflight: counting ends by moving focus to its verdict, which
  // is either what blocks the download or confirmation that nothing does.
  const preflightRef = useRef<HTMLParagraphElement>(null)
  const [focusPreflight, setFocusPreflight] = useState(0)
  const revalidated = useRef<string | undefined>(undefined)
  const tabRefs = useRef<Record<WorkspaceMode, HTMLButtonElement | null>>({ aggregated: null, microdata: null })

  /**
   * Selection follows the identity, and is dropped the moment it changes.
   *
   * Sign-out leaves the page mounted, so without this the in-memory selection
   * would still be on screen for whoever signs in next.
   */
  useEffect(() => {
    revalidated.current = undefined
    setDroppedCount(0)
    setSelection({
      production: readStoredSelection(accountKey, 'production'),
      test: readStoredSelection(accountKey, 'test'),
    })
  }, [accountKey])

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const controller = new AbortController()
    setResult(undefined)
    void discoverAggregatedSurveys(auth.requestProtected, {
      includeTestData: testMode,
      // Non-Contributors are offered only released (opendata = 1) rows; the
      // clause travels with each theme into every count and download.
      contributor: isContributor,
      refresh: reloadVersion > 0,
      signal: controller.signal,
      onProgress: (next) => setResult(next),
    })
    return () => controller.abort()
  }, [auth.requestProtected, auth.status, isContributor, reloadVersion, testMode])

  /**
   * The two populations never appear together.
   *
   * Test mode shows the simulated surveys *instead of* the production ones, not
   * alongside them. Filtering this way is what actually delivers "production and
   * test can never be in the same package": with a separate selection scope on
   * top, there is no sequence of clicks that mixes them.
   */
  const surveys = useMemo(
    () => (result?.surveys || []).filter((survey) => (testMode ? survey.testData : !survey.testData)),
    [result, testMode],
  )
  const settled = Boolean(result) && result!.pendingSourceCount === 0

  /**
   * A stored key is dropped only after an authoritative, complete discovery.
   *
   * `partial` and `failed` mean some source never answered, so a missing survey
   * may be missing only because its theme could not be read. Deleting the
   * selection then would lose a user's work over a transient ArcGIS failure and
   * tell them the survey is gone, which is the opposite of true. Those keys are
   * kept and reported as unconfirmed instead.
   */
  useEffect(() => {
    if (!settled || result?.status !== 'complete') return
    const token = `${accountKey}:${scope}:${reloadVersion}`
    if (revalidated.current === token) return
    revalidated.current = token
    const available = new Set(surveys.map((survey) => survey.key))
    setSelection((current) => {
      const kept = current[scope].filter((key) => available.has(key))
      if (kept.length === current[scope].length) return current
      setDroppedCount(current[scope].length - kept.length)
      writeStoredSelection(accountKey, scope, kept)
      return { ...current, [scope]: kept }
    })
  }, [accountKey, reloadVersion, result?.status, scope, settled, surveys])

  const unconfirmedCount = useMemo(() => {
    if (!settled || result?.status === 'complete') return 0
    const available = new Set(surveys.map((survey) => survey.key))
    return selection[scope].filter((key) => !available.has(key)).length
  }, [result?.status, scope, selection, settled, surveys])

  const selectedKeys = selection[scope]
  const unlimited = isContributor
  const atLimit = !unlimited && selectedKeys.length >= SELECTION_LIMIT

  const selectedSurveys = useMemo(
    () => surveys.filter((survey) => selectedKeys.includes(survey.key)),
    [selectedKeys, surveys],
  )

  /**
   * The themes on offer, each with the reach the plan asks to be stated.
   *
   * Themes are per generation, so a mixed selection legitimately offers a theme
   * that only some surveys carry. That is the number the user needs before
   * choosing, not after unzipping.
   */
  const themeCatalogue = useMemo(() => {
    const entries = new Map<string, { id: string; label: string; generation: DataGeneration; surveyKeys: string[] }>()
    for (const survey of selectedSurveys) {
      for (const theme of survey.themes) {
        const entry = entries.get(theme.id)
        if (entry) entry.surveyKeys.push(survey.key)
        else entries.set(theme.id, { id: theme.id, label: theme.label, generation: theme.generation, surveyKeys: [survey.key] })
      }
    }
    return Array.from(entries.values()).sort((left, right) => left.label.localeCompare(right.label))
  }, [selectedSurveys])

  const activeThemeIds = useMemo(() => {
    const available = new Set(themeCatalogue.map((theme) => theme.id))
    if (themeChoice === 'all') return Array.from(available)
    return chosenThemes.filter((id) => available.has(id))
  }, [chosenThemes, themeChoice, themeCatalogue])

  /**
   * Every (survey, theme) pair the package would contain, and every pair it
   * would leave out with the reason.
   *
   * "Not collected" and "could not be retrieved" are different facts for an
   * analyst: the first is how the survey was run, the second is a failure that
   * may resolve on a retry.
   */
  const plan = useMemo(() => {
    const failedSources = new Set(
      (result?.sources || [])
        .filter((source) => source.status === 'restricted' || source.status === 'failed')
        .map((source) => `${source.generation}:${source.themeId}`),
    )
    return selectedSurveys.map((survey) => {
      const own = new Map(survey.themes.map((theme) => [theme.id, theme]))
      const included = activeThemeIds.flatMap((id) => {
        const theme = own.get(id)
        return theme ? [theme] : []
      })
      const omitted = activeThemeIds.flatMap((id) => {
        if (own.has(id)) return []
        const label = themeCatalogue.find((theme) => theme.id === id)?.label || id
        return [{
          id,
          label,
          reason: failedSources.has(`${survey.generation}:${id}`)
            ? 'Could not be retrieved'
            : 'Not collected for this survey',
        }]
      })
      return { survey, included, omitted }
    })
  }, [activeThemeIds, result?.sources, selectedSurveys, themeCatalogue])

  const fileCount = plan.reduce((total, entry) => total + entry.included.length, 0)

  const toggleSurvey = useCallback((key: string) => {
    setSelection((current) => {
      const keys = current[scope]
      const next = keys.includes(key)
        ? keys.filter((value) => value !== key)
        : [...keys, key]
      writeStoredSelection(accountKey, scope, next)
      return { ...current, [scope]: next }
    })
    setDroppedCount(0)
  }, [accountKey, scope])

  const clearSelection = useCallback(() => {
    clearStoredSelection(accountKey, scope)
    setSelection((current) => ({ ...current, [scope]: [] }))
    setSelectedOnly(false)
  }, [accountKey, scope])

  function leaveTestMode() {
    clearStoredSelection(accountKey, 'test')
    setSelection((current) => ({ ...current, test: [] }))
    const next = new URLSearchParams(searchParams)
    next.delete('test')
    setSearchParams(next, { replace: true })
  }

  /**
   * Counts are measured on request, never on every checkbox.
   *
   * Ten surveys across five themes is fifty queries; running those while
   * somebody is still clicking would cost far more than it tells them.
   */
  async function runPreflight() {
    const slices = plan.flatMap((entry) => entry.included.map((theme) => ({ survey: entry.survey, theme })))
    if (!slices.length) return
    setCountProgress({ done: 0, total: slices.length })
    const measured = await countSurveySlices(slices, auth.requestProtected, (done, total) => {
      setCountProgress({ done, total })
    })
    setCounts(measured)
    setCountProgress(undefined)
    setFocusPreflight((value) => value + 1)
  }

  // Any change to what would be packaged invalidates a measurement of it, and
  // every outcome of building the previous package: a "cancelled" or "ready"
  // left on screen would describe a package that no longer exists.
  useEffect(() => {
    setCounts(undefined)
    setBundleReady(undefined)
    setBundleError(undefined)
    setBundleCancelled(false)
  }, [activeThemeIds, selectedKeys])

  const bundleSlices = useMemo(
    () => plan.flatMap((entry) => entry.included.map((theme) => ({ survey: entry.survey, theme }))),
    [plan],
  )

  const budget = unlimited ? PACKAGE_BUDGETS.contributor : PACKAGE_BUDGETS.member
  const packageHasTestData = bundleSlices.some(({ survey }) => survey.testData)
  const omittedCount = plan.reduce((total, entry) => total + entry.omitted.length, 0)
  const countedRecords = counts?.reduce((total, entry) => total + (entry.count || 0), 0) || 0
  const countErrors = counts?.filter((entry) => entry.error).length || 0

  /**
   * The measurement must describe exactly this package.
   *
   * Counts are cleared on every selection change, but a discovery refresh can
   * alter the slices without touching the selection, so coverage is checked by
   * key rather than assumed.
   */
  const countsCoverPackage = useMemo(() => {
    if (!counts) return false
    const measured = new Set(counts.map((entry) => `${entry.surveyKey}|${entry.themeId}`))
    return bundleSlices.length === counts.length
      && bundleSlices.every(({ survey, theme }) => measured.has(`${survey.key}|${theme.id}`))
  }, [bundleSlices, counts])

  /**
   * What stands between the user and a download, or nothing.
   *
   * Download is enabled by a successful preflight, never merely by the absence
   * of one. Each reason names the next action rather than just refusing.
   */
  const downloadBlocker = (() => {
    if (unconfirmedCount > 0) {
      // A selection the latest discovery could not confirm never reaches
      // `plan`, so building now would drop it from the archive without a word.
      return `${formatNumber(unconfirmedCount)} selected survey${unconfirmedCount === 1 ? ' has' : 's have'} not been confirmed because a data source did not answer. Check again, or clear the selection, before building a package.`
    }
    if (!countsCoverPackage) return 'Count the records first. A package is built only from a measured selection.'
    if (countErrors) return `${formatNumber(countErrors)} file${countErrors === 1 ? '' : 's'} could not be counted. Count again before building the package.`
    return packageBudgetProblem(countedRecords, bundleSlices.length, budget)
  })()

  async function downloadPackage() {
    const controller = new AbortController()
    bundleAbort.current = controller
    setBundleError(undefined)
    setBundleReady(undefined)
    setBundleCancelled(false)
    setBundleProgress({ stage: 'preparing', completed: 0, total: bundleSlices.length })
    try {
      const bundle = await buildSurveyBundle({
        slices: bundleSlices,
        omitted: plan.flatMap((entry) => entry.omitted.map((item) => ({
          surveyKey: entry.survey.key,
          themeLabel: item.label,
          reason: item.reason,
        }))),
        requester: auth.requestProtected,
        budget,
        signal: controller.signal,
        onProgress: setBundleProgress,
      })
      const url = URL.createObjectURL(bundle.blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = bundle.fileName
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 0)
      setBundleReady(bundle.fileName)
    } catch (error) {
      // A cancellation is the user's own decision, not a failure to report as one.
      if (isBundleCancelled(error)) setBundleCancelled(true)
      else setBundleError(error instanceof Error ? error.message : 'The package could not be built.')
    } finally {
      bundleAbort.current = undefined
      setBundleProgress(undefined)
      setFocusOutcome((value) => value + 1)
    }
  }

  // After the outcome has rendered, not before: focusing in the same tick would
  // target a paragraph that does not exist yet.
  useEffect(() => {
    if (focusOutcome) outcomeRef.current?.focus()
  }, [focusOutcome])

  useEffect(() => {
    if (focusPreflight) preflightRef.current?.focus()
  }, [focusPreflight])

  // Leaving the page must not leave an archive building against a dead session.
  useEffect(() => () => bundleAbort.current?.abort(), [])

  function toggleTheme(id: string) {
    setChosenThemes((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ))
  }

  function onTabKeyDown(event: React.KeyboardEvent) {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!step) return
    event.preventDefault()
    const index = WORKSPACE_MODES.findIndex((entry) => entry.id === mode)
    const next = WORKSPACE_MODES[(index + step + WORKSPACE_MODES.length) % WORKSPACE_MODES.length]
    setMode(next.id)
    tabRefs.current[next.id]?.focus()
  }

  function enterTestMode() {
    const next = new URLSearchParams(searchParams)
    next.set('test', '1')
    setSearchParams(next, { replace: true })
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return surveys.filter((survey) => {
      if (generationFilter !== 'all' && survey.generation !== generationFilter) return false
      if (selectedOnly && !selectedKeys.includes(survey.key)) return false
      if (!term) return true
      return survey.countryName.toLowerCase().includes(term) || survey.adm0Iso3.toLowerCase().includes(term)
    })
  }, [generationFilter, search, selectedKeys, selectedOnly, surveys])

  /**
   * The visible surveys grouped by country, latest round first.
   *
   * A flat list of every country and round runs to hundreds of rows. People
   * think country first and round second, so each country is one collapsed row
   * that opens onto its rounds.
   */
  const countryGroups = useMemo(() => {
    const groups = new Map<string, { iso3: string; name: string; surveys: AvailableSurvey[] }>()
    for (const survey of visible) {
      const group = groups.get(survey.adm0Iso3)
      if (group) group.surveys.push(survey)
      else groups.set(survey.adm0Iso3, { iso3: survey.adm0Iso3, name: survey.countryName, surveys: [survey] })
    }
    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        surveys: group.surveys.sort((left, right) => right.round - left.round || right.generation.localeCompare(left.generation)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [visible])

  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(() => new Set())
  // Narrowing the list already makes it short, so a search or "selected only"
  // opens every matching country rather than asking for one click each - as
  // does a list with a single country, where collapsing would only add a click.
  const expandAllMatches = Boolean(search.trim()) || selectedOnly || countryGroups.length === 1
  const isCountryOpen = (iso3: string) => expandAllMatches || expandedCountries.has(iso3)
  const allCountriesOpen = countryGroups.length > 0 && countryGroups.every((group) => isCountryOpen(group.iso3))

  function toggleCountry(iso3: string) {
    setExpandedCountries((current) => {
      const next = new Set(current)
      if (next.has(iso3)) next.delete(iso3)
      else next.add(iso3)
      return next
    })
  }

  function setAllCountriesOpen(open: boolean) {
    setExpandedCountries(open ? new Set(countryGroups.map((group) => group.iso3)) : new Set())
  }

  const generationsPresent = useMemo(
    () => Array.from(new Set(surveys.map((survey) => survey.generation))),
    [surveys],
  )

  if (auth.status === 'loading') {
    return <><SiteHeader/><main className="workspace-loading"><span className="loader"/><strong>Opening your survey data workspace</strong></main><SiteFooter/></>
  }
  if (auth.status !== 'authenticated') return <><SiteHeader/><SignInGate/><SiteFooter/></>

  return (
    <>
      <SiteHeader/>
      <main id="top" className="workspace-page">
        <section className="workspace-hero">
          <div className="section-wrap">
            <span className="eyebrow"><span/> Survey data workspace</span>
            <h1>Choose your surveys</h1>
            <p>Pick the countries and rounds you need. The Hub resolves which data infrastructure holds each survey and packages the matching documentation with it.</p>
          </div>
        </section>

        <section className="workspace-summary">
          <div className="section-wrap">
            <AggregatedAccessCard result={result} onRetry={() => setReloadVersion((value) => value + 1)}/>
            <MicrodataAccessCard onOpen={() => {
              setMode('microdata')
              // Focus follows the switch, so a keyboard user lands on the tab
              // whose panel just opened rather than on a button above it.
              tabRefs.current.microdata?.focus()
            }}/>
          </div>
        </section>

        {testMode && (
          <div className="test-mode-banner" role="status">
            <div className="section-wrap">
              <Icon name="flask"/>
              <div>
                <strong>Test data mode</strong>
                <p>These surveys carry simulated records published for infrastructure review. They are not survey results and must not be cited. Test surveys are excluded from every access count and can never be packaged with production surveys.</p>
              </div>
              <button type="button" onClick={leaveTestMode}>Leave test mode</button>
            </div>
          </div>
        )}

        <div className="section-wrap">
          {/* Tabs, not routes: one destination, and switching keeps each mode's
              own selection because the two packages are separate. */}
          {/* Roving tabindex: one stop in the Tab order, arrows move between
              tabs, and both panels stay mounted so `aria-controls` always
              resolves - the pattern assistive technology expects. */}
          <div className="workspace-tabs" role="tablist" aria-label="Data type" onKeyDown={onTabKeyDown}>
            {WORKSPACE_MODES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                ref={(node) => { tabRefs.current[id] = node }}
                aria-selected={mode === id}
                aria-controls={`panel-${id}`}
                tabIndex={mode === id ? 0 : -1}
                onClick={() => setMode(id)}
              >{label}</button>
            ))}
          </div>

          <div className="workspace-panel" id="panel-aggregated" role="tabpanel" aria-labelledby="tab-aggregated" hidden={mode !== 'aggregated'}>
              <section className="workspace-step" aria-labelledby="step-surveys">
                <h2 id="step-surveys"><span>1</span>Select surveys</h2>

                <div className="survey-filters">
                  <label className="survey-search">
                    <Icon name="search"/>
                    <span className="sr-only">Search by country name or ISO3 code</span>
                    <input type="search" value={search} placeholder="Search country or ISO3" onChange={(event) => setSearch(event.target.value)}/>
                  </label>
                  <label>
                    <span>Questionnaire</span>
                    <select value={generationFilter} onChange={(event) => setGenerationFilter(event.target.value as DataGeneration | 'all')}>
                      <option value="all">All</option>
                      {generationsPresent.map((generation) => (
                        <option key={generation} value={generation}>{GENERATIONS[generation].label}</option>
                      ))}
                    </select>
                  </label>
                  <label className="survey-filter-toggle">
                    <input type="checkbox" checked={selectedOnly} onChange={(event) => setSelectedOnly(event.target.checked)}/>
                    <span>Selected only</span>
                  </label>
                  <button type="button" className="survey-filter-clear" onClick={clearSelection} disabled={!selectedKeys.length}>Clear selection</button>
                </div>

                <p className="survey-count" aria-live="polite">
                  {formatNumber(visible.length)} survey{visible.length === 1 ? '' : 's'} listed · {formatNumber(selectedKeys.length)} selected
                  {!unlimited && <> · up to {SELECTION_LIMIT} surveys in one package</>}
                  {result && result.pendingSourceCount > 0 && <> · still checking {formatNumber(result.pendingSourceCount)} source{result.pendingSourceCount === 1 ? '' : 's'}</>}
                </p>

                {droppedCount > 0 && (
                  <p className="survey-dropped" role="status">
                    {formatNumber(droppedCount)} previously selected survey{droppedCount === 1 ? ' is' : 's are'} no longer available and {droppedCount === 1 ? 'was' : 'were'} removed.
                  </p>
                )}

                {unconfirmedCount > 0 && (
                  <p className="survey-dropped" role="status">
                    {formatNumber(unconfirmedCount)} selected survey{unconfirmedCount === 1 ? '' : 's'} could not be confirmed because a data source did not answer. {unconfirmedCount === 1 ? 'It has' : 'They have'} been kept — check again to confirm {unconfirmedCount === 1 ? 'it' : 'them'}.
                  </p>
                )}

                {atLimit && <p className="survey-limit-note">You have selected {SELECTION_LIMIT} surveys, the most one package can hold. Remove one to choose a different survey, or build a second package afterwards.</p>}

                {countryGroups.length > 1 && !expandAllMatches && (
                  <div className="survey-list-controls">
                    <button type="button" onClick={() => setAllCountriesOpen(!allCountriesOpen)}>
                      {allCountriesOpen ? 'Collapse all countries' : 'Expand all countries'}
                    </button>
                  </div>
                )}

                <fieldset className="survey-list">
                  <legend className="sr-only">Surveys available to your account, grouped by country</legend>
                  {countryGroups.map((group) => {
                    const open = isCountryOpen(group.iso3)
                    const selectedHere = group.surveys.filter((survey) => selectedKeys.includes(survey.key)).length
                    const generations = Array.from(new Set(group.surveys.map((survey) => GENERATIONS[survey.generation].label)))
                    const panelId = `country-rounds-${group.iso3}`
                    return (
                      <div className={open ? 'survey-country survey-country--open' : 'survey-country'} key={group.iso3}>
                        {/* A real button, not a summary element: a checkbox cannot
                            live inside <summary> accessibly, and the rounds carry
                            checkboxes. */}
                        <button
                          type="button"
                          className="survey-country-toggle"
                          aria-expanded={open}
                          aria-controls={panelId}
                          onClick={() => toggleCountry(group.iso3)}
                          disabled={expandAllMatches}
                        >
                          <span className="survey-country-chevron" aria-hidden="true"/>
                          <span className="survey-row-name">
                            <strong>{group.name}</strong>
                            <small>{group.iso3}</small>
                          </span>
                          <span className="survey-country-rounds">
                            {formatNumber(group.surveys.length)} round{group.surveys.length === 1 ? '' : 's'}
                          </span>
                          <span className="survey-country-generations">{generations.join(', ')}</span>
                          <span className="survey-country-selected">
                            {selectedHere ? `${formatNumber(selectedHere)} selected` : ''}
                          </span>
                        </button>
                        {open && (
                          <div className="survey-country-rounds-list" id={panelId}>
                            {group.surveys.map((survey) => {
                              const checked = selectedKeys.includes(survey.key)
                              return (
                                <label key={survey.key} className={checked ? 'survey-row survey-row--selected' : 'survey-row'}>
                                  {/* Only unchecked rows lock at the cap: a user must always
                                      be able to undo their own selection. */}
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!checked && atLimit}
                                    onChange={() => toggleSurvey(survey.key)}
                                    aria-label={`${survey.countryName}, round ${survey.round}`}
                                  />
                                  <span className="survey-row-round">Round {survey.round}</span>
                                  <span className="survey-row-generation">{GENERATIONS[survey.generation].label}</span>
                                  <span className="survey-row-themes">{survey.themes.length} theme{survey.themes.length === 1 ? '' : 's'}</span>
                                  <span className={survey.testData ? 'survey-row-status survey-row-status--test' : 'survey-row-status'}>
                                    {survey.testData ? 'Test data' : 'Published'}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {!visible.length && (
                    <p className="survey-empty">
                      {settled
                        ? surveys.length
                          ? 'No survey matches these filters. Clear the search or the questionnaire filter to see the rest.'
                          : 'No aggregated surveys are available to your account yet.'
                        : 'Loading the surveys your account can download…'}
                    </p>
                  )}
                </fieldset>
              </section>

              {/* Later steps stay readable and state their own prerequisite rather
                  than presenting a disabled region nobody can enter. */}
              <section className={selectedSurveys.length ? 'workspace-step' : 'workspace-step workspace-step--pending'} aria-labelledby="step-themes">
                <h2 id="step-themes"><span>2</span>Choose thematic areas</h2>
                {!selectedSurveys.length ? (
                  <p>Choose at least one survey to continue to thematic areas.</p>
                ) : (
                  <>
                    <fieldset className="theme-choice">
                      <legend className="sr-only">How to choose thematic areas</legend>
                      <label>
                        <input type="radio" name="theme-choice" checked={themeChoice === 'all'} onChange={() => setThemeChoice('all')}/>
                        <span><strong>All available themes</strong><small>Every theme published for each survey you selected.</small></span>
                      </label>
                      <label>
                        <input type="radio" name="theme-choice" checked={themeChoice === 'custom'} onChange={() => setThemeChoice('custom')}/>
                        <span><strong>Choose thematic areas</strong><small>Pick the themes you need. Each one says how many of your surveys carry it.</small></span>
                      </label>
                    </fieldset>

                    {themeChoice === 'custom' && (
                      <fieldset className="theme-list">
                        <legend className="sr-only">Thematic areas</legend>
                        {themeCatalogue.map((theme) => {
                          const reach = theme.surveyKeys.length
                          const partial = reach < selectedSurveys.length
                          return (
                            <label key={theme.id} className="theme-option">
                              <input type="checkbox" checked={chosenThemes.includes(theme.id)} onChange={() => toggleTheme(theme.id)}/>
                              <span className="theme-option-label">
                                <strong>{theme.label}</strong>
                                {/* Stated in words, never by colour alone. */}
                                <small>{partial
                                  ? `Available for ${formatNumber(reach)} of ${formatNumber(selectedSurveys.length)} selected surveys`
                                  : `Available for all ${formatNumber(reach)} selected survey${reach === 1 ? '' : 's'}`}</small>
                              </span>
                              <span className="theme-option-generation">{GENERATIONS[theme.generation].label}</span>
                            </label>
                          )
                        })}
                      </fieldset>
                    )}

                    {themeChoice === 'custom' && !activeThemeIds.length && (
                      <p className="theme-empty">Choose at least one thematic area to review the package.</p>
                    )}
                  </>
                )}
              </section>

              <section className={fileCount ? 'workspace-step' : 'workspace-step workspace-step--pending'} aria-labelledby="step-review">
                <h2 id="step-review"><span>3</span>Review package</h2>
                {!fileCount ? (
                  <p>{selectedSurveys.length
                    ? 'Choose at least one thematic area that your selected surveys carry, and the package appears here.'
                    : 'The review lists every survey, its themes, the file count and the record count before anything is downloaded.'}</p>
                ) : (
                  <>
                    <p className="package-preflight">
                      {formatNumber(selectedSurveys.length)} survey{selectedSurveys.length === 1 ? '' : 's'} · {formatNumber(activeThemeIds.length)} theme{activeThemeIds.length === 1 ? '' : 's'} · {formatNumber(fileCount)} data file{fileCount === 1 ? '' : 's'}
                      {counts && <> · {formatNumber(counts.reduce((total, entry) => total + (entry.count || 0), 0))} records</>}
                    </p>

                    <div className="package-table-wrap">
                      <table className="package-table">
                        <caption className="sr-only">Surveys, themes and records in this package</caption>
                        <thead>
                          <tr>
                            <th scope="col">Survey</th>
                            <th scope="col">Questionnaire</th>
                            <th scope="col">Included themes</th>
                            <th scope="col">Files</th>
                            <th scope="col">Records</th>
                            <th scope="col">Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.map(({ survey, included, omitted }) => {
                            const measured = counts?.filter((entry) => entry.surveyKey === survey.key)
                            const failed = measured?.filter((entry) => entry.error).length || 0
                            return (
                              <tr key={survey.key}>
                                <th scope="row">{survey.countryName} · Round {survey.round}</th>
                                <td>{GENERATIONS[survey.generation].label}</td>
                                <td>{included.map((theme) => theme.label).join(', ') || 'None'}</td>
                                <td>{formatNumber(included.length)}</td>
                                <td>{measured
                                  ? failed
                                    ? 'Not measured'
                                    : formatNumber(measured.reduce((total, entry) => total + (entry.count || 0), 0))
                                  : '—'}</td>
                                <td>
                                  {omitted.length
                                    ? omitted.map((entry) => `${entry.label}: ${entry.reason.toLowerCase()}`).join('; ')
                                    : failed
                                      ? `${formatNumber(failed)} theme${failed === 1 ? '' : 's'} could not be counted`
                                      : 'Complete'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Stated immediately before generating, per plan section 10:
                        what the file will be called, what it holds, under which
                        licence, what is missing, and whether preflight passed.
                        No size estimate: none would be reliable, and the plan
                        asks for one only when it is. */}
                    <dl className="package-summary">
                      <div>
                        <dt>Archive</dt>
                        <dd>{bundleFileName(packageHasTestData, new Date())}</dd>
                      </div>
                      <div>
                        <dt>Contents</dt>
                        <dd>
                          {formatNumber(selectedSurveys.length)} survey{selectedSurveys.length === 1 ? '' : 's'} · {formatNumber(fileCount)} data file{fileCount === 1 ? '' : 's'}
                          {countsCoverPackage && !countErrors && <> · {formatNumber(countedRecords)} records</>}
                          , each with its field schema
                        </dd>
                      </div>
                      <div>
                        <dt>Licence</dt>
                        <dd>CC BY 4.0 and the FAO Statistical Database Terms of Use</dd>
                      </div>
                      <div>
                        <dt>Not included</dt>
                        <dd>{omittedCount
                          ? `${formatNumber(omittedCount)} survey and theme combination${omittedCount === 1 ? '' : 's'}, named in the table above and in README.txt`
                          : 'Nothing — every requested survey and theme is present'}</dd>
                      </div>
                      {packageHasTestData && (
                        <div className="package-summary-test">
                          <dt>Test data</dt>
                          <dd>Simulated records, not survey results. TEST_DATA is written into the archive, folder and file names.</dd>
                        </div>
                      )}
                      <div>
                        <dt>Preflight</dt>
                        <dd>{downloadBlocker
                          ? 'Not yet complete — see below'
                          : 'All checks passed: every survey confirmed, every file counted, within the package budget'}</dd>
                      </div>
                    </dl>

                    <div className="package-actions">
                      {/* Preflight comes first in the tab order as well as in the
                          flow: it is the step that enables everything after it. */}
                      <button type="button" onClick={() => void runPreflight()} disabled={Boolean(countProgress) || Boolean(bundleProgress)}>
                        {countProgress
                          ? `Counting… ${formatNumber(countProgress.done)} of ${formatNumber(countProgress.total)}`
                          : countsCoverPackage ? 'Count records again' : 'Count records'}
                      </button>
                      <button
                        type="button"
                        className="package-download"
                        onClick={() => void downloadPackage()}
                        disabled={Boolean(downloadBlocker) || Boolean(bundleProgress)}
                        aria-describedby="package-preflight"
                      >
                        {bundleProgress
                          ? 'Building the package…'
                          : `Download ${formatNumber(fileCount)} data file${fileCount === 1 ? '' : 's'} for ${formatNumber(selectedSurveys.length)} survey${selectedSurveys.length === 1 ? '' : 's'}`}
                      </button>
                      {bundleProgress && (
                        <button type="button" className="package-cancel" onClick={() => bundleAbort.current?.abort()}>Cancel</button>
                      )}
                    </div>

                    {!bundleProgress && (downloadBlocker || countsCoverPackage) && (
                      <p
                        ref={preflightRef}
                        tabIndex={-1}
                        id="package-preflight"
                        className={downloadBlocker ? 'package-blocker' : 'package-ready'}
                      >
                        {downloadBlocker
                          || `Preflight passed: ${formatNumber(countedRecords)} records in ${formatNumber(fileCount)} data file${fileCount === 1 ? '' : 's'}, every survey confirmed and within the package budget. The package is ready to download.`}
                      </p>
                    )}

                    {/* Progress only. The outcome below is a separate element so
                        it can take focus without the live region re-announcing. */}
                    <p className="package-status" aria-live="polite">
                      {bundleProgress
                        ? `${BUNDLE_STAGE_COPY[bundleProgress.stage]}${bundleProgress.label ? ` — ${bundleProgress.label}` : ''}${bundleProgress.total > 1 ? ` (${formatNumber(bundleProgress.completed)} of ${formatNumber(bundleProgress.total)})` : ''}`
                        : ''}
                    </p>

                    {!bundleProgress && (bundleReady || bundleCancelled || bundleError) && (
                      <p
                        ref={outcomeRef}
                        tabIndex={-1}
                        className={bundleError ? 'package-error' : 'package-outcome'}
                        role={bundleError ? 'alert' : 'status'}
                      >
                        {bundleError
                          ? <><strong>The package was not created.</strong> {bundleError} Your selection has been kept, so you can try again or remove the survey that failed.</>
                          : bundleCancelled
                            ? 'The package was cancelled. Nothing was downloaded, and your selection has been kept.'
                            : `${bundleReady} downloaded. It contains one folder per survey, each with its data, its field schemas and links to the published documentation.`}
                      </p>
                    )}
                  </>
                )}
              </section>
          </div>

          <div className="workspace-panel" id="panel-microdata" role="tabpanel" aria-labelledby="tab-microdata" hidden={mode !== 'microdata'}>
            <section className="workspace-step" aria-labelledby="step-microdata">
              <h2 id="step-microdata">Microdata access</h2>
              <p>Household-level records are fully anonymized, released in coded form, and held under a stricter licence than aggregated data. There are two routes to them.</p>
              <div className="microdata-routes">
                <article className="microdata-route microdata-route--primary">
                  <span className="microdata-route-step">Start here</span>
                  <h3>FAO Microdata Catalogue (FAM)</h3>
                  <p>Anonymized DIEM microdata is published in FAM within about six months of the aggregated data being released, once final editing and additional disclosure control are complete.</p>
                  <a href={FAM_URL} target="_blank" rel="noreferrer">Browse DIEM collections in FAM <Icon name="external"/></a>
                </article>
                <article className="microdata-route">
                  <span className="microdata-route-step">If you need it sooner</span>
                  <h3>Request direct access</h3>
                  <p>For a survey that has not reached FAM yet. Requests are evaluated within about two working days. Access is granted in justified cases to institutional email addresses, is valid for a week from when the invitation is issued, and can be extended.</p>
                  <Link to="/data/microdata-request">Open the request form</Link>
                </article>
              </div>
            </section>

            {/* Mounted even while this tab is hidden, so grant discovery has
                already run by the time someone opens it. It renders nothing for
                an account with no grant. */}
            <TemporaryMicrodataGrants onActiveGrantChange={setHasActiveGrant} />

            {householdData && (
              <section className="workspace-step" aria-labelledby="step-household">
                <h2 id="step-household">Household microdata collections</h2>
                <p>Collections your account can open, by questionnaire generation. Each opens in the dataset explorer, where it can be filtered by country and round before download.</p>
                <ul className="source-rows">
                  {(microdataResources || MICRODATA_RESOURCES.map((resource) => ({ ...resource, access: 'checking' as const }))).map((resource) => (
                    <li key={resource.id}>
                      <span className="source-row-title">
                        <strong>{resource.fallbackTitle}</strong>
                        <small>{GENERATIONS[resource.version].label}{resource.period ? ` · ${resource.period}` : ''}</small>
                      </span>
                      <span className={`source-status source-status--${resource.access === 'available' ? 'confirmed' : resource.access === 'checking' ? 'checking' : 'restricted'}`}>
                        {resource.access === 'available'
                          ? resource.preview ? 'Test records' : 'Available'
                          : resource.access === 'checking' ? 'Checking' : resource.access === 'error' ? 'Could not be checked' : 'Additional access required'}
                      </span>
                      <span className="source-row-message">{resource.preview ? 'Simulated records published for review — not survey results.' : ''}</span>
                      <span className="source-row-links">
                        {resource.access === 'available' && <Link to={`/data/${resource.id}`}>Explore</Link>}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <MicrodataLicence access={microdataAccess} />
          </div>

          <details className="technical-resources">
            <summary>Technical resources and source datasets</summary>
            <div className="technical-resources-body">
              <p>Every source behind this workspace, with the status of its last check. These are the published items that dashboards and scripts address directly; their links are unchanged.</p>
              <ul className="source-rows">
                {(result?.sources || []).map((source) => (
                  <li key={source.resourceId}>
                    <span className="source-row-title">
                      <strong>{source.themeLabel}</strong>
                      <small>{GENERATIONS[source.generation].label}{source.surveyCount === undefined ? '' : ` · ${formatNumber(source.surveyCount)} surveys`}</small>
                    </span>
                    <SourceStatusLabel source={source}/>
                    {source.message && <span className="source-row-message">{source.message}</span>}
                    <span className="source-row-links">
                      <Link to={`/data/${source.resourceId}`}>Explore</Link>
                      <a href={`${DATA_PORTAL}/home/item.html?id=${source.resourceId}`} target="_blank" rel="noreferrer">ArcGIS item<Icon name="external"/></a>
                    </span>
                  </li>
                ))}
              </ul>
              {!isContributor ? null : !testMode ? (
                <button type="button" className="test-mode-open" onClick={enterTestMode}>
                  <Icon name="flask"/>Open test-data mode
                  <small>Adds the simulated review surveys to the picker. They stay out of every count and package.</small>
                </button>
              ) : (
                <button type="button" className="test-mode-open" onClick={leaveTestMode}>
                  <Icon name="flask"/>Leave test-data mode
                  <small>Removes the simulated surveys and clears any test selection.</small>
                </button>
              )}

              {/* These moved here from /data when it became the public overview.
                  Links only: ArcGIS decides what each one opens for this account. */}
              <h3 className="technical-resources-heading">Administrative reference boundaries</h3>
              <ul className="source-rows">
                {REFERENCE_RESOURCES.map((resource) => (
                  <li key={resource.id}>
                    <span className="source-row-title">
                      <strong>{resource.fallbackTitle}</strong>
                      <small>{resource.description}</small>
                    </span>
                    <span/>
                    <span/>
                    <span className="source-row-links">
                      {resource.staticLink
                        ? <a href={resource.staticLink} target="_blank" rel="noreferrer">Open<Icon name="external"/></a>
                        : <Link to={`/data/${resource.id}`}>Explore</Link>}
                    </span>
                  </li>
                ))}
              </ul>

              <h3 className="technical-resources-heading">Documentation and metadata</h3>
              <ul className="source-rows">
                {DOCUMENTATION_RESOURCES.map((resource) => (
                  <li key={resource.id}>
                    <span className="source-row-title">
                      <strong>{resource.fallbackTitle}</strong>
                      <small>{GENERATIONS[resource.version].label} · {resource.audience === 'microdata' ? 'microdata' : resource.audience === 'aggregate' ? 'aggregated data' : 'aggregated data and microdata'}</small>
                    </span>
                    <span/>
                    <span className="source-row-message">{resource.description}</span>
                    <span className="source-row-links">
                      <a href={resource.staticLink || resource.href || `${DATA_PORTAL}/home/item.html?id=${resource.id}`} target="_blank" rel="noreferrer">Open<Icon name="external"/></a>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="technical-resources-note">
                {GENERATIONS.v3.label} field descriptions and codebook are not published yet; they are released with the first {GENERATIONS.v3.label} survey. Do not use an earlier generation's documentation in their place.
              </p>

              <h3 className="technical-resources-heading">API and analysis tools</h3>
              <ul className="source-rows">
                <li>
                  <span className="source-row-title"><strong>DIEM data API</strong><small>Jupyter Notebook</small></span>
                  <span/>
                  <span className="source-row-message">Automated, authenticated downloads for your own workflows.</span>
                  <span className="source-row-links"><a href="https://github.com/Andrampa/DIEM_API/tree/main" target="_blank" rel="noreferrer">Repository<Icon name="external"/></a></span>
                </li>
                <li>
                  <span className="source-row-title"><strong>Microdata labelling</strong><small>Python and R</small></span>
                  <span/>
                  <span className="source-row-message">Detects the questionnaire generation and applies the official DIEM value labels.</span>
                  <span className="source-row-links"><a href="https://github.com/Andrampa/diem-microdata-labelling" target="_blank" rel="noreferrer">Repository<Icon name="external"/></a></span>
                </li>
              </ul>

              <p className="technical-resources-note">
                Citation in English, French and Spanish, both licences and the methodology notes are in <Link to="/data/guide">the data access guide</Link>.
              </p>
            </div>
          </details>
        </div>
      </main>
      <SiteFooter/>
    </>
  )
}
