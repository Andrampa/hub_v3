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
