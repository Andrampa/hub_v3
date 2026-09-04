import { Link } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { MonitoringProducts } from '../components/MonitoringProducts'
import { SurveyReleases } from '../components/SurveyReleases'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function HouseholdMonitoring() {
  useDocumentTitle('Surveys catalogue')
  return (
    <>
      <SiteHeader />
      <main className="household-monitoring-page">
        <section className="household-explorer-banner" aria-labelledby="household-explorer-heading">
          <div className="section-wrap">
            <div>
              <span>Interactive survey results</span>
              <h1 id="household-explorer-heading">Explore household survey evidence in depth</h1>
              <p>
                Open the Household Survey Explorer to compare rounds, indicators and
                themes in the full-screen interactive application.
              </p>
            </div>
            <Link to="/monitoring">
              Open the Household Survey Explorer
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
        <SurveyReleases />
        <MonitoringProducts />
      </main>
      <SiteFooter />
    </>
  )
}
