import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import eveExposureImage from '../assets/eve/eve-exposure-model-mozambique.jpg'
import eveFieldDataImage from '../assets/eve/eve-field-data-madagascar.jpg'
import eveOverviewImage from '../assets/eve/eve-overview-mozambique.jpg'
import vistaExplorerImage from '../assets/eve/vista-comparison-explorer.jpg'
import floodHeroImage from '../assets/heroes/bangladesh-flood-2020.jpg'
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
import { itemDestination } from '../services/arcgis'
import { countryDefinition } from '../services/countries'
import { fetchImpactAssessmentCatalog } from '../services/impactAssessments'
import type { ImpactAssessmentResource } from '../services/impactAssessments'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const EVE_URL = 'https://diem-eve.apps.fao.org/'
const VISTA_EXPLORER_URL = 'https://fao-oer.projects.earthengine.app/view/vistaproductscomparisonapp'
const VISTA_BUCKET_URL = 'https://diem.fao.org/vista/vista_bucket_browser.html'
const VISTA_MANUAL_URL = 'https://diem.fao.org/vista/user_guide.html'
const ACCESS_REQUEST_URL = 'https://survey123.arcgis.com/share/d644c40b9aa14515a1b25d1297d4ebd7'

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
      alt: 'EVE 2.0 Exposure model for Mozambique showing 2,049,380 people and 4,819.2 square kilometres of cropland potentially exposed, a stack of layer transparency sliders for the RP20 hazard, modelled flood depth, cropland and population density, districts ranked by exposed population with Chokwe first, and a map where modelled flood depth follows the Zambezi corridor and the Sofala floodplain with exposed cropland picked out over it.',
      caption: 'Exposure model for Mozambique: 2.05 million people and 4,819 km² of cropland fall inside the modelled RP20 flood scenario. Each layer carries its own transparency slider, and districts rank by exposed population. This is a preparedness baseline, not an observation of a specific event.',
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
  useDocumentTitle('Flood services')
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
      <SiteHeader active="flood" />
      <main className="programme-page">
        <section className="programme-hero programme-hero--flood">
          <img className="programme-hero-image" src={floodHeroImage} alt="" />
          <a
            className="programme-hero-credit"
            href="https://commons.wikimedia.org/wiki/File:Flood_of_Bangladesh_01.jpg"
            target="_blank"
            rel="noreferrer"
          >
            Photo: Frameofashik / CC BY-SA 4.0
          </a>
          <div className="section-wrap">
            <span className="eyebrow"><span /> DIEM flood services</span>
            <h1>From flood hazard to <em>evidence for action.</em></h1>
            <p>DIEM flood services connect hazard and exposure, satellite observation, field evidence and impact analysis in one workflow, so decisions about early action, response and recovery rest on a traceable chain of evidence.</p>
            <div className="programme-actions">
              <a href={EVE_URL} target="_blank" rel="noreferrer">Open EVE 2.0 ↗</a>
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
                <h2 id="flood-platform-heading">EVE 2.0</h2>
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
                <h2 id="flood-reference-heading">VISTA</h2>
              </div>
              <p>Observing water is not the same as observing a flood. VISTA is what makes the difference measurable.</p>
            </div>
            <div className="reference-body">
              <p>VISTA is a global flood and surface-water reference built from NOAA JPSS/VIIRS observations at roughly 375 m. Alongside a dekadal archive reaching back to 2012, it holds multi-year statistics for every recurring dekad and month of the year: how often each pixel is flooded, how many valid observations support that record, and which water, land or flood state dominates in a typical period.</p>
              <p>EVE 2.0 compares each observed dekad against this reference for the same time of year. Flooding that falls inside the seasonally expected pattern is separated from flooding that is exceptional for that place and season, which is what allows an impact figure to describe an event rather than a river behaving normally.</p>
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
                The observed 10-day flood extent for 11–20 January 2026, in blue and teal, drawn over the multi-year frequency baseline for that same dekad, in purple. Where blue sits on purple, the water is where it usually is at this point in the season. Where blue sits on bare ground, the flooding is exceptional — and that is the part EVE counts as event impact. Hosted on Google Earth Engine.
              </figcaption>
            </figure>
            <div className="service-card-grid">
              <article className="service-card service-card--internal">
                <span>Public explorer</span>
                <h3>VISTA comparison explorer</h3>
                <p>Display an observed event from the dekadal or rolling-monthly archive beside the multi-year baseline for the same calendar period, and apply a minimum historical threshold to see whether a flood footprint is common or spatially unusual for that time of year.</p>
                <a href={VISTA_EXPLORER_URL} target="_blank" rel="noreferrer">Open the comparison explorer ↗</a>
              </article>
              <article className="service-card service-card--internal">
                <span>Data access</span>
                <h3>VISTA product downloads</h3>
                <p>Browse and download the published GeoTIFF products directly: the dekadal and monthly archives, and the count, frequency and dominant-class statistics derived from them.</p>
                <a href={VISTA_BUCKET_URL} target="_blank" rel="noreferrer">Browse VISTA products ↗</a>
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
                {visibleBriefs.map((item) => (
                  <li key={item.id}>
                    <a href={itemDestination(item)} target="_blank" rel="noreferrer">
                      <span className="brief-meta">{briefMeta(item)}</span>
                      <strong>{item.title}</strong>
                      <span className="brief-type">{item.contentRoles[0] || item.type}</span>
                    </a>
                  </li>
                ))}
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
              <a href={ACCESS_REQUEST_URL} target="_blank" rel="noreferrer">Request DIEM Community access ↗</a>
              <Link to="/contact">Contact the DIEM team →</Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
