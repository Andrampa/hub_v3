export const DEFAULT_MONITORING_DASHBOARD_URL = 'https://diem-monitoring.apps.fao.org/'
export const MONITORING_BRIDGE_VERSION = 1
export const MONITORING_STATE_MESSAGE = 'diem-monitoring:url-state'
export const HUB_STATE_MESSAGE = 'diem-hub:url-state'
// Identity handoff. The dashboard is a different registrable domain, so no
// cookie or storage can be shared with it; the embedded dashboard learns about
// the Hub sign-in only through this channel.
export const MONITORING_AUTH_READY_MESSAGE = 'diem-monitoring:auth-ready'
export const HUB_AUTH_MESSAGE = 'diem-hub:auth'

const EMBED_MODE_PARAM = 'diemEmbed'
const HUB_SHARE_URL_PARAM = 'diemHubShareUrl'
const MAX_STATE_LENGTH = 8_192

export interface MonitoringStateMessage {
  type: typeof MONITORING_STATE_MESSAGE
  version: typeof MONITORING_BRIDGE_VERSION
  search: string
}

export interface HubStateMessage {
  type: typeof HUB_STATE_MESSAGE
  version: typeof MONITORING_BRIDGE_VERSION
  search: string
}

// `token: null` is a meaningful value, not an absence: it tells the dashboard to
// drop its credential when the Hub signs out. No username, role, or capability
// travels in this message - the dashboard re-derives all of those from
// /community/self with the token, so a forged message cannot grant access.
export interface HubAuthMessage {
  type: typeof HUB_AUTH_MESSAGE
  version: typeof MONITORING_BRIDGE_VERSION
  portal: string
  token: string | null
  expires: number | null
}

export function monitoringDashboardUrl() {
  const configured = import.meta.env.VITE_MONITORING_DASHBOARD_URL?.trim()
  const candidate = configured || DEFAULT_MONITORING_DASHBOARD_URL

  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported protocol')
    return url.toString()
  } catch {
    console.warn('Ignoring invalid VITE_MONITORING_DASHBOARD_URL; using the production deployment.')
    return DEFAULT_MONITORING_DASHBOARD_URL
  }
}

export function monitoringCountryPath(
  iso3: string,
  round: string,
  mode: 'explore' | 'trends' | 'anomalies' = 'explore',
  theme?: string,
) {
  const normalizedIso = iso3.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedIso) || !round.trim()) return '/monitoring'
  const params = new URLSearchParams({ iso: normalizedIso, round: round.trim() })
  if (mode !== 'explore') params.set('mode', mode)
  // The Monitoring application lowercases the theme it reads from the URL.
  if (theme?.trim()) params.set('theme', theme.trim().toLowerCase())
  return `/monitoring?${params}`
}

export function normalizeVisualizationSearch(search: string) {
  if (typeof search !== 'string' || search.length > MAX_STATE_LENGTH) return null

  const input = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const normalized = new URLSearchParams()
  for (const [key, value] of input) {
    if (key !== EMBED_MODE_PARAM && key !== HUB_SHARE_URL_PARAM) normalized.append(key, value)
  }
  const value = normalized.toString()
  return value ? `?${value}` : ''
}

export function embeddedDashboardUrl(dashboardHref: string, search: string, hubShareUrl: string) {
  const dashboard = new URL(dashboardHref)
  const normalized = normalizeVisualizationSearch(search)
  dashboard.search = normalized ?? ''
  dashboard.searchParams.set(EMBED_MODE_PARAM, 'hub')
  dashboard.searchParams.set(HUB_SHARE_URL_PARAM, hubShareUrl)
  return dashboard.toString()
}

export function isMonitoringStateMessage(value: unknown): value is MonitoringStateMessage {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<MonitoringStateMessage>
  return candidate.type === MONITORING_STATE_MESSAGE
    && candidate.version === MONITORING_BRIDGE_VERSION
    && typeof candidate.search === 'string'
    && normalizeVisualizationSearch(candidate.search) !== null
}

export function isMonitoringAuthReadyMessage(value: unknown) {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<{ type: string; version: number }>
  return candidate.type === MONITORING_AUTH_READY_MESSAGE
    && candidate.version === MONITORING_BRIDGE_VERSION
}

export function hubUrlWithVisualizationState(currentHref: string, search: string) {
  const normalized = normalizeVisualizationSearch(search)
  if (normalized === null) return null
  const hubUrl = new URL(currentHref)
  hubUrl.search = normalized
  return hubUrl.toString()
}
