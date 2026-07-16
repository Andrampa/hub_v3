import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../data-access.css'
import { useAuth } from '../auth/AuthContext'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { formatDate } from '../lib/catalog'
import {
  AGGREGATE_RESOURCES,
  GUIDE_RESOURCES,
  MICRODATA_RESOURCES,
  REFERENCE_RESOURCES,
  SUPPORTING_RESOURCES,
  authoritativeResourceUrl,
  fetchProtectedDataWorkspace,
  type ProtectedDataResource,
  type ResolvedDataResource,
} from '../services/protectedData'

const ACCESS_REQUEST_URL = 'https://data-in-emergencies.fao.org/feedback/surveys/c224d7e568fb464fbfbca2fff047707f/explore'
const QUESTIONNAIRES_URL = 'https://data-in-emergencies.fao.org/search?sort=Date%20Created%7Ccreated%7Cdesc&tags=household%2520survey%2520questionnaire'
const FAM_URL = 'https://microdata.fao.org/index.php/catalog/Emergencies-Monitoring-Surveys/?page=1&sort_by=popularity&sort_order=desc&ps=15&repo=Emergencies-Monitoring-Surveys'

type IconName = 'lock' | 'download' | 'table' | 'book' | 'code' | 'map' | 'arrow' | 'check' | 'external' | 'shield'

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
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

function statusCopy(resource: ResolvedDataResource) {
  if (resource.access === 'available') return 'Available to your account'
  if (resource.access === 'restricted') return 'Additional access required'
  if (resource.access === 'error') return 'Availability check failed'
  return 'Checking access'
}

function ResourceAction({ resource, label = 'Open and download' }: { resource: ResolvedDataResource; label?: string }) {
  if (resource.access === 'available') {
    if (resource.kind === 'microdata' || resource.kind === 'aggregate' || resource.kind === 'reference') {
      return <Link className="data-resource-action" to={`/data/${resource.id}`}>Explore data<Icon name="arrow" /></Link>
    }
    return <a className="data-resource-action" href={authoritativeResourceUrl(resource)} target="_blank" rel="noreferrer">{label}<Icon name="external" /></a>
  }
  if (resource.kind === 'microdata' && resource.access === 'restricted') {
    return <a className="data-resource-action data-resource-action--request" href={ACCESS_REQUEST_URL} target="_blank" rel="noreferrer">Request access<Icon name="arrow" /></a>
  }
  return <span className="data-resource-action data-resource-action--disabled">Not available</span>
}

function DatasetCard({ resource, icon = 'table' }: { resource: ResolvedDataResource; icon?: IconName }) {
  const title = resource.item?.title || resource.fallbackTitle
  return (
    <article className={`dataset-card${resource.archived ? ' dataset-card--archived' : ''}`}>
      <div className="dataset-card-topline">
        <span className="dataset-icon"><Icon name={icon} /></span>
        <span className={`access-chip access-chip--${resource.access}`}><i />{statusCopy(resource)}</span>
      </div>
      <div className="dataset-period">{resource.period || resource.language || 'DIEM resource'}</div>
      <h3>{title}</h3>
      <p>{resource.description}</p>
      {resource.item && <div className="dataset-updated">Updated {formatDate(resource.item.modified)}</div>}
      <ResourceAction resource={resource} />
    </article>
  )
}

function SupportingLink({ resource }: { resource: ResolvedDataResource }) {
  return (
    <article className="supporting-resource">
      <span><Icon name={resource.kind === 'guide' ? 'book' : 'table'} /></span>
      <div><strong>{resource.item?.title || resource.fallbackTitle}</strong><p>{resource.description}</p></div>
      <ResourceAction resource={resource} label="Open" />
    </article>
  )
}

function LoadingWorkspace() {
  return <main className="data-page data-page-loading"><span className="loader"/><strong>Checking your DIEM data access</strong><p>Reading protected resource permissions from ArcGIS Online...</p></main>
}

function SignInGate() {
  const auth = useAuth()
  return (
    <main className="data-gate">
      <section className="data-gate-hero">
        <div className="data-gate-content section-wrap">
          <div className="data-gate-copy">
            <span className="eyebrow"><span/> DIEM community data</span>
            <h1>Household evidence,<br/><em>responsibly accessible.</em></h1>
            <p>Sign in with your DIEM community account to access household microdata, aggregated indicators, operational boundaries and technical guidance.</p>
            <div className="data-gate-actions">
              <button type="button" onClick={() => void auth.signIn()} disabled={auth.status === 'authenticating'}>
                <Icon name="lock" />{auth.status === 'authenticating' ? 'Opening sign in...' : 'Sign in to access data'}
              </button>
              <a href={ACCESS_REQUEST_URL} target="_blank" rel="noreferrer">How microdata access works <Icon name="arrow" /></a>
            </div>
            <p className="data-gate-note"><Icon name="shield"/> Protected datasets remain governed by their ArcGIS sharing permissions.</p>
          </div>
          <div className="data-gate-preview" aria-label="Available data collections">
            <div><span>01</span><Icon name="download"/><strong>Household microdata</strong><small>Current and archived</small></div>
            <div><span>02</span><Icon name="table"/><strong>Aggregated indicators</strong><small>Four thematic areas</small></div>
            <div><span>03</span><Icon name="map"/><strong>Reference boundaries</strong><small>ADM1 and ADM2</small></div>
            <div><span>04</span><Icon name="code"/><strong>API and analysis tools</strong><small>Reproducible workflows</small></div>
          </div>
        </div>
      </section>
      <section className="data-gate-principles section-wrap" aria-label="Data access principles">
        <div><strong>Free access</strong><span>Microdata access is granted for one year and can be renewed.</span></div>
        <div><strong>Anonymized</strong><span>Personal information and higher-risk fields are removed.</span></div>
        <div><strong>Documented</strong><span>Field descriptions, codebooks and questionnaires accompany the data.</span></div>
      </section>
    </main>
  )
}

const citations = [
  { language: 'English', text: 'FAO. 2025. DIEM-Monitoring. In: Data in Emergencies (DIEM) Hub. Rome. [Cited date]. https://data-in-emergencies.fao.org' },
  { language: 'Français', text: 'FAO. 2024. DIEM-Monitoring [DIEM-Suivi]. Dans : Data in Emergencies (DIEM) Hub. Rome. [Consulté le date]. https://data-in-emergencies.fao.org' },
  { language: 'Español', text: 'FAO. 2024. DIEM-Monitoring [DIEM-Monitoreo]. En: Data in Emergencies (DIEM) Hub. Roma. [Consultado el fecha]. https://data-in-emergencies.fao.org' },
]

export default function DataAccess() {
  const auth = useAuth()
  const [resources, setResources] = useState<ResolvedDataResource[]>()
  const [archiveView, setArchiveView] = useState(false)
  const [copied, setCopied] = useState<string>()
  const [loadVersion, setLoadVersion] = useState(0)

  useEffect(() => {
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

  const resolved = useMemo(() => {
    const byId = new Map(resources?.map((resource) => [resource.id, resource]))
    return (resource: ProtectedDataResource): ResolvedDataResource => byId.get(resource.id) || { ...resource, access: 'checking' }
  }, [resources])

  const microdata = MICRODATA_RESOURCES.map(resolved)
  const aggregates = AGGREGATE_RESOURCES.filter((resource) => Boolean(resource.archived) === archiveView).map(resolved)
  const guides = GUIDE_RESOURCES.map(resolved)
  const references = REFERENCE_RESOURCES.map(resolved)
  const supporting = SUPPORTING_RESOURCES.map(resolved)
  const availableCount = resources?.filter((resource) => resource.access === 'available').length || 0
  const accessChecked = Boolean(resources)

  async function copyCitation(language: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(language)
    window.setTimeout(() => setCopied(undefined), 1800)
  }

  if (auth.status === 'loading') return <><SiteHeader active="data"/><LoadingWorkspace/><SiteFooter/></>
  if (auth.status !== 'authenticated') return <><SiteHeader active="data"/><SignInGate/><SiteFooter/></>

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
              <div><small>Signed in as</small><strong>{auth.user?.fullName || auth.user?.username}</strong><span>{accessChecked ? `${availableCount} protected resources available` : 'Checking resource permissions...'}</span></div>
              {accessChecked && resources?.some((resource) => resource.access === 'error') && <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>Retry checks</button>}
            </aside>
          </div>
        </section>

        <nav className="data-section-nav" aria-label="Data workspace sections">
          <div className="section-wrap"><a href="#microdata">Microdata</a><a href="#aggregated">Aggregated data</a><a href="#guides">Guides</a><a href="#boundaries">Boundaries</a><a href="#tools">API & tools</a></div>
        </nav>

        <section className="data-section section-wrap" id="microdata">
          <div className="data-section-heading">
            <div><span className="kicker">Household-level evidence</span><h2>Microdata</h2></div>
            <p>Fully anonymized records are released after cleaning and validation. Some fields are withheld to reduce disclosure risk.</p>
          </div>
          <div className="microdata-layout">
            <div className="microdata-cards">{microdata.map((resource) => <DatasetCard resource={resource} icon="download" key={resource.id}/>)}</div>
            <aside className="access-pathway">
              <span className="access-pathway-number">ACCESS</span>
              <h3>Need household microdata?</h3>
              <ol><li><span>1</span><div><strong>Create or sign in to your DIEM account</strong><p>Your community identity is already connected to this workspace.</p></div></li><li><span>2</span><div><strong>Request microdata access</strong><p>Complete the short access form. Access is free for one year and renewable.</p></div></li><li><span>3</span><div><strong>Return and download</strong><p>ArcGIS permissions update this page automatically after approval.</p></div></li></ol>
              <a href={ACCESS_REQUEST_URL} target="_blank" rel="noreferrer">Open the access form <Icon name="external"/></a>
            </aside>
          </div>
          <div className="data-caution"><span>Structure change</span><p>Surveys conducted before December 2022 use an earlier questionnaire and different fields. Comparability with current data may be limited or impossible for some variables.</p></div>
        </section>

        <section className="data-section data-section--tint" id="aggregated">
          <div className="section-wrap">
            <div className="data-section-heading">
              <div><span className="kicker">Administrative-level indicators</span><h2>Aggregated data</h2></div>
              <p>Cleaned and validated survey data aggregated at the first or second administrative level across four thematic areas.</p>
            </div>
            <div className="collection-switch" role="group" aria-label="Aggregated data period"><button type="button" aria-pressed={!archiveView} onClick={() => setArchiveView(false)}>Current collection</button><button type="button" aria-pressed={archiveView} onClick={() => setArchiveView(true)}>Archive 2021–2022</button></div>
            <div className="aggregate-grid">{aggregates.map((resource) => <DatasetCard resource={resource} key={resource.id}/>)}</div>
            {archiveView && <div className="data-caution data-caution--inside"><span>Archived structure</span><p>These datasets use the previous questionnaire. Review archived field descriptions before combining them with current indicators.</p></div>}
          </div>
        </section>

        <section className="data-section section-wrap" id="guides">
          <div className="data-section-heading">
            <div><span className="kicker">Use data confidently</span><h2>Guides and metadata</h2></div>
            <p>Start with variable definitions, codebooks and questionnaires before analysis, especially when comparing collection periods.</p>
          </div>
          <div className="guide-layout">
            <div className="guide-language-panel"><span>Data access guides</span>{guides.map((resource) => <SupportingLink resource={resource} key={resource.id}/>)}</div>
            <div className="guide-resource-list">{supporting.map((resource) => <SupportingLink resource={resource} key={resource.id}/>)}
              <article className="supporting-resource"><span><Icon name="book"/></span><div><strong>Household survey questionnaires</strong><p>Questionnaires used in DIEM country survey rounds.</p></div><a className="data-resource-action" href={QUESTIONNAIRES_URL} target="_blank" rel="noreferrer">Open<Icon name="external"/></a></article>
            </div>
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
            <article><span><Icon name="code"/></span><div><small>Python & R</small><h3>Microdata labelling</h3><p>Automatically detect the questionnaire infrastructure and apply official DIEM value labels while preserving the source structure.</p><a href="https://github.com/Andrampa/diem-microdata-labelling" target="_blank" rel="noreferrer">Open GitHub repository <Icon name="external"/></a></div></article>
            <article><span><Icon name="download"/></span><div><small>Jupyter Notebook</small><h3>DIEM data API</h3><p>Automate authenticated dataset downloads and integrate DIEM evidence into your own analytical workflows.</p><a href="https://github.com/Andrampa/DIEM_API/tree/main" target="_blank" rel="noreferrer">View API examples <Icon name="external"/></a></div></article>
            <article><span><Icon name="table"/></span><div><small>FAO catalogue</small><h3>Additional microdata</h3><p>Discover additional emergency monitoring survey collections in FAO's Microdata Catalogue.</p><a href={FAM_URL} target="_blank" rel="noreferrer">Browse the catalogue <Icon name="external"/></a></div></article>
          </div>
        </section>

        <section className="citation-section">
          <div className="section-wrap">
            <div className="citation-intro"><span className="kicker">Responsible reuse</span><h2>How to cite DIEM data</h2><p>Replace the bracketed date with the date on which you accessed the data.</p></div>
            <div className="citation-list">{citations.map((citation) => <article key={citation.language}><span>{citation.language}</span><p>{citation.text}</p><button type="button" onClick={() => void copyCitation(citation.language, citation.text)}>{copied === citation.language ? 'Copied' : 'Copy citation'}<Icon name={copied === citation.language ? 'check' : 'book'}/></button></article>)}</div>
            <div className="license-line"><Icon name="shield"/><p>DIEM aggregated data is available under <a href="https://creativecommons.org/licenses/by/4.0/legalcode.en" target="_blank" rel="noreferrer">CC BY 4.0</a> and the <a href="https://www.fao.org/contact-us/terms/db-terms-of-use/en" target="_blank" rel="noreferrer">FAO Statistical Database Terms of Use</a>.</p></div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
