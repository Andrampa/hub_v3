import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import {
  embeddedDashboardUrl,
  HUB_STATE_MESSAGE,
  hubUrlWithVisualizationState,
  isMonitoringStateMessage,
  MONITORING_BRIDGE_VERSION,
  monitoringDashboardUrl,
  normalizeVisualizationSearch,
} from '../services/monitoringEmbed'

export default function MonitoringSystem() {
  const location = useLocation()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const dashboardUrlRef = useRef(monitoringDashboardUrl())
  const dashboardOrigin = new URL(dashboardUrlRef.current).origin
  const hubShareUrl = `${window.location.origin}${location.pathname}`
  const initialEmbeddedUrl = useRef(
    embeddedDashboardUrl(dashboardUrlRef.current, location.search, hubShareUrl),
  )

  const sendHubStateToDashboard = useCallback(() => {
    const search = normalizeVisualizationSearch(window.location.search)
    if (search === null) return
    iframeRef.current?.contentWindow?.postMessage({
      type: HUB_STATE_MESSAGE,
      version: MONITORING_BRIDGE_VERSION,
      search,
    }, dashboardOrigin)
  }, [dashboardOrigin])

  useEffect(() => {
    const receiveDashboardState = (event: MessageEvent) => {
      if (event.origin !== dashboardOrigin || event.source !== iframeRef.current?.contentWindow) return
      if (!isMonitoringStateMessage(event.data)) return

      const nextUrl = hubUrlWithVisualizationState(window.location.href, event.data.search)
      if (!nextUrl || nextUrl === window.location.href) return
      window.history.replaceState(window.history.state, '', nextUrl)
    }

    window.addEventListener('message', receiveDashboardState)
    return () => window.removeEventListener('message', receiveDashboardState)
  }, [dashboardOrigin])

  useEffect(() => {
    sendHubStateToDashboard()
  }, [location.search, sendHubStateToDashboard])

  return (
    <>
      <SiteHeader active="monitoring" />
      <main className="monitoring-page">
        <section className="monitoring-dashboard" aria-label="DIEM monitoring dashboards">
          <iframe
            ref={iframeRef}
            className="monitoring-dashboard-frame"
            src={initialEmbeddedUrl.current}
            title="DIEM monitoring dashboards"
            allow="fullscreen"
            onLoad={sendHubStateToDashboard}
          />
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
