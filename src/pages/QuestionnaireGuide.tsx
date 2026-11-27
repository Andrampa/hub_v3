import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { usePageMetadata } from '../hooks/usePageMetadata'
import '../questionnaire-guide.css'

const GUIDE_URL = 'https://diem-monitoring.apps.fao.org/questionnaire.html?diemEmbed=hub'

/** Public guide; the embed flag suppresses its duplicate institutional header. */
export default function QuestionnaireGuide() {
  usePageMetadata({
    title: 'Questionnaire guide',
    description: 'Explore the DIEM household questionnaire, question routing and derived indicators.',
  })

  return (
    <>
      <SiteHeader />
      <main id="top" className="questionnaire-guide-page">
        <h1 className="visually-hidden">Questionnaire guide</h1>
        <iframe className="questionnaire-guide-frame" src={GUIDE_URL} title="DIEM household questionnaire guide" />
      </main>
      <SiteFooter />
    </>
  )
}
