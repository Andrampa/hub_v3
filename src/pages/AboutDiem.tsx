import { Link } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import aboutHeroImage from '../assets/heroes/zambia-drought-2024.jpg'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const CREATE_ACCOUNT_URL = 'https://hqfao.maps.arcgis.com/sharing/rest/oauth2/signup?client_id=aEXLMtXxljlIrgPN&response_type=token&redirect_uri=https%3A%2F%2Fdata-in-emergencies.fao.org%2Ftorii-provider-arcgis%2Fhub-redirect.html'

const videos = [
  {
    id: 'Y_3QsHLDZp4',
    title: 'DIEM introductory video',
    description: 'The DIEM – Data in Emergencies information system was established by the Food and Agriculture Organization of the United Nations to inform decision-making in support of agricultural livelihoods. By regularly collecting primary data in food crisis countries, DIEM enables FAO and its partners to better understand the impact of shocks. This video introduces the system and its functionalities.',
  },
  {
    id: 'wdUgzH_GAro',
    title: 'Stories from DIEM users',
    description: 'Since its launch in June 2020, DIEM has conducted surveys in over 30 countries and reached more than 150 000 households. The system informs programming in country offices, supports funding decisions and contributes to analytical processes. This video explores the added value of DIEM on the ground.',
  },
]

export default function AboutDiem() {
  useDocumentTitle('About DIEM')
  return (
    <>
      <SiteHeader active="about" />
      <main className="about-page">
        <section className="about-hero">
          <img className="about-hero-image" src={aboutHeroImage} alt="Dry agricultural fields illustrating the conditions DIEM evidence helps assess" />
          <div className="about-hero-overlay" />
          <div className="section-wrap">
            <span className="eyebrow"><span /> About DIEM</span>
            <h1>Evidence when decisions <em>cannot wait.</em></h1>
            <p>DIEM—Data in Emergencies—is FAO’s information system for understanding how shocks affect agricultural livelihoods and food security in crisis contexts.</p>
          </div>
          <a className="about-hero-credit" href="https://commons.wikimedia.org/wiki/File:Dry_fields_in_Lusaka_03.jpg" target="_blank" rel="noreferrer">Photo: Icem4k / CC BY 4.0</a>
        </section>

        <section className="about-introduction section-wrap" aria-labelledby="about-introduction-heading">
          <div>
            <span className="kicker">What is DIEM?</span>
            <h2 id="about-introduction-heading">Primary evidence for agricultural emergencies</h2>
          </div>
          <div className="about-introduction-copy">
            <p>FAO established DIEM to make timely, comparable evidence available where food crises and other shocks threaten rural livelihoods. Regular household surveys, hazard-impact assessments and geospatial monitoring help describe what has happened, who is affected and where support may be needed.</p>
            <p>The Hub brings these products together without duplicating their source records. Public evidence remains connected to its authoritative ArcGIS item, while approved users can access household datasets and specialist tools through the appropriate permission pathways.</p>
          </div>
        </section>

        <section className="about-cycle" aria-labelledby="about-cycle-heading">
          <div className="section-wrap">
            <div className="programme-section-heading">
              <div><span className="kicker">From observation to action</span><h2 id="about-cycle-heading">How DIEM supports decisions</h2></div>
              <p>DIEM combines recurring monitoring with rapid assessment and direct access to evidence.</p>
            </div>
            <ol className="about-cycle-grid">
              <li><span>01</span><h3>Collect</h3><p>Gather primary household information and observe hazards affecting agriculture in crisis-prone countries.</p></li>
              <li><span>02</span><h3>Understand</h3><p>Analyse changes in food security, livelihoods, shocks and exposure across places and time.</p></li>
              <li><span>03</span><h3>Use</h3><p>Share findings, products and authorized data so FAO and partners can plan and adapt their response.</p></li>
            </ol>
            <nav className="about-pathways" aria-label="Explore DIEM evidence pathways">
              <Link to="/monitoring-system">Household monitoring <span aria-hidden="true">→</span></Link>
              <Link to="/hazard-impact-assessments">Hazard impacts <span aria-hidden="true">→</span></Link>
              <Link to="/flood-services">Flood monitoring and risk <span aria-hidden="true">→</span></Link>
              <Link to="/data">Data access <span aria-hidden="true">→</span></Link>
            </nav>
          </div>
        </section>

        <section className="about-videos section-wrap" aria-labelledby="about-videos-heading">
          <div className="programme-section-heading">
            <div><span className="kicker">DIEM in practice</span><h2 id="about-videos-heading">Watch and learn</h2></div>
            <p>Meet the system and hear how country teams use its evidence.</p>
          </div>
          <div className="about-video-grid">
            {videos.map((video) => (
              <article className="about-video" key={video.id}>
                <div className="about-video-frame">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                    title={video.title}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
                <div className="about-video-copy">
                  <h3>{video.title}</h3>
                  <p>{video.description}</p>
                  <a href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer">Watch on YouTube <span aria-hidden="true">↗</span></a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="about-newsletter" aria-labelledby="about-newsletter-heading">
          <div className="section-wrap">
            <div className="about-newsletter-mark" aria-hidden="true">✉</div>
            <div>
              <span className="kicker">Stay informed</span>
              <h2 id="about-newsletter-heading">News and evidence from DIEM</h2>
              <p>Our newsletter keeps the DIEM community updated on new assessments and datasets, programme initiatives, events and other opportunities to engage with our work.</p>
            </div>
            <a href={CREATE_ACCOUNT_URL} target="_blank" rel="noreferrer">
              Create an account to receive it <span aria-hidden="true">↗</span>
            </a>
          </div>
        </section>

        <section className="about-contact">
          <div className="section-wrap">
            <div><span className="kicker">Work with DIEM</span><h2>Questions, collaboration or support?</h2></div>
            <Link to="/contact">Contact the DIEM team <span aria-hidden="true">→</span></Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
