import { Link } from 'react-router-dom'
import '../data-access.css'
import { useAuth } from '../auth/AuthContext'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { HeroImage } from '../components/HeroImage'
import { HeroCredit } from '../components/HeroCredit'
import {
  AGGREGATE_RESOURCES,
  ARCHIVE_GENERATIONS,
  GENERATIONS,
  REFERENCE_GENERATION,
  resourcesForGeneration,
} from '../services/protectedData'
import { usePageMetadata } from '../hooks/usePageMetadata'

const FAM_URL = 'https://microdata.fao.org/index.php/catalog/Emergencies-Monitoring-Surveys/?page=1&sort_by=popularity&sort_order=desc&ps=15&repo=Emergencies-Monitoring-Surveys'
const WORKSPACE_ROUTE = '/data/surveys'

type IconName = 'lock' | 'download' | 'table' | 'book' | 'arrow' | 'external' | 'shield'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    lock: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    download: <><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></>,
    table: <><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 9v11M15 9v11"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
    shield: <><path d="M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/></>,
  }
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>
}

/**
 * The hero's one action, which is the only part of the page that depends on
 * whether the visitor is signed in. Everything below it reads the same for
 * everyone: this page explains, the workspace is where data is chosen.
 */
function HeroAction() {
  const auth = useAuth()
  if (auth.status === 'authenticated') {
    return (
      <div className="data-gate-actions">
        <Link className="data-overview-primary" to={WORKSPACE_ROUTE}>
          <Icon name="table"/>Open your survey data workspace
        </Link>
        <span className="data-overview-signed-in">Signed in as {auth.user?.fullName || auth.user?.username}</span>
      </div>
    )
  }
  return (
    <div className="data-gate-actions">
      <button type="button" onClick={() => void auth.signIn()} disabled={auth.status === 'authenticating' || auth.status === 'loading'}>
        <Icon name="lock"/>{auth.status === 'authenticating' ? 'Opening sign in…' : 'Sign in or create an account'}
      </button>
      <Link className="data-gate-secondary" to="/data/guide"><Icon name="book"/>Read the data access guide</Link>
    </div>
  )
}

/**
 * Public overview of DIEM survey data.
 *
 * It used to be two pages in one: an anonymous gate, and - once signed in - the
 * whole authenticated workspace organised by questionnaire generation. The
 * workspace now lives at `/data/surveys`, organised by survey, and this page
 * does one job: get a visitor to the right path. Boundaries, documentation,
 * tools and the microdata licence moved with the workspace; the full licences,
 * methodology and citations are in `/data/guide`.
 *
 * The `aggregated` and `microdata` ids stay: country pages link to them.
 */
export default function DataAccess() {
  usePageMetadata({
    title: 'Data access',
    description: 'How to access DIEM household survey data: aggregated results for any DIEM community account, household microdata through the FAO Microdata Catalogue or by request, and the survey data workspace where both are chosen and downloaded.',
  })

  return (
    <>
      <SiteHeader />
      <main id="top" className="data-gate">
        <section className="data-gate-hero">
          <HeroImage name="afghanistan-f2f-smartphone-interview-2024" className="data-hero-image" alt="A DIEM enumerator recording a face-to-face interview on a smartphone in Afghanistan" />
          <HeroCredit name="afghanistan-f2f-smartphone-interview-2024" />
          <div className="data-gate-content data-overview-hero section-wrap">
            <div className="data-gate-copy">
              <span className="eyebrow"><span/> DIEM Household Monitoring System data</span>
              <h1>Access DIEM household survey data</h1>
              <p>Survey results from DIEM monitoring, published in two forms: aggregated indicators any DIEM community account can download, and household-level microdata under a stricter licence. Choose surveys by country and round; the Hub works out the rest.</p>
              <HeroAction />
              <p className="data-gate-note"><Icon name="shield"/> Accounts are free. Privileges usually activate within 15 minutes of account creation.</p>
            </div>
          </div>
        </section>

        {/* Aggregated first, then microdata - also the order they stack in on a
            phone. Never the infrastructure versions as the first choice. */}
        <section className="data-overview-choices section-wrap" aria-labelledby="choices-heading">
          <div className="data-gate-ladder-intro">
            <span className="kicker">Two kinds of data</span>
            <h2 id="choices-heading">Aggregated data or household microdata</h2>
          </div>
          <div className="data-overview-choice-grid">
            <article className="data-overview-choice" id="aggregated">
              <span className="data-overview-choice-icon"><Icon name="table"/></span>
              <h3>Aggregated data</h3>
              <p>Survey results cleaned, weighted and summarised at the lowest administrative level each survey supports — ADM1 or ADM2 — and organised by theme: income and shocks, crops, livestock, food security and needs.</p>
              <dl>
                <div><dt>Who can get it</dt><dd>Anyone with a DIEM community account.</dd></div>
                <div><dt>What is required</dt><dd>A free account. Nothing to request.</dd></div>
                <div><dt>Licence</dt><dd>CC BY 4.0 and the FAO Statistical Database Terms of Use.</dd></div>
              </dl>
              <Link to={WORKSPACE_ROUTE}>Choose surveys in the workspace<Icon name="arrow"/></Link>
            </article>
            <article className="data-overview-choice" id="microdata">
              <span className="data-overview-choice-icon"><Icon name="download"/></span>
              <h3>Household microdata</h3>
              <p>Anonymized household-level records, released in coded form, with some fields withheld to protect the people surveyed. For research and statistical use only.</p>
              <dl>
                <div><dt>Who can get it</dt><dd>Anyone, through the FAO Microdata Catalogue, about six months after the aggregated release. Sooner, by approved request.</dd></div>
                <div><dt>What is required</dt><dd>For a direct request: an account, an institutional email address and a justified purpose. Requests are evaluated within about two working days.</dd></div>
                <div><dt>Licence</dt><dd>A stricter microdata licence: no identification, no redistribution, no commercial use.</dd></div>
              </dl>
              <div className="data-overview-choice-links">
                <a href={FAM_URL} target="_blank" rel="noreferrer">Browse DIEM data in FAM<Icon name="external"/></a>
                <Link to="/data/microdata-request">Request direct access<Icon name="arrow"/></Link>
              </div>
            </article>
          </div>
        </section>

        <section className="data-gate-ladder section-wrap" aria-labelledby="steps-heading">
          <div className="data-gate-ladder-intro">
            <span className="kicker">How it works</span>
            <h2 id="steps-heading">Three steps to the data</h2>
          </div>
          <ol className="access-ladder">
            <li>
              <span>01</span>
              <div>
                <strong>Sign in</strong>
                <p>With a DIEM community account. Creating one is free, and access to aggregated data follows automatically within about 15 minutes.</p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Choose surveys</strong>
                <p>By country and round, then the themes you need; each theme says how many of your surveys carry it. A standard account can put up to ten surveys in one package.</p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>Download data and documentation</strong>
                <p>One zip with a folder per survey: a CSV per theme, the field schema of every file, and links to the documentation for that survey's questionnaire.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="data-gate-generations section-wrap" aria-labelledby="generations-heading">
          <div className="data-gate-ladder-intro">
            <span className="kicker">How DIEM data has evolved</span>
            <h2 id="generations-heading">Three questionnaire generations, chosen for you</h2>
            <p>DIEM revised its questionnaire twice, and each revision changed the fields, codes and structure of the data. You do not need to pick one: the workspace knows which generation each survey belongs to and packages the matching documentation with it.</p>
          </div>
          <div className="generation-strip">
            {[REFERENCE_GENERATION, ...ARCHIVE_GENERATIONS].map((id) => {
              const generation = GENERATIONS[id]
              const themes = resourcesForGeneration(AGGREGATE_RESOURCES, id)
              const preview = themes.length > 0 && themes.every((resource) => resource.preview)
              return (
                <article key={id} className={id === REFERENCE_GENERATION ? 'generation-strip-card generation-strip-card--reference' : 'generation-strip-card'}>
                  <div className="generation-strip-topline">
                    <strong>{generation.label}</strong>
                    {id === REFERENCE_GENERATION
                      ? <span className="generation-strip-flag generation-strip-flag--current">Current standard</span>
                      : <span className="generation-strip-flag">Archived</span>}
                  </div>
                  <h3>{generation.name}</h3>
                  <p className="generation-strip-period">{generation.period}</p>
                  <p>{generation.summary}</p>
                  {/* The inventory, reduced to one honest line. A generation whose
                      services hold only simulated records says so, rather than
                      advertising surveys that do not exist yet. */}
                  <p className="generation-strip-inventory">
                    {preview
                      ? 'Being prepared for its first surveys. No production data yet.'
                      : `${themes.length} thematic dataset${themes.length === 1 ? '' : 's'}, with household microdata.`}
                  </p>
                </article>
              )
            })}
          </div>
          <p className="generation-strip-note">Comparisons across generations may be limited or impossible for some variables. The <Link to="/data/guide#generations">data access guide</Link> explains what changed.</p>
        </section>

        <section className="data-overview-cta section-wrap" aria-labelledby="cta-heading">
          <div>
            <h2 id="cta-heading">Ready to choose surveys?</h2>
            <p>The workspace lists every survey your account can download.</p>
          </div>
          <div className="data-overview-cta-actions">
            <Link className="data-overview-primary" to={WORKSPACE_ROUTE}><Icon name="table"/>Open the survey data workspace</Link>
            <ul className="data-overview-secondary">
              <li><Link to="/data/guide"><Icon name="book"/>Read the data access guide</Link></li>
              <li><Link to="/data/microdata-request"><Icon name="download"/>Request microdata</Link></li>
              <li><a href={FAM_URL} target="_blank" rel="noreferrer"><Icon name="external"/>FAO Microdata Catalogue</a></li>
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
