import { useCallback, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useAuth } from '../auth/AuthContext'
import { COMMUNITY_PORTAL } from '../services/auth'
import {
  embeddedDashboardUrl,
  HUB_AUTH_MESSAGE,
  HUB_STATE_MESSAGE,
  hubUrlWithVisualizationState,
  isMonitoringAuthReadyMessage,
  isMonitoringStateMessage,
  MONITORING_BRIDGE_VERSION,
  monitoringDashboardUrl,
  normalizeVisualizationSearch,
} from '../services/monitoringEmbed'

// Re-send the token this far before it expires so the embedded dashboard never
// runs on a dead credential, and never schedule a tighter loop than the floor.
const AUTH_REFRESH_LEAD_MS = 120_000
const AUTH_REFRESH_MIN_MS = 30_000

export default function MonitoringSystem() {
  const location = useLocation()
  const { status, embedCredential } = useAuth()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const dashboardReadyRef = useRef(false)
  const refreshTimerRef = useRef<number | undefined>(undefined)
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

  const sendAuthToDashboard = useCallback(async () => {
    // 'loading' and 'authenticating' are unsettled: sending now would push a
    // null token and sign the dashboard out mid-restore. The status effect
    // re-runs once the state settles.
    if (status === 'loading' || status === 'authenticating') return
    if (!dashboardReadyRef.current) return

    const frame = iframeRef.current?.contentWindow
    if (!frame) return

    let credential = null
    try {
      credential = await embedCredential()
    } catch {
      // A token that cannot be minted or refreshed is reported as signed-out
      // rather than left stale; the dashboard falls back to anonymous.
      credential = null
    }

    // The iframe may have been replaced or unmounted while the token was being
    // minted; posting to a different document would leak the token.
    if (iframeRef.current?.contentWindow !== frame) return

    frame.postMessage({
      type: HUB_AUTH_MESSAGE,
      version: MONITORING_BRIDGE_VERSION,
      portal: COMMUNITY_PORTAL,
      token: credential?.token ?? null,
      expires: credential?.expires ?? null,
    }, dashboardOrigin)

    window.clearTimeout(refreshTimerRef.current)
    if (credential?.expires) {
      const delay = Math.max(credential.expires - Date.now() - AUTH_REFRESH_LEAD_MS, AUTH_REFRESH_MIN_MS)
      refreshTimerRef.current = window.setTimeout(() => { void sendAuthToDashboard() }, delay)
    }
  }, [dashboardOrigin, embedCredential, status])

  useEffect(() => {
    const receiveDashboardMessage = (event: MessageEvent) => {
      if (event.origin !== dashboardOrigin || event.source !== iframeRef.current?.contentWindow) return

      if (isMonitoringAuthReadyMessage(event.data)) {
        dashboardReadyRef.current = true
        void sendAuthToDashboard()
        return
      }

      if (!isMonitoringStateMessage(event.data)) return

      const nextUrl = hubUrlWithVisualizationState(window.location.href, event.data.search)
      if (!nextUrl || nextUrl === window.location.href) return
      window.history.replaceState(window.history.state, '', nextUrl)
    }

    window.addEventListener('message', receiveDashboardMessage)
    return () => window.removeEventListener('message', receiveDashboardMessage)
  }, [dashboardOrigin, sendAuthToDashboard])

  useEffect(() => {
    void sendAuthToDashboard()
  }, [sendAuthToDashboard])

  useEffect(() => () => window.clearTimeout(refreshTimerRef.current), [])

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
