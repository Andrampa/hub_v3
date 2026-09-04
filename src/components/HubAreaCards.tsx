import { Link } from 'react-router-dom'

interface HubArea {
  id: string
  eyebrow: string
  title: string
  description: string
  destination: string
  imageUrl: string
}

const sectionAreas: HubArea[] = [
  {
    id: 'monitoring', eyebrow: 'Household surveys', title: 'Household monitoring',
    description: 'Follow survey rounds, briefs and findings on livelihoods, food security and needs.',
    destination: '/monitoring-system',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/b18c0ef1f4494f2a9a564713bc216620/data',
  },
  {
    id: 'impact', eyebrow: 'Major shocks', title: 'Hazard impact assessments',
    description: 'Explore assessment dossiers and the Living Shock Atlas by country, hazard and year.',
    destination: '/hazard-impact-assessments',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/1ab88703b32847cd8fd8776fd2c5e7ac/data',
  },
  {
    id: 'flood', eyebrow: 'Flood evidence', title: 'Flood services',
    description: 'Understand the DIEM pathway for observing floods, assessing exposure and prioritizing action.',
    destination: '/flood-services',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/1155b4e0339641458d8aac5e294d81d4/data',
  },
  {
    id: 'countries', eyebrow: 'Place-based discovery', title: 'Country evidence',
    description: 'Start with a country and find its monitoring, assessments and published evidence.',
    destination: '/countries',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/9103febede744492ae43ebae1c5e3826/data',
  },
]


function CardContent({ area }: { area: HubArea }) {
  return <>
    <div className="hub-area-image"><img src={area.imageUrl} alt="" loading="lazy" /></div>
    <div className="hub-area-body">
      <span className="kicker">{area.eyebrow}</span>
      <h3>{area.title}</h3>
      <p>{area.description}</p>
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
        <p>Search and filter the public catalogue by pillar, product type, country or year.</p>
      </div>
      <Link className="hub-catalog-band-action" to="/catalog">
        Open the catalogue <span aria-hidden="true">→</span>
      </Link>
    </section>
  )
}

export function HubAreaCards() {
  return (
    <section className="hub-areas section-wrap" aria-labelledby="hub-areas-title">
      <div className="section-heading">
        <div><span className="kicker">Explore the Hub</span><h2 id="hub-areas-title">Start with the evidence you need</h2></div>
        <p>Move directly to household monitoring, hazard impacts, flood services or country evidence.</p>
      </div>
      <div className="hub-area-grid">
        {sectionAreas.map((area) => <Link className="hub-area-card" to={area.destination} key={area.id}><CardContent area={area} /></Link>)}
      </div>
      <CatalogBand />
    </section>
  )
}
