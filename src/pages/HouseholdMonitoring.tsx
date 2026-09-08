import { Link } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { MonitoringProducts } from '../components/MonitoringProducts'
import { SurveyReleases } from '../components/SurveyReleases'
import { usePageMetadata } from '../hooks/usePageMetadata'

export default function HouseholdMonitoring() {
  usePageMetadata({
    title: 'Surveys catalogue',
    description: 'DIEM household survey rounds: which countries are in the field, which rounds have been released, and the published briefs, presentations, questionnaires and datasets that belong to each round.',
  })
  return (
    <>
      <SiteHeader />
      <main id="top" className="household-monitoring-page">
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
