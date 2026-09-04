import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../data-access.css'
import { useAuth } from '../auth/AuthContext'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { formatDate } from '../lib/catalog'
import {
  AGGREGATE_RESOURCES,
  ALL_PROTECTED_DATA_RESOURCES,
  ARCHIVE_GENERATIONS,
  DOCUMENTATION_RESOURCES,
  GENERATIONS,
  MICRODATA_RESOURCES,
  REFERENCE_GENERATION,
  REFERENCE_RESOURCES,
  authoritativeResourceUrl,
  fetchProtectedDataWorkspace,
  protectedItemThumbnailUrl,
  resourcesForGeneration,
  type DataGeneration,
  type ProtectedDataResource,
  type ResolvedDataResource,
} from '../services/protectedData'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const ACCESS_REQUEST_URL = 'https://data-in-emergencies.fao.org/feedback/surveys/c224d7e568fb464fbfbca2fff047707f/explore'
const QUESTIONNAIRES_URL = 'https://data-in-emergencies.fao.org/search?sort=Date%20Created%7Ccreated%7Cdesc&tags=household%2520survey%2520questionnaire'
const FAM_URL = 'https://microdata.fao.org/index.php/catalog/Emergencies-Monitoring-Surveys/?page=1&sort_by=popularity&sort_order=desc&ps=15&repo=Emergencies-Monitoring-Surveys'

// Layout harness. Renders the authenticated workspace for anonymous visitors
// with fabricated resolutions, so the layout can be reviewed without a session.
// It bypasses the access tiers entirely, so it MUST stay false everywhere except
// a local styling pass. Never commit or deploy it set to true.
const STYLE_PREVIEW = false

const PREVIEW_SERVICE_TITLES: Record<string, string> = {
  f6b197ea47bd4663aa0ccd10b4d4ea9d: 'diem_adm_repr_1_mview_noshape',
  f6f876ca3a4d4108becd17da8247b78e: 'diem_adm_repr_2_mview_noshape',
  a313b15f51d34c2b8cb3516274461ec1: 'diem_adm_repr_3_mview_noshape',
  a870f5dac1064aab806258e8c3bdd284: 'diem_adm_repr_4_mview_noshape',
  '4f1fd777958a4495bd2b4a5c024df779': 'diem_adm_repr_5_mview_noshape',
  fd3f8386f8dd40abaa6fdbc033580b65: 'hh_master_table_2026_core_projection',
  '877fb415ef4e4ef28967fa4b49670ee5': 'hh_master_table_2026_optional_projection',
}

function previewResources(): ResolvedDataResource[] {
  return ALL_PROTECTED_DATA_RESOURCES.map((resource) => ({
    ...resource,
    access: 'available',
    item: resource.staticLink ? undefined : {
      id: resource.id,
      title: PREVIEW_SERVICE_TITLES[resource.id] || resource.fallbackTitle,
      type: 'Feature Service',
      owner: 'diem_publisher',
      modified: Date.UTC(2026, 6, 8),
      access: 'org',
    },
  }))
}

type IconName = 'lock' | 'download' | 'table' | 'book' | 'code' | 'map' | 'arrow' | 'check' | 'external' | 'shield' | 'flask'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 9v11M15 9v11"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></>,
    code: <><path d="m8 9-4 3 4 3M16 9l4 3-4 3M14 5l-4 14"/></>,
    map: <><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
    flask: <><path d="M9 3h6M10 3v6L4.6 18a1.5 1.5 0 0 0 1.3 2.3h12.2a1.5 1.5 0 0 0 1.3-2.3L14 9V3"/><path d="M7.5 15h9"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

// Short enough to stay on one line inside a card chip. The action control at the
// foot of the card carries the longer explanation.
function statusCopy(resource: ResolvedDataResource) {
  if (resource.access === 'available') return 'Available'
  if (resource.access === 'restricted') return 'Access required'
  if (resource.access === 'error') return 'Check failed'
  return 'Checking'
}

function ResourceAction({ resource, label = 'Open and download' }: { resource: ResolvedDataResource; label?: string }) {
  if (resource.access === 'available') {
    if (!resource.staticLink && (resource.kind === 'microdata' || resource.kind === 'aggregate' || resource.kind === 'reference')) {
      return <Link className="data-resource-action" to={`/data/${resource.id}`}>Explore data<Icon name="arrow" /></Link>
    }
    return <a className="data-resource-action" href={authoritativeResourceUrl(resource)} target="_blank" rel="noreferrer">{label}<Icon name="external" /></a>
  }
  if (resource.kind === 'microdata' && resource.access === 'restricted') {
    return <span className="data-resource-action data-resource-action--disabled">Requires approved microdata access</span>
  }
  return <span className="data-resource-action data-resource-action--disabled">Not available</span>
}

/**
 * The heading is the curated label, not the live ArcGIS title.
 *
 * Infrastructure services are named for the pipeline that builds them
 * (`diem_adm_repr_1_mview_noshape`), which is correct there and unreadable
 * here. ArcGIS stays authoritative for the data; the Hub owns how it is
 * introduced. The live title is still shown, as a subdued source line, so the
 * underlying service is never hidden from anyone who needs it.
 */
/**
 * The item's own thumbnail, when it has a distinctive one.
 *
 * Protected item images need the session, so the bytes are fetched with the
 * token in a header and shown from an object URL. The token therefore never
 * appears in the `src`, and a card with no usable image simply renders as it
 * did before rather than leaving a broken frame.
 */
function DatasetThumbnail({ resource }: { resource: ResolvedDataResource }) {
  const auth = useAuth()
  const [source, setSource] = useState<string>()
  const url = protectedItemThumbnailUrl(resource.item)

  useEffect(() => {
    if (!url) return
    let objectUrl: string | undefined
    let active = true
    auth.fetchProtectedImage(url).then((blob) => {
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setSource(objectUrl)
    })
    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [auth, url])

  if (!source) return null
  return <div className={`dataset-card-thumb${resource.kind === 'microdata' ? ' dataset-card-thumb--microdata' : ''}`}><img src={source} alt="" loading="lazy" /></div>
}

function DatasetCard({ resource, icon = 'table' }: { resource: ResolvedDataResource; icon?: IconName }) {
  const liveTitle = resource.item?.title
  const archived = resource.version !== REFERENCE_GENERATION
  return (
    <article className={`dataset-card${archived ? ' dataset-card--archived' : ''}`}>
      <DatasetThumbnail resource={resource} />
      <div className="dataset-card-topline">
        <span className="dataset-icon"><Icon name={icon} /></span>
        <span className={`access-chip access-chip--${resource.access}`}><i />{statusCopy(resource)}</span>
      </div>
      {/* Never the thematic layer: for an aggregated dataset that is the title
          again, and a card that says the same thing twice reads as a mistake. */}
      <div className="dataset-period">{resource.period || `${GENERATIONS[resource.version].label} · ${GENERATIONS[resource.version].period}`}</div>
      <h3>{resource.fallbackTitle}</h3>
      <p>{resource.description}</p>
      <div className="dataset-facts">
        {resource.admFamily && <span>Aggregated at {resource.admFamily}</span>}
        {resource.item && <span>Updated {formatDate(resource.item.modified)}</span>}
      </div>
      {liveTitle && liveTitle !== resource.fallbackTitle && <div className="dataset-source" title={liveTitle}>{liveTitle}</div>}
      {resource.preview && <div className="dataset-preview-flag"><Icon name="flask" />Test records — not survey results</div>}
      <ResourceAction resource={resource} />
    </article>
  )
}

function SupportingLink({ resource }: { resource: ResolvedDataResource }) {
  return (
    <article className="supporting-resource">
      <span><Icon name="book" /></span>
      <div><strong>{resource.fallbackTitle}</strong><p>{resource.description}</p></div>
      <ResourceAction resource={resource} label="Open" />
    </article>
  )
}

function LoadingWorkspace() {
  return <main className="data-page data-page-loading"><span className="loader"/><strong>Checking your DIEM data access</strong><p>Reading protected resource permissions...</p></main>
}

/**
 * Tier 1. Anonymous visitors are told what exists and how to reach it. No
 * protected metadata is requested and no dataset is listed, because item
 * titles and update dates are themselves protected metadata.
 */
function SignInGate() {
  const auth = useAuth()
  const reference = GENERATIONS[REFERENCE_GENERATION]
  return (
    <main className="data-gate">
      <section className="data-gate-hero">
        <div className="data-gate-content section-wrap">
          <div className="data-gate-copy">
            <span className="eyebrow"><span/> DIEM Household Monitoring System Data</span>
            <h1>Household evidence,<br/><em>responsibly accessible.</em></h1>
            <p>DIEM monitoring data is open, accessible and reusable. Aggregated survey results, administrative reference boundaries, technical documentation and the data API are available to anyone with a DIEM community account. Household-level microdata follows a separate, documented route.</p>
            <div className="data-gate-actions">
              <button type="button" onClick={() => void auth.signIn()} disabled={auth.status === 'authenticating'}>
                <Icon name="lock" />{auth.status === 'authenticating' ? 'Opening sign in...' : 'Sign in or create an account'}
              </button>
              <Link className="data-gate-secondary" to="/data/guide"><Icon name="book" />Read the data access guide</Link>
            </div>
            <p className="data-gate-note"><Icon name="shield"/> Accounts are free. Privileges take about ten minutes to activate after you create one.</p>
          </div>
          <div className="data-gate-preview" aria-label="Available data collections">
            <div><span>01</span><Icon name="table"/><strong>Aggregated data</strong><small>To ADM1 or ADM2, by theme</small></div>
            <div><span>02</span><Icon name="download"/><strong>Household microdata</strong><small>Through FAM, or by request</small></div>
            <div><span>03</span><Icon name="map"/><strong>Reference boundaries</strong><small>Operational ADM1 and ADM2</small></div>
            <div><span>04</span><Icon name="code"/><strong>API and analysis tools</strong><small>Reproducible workflows</small></div>
          </div>
        </div>
      </section>

      <section className="guide-promo" aria-labelledby="guide-promo-heading">
        <div className="section-wrap">
          <div className="guide-promo-copy">
            <span className="kicker">Start here</span>
            <h2 id="guide-promo-heading">The DIEM data access guide</h2>
            <p>One place covering what DIEM publishes, the three questionnaire generations, how access is granted, how to download and cite the data, and what the licences allow. No account needed to read it.</p>
          </div>
          <Link className="guide-promo-action" to="/data/guide">
            <Icon name="book" />
            <span><strong>Read the guide</strong><small>11 sections · public</small></span>
            <Icon name="arrow" />
          </Link>
        </div>
      </section>

      <section className="data-gate-ladder section-wrap" aria-labelledby="access-ladder-heading">
        <div className="data-gate-ladder-intro">
          <span className="kicker">How access works</span>
          <h2 id="access-ladder-heading">Three levels, and what each one opens</h2>
          <p>Signing in opens the workspace. What you can actually download is decided by the permissions attached to your account, not by signing in.</p>
        </div>
        <ol className="access-ladder">
          <li>
            <span>01</span>
            <div>
              <strong>Without an account</strong>
              <p>You are reading it: what DIEM publishes, how it is organized, and how to obtain access. The full data access guide is public.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>With a DIEM community account</strong>
              <p>Aggregated survey data at the lowest available administrative level, administrative reference boundaries, all technical documentation, the API, and the microdata request form.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>With approved microdata access</strong>
              <p>Anonymized household-level records for the surveys covered by your approval, valid for a week and renewable.</p>
            </div>
          </li>
        </ol>
      </section>

      <section className="data-gate-generations section-wrap" aria-labelledby="generation-intro-heading">
        <div className="data-gate-ladder-intro">
          <span className="kicker">What you will find</span>
          <h2 id="generation-intro-heading">{reference.label} is the current standard</h2>
          <p>{reference.summary}</p>
        </div>
        <div className="generation-strip">
          {[REFERENCE_GENERATION, ...ARCHIVE_GENERATIONS].map((id) => {
            const generation = GENERATIONS[id]
            return (
              <article key={id} className={id === REFERENCE_GENERATION ? 'generation-strip-card generation-strip-card--reference' : 'generation-strip-card'}>
                <div className="generation-strip-topline"><strong>{generation.label}</strong><span>{id === REFERENCE_GENERATION ? 'Current standard' : 'Archived'}</span></div>
                <h3>{generation.name}</h3>
                <p className="generation-strip-period">{generation.period}</p>
                <p>{generation.summary}</p>
              </article>
            )
          })}
        </div>
        <p className="generation-strip-note">Every generation keeps its own field descriptions and codebooks, so archived rounds stay reproducible. Comparisons across generations may be limited or impossible for some variables.</p>
      </section>

      <section className="data-gate-microdata-note section-wrap">
        <div>
          <span className="kicker">Household-level data</span>
          <h2>Microdata is published through FAM</h2>
          <p>Anonymized DIEM microdata is published in the FAO Food and Agriculture Microdata Catalogue within about six months of the aggregated data being released here. That window is used for final editing, polishing and additional disclosure control. If you need household-level data from a more recent survey for research or operational purposes, create a DIEM account and submit a request.</p>
        </div>
        <div className="data-gate-microdata-actions">
          <a href={FAM_URL} target="_blank" rel="noreferrer">Browse DIEM data in FAM <Icon name="external"/></a>
          <a href={ACCESS_REQUEST_URL} target="_blank" rel="noreferrer">Open the microdata request form <Icon name="external"/></a>
        </div>
      </section>
    </main>
  )
}

const citations = [
  { language: 'English', text: 'FAO. 2026. DIEM-Monitoring. In: Data in Emergencies (DIEM) Hub. Rome. [Cited date]. https://data-in-emergencies.fao.org' },
  { language: 'Français', text: 'FAO. 2026. DIEM-Monitoring [DIEM-Suivi]. Dans : Data in Emergencies (DIEM) Hub. Rome. [Consulté le date]. https://data-in-emergencies.fao.org' },
  { language: 'Español', text: 'FAO. 2026. DIEM-Monitoring [DIEM-Monitoreo]. En: Data in Emergencies (DIEM) Hub. Roma. [Consultado el fecha]. https://data-in-emergencies.fao.org' },
]

function GenerationHeader({ id, reference }: { id: DataGeneration; reference: boolean }) {
  const generation = GENERATIONS[id]
  return (
    <div className={reference ? 'generation-header generation-header--reference' : 'generation-header'}>
      <div className="generation-header-title">
        <span className="generation-badge">{generation.label}</span>
        <div>
          <h3>{generation.name}</h3>
          <span>{generation.period}</span>
        </div>
      </div>
      <p>{reference ? generation.summary : generation.comparability}</p>
    </div>
  )
}

export default function DataAccess() {
  useDocumentTitle('Data access')
  const auth = useAuth()
  const [resources, setResources] = useState<ResolvedDataResource[]>()
  const [copied, setCopied] = useState<string>()
  const [loadVersion, setLoadVersion] = useState(0)

  useEffect(() => {
    if (STYLE_PREVIEW) {
      setResources(previewResources())
      return
    }
    if (auth.status !== 'authenticated') {
      setResources(undefined)
      return
    }
    let active = true
    fetchProtectedDataWorkspace(auth.requestProtected).then((results) => {
      if (active) setResources(results)
    })
    return () => { active = false }
  }, [auth.requestProtected, auth.status, loadVersion])

  useEffect(() => {
    if (!resources || !window.location.hash) return
    const targetId = window.location.hash.slice(1)
    if (!['microdata', 'aggregated', 'documentation', 'boundaries', 'tools'].includes(targetId)) return
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({ block: 'start' })
    })
  }, [resources])

  const resolved = useMemo(() => {
    const byId = new Map(resources?.map((resource) => [resource.id, resource]))
    return (resource: ProtectedDataResource): ResolvedDataResource => byId.get(resource.id) || { ...resource, access: 'checking' }
  }, [resources])

  const capabilities = STYLE_PREVIEW
    ? { contributor: true, aggregatedData: true, householdData: true }
    : auth.user?.capabilities
  const aggregatesFor = (generation: DataGeneration) => resourcesForGeneration(AGGREGATE_RESOURCES, generation).map(resolved)
  const microdataFor = (generation: DataGeneration) => resourcesForGeneration(MICRODATA_RESOURCES, generation).map(resolved)
  const documentationFor = (generation: DataGeneration) => resourcesForGeneration(DOCUMENTATION_RESOURCES, generation).map(resolved)
  const references = REFERENCE_RESOURCES.map(resolved)

  const availableCount = resources?.filter((resource) => resource.access === 'available').length || 0
  const accessChecked = Boolean(resources)
  const checkFailed = Boolean(resources?.some((resource) => resource.access === 'error'))
  // The provisioning window is only worth mentioning when it actually blocks
  // the user: no aggregated dataset resolved at all. Deriving it from group
  // capability instead produced a false alarm for accounts that could plainly
  // see their data, which is worse than saying nothing.
  const noAggregatesAvailable = accessChecked
    && !AGGREGATE_RESOURCES.map(resolved).some((resource) => resource.access === 'available')

  async function copyCitation(language: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(language)
    window.setTimeout(() => setCopied(undefined), 1800)
  }

  if (!STYLE_PREVIEW && auth.status === 'loading') return <><SiteHeader active="data"/><LoadingWorkspace/><SiteFooter/></>
  if (!STYLE_PREVIEW && auth.status !== 'authenticated') return <><SiteHeader active="data"/><SignInGate/><SiteFooter/></>

  const referenceAggregates = aggregatesFor(REFERENCE_GENERATION)
  const referenceMicrodata = microdataFor(REFERENCE_GENERATION)

  return (
    <>
      <SiteHeader active="data" />
      <main className="data-page">
        <section className="data-workspace-hero">
          <div className="section-wrap">
            <div className="data-workspace-heading">
              <span className="eyebrow"><span/> Authenticated data workspace</span>
              <h1>DIEM data access</h1>
              <p>Download analysis-ready household evidence, aggregated indicators and reference data with the documentation needed to use them responsibly.</p>
            </div>
            <aside className="account-access-card">
              <span className="account-check"><Icon name="check"/></span>
              <div>
                <small>Signed in as</small>
                <strong>{auth.user?.fullName || auth.user?.username}</strong>
                <span>{accessChecked ? `${availableCount} protected resources available` : 'Checking resource permissions...'}</span>
                {capabilities?.householdData && <span className="account-tier">Approved for household microdata</span>}
              </div>
              {checkFailed && <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>Retry checks</button>}
            </aside>
          </div>
        </section>

        <nav className="data-section-nav" aria-label="Data workspace sections">
          <div className="section-wrap">
            <a href="#aggregated">Aggregated data</a>
            <a href="#microdata">Microdata</a>
            <a href="#documentation">Documentation</a>
            <a href="#boundaries">Boundaries</a>
            <a href="#tools">API &amp; tools</a>
            <Link to="/data/guide">Full guide</Link>
          </div>
        </nav>

        {noAggregatesAvailable && (
          <div className="provisioning-banner" role="status">
            <div className="section-wrap">
              <Icon name="shield"/>
              <div>
                <strong>No aggregated datasets are available to your account yet</strong>
                <p>Access is assigned automatically and usually takes about ten minutes after an account is created. If you have just registered, wait a moment and check again. If this persists, contact the DIEM Hub team.</p>
              </div>
              <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>Check again</button>
            </div>
          </div>
        )}

        <section className="data-section data-section--tint" id="aggregated">
          <div className="section-wrap">
            <div className="data-section-heading">
              <div><span className="kicker">Administrative-level indicators</span><h2>Aggregated data</h2></div>
              <p>Survey data cleaned, weighted, aggregated and validated at the lowest administrative level each survey supports, then organized by thematic area.</p>
            </div>

            <GenerationHeader id={REFERENCE_GENERATION} reference />
            {referenceAggregates.some((resource) => resource.preview) && (
              <div className="preview-notice">
                <Icon name="flask"/>
                <p><strong>These services currently carry test records.</strong> The {GENERATIONS[REFERENCE_GENERATION].label} infrastructure is published and queryable, but it is loaded with simulated data while the questionnaire is finalized. Do not cite these figures as survey results.</p>
              </div>
            )}
            <div className="aggregate-grid">{referenceAggregates.map((resource) => <DatasetCard resource={resource} key={resource.id}/>)}</div>

            {ARCHIVE_GENERATIONS.map((generation) => {
              const items = aggregatesFor(generation)
              if (!items.length) return null
              return (
                <details className="archive-block" key={generation}>
                  <summary>
                    <span className="generation-badge generation-badge--muted">{GENERATIONS[generation].label}</span>
                    <span className="archive-block-title">{GENERATIONS[generation].name}</span>
                    <span className="archive-block-period">{GENERATIONS[generation].period}</span>
                    <span className="archive-block-count">{items.length} datasets</span>
                  </summary>
                  <div className="archive-block-body">
                    <p className="archive-block-note">{GENERATIONS[generation].comparability}</p>
                    <div className="aggregate-grid">{items.map((resource) => <DatasetCard resource={resource} key={resource.id}/>)}</div>
                    <div className="archive-block-docs">
                      <h4>Documentation for {GENERATIONS[generation].label}</h4>
                      {documentationFor(generation).map((resource) => <SupportingLink resource={resource} key={resource.id}/>)}
                    </div>
                  </div>
                </details>
              )
            })}
          </div>
        </section>

        <section className="data-section section-wrap" id="microdata">
          <div className="data-section-heading">
            <div><span className="kicker">Household-level evidence</span><h2>Microdata</h2></div>
            <p>Records are fully anonymized and released in coded form. Some fields are withheld to reduce the risk of identifying individuals and groups.</p>
          </div>

          <div className="microdata-routes">
            <article className="microdata-route microdata-route--primary">
              <span className="microdata-route-step">Start here</span>
              <h3>FAO Microdata Catalogue (FAM)</h3>
              <p>FAM is the one-stop catalogue for FAO farm and household survey microdata. Anonymized DIEM microdata is published there within about six months of the aggregated data being released on this Hub, once final editing, polishing and additional disclosure control are complete.</p>
              <a href={FAM_URL} target="_blank" rel="noreferrer">Browse DIEM collections in FAM <Icon name="external"/></a>
            </article>
            <article className="microdata-route">
              <span className="microdata-route-step">If you need it sooner</span>
              <h3>Request direct access</h3>
              <p>If your research or operational work needs household-level data from a survey that has not reached FAM yet, submit a request. Requests are evaluated within about two working days. Access is granted in justified cases to users with institutional email addresses, is valid for a week, and can be extended.</p>
              <a href={ACCESS_REQUEST_URL} target="_blank" rel="noreferrer">Open the request form <Icon name="external"/></a>
            </article>
          </div>

          <section className="microdata-licence" aria-labelledby="microdata-licence-heading">
            <div className="microdata-licence-head">
              <span className="kicker">Microdata licence</span>
              <h3 id="microdata-licence-heading">Conditions of use</h3>
              <p>Aggregated data is CC BY 4.0. Microdata is not. Submitting a request means agreeing to the conditions below, and they continue to apply for as long as you hold the data.</p>
            </div>
            <div className="microdata-licence-body">
              <div>
                <h4>Confidentiality</h4>
                <p>Users shall not take any action with the purpose of identifying any individual entity — person, household or enterprise — in the microdataset. If such a disclosure is made inadvertently, no use will be made of the information and it will be reported immediately to FAO.</p>
              </div>
              <div>
                <h4>Access conditions</h4>
                <p>Microdatasets disseminated by FAO are released for research and statistical purposes only. Users working for a commercial company will not be granted access, regardless of the stated purpose. Users requesting access must agree that:</p>
                <ul>
                  <li>the microdataset will be used only for statistical or research purposes;</li>
                  <li>any results derived from it will report aggregated information only, never specific individual entities or data subjects;</li>
                  <li>no action will be taken with the purpose of identifying any individual entity in the microdataset;</li>
                  <li>the microdataset will not be redisseminated, or shared with anyone other than the individuals granted access by FAO.</li>
                </ul>
                <p className="microdata-licence-aside">On that last point: if colleagues will work with the data, tell the DIEM Hub team so they can be granted access too.</p>
              </div>
            </div>
            <a className="microdata-licence-cta" href={ACCESS_REQUEST_URL} target="_blank" rel="noreferrer">I accept these conditions — open the request form <Icon name="arrow"/></a>
          </section>

          {capabilities?.householdData ? (
            <div className="microdata-datasets">
              <GenerationHeader id={REFERENCE_GENERATION} reference />
              <div className="microdata-cards">{referenceMicrodata.map((resource) => <DatasetCard resource={resource} icon="download" key={resource.id}/>)}</div>
              {ARCHIVE_GENERATIONS.map((generation) => {
                const items = microdataFor(generation)
                if (!items.length) return null
                return (
                  <details className="archive-block" key={generation}>
                    <summary>
                      <span className="generation-badge generation-badge--muted">{GENERATIONS[generation].label}</span>
                      <span className="archive-block-title">{GENERATIONS[generation].name}</span>
                      <span className="archive-block-period">{GENERATIONS[generation].period}</span>
                      <span className="archive-block-count">{items.length} datasets</span>
                    </summary>
                    <div className="archive-block-body">
                      <p className="archive-block-note">{GENERATIONS[generation].comparability}</p>
                      <div className="microdata-cards">{items.map((resource) => <DatasetCard resource={resource} icon="download" key={resource.id}/>)}</div>
                    </div>
                  </details>
                )
              })}
            </div>
          ) : (
            <p className="microdata-locked"><Icon name="lock"/> Household-level datasets appear here once a microdata request has been approved for your account.</p>
          )}
        </section>

        <section className="data-section data-section--tint" id="documentation">
          <div className="section-wrap">
            <div className="data-section-heading">
              <div><span className="kicker">Use data confidently</span><h2>Documentation and metadata</h2></div>
              <p>Read the variable definitions and codebooks for the generation you are working in before analysis, especially when combining collection periods.</p>
            </div>
            <div className="documentation-grid">
              {[REFERENCE_GENERATION, ...ARCHIVE_GENERATIONS].map((generation) => {
                const items = documentationFor(generation)
                return (
                  <section className="documentation-column" key={generation}>
                    <h3><span className="generation-badge generation-badge--muted">{GENERATIONS[generation].label}</span>{GENERATIONS[generation].name}</h3>
                    {items.length
                      ? items.map((resource) => <SupportingLink resource={resource} key={resource.id}/>)
                      : (
                        <div className="documentation-pending">
                          <span className="documentation-pending-flag">In production</span>
                          <p>{GENERATIONS[generation].label} field descriptions, the codebook and the detailed metadata are being produced alongside the questionnaire and are not published yet. They are released with the first {GENERATIONS[generation].label} survey. Until then, use the {GENERATIONS[ARCHIVE_GENERATIONS[0]].label} documentation for orientation only — the field set and codes have changed.</p>
                        </div>
                      )}
                  </section>
                )
              })}
            </div>
            <article className="supporting-resource supporting-resource--wide">
              <span><Icon name="book"/></span>
              <div><strong>Household survey questionnaires</strong><p>Template and survey-specific questionnaires used across every DIEM collection round.</p></div>
              <a className="data-resource-action" href={QUESTIONNAIRES_URL} target="_blank" rel="noreferrer">Open<Icon name="external"/></a>
            </article>
          </div>
        </section>

        <section className="data-section data-section--deep" id="boundaries">
          <div className="section-wrap">
            <div className="data-section-heading"><div><span className="kicker">Spatial reference</span><h2>Administrative boundaries</h2></div><p>Operational ADM1 and ADM2 references prioritize boundaries accepted for field implementation and preserve previous configurations for historical traceability.</p></div>
            <div className="boundary-grid">{references.map((resource) => <DatasetCard resource={resource} icon="map" key={resource.id}/>)}</div>
            <p className="boundary-note">If a pcode is absent from the current collection, search the archive for the boundary configuration used at the time of collection.</p>
          </div>
        </section>

        <section className="data-section section-wrap" id="tools">
          <div className="data-section-heading"><div><span className="kicker">Reproducible analysis</span><h2>API and analysis tools</h2></div><p>Move from manual downloads to repeatable workflows, or convert coded microdata into labelled, analysis-ready files.</p></div>
          <div className="tools-grid">
            <article><span><Icon name="code"/></span><div><small>Python &amp; R</small><h3>Microdata labelling</h3><p>Automatically detect the questionnaire generation and apply official DIEM value labels while preserving the source structure and file format.</p><a href="https://github.com/Andrampa/diem-microdata-labelling" target="_blank" rel="noreferrer">Open GitHub repository <Icon name="external"/></a></div></article>
            <article><span><Icon name="download"/></span><div><small>Jupyter Notebook</small><h3>DIEM data API</h3><p>Automate authenticated dataset downloads and integrate DIEM evidence into your own analytical workflows.</p><a href="https://github.com/Andrampa/DIEM_API/tree/main" target="_blank" rel="noreferrer">View API examples <Icon name="external"/></a></div></article>
            <article><span><Icon name="table"/></span><div><small>FAO catalogue</small><h3>Additional microdata</h3><p>Discover additional emergency monitoring survey collections in FAO's Microdata Catalogue.</p><a href={FAM_URL} target="_blank" rel="noreferrer">Browse the catalogue <Icon name="external"/></a></div></article>
          </div>
        </section>

        <section className="citation-section">
          <div className="section-wrap">
            <div className="citation-intro"><span className="kicker">Responsible reuse</span><h2>How to cite DIEM data</h2><p>Replace the bracketed date with the date on which you accessed the data.</p></div>
            <div className="citation-list">{citations.map((citation) => <article key={citation.language}><span>{citation.language}</span><p>{citation.text}</p><button type="button" onClick={() => void copyCitation(citation.language, citation.text)}>{copied === citation.language ? 'Copied' : 'Copy citation'}<Icon name={copied === citation.language ? 'check' : 'book'}/></button></article>)}</div>
            <div className="license-line"><Icon name="shield"/><p>DIEM aggregated data is available under <a href="https://creativecommons.org/licenses/by/4.0/legalcode.en" target="_blank" rel="noreferrer">CC BY 4.0</a> and the <a href="https://www.fao.org/contact-us/terms/db-terms-of-use/en" target="_blank" rel="noreferrer">FAO Statistical Database Terms of Use</a>. Microdata is released under the separate conditions set out above.</p></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
