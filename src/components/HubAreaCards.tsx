import { Link } from 'react-router-dom'
import { MONITORING_COUNTRIES_COVERED } from '../services/monitoring'

/**
 * The live figures behind the four pathways. Everything except `surveys` is
 * already computed on the homepage; each is 0 until its source resolves.
 */
export interface HubAreaCounts {
  publicResources: number
  hazardImpactAssessments: number
  countriesWithEvidence: number
  surveys: number
}

interface HubArea {
  id: string
  eyebrow: string
  title: string
  /**
   * A card says what is behind it rather than inviting the reader to explore,
   * so the copy is a function of the live counts. Each sentence is written to
   * read correctly while a count is still 0, because the figures arrive from
   * three different services at three different moments.
   */
  description: (counts: HubAreaCounts) => string
  destination: string
  imageUrl: string
}

const sectionAreas: HubArea[] = [
  {
    id: 'countries', eyebrow: 'Place-based discovery', title: 'Country evidence',
    description: ({ countriesWithEvidence, publicResources }) =>
      countriesWithEvidence && publicResources
        ? `${countriesWithEvidence} countries, ${publicResources.toLocaleString()} products: monitoring, assessments and published evidence, indexed by place.`
        : 'Start with a country and find its monitoring, assessments and published evidence.',
    destination: '/countries',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/9103febede744492ae43ebae1c5e3826/data',
  },
  {
    id: 'monitoring', eyebrow: 'Household surveys', title: 'Household monitoring',
    description: ({ surveys }) =>
      surveys
        ? `${surveys.toLocaleString()} survey rounds across ${MONITORING_COUNTRIES_COVERED} countries, with the briefs and findings from each.`
        : `Survey rounds across ${MONITORING_COUNTRIES_COVERED} countries, with the briefs and findings from each.`,
    destination: '/monitoring-system',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/b18c0ef1f4494f2a9a564713bc216620/data',
  },
  {
    id: 'impact', eyebrow: 'Major shocks', title: 'Hazard impact assessments',
    description: ({ hazardImpactAssessments }) =>
      hazardImpactAssessments
        ? `${hazardImpactAssessments} hazard impact assessments, indexed by country, shock type and year.`
        : 'Hazard impact assessments, indexed by country, shock type and year.',
    destination: '/hazard-impact-assessments',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/1ab88703b32847cd8fd8776fd2c5e7ac/data',
  },
  {
    id: 'flood', eyebrow: 'Flood evidence', title: 'Flood services',
    description: () => 'How DIEM observes floods, assesses exposure and prioritizes action, through EVE and VISTA.',
    destination: '/flood-services',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/1155b4e0339641458d8aac5e294d81d4/data',
  },
]

function CardContent({ area, counts }: { area: HubArea, counts: HubAreaCounts }) {
  return <>
    <div className="hub-area-image"><img src={area.imageUrl} alt="" loading="lazy" /></div>
    <div className="hub-area-body">
      <span className="kicker">{area.eyebrow}</span>
      <h3>{area.title}</h3>
      <p>{area.description(counts)}</p>
      <span className="hub-area-action">Explore<span aria-hidden="true">→</span></span>
    </div>
  </>
}

/**
 * Replaces a three-slide carousel whose second and third slides were inert
 * "Coming soon" panels, so two thirds of the control's states rewarded the
 * reader with nothing, and whose first slide used a generated illustration on
 * a page where every other image is field photography.
 */
function CatalogBand() {
  return (
    <section className="hub-catalog-band" aria-labelledby="hub-catalog-band-title">
      <div>
        <span className="kicker">Complete collection</span>
        <h2 id="hub-catalog-band-title">Every published DIEM product, in one place</h2>
        <p>Search and filter the public catalogue by evidence pathway, product type, country or year.</p>
      </div>
      <Link className="hub-catalog-band-action" to="/catalog">
        Open the catalogue <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

export function HubAreaCards({ counts }: { counts: HubAreaCounts }) {
  return (
    <section className="hub-areas section-wrap" aria-labelledby="hub-areas-title">
      {/* The heading previously carried a paragraph re-listing the four card
          titles directly above the four cards. Country evidence leads because
          it is the entry point a first-time visitor needs and the only one of
          the four that opens a real index. */}
      <div className="section-heading">
        <div><span className="kicker">Explore the Hub</span><h2 id="hub-areas-title">Start with the evidence you need</h2></div>
      </div>
      <div className="hub-area-grid">
        {sectionAreas.map((area) => <Link className="hub-area-card" to={area.destination} key={area.id}><CardContent area={area} counts={counts} /></Link>)}
      </div>
      <CatalogBand />
    </section>
  )
}
