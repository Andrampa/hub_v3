import { Link } from 'react-router-dom'
import floodHeroImage from '../assets/heroes/bangladesh-flood-2020.jpg'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'

const publicApps = [
  {
    name: 'EVE 2.0',
    description: 'Follow satellite-observed flood and water conditions to support situation analysis and rapid verification.',
    href: 'https://diem.fao.org/eve-webapp/index.html',
  },
  {
    name: 'Floodex',
    description: 'Explore modelled flood hazard and exposure across people, agriculture and other exposed assets.',
    href: 'https://diem.fao.org/risk-explorer/NGA_flood_exposure.html',
  },
]

const internalApps = [
  {
    name: 'Madagascar field reporting',
    description: 'Review geo-tagged field submissions and photos alongside satellite-derived flood information.',
    href: 'https://hqfao.maps.arcgis.com/apps/instant/attachmentviewer/index.html?appid=172f8f84fd644d14bfa3cc063f5bc11d',
  },
  {
    name: 'Mozambique field reporting',
    description: 'Review structured field observations and photos alongside satellite-derived flood information.',
    href: 'https://hqfao.maps.arcgis.com/apps/instant/attachmentviewer/index.html?appid=eebd1d161cbe42e9a76c87c27a04a49d',
  },
]

export default function FloodServices() {
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
            <p>DIEM flood services connect hazard and exposure, satellite observation, field evidence and impact analysis to support early action, response and recovery.</p>
          </div>
        </section>

        <section className="flood-intro section-wrap">
          <div><span className="kicker">One connected evidence chain</span><h2>Understand the event, then validate what it means on the ground.</h2></div>
          <p>Use the services together to move from preparedness and prioritization, through observation and field reporting, to a context-specific assessment of impacts on agricultural livelihoods.</p>
        </section>

        <section className="flood-services section-wrap" aria-labelledby="flood-services-heading">
          <div className="programme-section-heading"><div><span className="kicker">Public services</span><h2 id="flood-services-heading">Explore flood evidence</h2></div><p>These services are publicly available.</p></div>
          <div className="service-card-grid">
            {publicApps.map((app) => <article className="service-card" key={app.name}><span>Public service</span><h3>{app.name}</h3><p>{app.description}</p><a href={app.href} target="_blank" rel="noreferrer">Open {app.name} ↗</a></article>)}
          </div>
        </section>

        <section className="field-services">
          <div className="section-wrap">
            <div className="programme-section-heading"><div><span className="kicker kicker--light">Field evidence</span><h2>Field reporting applications</h2></div><p>These applications are available to internal users. External partners can request access through the contact form.</p></div>
            <div className="service-card-grid">
              {internalApps.map((app) => <article className="service-card service-card--internal" key={app.name}><span>Internal access</span><h3>{app.name}</h3><p>{app.description}</p><a href={app.href} target="_blank" rel="noreferrer">Open internal application ↗</a></article>)}
            </div>
            <Link className="field-contact-link" to="/contact">Request access or contact the DIEM team →</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
