import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import '../survey-workspace.css'
import { useAuth } from '../auth/AuthContext'
import { GRANTS_SECTION_ID } from '../components/MicrodataInvitationDialog'
import { MicrodataLicence, type MicrodataAccess } from '../components/MicrodataLicence'
import { MicrodataPackagePicker } from '../components/MicrodataPackagePicker'
import { FlowActions, FlowStepList, FlowStepPanel, useStepHeadingFocus } from '../components/SurveyFlowNav'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useMicrodataGrants } from '../hooks/useMicrodataGrants'
import { MicrodataAccessSummary } from '../components/MicrodataAccessSummary'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { formatNumber } from '../lib/format'
import { hubPath } from '../lib/hubOrigin'
import {
  FLOW_STEPS,
  describeRequestOutcome,
  flowType,
  guardedStep,
  hasSurveyRequest,
  requestedStep,
  resolveSurveyRequest,
  surveyRequest,
  withFlowParams,
  withoutSurveyRequest,
  type FlowStep,
  type FlowType,
  type SurveyRequest,
} from '../lib/surveyFlow'
import { fetchSurveyCollectionPeriods, type SurveyCollectionPeriod } from '../services/monitoring'
import {
  ANALYSIS_TOOLS,
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
  bundleDataFileCount,
  bundleFileName,
  bundleSourceKey,
  combinedFileNames,
  groupBundleSlices,
  isBundleCancelled,
  packageBudgetProblem,
  PACKAGE_BUDGETS,
  type BundleProgress,
  type BundleLayout,
} from '../services/surveyBundle'
import { BROWSER_EXPORT_LIMIT } from '../services/dataExplorer'
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
const LAYOUT_STORAGE_KEY = 'diem.survey-package-layout'

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

const FLOW_TITLES: Record<FlowType, string> = {
  aggregated: 'Aggregated survey data',
  microdata: 'Household microdata',
}

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

function readStoredLayout(account: string, scope: SelectionScope): BundleLayout {
  if (!account) return 'per-survey'
  try {
    return sessionStorage.getItem(`${LAYOUT_STORAGE_KEY}.${account}.${scope}`) === 'combined-by-source'
      ? 'combined-by-source' : 'per-survey'
  } catch {
    return 'per-survey'
  }
}

function writeStoredLayout(account: string, scope: SelectionScope, layout: BundleLayout) {
  if (!account) return
  try {
    sessionStorage.setItem(`${LAYOUT_STORAGE_KEY}.${account}.${scope}`, layout)
  } catch {
    // The preference is optional; the current selection still works.
  }
}

function SignInGate({ type }: { type?: FlowType }) {
  const auth = useAuth()
  usePageMetadata({
    title: 'Your surveys',
    description: 'Sign in with a DIEM community account to choose surveys and download aggregated household survey data with its documentation.',
  })
  return (
    <main id="top" className="workspace-gate">
      <div className="section-wrap">
        <span className="eyebrow"><span/> Your surveys</span>
        <h1>Sign in to choose your surveys</h1>
        <p>The workspace lists the surveys your account can download — country by country, round by round — and packages them with the documentation that belongs to each one. Aggregated survey data is available to any DIEM community account.</p>
        {type === 'microdata' && <p>Household microdata also needs approved access: membership of the household-data group or a temporary grant. After signing in you will see which surveys your account can open.</p>}
        <div className="workspace-gate-actions">
          {/* Sign-in opens in a popup and this page stays where it is, so the
              data type, step and any survey a link asked for are kept. */}
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
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** "Mar 2024 – Apr 2024", "Mar 2024" for one month, or the one end the register holds. */
export function collectionPeriodLabel(period: SurveyCollectionPeriod) {
  const start = period.start ? MONTH_YEAR.format(period.start) : undefined
  const end = period.end ? MONTH_YEAR.format(period.end) : undefined
  if (start && end) return start === end ? start : `${start} – ${end}`
  return start ? `From ${start}` : end ? `Until ${end}` : ''
}

function AggregatedAccessCard({ result, onRetry, action }: {
  result?: SurveyDiscoveryResult
  onRetry: () => void
  action?: React.ReactNode
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
  const restrictedCount = sources.filter((source) => source.status === 'restricted').length
  const failedCount = sources.filter((source) => source.status === 'failed').length
  const unavailableCount = restrictedCount + failedCount
  const warningCount = sources.filter((source) => source.status === 'confirmed-with-warnings').length

  if (!result || (sources.length > 0 && pendingCount === sources.length)) {
    return (
      <article className="access-card">
        <h2>Aggregated survey data</h2>
        <p className="access-card-lede">Checking which surveys your account can download…</p>
        {action}
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

  // Every production item returning 403 is an ArcGIS provisioning failure,
  // not evidence that the catalogue contains zero surveys. Community
  // membership establishes eligibility; the cross-organization sync supplies
  // the item authorization. Keep those two facts distinct in the UI.
  if (!pending && surveys.length === 0 && sources.length > 0 && restrictedCount === sources.length) {
    return (
      <article className="access-card">
        <h2>Aggregated survey data</h2>
        <p className="access-card-lede"><strong>Access is still being provisioned.</strong></p>
        <p className="access-card-state access-card-state--warn">
          This is a valid DIEM community account, but it cannot open the aggregated data sources yet. Access normally activates within 15 minutes of account creation. If this account is older, contact the DIEM Hub team.
          <button type="button" onClick={onRetry}>Check again</button>
        </p>
        {action}
      </article>
    )
  }

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
      {action}
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
      <p className="access-card-lede">Anonymized household-level records, under a stricter licence than aggregated data.</p>
      <p className="access-card-state">Needs approved access: the household-data group or a temporary grant. Published collections are also in the FAO Microdata Catalogue (FAM).</p>
      <div className="access-card-links">
        <button type="button" className="access-card-choose" onClick={onOpen}>Choose household microdata<Icon name="arrow"/></button>
        <Link className="access-card-action" to="/data/microdata-request">Request microdata access<Icon name="arrow"/></Link>
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
    title: 'Your surveys',
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
  const arrivingForGrants = [`#${GRANTS_SECTION_ID}`, '#temporary-microdata', '#step-microdata', '#step-household'].includes(location.hash)
  /*
   * The data type comes from the URL. The invitation dialog sends an accepted
   * recipient here with a grants hash and no type; that arrival still means
   * microdata, so existing grant links keep working without a rewrite.
   */
  const type: FlowType | undefined = flowType(searchParams) || (arrivingForGrants ? 'microdata' : undefined)
  const requested: FlowStep = type ? requestedStep(searchParams, type) : 'surveys'

  /*
   * A link's survey request (`surveys`, or `country` with `round`) is held until
   * the matching route has applied it against what the account can open; only
   * then is it removed from the URL. Signing in happens in a popup, so the
   * request survives it.
   */
  const [surveyIntent, setSurveyIntent] = useState<SurveyRequest | undefined>(() => surveyRequest(searchParams))
  const requestSignature = hasSurveyRequest(searchParams) ? `${searchParams.get('surveys')}|${searchParams.get('country')}|${searchParams.get('round')}` : ''
  useEffect(() => {
    if (requestSignature) setSurveyIntent(surveyRequest(searchParams))
    // The signature is the dependency: other parameter changes must not re-apply a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestSignature])
  const [intentNotice, setIntentNotice] = useState<string>()
  const finishIntent = useCallback((notice?: string) => {
    setSurveyIntent(undefined)
    setIntentNotice(notice)
    setSearchParams((current) => withoutSurveyRequest(current), { replace: true })
  }, [setSearchParams])

  /** Deliberate moves push a history entry, so the browser's Back returns to the previous step. */
  const goTo = useCallback((step: FlowStep, options: { replace?: boolean } = {}) => {
    setSearchParams((current) => withFlowParams(current, { type, step: step === 'surveys' ? undefined : step }), { replace: options.replace })
  }, [setSearchParams, type])
  const chooseType = useCallback((next: FlowType | undefined) => {
    setSearchParams((current) => withFlowParams(current, { type: next, step: undefined }))
  }, [setSearchParams])

  useEffect(() => {
    if (type === 'microdata' && location.hash === '#step-household') {
      document.getElementById('step-household')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    }
  }, [type, location.hash])

  const householdData = Boolean(auth.user?.capabilities?.householdData)
  const [microdataResources, setMicrodataResources] = useState<ResolvedDataResource[]>()
  const [microdataBusy, setMicrodataBusy] = useState(false)
  const { discovery: grantDiscovery, checking: grantChecking, check: recheckGrants, pending: grantPending } = useMicrodataGrants({ busy: microdataBusy })
  const hasActiveGrant = Boolean(grantDiscovery?.bundles.some((bundle) => bundle.status === 'active'))
  // Each path held gets named; both at once is its own state rather than one
  // path standing in for the other.
  const microdataAccess: MicrodataAccess = hasActiveGrant
    ? householdData ? 'temporaryGrantAndHouseholdGroup' : 'temporaryGrant'
    : householdData ? 'householdGroup' : 'none'
  // Without any microdata path there is no list to apply a request to; the
  // page offers the catalogue and the request form instead.
  useEffect(() => {
    if (type === 'microdata' && surveyIntent && grantDiscovery && !grantChecking && !householdData && !hasActiveGrant) finishIntent()
  }, [finishIntent, grantChecking, grantDiscovery, hasActiveGrant, householdData, surveyIntent, type])

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
  const [layoutPreference, setLayoutPreference] = useState<BundleLayout>('per-survey')
  const [droppedCount, setDroppedCount] = useState(0)
  /** The survey a user tried to add past the cap, so the refusal is said on its row. */
  const [limitNotice, setLimitNotice] = useState<string>()
  /** Collection dates from the survey register, keyed `ISO3:round`. */
  const [collectionPeriods, setCollectionPeriods] = useState<Map<string, SurveyCollectionPeriod>>()
  const microdataCollectionDates = useMemo(() => collectionPeriods && new Map([...collectionPeriods].map(([key, period]) => [key, collectionPeriodLabel(period)])), [collectionPeriods])
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
  const countAbort = useRef<AbortController | undefined>(undefined)
  const [countCancelled, setCountCancelled] = useState(false)
  /** The package an automatic count last started for, so it runs once per package, not per render. */
  const countAttempted = useRef<string | undefined>(undefined)
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(() => new Set())

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
    setLayoutPreference(readStoredLayout(accountKey, scope))
  }, [accountKey, scope])

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

  /*
   * A link's survey request, applied once discovery has settled and only to
   * surveys this account was offered. An explicit request replaces the stored
   * selection rather than merging with it: the link says what it wants.
   */
  useEffect(() => {
    if (type !== 'aggregated' || !surveyIntent || !settled) return
    const outcome = resolveSurveyRequest(surveyIntent, surveys, isContributor ? undefined : SELECTION_LIMIT)
    if (outcome.countries.length) setExpandedCountries((current) => new Set([...current, ...outcome.countries]))
    // A link naming surveys replaces the selection even when none of them could
    // be selected, so an earlier choice is never mistaken for the one asked
    // for. A country-only link just opens the country and keeps the selection.
    if (outcome.keys.length || surveyIntent.keys.length || surveyIntent.round !== undefined) {
      setSelection((current) => ({ ...current, [scope]: outcome.keys }))
      writeStoredSelection(accountKey, scope, outcome.keys)
      setDroppedCount(0)
    }
    finishIntent(describeRequestOutcome({ ...outcome, complete: result?.status === 'complete', limit: SELECTION_LIMIT }))
  }, [accountKey, finishIntent, isContributor, result?.status, scope, settled, surveyIntent, surveys, type])

  // Collection dates for the list. Best effort: without them a row still shows
  // its round and generation, and the package states the dates on its own.
  const periodRequest = settled ? surveys.map((survey) => `${survey.adm0Iso3}:${survey.round}`).sort().join(',') : ''
  useEffect(() => {
    if (!periodRequest) return
    const controller = new AbortController()
    const identities = periodRequest.split(',').map((key) => {
      const [adm0Iso3, round] = key.split(':')
      return { adm0Iso3, round: Number(round) }
    })
    fetchSurveyCollectionPeriods(identities, controller.signal)
      .then(setCollectionPeriods)
      .catch(() => { if (!controller.signal.aborted) setCollectionPeriods(new Map()) })
    return () => controller.abort()
  }, [periodRequest])

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

  const toggleSurvey = useCallback((key: string) => {
    const keys = selection[scope]
    // Past the cap a click is refused out loud, on the row, rather than ignored.
    if (!keys.includes(key) && !isContributor && keys.length >= SELECTION_LIMIT) {
      setLimitNotice(key)
      return
    }
    setLimitNotice(undefined)
    setSelection((current) => {
      const keys = current[scope]
      const next = keys.includes(key)
        ? keys.filter((value) => value !== key)
        : [...keys, key]
      writeStoredSelection(accountKey, scope, next)
      return { ...current, [scope]: next }
    })
    setDroppedCount(0)
  }, [accountKey, isContributor, scope, selection])

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
   * Counts are measured for a settled package, never on every checkbox.
   *
   * Ten surveys across five themes is fifty queries; running those while
   * somebody is still clicking would cost far more than it tells them. The
   * count starts on its own when the Review step opens, once per package, and
   * by request after that. Each run owns its controller: a superseded or
   * cancelled run can no longer write progress, counts or focus.
   */
  async function runPreflight() {
    const slices = plan.flatMap((entry) => entry.included.map((theme) => ({ survey: entry.survey, theme })))
    if (!slices.length) return
    countAbort.current?.abort()
    const controller = new AbortController()
    countAbort.current = controller
    setCountCancelled(false)
    setCountProgress({ done: 0, total: slices.length })
    try {
      const measured = await countSurveySlices(slices, auth.requestProtected, (done, total) => {
        if (countAbort.current === controller) setCountProgress({ done, total })
      }, { signal: controller.signal })
      if (countAbort.current === controller && !controller.signal.aborted) {
        setCounts(measured)
        setFocusPreflight((value) => value + 1)
      }
    } catch {
      if (countAbort.current === controller) setCountCancelled(true)
    } finally {
      if (countAbort.current === controller) {
        countAbort.current = undefined
        setCountProgress(undefined)
      }
    }
  }

  // Any change to what would be packaged invalidates a measurement of it, and
  // every outcome of building the previous package: a "cancelled" or "ready"
  // left on screen would describe a package that no longer exists. A count
  // still running for the old package is stopped; its answer would be stale.
  useEffect(() => {
    if (countAbort.current) {
      const running = countAbort.current
      countAbort.current = undefined
      running.abort()
      setCountProgress(undefined)
    }
    setCounts(undefined)
    setCountCancelled(false)
    setBundleReady(undefined)
    setBundleError(undefined)
    setBundleCancelled(false)
  }, [activeThemeIds, selectedKeys, accountKey])

  const bundleSlices = useMemo(
    () => plan.flatMap((entry) => entry.included.map((theme) => ({ survey: entry.survey, theme }))),
    [plan],
  )
  const layout: BundleLayout = selectedSurveys.length > 1 ? layoutPreference : 'per-survey'
  const generatedGroups = useMemo(() => groupBundleSlices(bundleSlices), [bundleSlices])
  const generatedFileNames = useMemo(() => combinedFileNames(generatedGroups), [generatedGroups])
  const fileCount = bundleDataFileCount(bundleSlices, layout)

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
    const budgetProblem = packageBudgetProblem(countedRecords, fileCount, budget, bundleSlices.length)
    if (budgetProblem) return budgetProblem
    if (layout === 'combined-by-source') {
      for (const group of generatedGroups) {
        const total = group.reduce((sum, { survey, theme }) => sum + (counts?.find((entry) => entry.surveyKey === survey.key && entry.themeId === theme.id)?.count || 0), 0)
        if (total > BROWSER_EXPORT_LIMIT) return `${group[0].theme.label} (${GENERATIONS[group[0].survey.generation].label}) would make a ${formatNumber(total)}-record CSV, above the ${formatNumber(BROWSER_EXPORT_LIMIT)}-record file limit. Use separate survey folders for this selection.`
      }
    }
    return undefined
  })()

  /*
   * Guided steps for aggregated data. A step may be shown only when every step
   * before it is finished; until discovery settles the selection is not known,
   * so the first step is shown and the URL is left alone.
   */
  const aggregatedReady = (step: FlowStep) => {
    if (step === 'surveys') return true
    if (step === 'options') return selectedSurveys.length > 0
    if (step === 'review') return selectedSurveys.length > 0 && fileCount > 0
    return selectedSurveys.length > 0 && fileCount > 0 && !downloadBlocker
  }
  const aggregatedStep: FlowStep = type !== 'aggregated' || !settled || surveyIntent
    ? 'surveys'
    : guardedStep(FLOW_STEPS.aggregated, requested, aggregatedReady)
  useEffect(() => {
    if (type === 'aggregated' && settled && !surveyIntent && aggregatedStep !== requested) goTo(aggregatedStep, { replace: true })
  }, [aggregatedStep, goTo, requested, settled, surveyIntent, type])
  useStepHeadingFocus('aggregated-step', aggregatedStep)

  const packageKey = `${accountKey}|${bundleSlices.map(({ survey, theme }) => `${survey.key}|${theme.id}`).join(',')}`
  useEffect(() => {
    if (aggregatedStep !== 'review' || !bundleSlices.length || countsCoverPackage || countAbort.current || unconfirmedCount > 0) return
    if (countAttempted.current === packageKey) return
    countAttempted.current = packageKey
    void runPreflight()
    // runPreflight reads the current plan; the package key is what identifies it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aggregatedStep, bundleSlices.length, countsCoverPackage, packageKey, unconfirmedCount])
  // Leaving Review stops a count in progress; coming back offers it again rather than restarting it.
  useEffect(() => {
    if (aggregatedStep !== 'review') countAbort.current?.abort()
  }, [aggregatedStep])

  function chooseLayout(next: BundleLayout) {
    setLayoutPreference(next)
    writeStoredLayout(accountKey, scope, next)
    setBundleReady(undefined)
    setBundleError(undefined)
    setBundleCancelled(false)
  }

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
        layout,
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

  // Leaving the page must not leave an archive building, or a count running, against a dead session.
  useEffect(() => () => {
    bundleAbort.current?.abort()
    countAbort.current?.abort()
  }, [])

  function toggleTheme(id: string) {
    setChosenThemes((current) => (
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    ))
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
    return <><SiteHeader/><main className="workspace-loading"><span className="loader"/><strong>Opening Your surveys</strong></main><SiteFooter/></>
  }
  if (auth.status !== 'authenticated') return <><SiteHeader/><SignInGate type={type}/><SiteFooter/></>

  const otherType: FlowType = type === 'microdata' ? 'aggregated' : 'microdata'

  return (
    <>
      <SiteHeader/>
      <main id="top" className="workspace-page">
        <section className="workspace-hero">
          <div className="section-wrap">
            <span className="eyebrow"><span/> Your surveys</span>
            <h1>{type ? FLOW_TITLES[type] : 'Which data do you need?'}</h1>
            <p>{type === 'microdata'
              ? 'Choose household surveys your account can open, check access, accept the microdata licence and prepare the download, one step at a time.'
              : type === 'aggregated'
                ? 'Choose surveys by country and round, pick the themes you need, and download them with the documentation for each questionnaire generation.'
                : 'DIEM household survey data comes in two forms. Choose one to start; you can switch at any time.'}</p>
          </div>
        </section>

        {!type && (
          <section className="workspace-summary workspace-entry" aria-label="Choose the data type">
            <div className="section-wrap">
              <AggregatedAccessCard
                result={result}
                onRetry={() => setReloadVersion((value) => value + 1)}
                action={<button type="button" className="access-card-choose" onClick={() => chooseType('aggregated')}>Choose aggregated data<Icon name="arrow"/></button>}
              />
              <MicrodataAccessCard onOpen={() => chooseType('microdata')}/>
            </div>
          </section>
        )}

        {type && (
          <div className="section-wrap flow-header">
            <p className="flow-switch">
              {FLOW_TITLES[type]}
              <button type="button" onClick={() => chooseType(otherType)}>Switch to {FLOW_TITLES[otherType].toLowerCase()}</button>
            </p>
            {intentNotice && <p className="survey-dropped flow-intent-notice" role="status">{intentNotice}</p>}
          </div>
        )}

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
          {/* Both routes stay mounted, so switching keeps each one's own
              selection: the two packages are separate. */}
          <div className="workspace-panel" id="panel-aggregated" hidden={type !== 'aggregated'}>
              <FlowStepList
                id="aggregated-steps"
                steps={FLOW_STEPS.aggregated}
                current={aggregatedStep}
                done={(step) => FLOW_STEPS.aggregated.indexOf(step) < FLOW_STEPS.aggregated.indexOf(aggregatedStep)}
                reachable={(step) => guardedStep(FLOW_STEPS.aggregated, step, aggregatedReady) === step}
                onSelect={(step) => goTo(step)}
              />
              <p className="flow-selection" aria-live="polite">
                {formatNumber(selectedSurveys.length)} survey{selectedSurveys.length === 1 ? '' : 's'} selected
                {selectedSurveys.length > 0 && `: ${selectedSurveys.slice(0, 4).map((survey) => `${survey.countryName} round ${survey.round}`).join(', ')}${selectedSurveys.length > 4 ? ` and ${formatNumber(selectedSurveys.length - 4)} more` : ''}`}
              </p>
              <FlowStepPanel id="aggregated-step" step="surveys" current={aggregatedStep} title={<><span>1</span>Select surveys</>}>

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
                              const locked = !checked && atLimit
                              const noticeId = `limit-${survey.key}`
                              const period = collectionPeriods?.get(`${survey.adm0Iso3}:${survey.round}`)
                              const generation = GENERATIONS[survey.generation]
                              return (
                                <div key={survey.key} className={checked ? 'survey-row survey-row--selected' : locked ? 'survey-row survey-row--locked' : 'survey-row'}>
                                  {/* Only the checkbox and round form the label: the
                                      generation is a link, and a link cannot live in one.
                                      Rows past the cap stay clickable, so the click can
                                      explain itself instead of doing nothing. */}
                                  <label className="survey-row-pick">
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      aria-disabled={locked || undefined}
                                      aria-describedby={limitNotice === survey.key ? noticeId : undefined}
                                      onChange={() => toggleSurvey(survey.key)}
                                      aria-label={`${survey.countryName}, round ${survey.round}`}
                                    />
                                    <span className="survey-row-round">Round {survey.round}</span>
                                  </label>
                                  <span className="survey-row-dates">
                                    {period ? collectionPeriodLabel(period) : collectionPeriods ? 'Dates not recorded' : ''}
                                  </span>
                                  <Link
                                    className="survey-row-generation"
                                    to="/data/guide#generations"
                                    title={`${generation.label}: ${generation.name}. Why each questionnaire generation has its own structure and documentation`}
                                  >
                                    {generation.label}
                                  </Link>
                                  <span className="survey-row-themes">{survey.themes.length} theme{survey.themes.length === 1 ? '' : 's'}</span>
                                  <span className={survey.testData ? 'survey-row-status survey-row-status--test' : 'survey-row-status'}>
                                    {survey.testData ? 'Test data' : 'Published'}
                                  </span>
                                  {limitNotice === survey.key && locked && (
                                    <p className="survey-row-limit" id={noticeId} role="alert">
                                      Round {survey.round} was not added: one package holds up to {SELECTION_LIMIT} surveys and you have selected {SELECTION_LIMIT}. Remove a selected survey to include this one, or download this package first and build a second one.
                                    </p>
                                  )}
                                </div>
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
                <FlowActions
                  id="aggregated-surveys"
                  onNext={() => goTo('options')}
                  nextDisabled={!aggregatedReady('options')}
                  nextLabel="Next: options"
                  hint={aggregatedReady('options') ? undefined : 'Select at least one survey to continue.'}
                />
              </FlowStepPanel>

              {/* Each step states its own prerequisite rather than presenting a
                  disabled region nobody can enter. */}
              <FlowStepPanel id="aggregated-step" step="options" current={aggregatedStep} title={<><span>2</span>Choose thematic areas and layout</>}>
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

                    {selectedSurveys.length > 1 && (
                      <fieldset className="package-layout-choice flow-layout-choice">
                        <legend>How should the data be arranged?</legend>
                        <div className="package-layout-options">
                          <label>
                            <input type="radio" name="package-layout" checked={layout === 'per-survey'} disabled={Boolean(bundleProgress)} onChange={() => chooseLayout('per-survey')}/>
                            <span><strong>Separate survey folders</strong><small>One CSV per survey and theme.</small></span>
                          </label>
                          <label>
                            <input type="radio" name="package-layout" checked={layout === 'combined-by-source'} disabled={Boolean(bundleProgress)} onChange={() => chooseLayout('combined-by-source')}/>
                            <span><strong>Combine compatible surveys</strong><small>One CSV per theme and questionnaire generation when surveys use the same source. Country and round identify each row.</small></span>
                          </label>
                        </div>
                      </fieldset>
                    )}
                  </>
                )}
                <FlowActions
                  id="aggregated-options"
                  onBack={() => goTo('surveys')}
                  onNext={() => goTo('review')}
                  nextDisabled={!aggregatedReady('review')}
                  nextLabel="Next: review"
                  hint={aggregatedReady('review') ? undefined : 'Choose at least one thematic area that your selected surveys carry.'}
                />
              </FlowStepPanel>

              <FlowStepPanel id="aggregated-step" step="review" current={aggregatedStep} title={<><span>3</span>Review package</>}>
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
                            <th scope="col">{layout === 'per-survey' ? 'Files' : 'Themes'}</th>
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

                    {layout === 'combined-by-source' && (
                      <div className="package-generated-files">
                        <h3>Generated data files</h3>
                        <ul>{generatedGroups.map((group) => (
                          <li key={bundleSourceKey(group[0].theme)}>
                          <strong>{generatedFileNames.get(bundleSourceKey(group[0].theme))}</strong> — {group.length} survey{group.length === 1 ? '' : 's'} · {GENERATIONS[group[0].survey.generation].label}
                            {countsCoverPackage && !countErrors && ` · ${formatNumber(group.reduce((sum, { survey, theme }) => sum + (counts?.find((entry) => entry.surveyKey === survey.key && entry.themeId === theme.id)?.count || 0), 0))} records`}
                          </li>
                        ))}</ul>
                      </div>
                    )}

                    {/* The count starts by itself when this step opens; the
                        button is the retry after a failure or a cancellation. */}
                    <div className="package-actions">
                      <button type="button" onClick={() => { countAttempted.current = packageKey; void runPreflight() }} disabled={Boolean(countProgress) || Boolean(bundleProgress)}>
                        {countProgress
                          ? `Counting… ${formatNumber(countProgress.done)} of ${formatNumber(countProgress.total)}`
                          : countsCoverPackage ? 'Count records again' : 'Count records'}
                      </button>
                      {countProgress && (
                        <button type="button" className="package-cancel" onClick={() => countAbort.current?.abort()}>Cancel count</button>
                      )}
                    </div>
                    <p className="package-status" aria-live="polite">
                      {countProgress ? `Counting records: ${formatNumber(countProgress.done)} of ${formatNumber(countProgress.total)} files checked.` : ''}
                    </p>
                    {countCancelled && !countProgress && (
                      <p className="package-outcome" role="status">The count was stopped before it finished. Count records to check this package again.</p>
                    )}
                    {!countProgress && (downloadBlocker || countsCoverPackage) && (
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
                  </>
                )}
                <FlowActions
                  id="aggregated-review"
                  onBack={() => goTo('options')}
                  onNext={() => goTo('download')}
                  nextDisabled={!aggregatedReady('download')}
                  nextLabel="Next: download"
                  hint={aggregatedReady('download') ? undefined : countProgress ? 'Counting records. Please wait.' : 'The package can be downloaded once its records are counted and every check passes.'}
                />
              </FlowStepPanel>

              <FlowStepPanel id="aggregated-step" step="download" current={aggregatedStep} title={<><span>4</span>Download</>}>
                {fileCount > 0 && (
                  <>
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
                          , with documentation for each questionnaire generation
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
                            : `${bundleReady} downloaded. ${layout === 'combined-by-source' ? 'It contains combined data files grouped by questionnaire generation, with survey details and documentation.' : 'It contains one folder per survey, with data and documentation.'}`}
                      </p>
                    )}
                  </>
                )}
                <FlowActions id="aggregated-download" onBack={() => goTo('review')}/>
              </FlowStepPanel>
          </div>

          <div className="workspace-panel" id="panel-microdata" hidden={type !== 'microdata'}>
            {(householdData || hasActiveGrant || grantChecking || grantDiscovery?.error) && <MicrodataAccessSummary discovery={grantDiscovery} checking={grantChecking} householdData={householdData} recheck={() => void recheckGrants()} />}
            {householdData || hasActiveGrant ? <MicrodataPackagePicker grantDiscovery={grantDiscovery} grantPending={grantPending} grantChecking={grantChecking}
              householdData={householdData} contributor={isContributor} testMode={testMode}
              licenceAccess={microdataAccess} collectionDates={microdataCollectionDates} onBusyChange={setMicrodataBusy} onRecheck={() => void recheckGrants()}
              active={type === 'microdata'} requested={type === 'microdata' ? requested : 'surveys'} onStep={goTo}
              request={type === 'microdata' ? surveyIntent : undefined} onRequestApplied={finishIntent} /> : <section className="workspace-step" id="step-microdata-package">
              {/* No microdata path yet: the two routes are offered at once rather
                  than an empty survey list to step through. */}
              <h2>Get household microdata</h2>
              <p>{grantChecking ? 'Checking your approved surveys…' : 'Your account has no approved microdata access yet. Published DIEM microdata is in the FAO Microdata Catalogue (FAM); for a survey that has not reached it, request direct access.'}</p>
              <div className="workspace-step-actions">
                <a href={FAM_URL} target="_blank" rel="noreferrer">Browse DIEM collections in the FAO Microdata Catalogue<Icon name="external"/></a>
                <Link to="/data/microdata-request">Request microdata access<Icon name="arrow"/></Link>
              </div>
              <details className="microdata-help"><summary>Microdata licence</summary><MicrodataLicence access={microdataAccess} /></details>
            </section>}
            <details className="microdata-help microdata-reference" open={location.hash === '#step-household' || undefined}><summary>Documentation and reference data</summary>
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

            {/* The boundary layers were reachable only from the collapsed
                technical panel below, which people did not open. Surveys carry
                pcodes and nothing else, so the layer that resolves them belongs
                in the visible flow. */}
            <section className="workspace-step" aria-labelledby="step-boundaries">
              <h2 id="step-boundaries">Administrative reference boundaries</h2>
              <p>Survey records carry ADM1 and ADM2 pcodes. Join them to these layers to map results or to read unit names. If a pcode is missing from the current layer, the boundary has since changed and the archive holds the configuration in use at the time of collection. <Link to="/data/guide#boundaries">How the boundaries are compiled</Link></p>
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
            </section>

            </details>
              <details className="microdata-help">
                <summary>Need access to more surveys? Browse published collections or request access</summary>
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
              </details>

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
                      <a href={`${DATA_PORTAL}/home/item.html?id=${source.resourceId}`} target="_blank" rel="noreferrer">Source details<Icon name="external"/></a>
                    </span>
                  </li>
                ))}
              </ul>
              {!isContributor ? null : !testMode ? (
                <button type="button" className="test-mode-open" onClick={enterTestMode}>
                  <Icon name="flask"/>Open test-data mode
                  <small>Shows simulated review surveys instead of production surveys. Test and production data never share a package.</small>
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
                      {(() => {
                        const href = resource.staticLink || resource.href || `${DATA_PORTAL}/home/item.html?id=${resource.id}`
                        const path = hubPath(href)
                        return path
                          ? <Link to={path}>Open</Link>
                          : <a href={href} target="_blank" rel="noreferrer">Open<Icon name="external"/></a>
                      })()}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="technical-resources-note">
                {GENERATIONS.v3.label} field descriptions and codebook are not published yet; they are released with the first {GENERATIONS.v3.label} survey. Do not use an earlier generation's documentation in their place.
              </p>

              <h3 className="technical-resources-heading">API and analysis tools</h3>
              <ul className="source-rows">
                {ANALYSIS_TOOLS.map((tool) => (
                  <li key={tool.href}>
                    <span className="source-row-title"><strong>{tool.title}</strong><small>{tool.kind}</small></span>
                    <span/>
                    <span className="source-row-message">{tool.description}</span>
                    <span className="source-row-links"><a href={tool.href} target="_blank" rel="noreferrer">Repository<Icon name="external"/></a></span>
                  </li>
                ))}
              </ul>
              <p className="technical-resources-note">
                Every package carries these links for each survey, with the documentation for its generation, in <code>documentation_and_metadata.txt</code>.
              </p>

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
