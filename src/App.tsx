import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import { CatalogSearchBox } from './components/CatalogSearchBox'
import { EditorialPopup } from './components/EditorialPopup'
import { FeaturedEvidence } from './components/FeaturedEvidence'
import { HubAreaCards } from './components/HubAreaCards'
import { LatestEvidenceBanner } from './components/LatestEvidenceBanner'
import { ProgrammeNumbers } from './components/ProgrammeNumbers'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { useCountryCatalog } from './hooks/useCountryCatalog'
import { useDocumentTitle } from './hooks/useDocumentTitle'
import { isHazardImpactAssessment } from './lib/catalog'
import { groupProductFamilies } from './lib/productFamilies'
import { fetchMonitoringStatistics, type MonitoringStatistics } from './services/monitoring'
import { defaultProgrammeSlides, fetchHubPromotions, promotionChannel, type HubPromotions } from './services/hubPromotions'

export default function App() {
  useDocumentTitle('Data in Emergencies')
  const auth = useAuth()
  const { catalog, error, retry } = useCountryCatalog()
  const [promotions, setPromotions] = useState<HubPromotions>({ slides: defaultProgrammeSlides, channel: promotionChannel })
  const [monitoringStatistics, setMonitoringStatistics] = useState<MonitoringStatistics | null>(null)
  const [monitoringStatisticsFailed, setMonitoringStatisticsFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetchHubPromotions(controller.signal).then(setPromotions).catch((reason: Error) => {
      if (reason.name !== 'AbortError') console.warn('Hub promotions could not be initialized.', reason)
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchMonitoringStatistics(controller.signal).then(setMonitoringStatistics).catch((reason: Error) => {
      if (reason.name === 'AbortError') return
      console.warn('Monitoring statistics could not be loaded.', reason)
      setMonitoringStatisticsFailed(true)
    })
    return () => controller.abort()
  }, [])

  const families = useMemo(() => groupProductFamilies(catalog?.items || []), [catalog])
  const stats = useMemo(() => ({
    total: families.length,
    hazardImpactAssessments: families.filter((family) => family.variants.some(isHazardImpactAssessment)).length,
  }), [families])

  return (
    <>
      <SiteHeader />
      <main id="top">
        <section className="hero">
          <img className="hero-image" src={defaultProgrammeSlides[0].imageUrl} alt="" />
          <div className="hero-content">
            <div className="eyebrow">Data in Emergencies</div>
            <h1>Evidence where<br />decisions <em>can’t wait.</em></h1>
            <p>Regularly collected and analysed data on how shocks affect agricultural livelihoods in fragile and risk-prone contexts.</p>
            <CatalogSearchBox families={families} countries={catalog?.countries || []} />
            <div className="hero-actions"><Link to="/countries">Browse country evidence <span aria-hidden="true">→</span></Link></div>
            {auth.status === 'authenticated' && <div className="hero-meta"><span><i className="status-dot" /> Signed in to the DIEM community</span></div>}
          </div>
        </section>

        {catalog && <LatestEvidenceBanner items={families.map((family) => family.primary)} />}
        {error && <div className="home-catalog-notice section-wrap" role="alert"><p><strong>Latest public evidence is temporarily unavailable.</strong> The programme pathways remain available.</p><button type="button" onClick={retry}>Try again</button></div>}
        <HubAreaCards counts={{ publicResources: stats.total, hazardImpactAssessments: stats.hazardImpactAssessments, countriesWithEvidence: catalog?.countries.length || 0, surveys: monitoringStatistics?.surveys || 0 }} />
        <FeaturedEvidence families={families} />
        <ProgrammeNumbers statistics={monitoringStatistics} statisticsFailed={monitoringStatisticsFailed} hazardImpactAssessments={stats.hazardImpactAssessments} publicResources={stats.total} countriesWithEvidence={catalog?.countries.length || 0} catalogReady={Boolean(catalog)} />

        <EditorialPopup campaign={promotions.campaign} channel={promotions.channel} triggerId="featured-evidence" />
      </main>
      <SiteFooter />
    </>
  )
}
