import { Link } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { HeroImage } from '../components/HeroImage'
import { HeroCredit } from '../components/HeroCredit'
import { usePageMetadata } from '../hooks/usePageMetadata'

// Survey123 form behind ArcGIS item c224d7e568fb464fbfbca2fff047707f.
const REQUEST_FORM_URL = 'https://survey123.arcgis.com/share/c224d7e568fb464fbfbca2fff047707f?portalUrl=https://hqfao.maps.arcgis.com'

export default function MicrodataRequest() {
  usePageMetadata({
    title: 'Microdata request',
    description: 'Request household-level DIEM microdata from a recent survey for research or operational purposes, before it is published in the FAO Food and Agriculture Microdata Catalogue.',
  })
  return (
    <>
      <SiteHeader />
      <main id="top" className="contact-page">
        <section className="contact-hero">
          <HeroImage name="afghanistan-f2f-smartphone-interview-2024" className="contact-hero-image" alt="A DIEM enumerator recording a face-to-face interview on a smartphone in Afghanistan" />
          <HeroCredit name="afghanistan-f2f-smartphone-interview-2024" />
          <div className="section-wrap">
            <span className="eyebrow"><span /> DIEM data</span>
            <h1>Request <em>microdata</em></h1>
            <p>Anonymized microdata is published in FAM about six months after the aggregated release. If you need household-level data from a more recent survey, submit a request below.</p>
          </div>
        </section>
        <section className="contact-form-section section-wrap" aria-labelledby="microdata-form-heading">
          <div className="contact-form-intro"><span className="kicker">Request form</span><h2 id="microdata-form-heading">Tell us what data you need.</h2><p>Read the <Link to="/data/guide#microdata">microdata conditions in the data guide</Link> before submitting. Sign in to the form with your DIEM community account if prompted.</p><a href={REQUEST_FORM_URL} target="_blank" rel="noreferrer">Open the form in a new tab ↗</a></div>
          <iframe title="DIEM microdata request form" src={REQUEST_FORM_URL} loading="lazy" allow="geolocation">Your browser does not support embedded content. <a href={REQUEST_FORM_URL} target="_blank" rel="noreferrer">Open the microdata request form.</a></iframe>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
