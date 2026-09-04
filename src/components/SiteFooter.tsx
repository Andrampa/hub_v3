import { Link } from 'react-router-dom'
import faoLogo from '../assets/fao/fao-logo-blue-3lines-en.svg'

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="footer site-footer">
      <div className="footer-primary">
        <a className="footer-brand" href="https://www.fao.org/home/en/">
          <img src={faoLogo} alt="Food and Agriculture Organization of the United Nations" />
        </a>
        <div className="footer-about">
          <strong>DIEM Hub</strong>
          <p>Data in Emergencies evidence for resilient agricultural livelihoods and food security.</p>
        </div>
      </div>
      {/* The footer previously held FAO corporate links only, so the reader who
          reached the bottom of a 3,000 px page was offered nothing but a way
          off the site. */}
      <nav className="footer-nav" aria-label="Site sections">
        <div>
          <h2>Evidence</h2>
          <ul>
            <li><Link to="/catalog">Catalogue</Link></li>
            <li><Link to="/countries">Countries</Link></li>
            <li><Link to="/hazard-impact-assessments">Hazard impacts</Link></li>
            <li><Link to="/flood-services">Flood services</Link></li>
          </ul>
        </div>
        <div>
          <h2>Household surveys</h2>
          <ul>
            <li><Link to="/monitoring-system">Surveys catalogue</Link></li>
            <li><Link to="/monitoring">Survey explorer</Link></li>
            <li><Link to="/data">Data access</Link></li>
            <li><Link to="/data/guide">Data access guide</Link></li>
          </ul>
        </div>
        <div>
          <h2>About</h2>
          <ul>
            <li><Link to="/about">What is DIEM?</Link></li>
            <li><Link to="/photo-galleries">Photo galleries</Link></li>
            <li><Link to="/contact">Contact us</Link></li>
          </ul>
        </div>
      </nav>
      <div className="footer-rule" />
      <ul className="footer-links list-inline">
        <li className="list-inline-item"><a href="https://www.fao.org/contact-us/en/">Contact us</a></li>
        <li className="list-inline-item"><a href="https://www.fao.org/contact-us/terms/en/">Terms and Conditions</a></li>
        <li className="list-inline-item"><a href="https://www.fao.org/contact-us/data-protection-and-privacy/en/">Data protection and privacy</a></li>
        <li className="list-inline-item"><a href="https://www.fao.org/contact-us/scam-alert/en/">Scam Alert</a></li>
        <li className="list-inline-item"><a href="https://www.fao.org/audit-and-investigations/reporting-misconduct/en/">Report Misconduct</a></li>
        <li className="list-inline-item"><a href="https://www.fao.org/transparency/en">Transparency and accountability</a></li>
      </ul>
      <div className="footer-meta">
        <span>Original content CC BY 4.0</span>
        <a className="copyright" href="https://www.fao.org/contact-us/terms/en/">© FAO&nbsp;{year}</a>
      </div>
    </footer>
  )
}
