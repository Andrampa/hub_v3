export type PromotionChannel = 'prod' | 'stg'

export interface ProgrammeSlide {
  id: string
  eyebrow: string
  title: string
  description: string
  imageUrl: string
  imageAlt: string
  ctaLabel?: string
  destination?: string
  sortOrder: number
}

export interface HubCampaign {
  id: string
  title: string
  description: string
  imageUrl?: string
  destination: string
  ctaLabel: string
  dismissDays: number
}

export interface HubPromotions {
  slides: ProgrammeSlide[]
  campaign?: HubCampaign
  channel: PromotionChannel
}

interface ArcGISFeature {
  attributes?: Record<string, unknown>
}

interface ArcGISQueryResponse {
  features?: ArcGISFeature[]
  error?: { message?: string }
}

interface ArcGISServiceDefinition {
  layers?: Array<{ id?: number }>
  tables?: Array<{ id?: number }>
  error?: { message?: string }
}

const LEGACY_POPUP_ITEM_ID = '015a1eabdb454d1c90fd9ad282e407e6'
const configuredViewItemId = import.meta.env.VITE_HUB_PROMOTIONS_VIEW_ITEM_ID?.trim()
const configuredServiceUrl = import.meta.env.VITE_HUB_PROMOTIONS_SERVICE_URL?.trim().replace(/\/+$/, '')

export const promotionChannel: PromotionChannel =
  import.meta.env.VITE_HUB_PROMOTIONS_CHANNEL?.trim().toLowerCase() === 'stg' ? 'stg' : 'prod'

export const defaultProgrammeSlides: ProgrammeSlide[] = [
  {
    id: 'products',
    eyebrow: 'Country evidence',
    title: 'Explore DIEM products',
    description: 'Access country-specific documents, reports and products across the DIEM evidence base.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/d923904e390c4d57a814c1ca77a9cbe1/data',
    imageAlt: 'Agricultural landscape representing DIEM country evidence',
    ctaLabel: 'Explore country evidence',
    destination: '/countries',
    sortOrder: 10,
  },
  {
    id: 'eve',
    eyebrow: 'Flood monitoring',
    title: 'EVE 2.0',
    description: 'Track floods dekad by dekad, separate exceptional flooding from the normal season, and map impacts on agriculture.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/1155b4e0339641458d8aac5e294d81d4/data',
    imageAlt: 'Flooded agricultural landscape',
    ctaLabel: 'Explore flood services',
    destination: '/flood-services',
    sortOrder: 20,
  },
  {
    id: 'exposure',
    eyebrow: 'Exposure analysis',
    title: 'Flood exposure',
    description: 'Estimate potential exposure of cropland and population to flood events for rapid prioritization.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/9103febede744492ae43ebae1c5e3826/data',
    imageAlt: 'Flood exposure analysis landscape',
    ctaLabel: 'Open flood services',
    destination: '/flood-services',
    sortOrder: 30,
  },
  {
    id: 'monitoring',
    eyebrow: 'Household monitoring',
    title: 'DIEM-Monitoring',
    description: 'Follow shocks, livelihoods, food security and needs through dashboards, briefs and datasets.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/b18c0ef1f4494f2a9a564713bc216620/data',
    imageAlt: 'Rural landscape representing household monitoring',
    ctaLabel: 'Explore monitoring',
    destination: '/monitoring',
    sortOrder: 40,
  },
  {
    id: 'impact',
    eyebrow: 'Impact assessment',
    title: 'DIEM-Impact',
    description: 'Combine remote sensing, household evidence and qualitative inputs to assess major shocks.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/1ab88703b32847cd8fd8776fd2c5e7ac/data',
    imageAlt: 'Wetlands and river landscape representing impact assessment',
    ctaLabel: 'Explore country evidence',
    destination: '/countries',
    sortOrder: 50,
  },
  {
    id: 'research',
    eyebrow: 'Applied research',
    title: 'DIEM-Research',
    description: 'Action-oriented research strengthens the use of DIEM evidence in fragile and risk-prone contexts.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/ed74404106024315a20fb5ebbb73f53e/data',
    imageAlt: 'Coastline representing applied research',
    ctaLabel: 'Read featured research',
    destination: 'https://www.nature.com/articles/s43016-023-00825-7',
    sortOrder: 60,
  },
  {
    id: 'risk',
    eyebrow: 'Anticipatory action',
    title: 'DIEM-Risk',
    description: 'Risk assessments and scores support disaster risk reduction and anticipatory action.',
    imageUrl: 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/f16cb09773494779b17eb4156c78e323/data',
    imageAlt: 'Mountain valley representing risk assessment',
    ctaLabel: 'Explore flood services',
    destination: '/flood-services',
    sortOrder: 70,
  },
]

function safeHttpUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

function safeDestination(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return undefined
  const destination = value.trim()
  if (destination.startsWith('/') && !destination.startsWith('//')) return destination
  return safeHttpUrl(destination)
}

function value(row: Record<string, unknown>, ...names: string[]) {
  const entries = Object.entries(row)
  for (const name of names) {
    const match = entries.find(([key]) => key.toLowerCase() === name.toLowerCase())
    if (match) return match[1]
  }
  return undefined
}

function text(row: Record<string, unknown>, ...names: string[]) {
  const candidate = value(row, ...names)
  return typeof candidate === 'string' ? candidate.trim() : ''
}

function numberValue(row: Record<string, unknown>, fallback: number, ...names: string[]) {
  const candidate = Number(value(row, ...names))
  return Number.isFinite(candidate) ? candidate : fallback
}

function isPublished(row: Record<string, unknown>) {
  const published = value(row, 'published', 'enabled')
  if (published === undefined || published === null || published === '') return true
  return published === true || published === 1 || String(published).toLowerCase() === 'true'
}

function matchesChannel(row: Record<string, unknown>) {
  const rowChannel = text(row, 'channel', 'prod_or_stg', 'publication_channel').toLowerCase()
  if (!rowChannel) return true
  return promotionChannel === 'stg'
    ? rowChannel === 'stg' || rowChannel === 'staging'
    : rowChannel === 'prod' || rowChannel === 'production'
}

function activeNow(row: Record<string, unknown>) {
  const now = Date.now()
  const start = Number(value(row, 'start_at', 'starts_at'))
  const end = Number(value(row, 'end_at', 'ends_at'))
  return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now)
}

function mapSlide(row: Record<string, unknown>, index: number): ProgrammeSlide | undefined {
  if (!isPublished(row) || !matchesChannel(row) || !activeNow(row)) return undefined
  const title = text(row, 'title')
  const description = text(row, 'description', 'subtitle')
  const imageUrl = safeHttpUrl(value(row, 'image_url', 'imageUrl'))
  if (!title || !description || !imageUrl) return undefined
  const destination = safeDestination(value(row, 'destination', 'product_url', 'cta_url'))
  return {
    id: text(row, 'slide_id', 'campaign_id') || `slide-${index + 1}`,
    eyebrow: text(row, 'eyebrow', 'category') || 'DIEM',
    title,
    description,
    imageUrl,
    imageAlt: text(row, 'image_alt') || '',
    ctaLabel: destination ? text(row, 'cta_label') || 'Explore' : undefined,
    destination,
    sortOrder: numberValue(row, (index + 1) * 10, 'sort_order'),
  }
}

function mapCampaign(row: Record<string, unknown>, index: number): HubCampaign | undefined {
  if (!isPublished(row) || !matchesChannel(row) || !activeNow(row)) return undefined
  const title = text(row, 'title')
  const description = text(row, 'description', 'subtitle')
  const destination = safeDestination(value(row, 'destination', 'product_url', 'cta_url'))
  if (!title || !description || !destination) return undefined
  return {
    id: text(row, 'campaign_id') || `campaign-${text(row, 'objectid', 'OBJECTID') || index + 1}`,
    title,
    description,
    imageUrl: safeHttpUrl(value(row, 'image_url', 'imageUrl')),
    destination,
    ctaLabel: text(row, 'cta_label') || 'Open',
    dismissDays: Math.max(0, numberValue(row, 7, 'dismiss_days')),
  }
}

async function queryTable(serviceUrl: string, tableId: number, signal?: AbortSignal) {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: '100',
  })
  const response = await fetch(`${serviceUrl}/${tableId}/query?${params}`, { signal })
  if (!response.ok) throw new Error(`Hub promotions request failed (${response.status})`)
  const payload = await response.json() as ArcGISQueryResponse
  if (payload.error) throw new Error(payload.error.message || 'Hub promotions request failed')
  return (payload.features || []).map((feature) => feature.attributes || {})
}

async function firstLayerOrTableId(serviceUrl: string, signal?: AbortSignal) {
  const response = await fetch(`${serviceUrl}?f=json`, { signal })
  if (!response.ok) throw new Error(`Hub promotions service request failed (${response.status})`)
  const payload = await response.json() as ArcGISServiceDefinition
  if (payload.error) throw new Error(payload.error.message || 'Hub promotions service request failed')
  const id = payload.tables?.[0]?.id ?? payload.layers?.[0]?.id
  if (!Number.isInteger(id)) throw new Error('Hub promotions service has no queryable table or layer')
  return id!
}

async function resolveItemServiceUrl(itemId: string, signal?: AbortSignal) {
  const response = await fetch(
    `https://www.arcgis.com/sharing/rest/content/items/${itemId}?f=json`,
    { signal },
  )
  if (!response.ok) throw new Error(`Hub promotions item request failed (${response.status})`)
  const item = await response.json() as { url?: string, error?: { message?: string } }
  if (item.error || !item.url) throw new Error(item.error?.message || 'Hub promotions service URL is missing')
  const url = safeHttpUrl(item.url)
  if (!url) throw new Error('Hub promotions service URL is invalid')
  return url.replace(/\/+$/, '')
}

async function fetchConfiguredPromotions(signal?: AbortSignal): Promise<HubPromotions | undefined> {
  if (!configuredServiceUrl && !configuredViewItemId) return undefined
  const serviceUrl = configuredServiceUrl || await resolveItemServiceUrl(configuredViewItemId!, signal)
  const [slideRows, campaignRows] = await Promise.all([
    queryTable(serviceUrl, 0, signal),
    queryTable(serviceUrl, 1, signal),
  ])
  const slides = slideRows
    .map(mapSlide)
    .filter((slide): slide is ProgrammeSlide => Boolean(slide))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const campaigns = campaignRows
    .sort((a, b) => numberValue(a, 10, 'sort_order') - numberValue(b, 10, 'sort_order'))
    .map(mapCampaign)
    .filter((campaign): campaign is HubCampaign => Boolean(campaign))
  return {
    slides: slides.length ? slides : defaultProgrammeSlides,
    campaign: campaigns.at(0),
    channel: promotionChannel,
  }
}

async function fetchLegacyCampaign(signal?: AbortSignal) {
  const serviceUrl = await resolveItemServiceUrl(LEGACY_POPUP_ITEM_ID, signal)
  const tableId = await firstLayerOrTableId(serviceUrl, signal)
  const rows = await queryTable(serviceUrl, tableId, signal)
  return rows
    .sort((a, b) => numberValue(a, 10, 'sort_order') - numberValue(b, 10, 'sort_order'))
    .map(mapCampaign)
    .find((campaign): campaign is HubCampaign => Boolean(campaign))
}

export async function fetchHubPromotions(signal?: AbortSignal): Promise<HubPromotions> {
  try {
    const configured = await fetchConfiguredPromotions(signal)
    if (configured) return configured
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    console.warn('Configured Hub promotions could not be loaded.', error)
  }

  try {
    return {
      slides: defaultProgrammeSlides,
      campaign: await fetchLegacyCampaign(signal),
      channel: promotionChannel,
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') throw error
    console.warn('Legacy Hub campaign could not be loaded.', error)
    return { slides: defaultProgrammeSlides, channel: promotionChannel }
  }
}
