import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import eveExposureImage from '../assets/eve/eve-exposure-model-mozambique.jpg'
import eveFieldDataImage from '../assets/eve/eve-field-data-madagascar.jpg'
import eveOverviewImage from '../assets/eve/eve-overview-mozambique.jpg'
import vistaExplorerImage from '../assets/eve/vista-comparison-explorer.jpg'
import { HeroImage } from '../components/HeroImage'
import { HeroCredit } from '../components/HeroCredit'
import faoLogo from '../assets/fao/fao-logo-blue-3lines-en.svg'
import columbiaLogo from '../assets/partners/columbia-climate-school.png'
import dfoLogo from '../assets/partners/dartmouth-flood-observatory.png'
import googleLogo from '../assets/partners/google.png'
import jrcLogo from '../assets/partners/jrc.png'
import noaaLogo from '../assets/partners/noaa.png'
import rwthLogo from '../assets/partners/rwth-aachen.png'
import wfpLogo from '../assets/partners/wfp.png'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { countryDefinition, itemHubLink } from '../services/countries'
import { fetchImpactAssessmentCatalog } from '../services/impactAssessments'
import type { ImpactAssessmentResource } from '../services/impactAssessments'
import { usePageMetadata } from '../hooks/usePageMetadata'

const EVE_URL = 'https://diem-eve.apps.fao.org/'
// VISTA links point at the official VISTA site and its Earth Engine apps, never
// at the retired diem.fao.org pages.
const VISTA_WEBSITE_URL = 'https://diem-vista.web.app/'
const VISTA_PREVIEW_URL = 'https://fao-oer.projects.earthengine.app/view/vista-preview'
const VISTA_MANUAL_URL = 'https://diem-vista.web.app/user_guide.html'

// The Hub content group carries a `Shock types` category branch, and `Flood` is
// its reviewed selector for flood evidence. Reusing the hazard impact-assessment
// catalog keeps this page on the same taxonomy as `/hazard-impact-assessments`
// instead of introducing a second discovery contract over the same items.
const FLOOD_SHOCK_TYPE = 'Flood'
const VISIBLE_BRIEFS = 6

// The consortium belongs to VISTA specifically, not to DIEM flood services as a
// whole. Other components reuse open data (the JRC RP20 scenario, for example)
// without that being a partnership.
const vistaConsortium = [
  { name: 'Food and Agriculture Organization of the United Nations', src: faoLogo, tall: false },
  { name: 'European Commission Joint Research Centre', src: jrcLogo, tall: false },
  { name: 'National Oceanic and Atmospheric Administration', src: noaaLogo, tall: true },
  { name: 'Dartmouth Flood Observatory', src: dfoLogo, tall: true },
  { name: 'RWTH Aachen University', src: rwthLogo, tall: false },
  { name: 'Columbia Climate School', src: columbiaLogo, tall: false },
  { name: 'World Food Programme', src: wfpLogo, tall: true },
  { name: 'Google', src: googleLogo, tall: false },
]

// Facts, method and product questions follow the official VISTA website, so the
// Hub explains the same atlas in the same terms.
const vistaFacts = [
  { value: 'Global', label: 'Spatial coverage' },
  { value: '2012–2026', label: 'Historical record' },
  { value: '~375 m', label: 'Nominal resolution' },
  { value: '10 days', label: 'Time step (dekad)' },
  { value: 'CC BY 4.0', label: 'Open data' },
]

const vistaMethod = [
  {
    step: 'Gather',
    description: 'Each satellite flood map joins the stack for its period of the year: the same 10 days, across every year since 2012. Three dekads a month make 36 stacks.',
  },
  {
    step: 'Summarise',
    description: 'For each stack, VISTA records how often every pixel was flooded among the years the satellite could actually see the ground. Cloud and no-data are left out.',
  },
  {
    step: 'Set a threshold',
    description: 'Take the baseline for the same time of year as the event and choose a frequency cutoff. Places flooded at least that often are treated as seasonal water.',
  },
  {
    step: 'Apply',
    description: 'Remove seasonal water from the current observation. What remains is flooding that is exceptional for that place and season. Pixels without a valid baseline stay unclassified.',
  },
]

const vistaProducts = [
  {
    name: 'Count',
    question: 'In how many years was flooding seen here at this time of year?',
    description: 'Also records in how many years the ground was visible, so you can judge how much evidence lies behind each figure.',
    anchor: 'statistical-product-count',
  },
  {
    name: 'Frequency',
    question: 'In what share of clear-sky years was this place flooded?',
    description: 'Flooded observations divided by valid observations. 80% means flooding in 8 out of 10 valid years for that period.',
    anchor: 'statistical-product-frequency',
  },
  {
    name: 'Dominant class',
    question: 'What is this place usually at this time of year?',
    description: 'Dry land, permanent water, flooded or cloud-covered: the state seen most often across years.',
    anchor: 'statistical-product-dominant-class',
  },
]

const pathway = [
  {
    step: 'Prepare and prioritize',
    description: 'Identify where flood hazard meets people and agriculture, and where recurrent flooding shapes the normal year, so monitoring and field teams can agree on focus areas before an event.',
  },
  {
    step: 'Observe the event',
    description: 'Follow satellite-observed flood conditions dekad by dekad, and separate flooding that is expected for the season from flooding that is exceptional for that place and time of year.',
  },
  {
    step: 'Verify impacts in the field',
    description: 'Connect geo-tagged field submissions and photographs with the observed flood extent, to test what the satellite signal means on the ground and capture impacts that cannot be seen from space.',
  },
  {
    step: 'Translate evidence into action',
    description: 'Combine observation, exposure and field evidence with crop calendars, production and price data and local knowledge to produce a concise, decision-focused assessment.',
  },
]

interface Capability {
  name: string
  description: string
  note?: string
  restricted?: boolean
}

interface CapabilityFigure {
  src: string
  width: number
  height: number
  alt: string
  caption: string
}

interface CapabilityGroup {
  group: string
  summary: string
  capabilities: Capability[]
  figure?: CapabilityFigure
}

const capabilityGroups: CapabilityGroup[] = [
  {
    group: 'Observe',
    summary: 'Follow the event as it unfolds.',
    capabilities: [
      {
        name: 'Overview',
        description: 'Flood situation cards, ranked administrative units and the dekadal flood raster for the selected country and period.',
      },
      {
        name: 'Mapping',
        description: 'Thematic impact mapping with adjustable classification, flooded area and cropland, exposed population and livestock breakdowns, and map export.',
      },
      {
        name: 'Time analysis',
        description: 'Dekadal time-series charts and map animation, to see how an event builds, peaks and recedes.',
      },
    ],
  },
  {
    group: 'Contextualize',
    summary: 'Read the event against local seasons and geography.',
    capabilities: [
      {
        name: 'Crop calendar',
        description: 'Agro-ecological zone ranking with zone-internal administrative drilldown, set against the agricultural calendar for countries with coverage.',
      },
      {
        name: 'Localisation',
        description: 'Country-configured local impact views, currently land-cover impact statistics for Gaza and Maputo provinces in Mozambique.',
      },
    ],
  },
  {
    group: 'Anticipate',
    summary: 'Prepare ahead of an event, or work when observation is unavailable.',
    capabilities: [
      {
        name: 'Exposure model',
        description: 'Potential population and cropland exposure under a static JRC RP20 flood scenario, with administrative rankings, two-area comparison and an optional observed-flood overlay. It is a preparedness baseline rather than a near-real-time observation, designed for moments when satellite observation is delayed, cloud-obscured, or misses the peak of an event.',
        note: 'Available for 35 countries',
      },
    ],
    figure: {
      src: eveExposureImage,
      width: 1907,
      height: 1025,
      alt: 'EVE 2.0 Exposure model for Mozambique showing 2 049 380 people and 4 819.2 square kilometres of cropland potentially exposed, a stack of layer transparency sliders for the RP20 hazard, modelled flood depth, cropland and population density, districts ranked by exposed population with Chokwe first, and a map where modelled flood depth follows the Zambezi corridor and the Sofala floodplain with exposed cropland picked out over it.',
      caption: 'Exposure model for Mozambique: 2.05 million people and 4 819 km² of cropland fall inside the modelled RP20 flood scenario. Each layer carries its own transparency slider, and districts rank by exposed population. This is a preparedness baseline, not an observation of a specific event.',
    },
  },
  {
    group: 'Verify',
    summary: 'Bring field evidence alongside the satellite signal.',
    capabilities: [
      {
        name: 'Field Data',
        description: 'Event workspaces combining a chronological observation feed, a synchronized map, assessment detail and field photographs. Current events cover the Mozambique floods of January and February 2026 and the Madagascar cyclones Fytia and Gezani of February 2026.',
        restricted: true,
      },
    ],
    figure: {
      src: eveFieldDataImage,
      width: 1912,
      height: 1030,
      alt: 'EVE 2.0 Field Data workspace for the Madagascar cyclones Fytia and Gezani, February 2026: counters showing 422 total reports, 416 with photos, 172 flood affected, 97 access and displacement and 19 with no visible impact; a chronological feed of geo-tagged observations with photo thumbnails of damaged buildings, a flooded field and a blocked road; a map of Madagascar with observations coloured by type; and a detail panel showing a flooded rice field with its recorded flood depth, duration and observed impact.',
      caption: 'Field Data for the Madagascar cyclones Fytia and Gezani, February 2026: 422 geo-tagged reports, 416 carrying photographs. Each observation records whether flooding is active, how deep and how long, and what it affected. Reporter identity is never queried or shown. Access is limited to approved DIEM Community members.',
    },
  },
  {
    group: 'Deliver',
    summary: 'Turn the session into something shareable.',
    capabilities: [
      {
        name: 'Data and reports',
        description: 'A structured flood impact report as PDF for the selected country and period, scoped to total or exceptional flooding, with links to download the underlying exposure datasets.',
      },
    ],
  },
]

function briefMeta(item: ImpactAssessmentResource) {
  const countries = item.countries
    .map((iso3) => countryDefinition(iso3).name)
    .filter(Boolean)
  const label = countries.length > 2
    ? `${countries.slice(0, 2).join(', ')} +${countries.length - 2}`
    : countries.join(', ')
  return [label, String(item.assessmentYear)].filter(Boolean).join(' · ')
}

export default function FloodServices() {
  usePageMetadata({
    title: 'Flood analysis',
    description: 'DIEM flood services: the EVE 2.0 exposure model and field data modes, VISTA satellite products and flood impact assessments, connecting hazard, exposure, observation and field evidence into one traceable workflow.',
  })
  const [briefs, setBriefs] = useState<ImpactAssessmentResource[]>()
  const [briefsError, setBriefsError] = useState<string>()
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setBriefsError(undefined)
    fetchImpactAssessmentCatalog(controller.signal)
      .then((catalog) => {
        setBriefs(catalog.items.filter((item) => item.shockTypes.includes(FLOOD_SHOCK_TYPE)))
      })
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setBriefsError(reason.message)
      })
    return () => controller.abort()
  }, [reloadKey])

  const visibleBriefs = useMemo(() => (briefs || []).slice(0, VISIBLE_BRIEFS), [briefs])

  return (
    <>
      <SiteHeader />
      <main id="top" className="programme-page">
        <section className="programme-hero programme-hero--flood">
          <HeroImage name="bangladesh-haor-flood-2024" className="programme-hero-image" alt="A woman and child under an umbrella wading through floodwater in Bangladesh's Haor region, June 2024" />
          <HeroCredit name="bangladesh-haor-flood-2024" />
          <div className="section-wrap">
            <span className="eyebrow"><span /> DIEM flood analysis</span>
            <h1>From flood hazard to <em>evidence for action.</em></h1>
            <p>DIEM flood services connect hazard and exposure, satellite observation, field evidence and impact analysis in one workflow, so decisions about early action, response and recovery rest on a traceable chain of evidence.</p>
            <div className="programme-actions">
              <a href={EVE_URL} target="_blank" rel="noreferrer">Open Events Visualization in Emergencies (EVE) 2.0 ↗</a>
              <span>Public access, no account required</span>
            </div>
          </div>
        </section>

        <section className="flood-pathway section-wrap" aria-labelledby="flood-pathway-heading">
          <div className="programme-section-heading">
            <div>
              <span className="kicker">One connected evidence chain</span>
              <h2 id="flood-pathway-heading">Understand the event, then validate what it means on the ground.</h2>
            </div>
            <p>The pathway adapts to the country, the event and the information available. It supports anticipatory action, rapid assessment, response prioritization and recovery planning.</p>
          </div>
          <ol className="flood-pathway-grid">
            {pathway.map((entry, index) => (
              <li className="flood-step" key={entry.step}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <h3>{entry.step}</h3>
                <p>{entry.description}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flood-platform" aria-labelledby="flood-platform-heading">
          <div className="section-wrap">
            <div className="programme-section-heading">
              <div>
                <span className="kicker">The platform</span>
                <h2 id="flood-platform-heading">Events Visualization in Emergencies (EVE) 2.0</h2>
              </div>
              <p>A single analytical environment over one shared map, country and period. Every capability below reads the same selection, so moving between them keeps your context.</p>
            </div>
            <figure className="eve-figure">
              <img
                src={eveOverviewImage}
                width={1912}
                height={1021}
                loading="lazy"
                decoding="async"
                alt="EVE 2.0 Overview mode showing the situation for Mozambique in the first dekad of February 2026: headline cards for flooded area, flooded cropland and exposed population, provinces ranked by exceptional flooded area with Gaza first, and the observed flood extent mapped across Mozambique and Madagascar."
              />
              <figcaption>
                Overview for Mozambique, first dekad of February 2026. Headline totals separate exceptional flooding from the seasonal total, provinces rank by impact, and the observed extent is drawn on the shared map. Interface shown for illustration; live figures change with each dekad.
              </figcaption>
            </figure>
            <div className="capability-groups">
              {capabilityGroups.map((entry) => (
                <div className="capability-group" key={entry.group}>
                  <div className="capability-group-label">
                    <h3>{entry.group}</h3>
                    <p>{entry.summary}</p>
                  </div>
                  <div className="capability-grid">
                    {entry.capabilities.map((capability) => (
                      <article className={capability.restricted ? 'capability capability--restricted' : 'capability'} key={capability.name}>
                        <div className="capability-topline">
                          <h4>{capability.name}</h4>
                          {capability.restricted && <span className="capability-badge">Restricted</span>}
                          {capability.note && <span className="capability-note">{capability.note}</span>}
                        </div>
                        <p>{capability.description}</p>
                      </article>
                    ))}
                    {entry.figure && (
                      <figure className="capability-figure">
                        <img
                          src={entry.figure.src}
                          width={entry.figure.width}
                          height={entry.figure.height}
                          loading="lazy"
                          decoding="async"
                          alt={entry.figure.alt}
                        />
                        <figcaption>{entry.figure.caption}</figcaption>
                      </figure>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <a className="flood-platform-cta" href={EVE_URL} target="_blank" rel="noreferrer">
              Open EVE 2.0 <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <section className="flood-reference" aria-labelledby="flood-reference-heading">
          <div className="section-wrap">
            <div className="programme-section-heading">
              <div>
                <span className="kicker kicker--light">The reference behind the analysis</span>
                <h2 id="flood-reference-heading">VIIRS Surface Water Temporal Atlas (VISTA)</h2>
              </div>
              <p>Observing water is not the same as observing a flood. VISTA is what makes the difference measurable.</p>
            </div>
            <div className="reference-body">
              <p>Floodplains fill and recede, and rivers swell with the season. A pixel under water can be part of a pattern that returns every year, or a departure from it. To read a flood observation, you first need to know whether this flood is normal for the time of year.</p>
              <p>VISTA is a free, global record of where satellites have seen floodwater and surface water since 2012, built from NOAA VIIRS flood maps in 10-day steps (dekads). It answers two questions on the same grid and calendar: <strong>what was seen here</strong> during a given 10-day period, from the dated archives, and <strong>what is normal here</strong> at this time of year, from the multi-year baselines.</p>
            </div>
            <ul className="reference-facts" aria-label="VISTA at a glance">
              {vistaFacts.map((fact) => (
                <li key={fact.label}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </li>
              ))}
            </ul>
            <div className="reference-method">
              <h3>How the seasonal baseline is built</h3>
              <ol>
                {vistaMethod.map((item, index) => (
                  <li key={item.step}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <h4>{item.step}</h4>
                    <p>{item.description}</p>
                  </li>
                ))}
              </ol>
              <p className="reference-method-eve">EVE 2.0 applies this to VISTA's rolling monthly flood-frequency baseline: flooding is treated as seasonal where that place flooded in at least 25% of valid years for the same window, and the rest is counted as event flooding. That 25% cutoff is EVE's configured rule, not a universal VISTA classification, which is what lets an impact figure describe an event rather than a river behaving normally.</p>
            </div>
            <figure className="reference-figure">
              <img
                src={vistaExplorerImage}
                width={1915}
                height={942}
                loading="lazy"
                decoding="async"
                alt="The VISTA comparison explorer showing the 10-day composite flood extent for 11 to 20 January 2026 over coastal Mozambique in blues and teals, drawn over the multi-annual flood-frequency baseline for the same dekad shown as a purple ramp from 30 to 100 percent, with legends for both layers and controls for archive type, event date, statistic and minimum threshold."
              />
              <figcaption>
                The observed 10-day flood extent for 11–20 January 2026, in blue and teal, drawn over the multi-year frequency baseline for that same dekad, in purple. Where blue sits on purple, the water is where it usually is at this point in the season. Where blue sits on bare ground, the flooding is exceptional — and that is the part EVE counts as event impact. Shown in the VISTA comparison explorer on Google Earth Engine, linked from the VISTA website.
              </figcaption>
            </figure>
            <div className="reference-products">
              <h3>Three baselines, three questions</h3>
              <div className="reference-product-grid">
                {vistaProducts.map((product) => (
                  <article key={product.name}>
                    <span>{product.name}</span>
                    <h4>{product.question}</h4>
                    <p>{product.description}</p>
                    <a href={`${VISTA_MANUAL_URL}#${product.anchor}`} target="_blank" rel="noreferrer">{product.name} in the user guide ↗</a>
                  </article>
                ))}
              </div>
            </div>
            <p className="reference-limits">
              <strong>Know the limits.</strong> VISTA reorganises VIIRS flood maps produced by NOAA and George Mason University and inherits their limits. Flood classes describe the share of a pixel covered by water, not depth or damage. Cloud reduces the evidence behind each statistic, and thresholds are an analytical choice. It is a historical record, not a real-time alert service.
            </p>
            <div className="service-card-grid">
              <article className="service-card service-card--internal">
                <span>Official website</span>
                <h3>VISTA website</h3>
                <p>The home of the atlas: how the seasonal baseline is built, GeoTIFF downloads with no account needed, Earth Engine asset IDs and a quick-start script, and the citation and CC BY 4.0 reuse terms.</p>
                <a href={VISTA_WEBSITE_URL} target="_blank" rel="noreferrer">Visit the VISTA website ↗</a>
              </article>
              <article className="service-card service-card--internal">
                <span>Interactive map</span>
                <h3>VISTA asset preview</h3>
                <p>Explore the VISTA layers on a map in your browser, from dated flood observations to the multi-year count, frequency and dominant-class baselines, without an Earth Engine account.</p>
                <a href={VISTA_PREVIEW_URL} target="_blank" rel="noreferrer">Open the asset preview ↗</a>
              </article>
              <article className="service-card service-card--internal">
                <span>Documentation</span>
                <h3>VISTA user guide</h3>
                <p>Reference for the archive rasters and the statistical products: class values, dekad and rolling-month naming conventions, and guidance on when a time-specific observation answers the question and when a multi-year statistic does.</p>
                <a href={VISTA_MANUAL_URL} target="_blank" rel="noreferrer">Read the user guide ↗</a>
              </article>
            </div>
            <div className="reference-consortium">
              <h3>A multi-agency effort</h3>
              <p>VISTA is coordinated by FAO and the European Commission's Joint Research Centre, with active contributions from the National Oceanic and Atmospheric Administration, RWTH Aachen University, the Dartmouth Flood Observatory, Columbia Climate School, the World Food Programme and Google.</p>
              <ul className="partner-logos">
                {vistaConsortium.map((partner) => (
                  <li key={partner.name}>
                    <img
                      className={partner.tall ? 'partner-logo partner-logo--tall' : 'partner-logo'}
                      src={partner.src}
                      loading="lazy"
                      decoding="async"
                      alt={partner.name}
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="flood-briefs section-wrap" aria-labelledby="flood-briefs-heading">
          <div className="programme-section-heading">
            <div>
              <span className="kicker">The decision product</span>
              <h2 id="flood-briefs-heading">Flood impact assessments</h2>
            </div>
            <p>Published flood assessments are catalogued on the Hub and listed here as they appear.</p>
          </div>
          <p className="flood-briefs-lede">For a given event, DIEM analysts combine these services with crop calendars, production and price data and local knowledge into a short assessment that makes its assumptions transparent. Depending on the data available in country, it can estimate the scale and value of harvest losses, damage to productive assets and other losses, identify the most affected places and groups, and state plainly where the evidence is thin.</p>

          {!briefs && !briefsError && (
            <div className="programme-loading" role="status">
              <span className="loader" />
              <strong>Reading published flood assessments</strong>
            </div>
          )}

          {briefsError && (
            <div className="programme-error" role="alert">
              <strong>Flood assessments could not be loaded.</strong>
              <p>{briefsError}</p>
              <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
            </div>
          )}

          {briefs && visibleBriefs.length > 0 && (
            <>
              <ul className="brief-list">
                {visibleBriefs.map((item) => {
                  // Same routing rule as the hazard-impacts page these
                  // assessments are drawn from; see itemHubLink.
                  const link = itemHubLink(item)
                  const body = (
                    <>
                      <span className="brief-meta">{briefMeta(item)}</span>
                      <strong>{item.title}</strong>
                      <span className="brief-type">{item.contentRoles[0] || item.type}</span>
                    </>
                  )
                  return (
                    <li key={item.id}>
                      {link.kind === 'product'
                        ? <Link to={link.to}>{body}</Link>
                        : <a href={link.href} target="_blank" rel="noreferrer">{body}</a>}
                    </li>
                  )
                })}
              </ul>
              <Link className="source-link" to="/hazard-impact-assessments">
                Browse all {briefs.length} flood assessments, and other hazards →
              </Link>
            </>
          )}

          {briefs && visibleBriefs.length === 0 && (
            <p className="flood-briefs-empty">No published flood assessments are currently catalogued. <Link to="/contact">Contact the DIEM team</Link> to discuss an assessment for a specific event.</p>
          )}
        </section>

        <section className="flood-access" aria-labelledby="flood-access-heading">
          <div className="section-wrap">
            <div>
              <span className="kicker">Access</span>
              <h2 id="flood-access-heading">Working with field evidence</h2>
              <p>Everything on this page is public except Field Data. Because field submissions carry precise locations, photographs and reporter context, that workspace is limited to approved members of the DIEM Community group. The same approval opens the Hub's contributor surfaces, so one request covers both.</p>
            </div>
            <div className="flood-access-actions">
              <Link to="/contact">Contact the DIEM team →</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
