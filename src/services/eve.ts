const EVE_PRODUCTION_URL = 'https://diem-eve.apps.fao.org/'
const EVE_ADM0_SERVICE_URL = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/eve_mastertable_adm0/FeatureServer'
const ISO3_FIELD = 'iso3_code'

interface ArcGISServiceEntry {
  id: number
  name?: string
}

interface ArcGISError {
  message?: string
}

interface ArcGISServiceDefinition {
  layers?: ArcGISServiceEntry[]
  tables?: ArcGISServiceEntry[]
  error?: ArcGISError
}

interface EveCountryQueryResponse {
  features?: Array<{ attributes?: Record<string, unknown> }>
  error?: ArcGISError
}

function validIso3(value: unknown): string | undefined {
  const code = String(value ?? '').trim().toUpperCase()
  return /^[A-Z]{3}$/.test(code) ? code : undefined
}

async function getJson<T extends { error?: ArcGISError }>(url: string): Promise<T> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`EVE catalog request failed (${response.status})`)
  const data = await response.json() as T
  if (data.error) throw new Error(data.error.message || 'EVE catalog request failed')
  return data
}

async function resolveAdm0TableUrl(): Promise<string> {
  const definition = await getJson<ArcGISServiceDefinition>(`${EVE_ADM0_SERVICE_URL}?f=json`)
  const entries = [...(definition.tables || []), ...(definition.layers || [])]
  const exact = entries.find((entry) => entry.name?.trim().toLowerCase() === 'eve_mastertable_adm0')
  const hinted = entries.find((entry) => entry.name?.toLowerCase().includes('adm0'))
  const match = exact || hinted
  if (!match || !Number.isInteger(match.id)) {
    throw new Error('EVE ADM0 catalog table could not be resolved')
  }
  return `${EVE_ADM0_SERVICE_URL}/${match.id}`
}

async function loadEveActiveCountryCodes(): Promise<Set<string>> {
  const tableUrl = await resolveAdm0TableUrl()
  const params = new URLSearchParams({
    f: 'json',
    where: `${ISO3_FIELD} IS NOT NULL`,
    outFields: ISO3_FIELD,
    returnGeometry: 'false',
    returnDistinctValues: 'true',
    orderByFields: ISO3_FIELD,
  })
  const result = await getJson<EveCountryQueryResponse>(`${tableUrl}/query?${params}`)
  const codes = new Set<string>()
  for (const feature of result.features || []) {
    const code = validIso3(feature.attributes?.[ISO3_FIELD])
    if (code) codes.add(code)
  }
  return codes
}

let activeCountryCodesPromise: Promise<Set<string>> | undefined

export function fetchEveActiveCountryCodes(): Promise<Set<string>> {
  if (!activeCountryCodesPromise) {
    activeCountryCodesPromise = loadEveActiveCountryCodes().catch((error) => {
      activeCountryCodesPromise = undefined
      throw error
    })
  }
  return activeCountryCodesPromise
}

export async function isEveRegularMonitoringActive(iso3: string): Promise<boolean> {
  const code = validIso3(iso3)
  if (!code) return false
  return (await fetchEveActiveCountryCodes()).has(code)
}

export function buildEveCountryOverviewUrl(iso3: string, { lang = 'en' } = {}): string {
  const code = validIso3(iso3)
  if (!code) throw new TypeError('A valid ISO 3166-1 alpha-3 country code is required.')

  const url = new URL(EVE_PRODUCTION_URL)
  url.searchParams.set('mode', 'overview')
  url.searchParams.set('adm0', code)
  if (lang !== 'en') url.searchParams.set('lang', lang)
  return url.href
}
