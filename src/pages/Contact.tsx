import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'

const CONTACT_FORM_URL = 'https://arcg.is/0Df1Ca'

export default function Contact() {
  return (
    <>
      <SiteHeader active="contact" />
      <main className="contact-page">
        <section className="contact-hero">
          <div className="section-wrap">
            <span className="eyebrow"><span /> Contact DIEM</span>
            <h1>How can we <em>help?</em></h1>
            <p>Use the contact form for questions about DIEM resources, flood-service access or collaboration with the DIEM team.</p>
          </div>
        </section>
        <section className="contact-form-section section-wrap" aria-labelledby="contact-form-heading">
          <div className="contact-form-intro"><span className="kicker">Contact form</span><h2 id="contact-form-heading">Send a request to the DIEM team.</h2><p>The form opens in a separate service and can also be used to request access to the internal field-reporting applications.</p><a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer">Open the contact form in a new tab ↗</a></div>
          <iframe title="DIEM contact form" src={CONTACT_FORM_URL} loading="lazy">Your browser does not support embedded content. <a href={CONTACT_FORM_URL} target="_blank" rel="noreferrer">Open the contact form.</a></iframe>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
