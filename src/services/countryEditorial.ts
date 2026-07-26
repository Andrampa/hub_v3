import type { CountryResource } from './countries'

export const COUNTRY_EDITORIAL_VIEW_ITEM_ID = 'bfabf1dc1d354b3c92a3c801b0376452'
const configuredServiceUrl = import.meta.env.VITE_COUNTRY_EDITORIAL_SERVICE_URL?.trim().replace(/\/+$/, '')

export interface CountryEditorialProfile {
  iso3: string
  name?: string
  introContent: string
  contentFormat: 'plain' | 'html'
  heroImageUrl?: string
  thumbnailUrl?: string
  isPreview: boolean
}

export interface CountryEditorialHighlight {
  item: CountryResource
  leadContent: string
  leadFormat: 'plain' | 'html'
  headline: string
  description: string
  ctaLabel: string
  isDemo: boolean
}

export interface CountryEditorialContent {
  profile?: CountryEditorialProfile
  highlights: CountryEditorialHighlight[]
  isPreview: boolean
  updatedAt?: number
}

interface ArcGISFeature<T> {
  attributes: T
}

interface ArcGISQueryResponse<T> {
  features?: ArcGISFeature<T>[]
  error?: { message?: string }
}

interface ProfileRow {
  iso3?: string
  name?: string
  intro_content?: string
  content_format?: string
  hero_image_url?: string
  thumbnail_url?: string
  updated_at?: number
}

interface HighlightRow {
  item_id?: string
  lead_content?: string
  lead_format?: string
  headline?: string
  description?: string
  cta_label?: string
  is_demo?: number
  updated_at?: number
}

function safeHttpUrl(value?: string) {
  if (!value) return undefined
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

function whereIso(iso3: string) {
  return `iso3='${iso3.replaceAll("'", "''")}' AND published=1`
}

async function queryTable<T>(
  url: string,
  params: Record<string, string>,
  signal?: AbortSignal,
): Promise<T[]> {
  const query = new URLSearchParams({ f: 'json', returnGeometry: 'false', ...params })
  const response = await fetch(`${url}/query?${query}`, { signal })
  if (!response.ok) throw new Error(`Country editorial request failed (${response.status})`)
  const data = await response.json() as ArcGISQueryResponse<T>
  if (data.error) throw new Error(data.error.message || 'Country editorial request failed')
  return (data.features || []).map((feature) => feature.attributes)
}

let serviceUrlPromise: Promise<string> | undefined

function resolveServiceUrl() {
  if (configuredServiceUrl) return Promise.resolve(configuredServiceUrl)
  if (!serviceUrlPromise) {
    const itemUrl = `https://www.arcgis.com/sharing/rest/content/items/${COUNTRY_EDITORIAL_VIEW_ITEM_ID}?f=json`
    serviceUrlPromise = fetch(itemUrl)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Country editorial item request failed (${response.status})`)
        const item = await response.json() as { url?: string, error?: { message?: string } }
        if (item.error || !item.url) throw new Error(item.error?.message || 'Country editorial service URL is missing')
        const url = safeHttpUrl(item.url)
        if (!url) throw new Error('Country editorial service URL is invalid')
        return url.replace(/\/+$/, '')
      })
      .catch((error) => {
        serviceUrlPromise = undefined
        throw error
      })
  }
  return serviceUrlPromise
}

async function fetchPublishedEditorial(
  serviceUrl: string,
  iso3: string,
  resources: CountryResource[],
  signal?: AbortSignal,
): Promise<CountryEditorialContent> {
  const [profiles, rows] = await Promise.all([
    queryTable<ProfileRow>(`${serviceUrl}/0`, {
      where: whereIso(iso3),
      outFields: 'iso3,name,intro_content,content_format,hero_image_url,thumbnail_url,updated_at',
      resultRecordCount: '1',
    }, signal),
    queryTable<HighlightRow>(`${serviceUrl}/1`, {
      where: whereIso(iso3),
      outFields: 'item_id,lead_content,lead_format,headline,description,cta_label,is_demo,sort_order,updated_at',
      orderByFields: 'sort_order ASC,OBJECTID ASC',
    }, signal),
  ])

  const profileRow = profiles[0]
  const byId = new Map(resources.map((item) => [item.id, item]))
  const highlights = rows.flatMap((row) => {
    const item = row.item_id ? byId.get(row.item_id) : undefined
    if (!item) return []
    return [{
      item,
      leadContent: row.lead_content?.trim() || '',
      leadFormat: row.lead_format?.toLowerCase() === 'html' ? 'html' as const : 'plain' as const,
      headline: row.headline?.trim() || item.title.trim(),
      description: row.description?.trim() || '',
      ctaLabel: row.cta_label?.trim() || 'Open resource',
      isDemo: row.is_demo === 1,
    }]
  })

  return {
    profile: profileRow ? {
      iso3,
      name: profileRow.name?.trim(),
      introContent: profileRow.intro_content?.trim() || '',
      contentFormat: profileRow.content_format?.toLowerCase() === 'html' ? 'html' : 'plain',
      heroImageUrl: safeHttpUrl(profileRow.hero_image_url),
      thumbnailUrl: safeHttpUrl(profileRow.thumbnail_url),
      isPreview: false,
    } : undefined,
    highlights,
    isPreview: false,
    updatedAt: Math.max(
      Number.isFinite(profileRow?.updated_at) ? profileRow!.updated_at! : 0,
      ...rows.map((row) => Number.isFinite(row.updated_at) ? row.updated_at! : 0),
    ) || undefined,
  }
}

export async function fetchCountryEditorial(
  iso3: string,
  resources: CountryResource[],
  signal?: AbortSignal,
) {
  const serviceUrl = await resolveServiceUrl()
  return fetchPublishedEditorial(serviceUrl, iso3, resources, signal)
}
