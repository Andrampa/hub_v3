import { useState } from 'react'
import { Link } from 'react-router-dom'

interface HubArea {
  id: string
  eyebrow: string
  title: string
  description: string
  destination?: string
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

const portfolioAreas: HubArea[] = [
  {
    id: 'catalog', eyebrow: 'Complete collection', title: 'Explore DIEM products',
    description: 'Search and filter the complete public collection of DIEM evidence and resources.',
    destination: '/catalog',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/d923904e390c4d57a814c1ca77a9cbe1/data',
  },
  {
    id: 'research', eyebrow: 'Applied research', title: 'DIEM-Research',
    description: 'Action-oriented research for evidence use in fragile and risk-prone contexts.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/ed74404106024315a20fb5ebbb73f53e/data',
  },
  {
    id: 'risk', eyebrow: 'Anticipatory action', title: 'DIEM-Risk',
    description: 'Risk assessments and scores supporting disaster risk reduction and anticipatory action.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/f16cb09773494779b17eb4156c78e323/data',
  },
]

function CardContent({ area }: { area: HubArea }) {
  return <>
    <div className="hub-area-image"><img src={area.imageUrl} alt="" loading="lazy" /></div>
    <div className="hub-area-body">
      <span className="kicker">{area.eyebrow}</span>
      <h3>{area.title}</h3>
      <p>{area.description}</p>
      <span className="hub-area-action">{area.destination ? 'Explore' : 'Coming soon'}{area.destination && <span aria-hidden="true">→</span>}</span>
    </div>
  </>
}

function PortfolioCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const area = portfolioAreas[activeIndex]
  const move = (direction: number) => setActiveIndex((activeIndex + direction + portfolioAreas.length) % portfolioAreas.length)
  const card = <CardContent area={area} />

  return (
    <section className="hub-portfolio" aria-labelledby="hub-portfolio-title" aria-roledescription="carousel">
      <div className="hub-portfolio-heading">
        <div><span className="kicker">DIEM portfolio</span><h2 id="hub-portfolio-title">Products, research and risk</h2></div>
        <div className="hub-carousel-controls">
          <button type="button" onClick={() => move(-1)} aria-label="Previous portfolio card">←</button>
          <span aria-live="polite"><strong>{activeIndex + 1}</strong> / {portfolioAreas.length}</span>
          <button type="button" onClick={() => move(1)} aria-label="Next portfolio card">→</button>
        </div>
      </div>
      <div className="hub-carousel-viewport">
        {area.destination ? (
          <Link className="hub-area-card hub-carousel-card" to={area.destination} key={area.id}><CardContent area={area} /></Link>
        ) : (
          <article className="hub-area-card hub-area-card--upcoming hub-carousel-card" key={area.id}>{card}</article>
        )}
      </div>
      <div className="hub-carousel-pagination" aria-label="Choose a portfolio card">
        {portfolioAreas.map((item, index) => <button type="button" className={index === activeIndex ? 'is-active' : ''} aria-label={`Show ${item.title}`} aria-pressed={index === activeIndex} onClick={() => setActiveIndex(index)} key={item.id} />)}
      </div>
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
        {sectionAreas.map((area) => <Link className="hub-area-card" to={area.destination!} key={area.id}><CardContent area={area} /></Link>)}
      </div>
      <PortfolioCarousel />
    </section>
  )
}
