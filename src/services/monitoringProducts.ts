import type { ArcGISItem } from '../types'
import { countryDefinition } from './countries'
import { fetchCatalog, type AuthenticatedCatalogRequest } from './arcgis'
import { fetchSurveyReleases, type SurveyRelease, type SurveyReleaseStatus } from './monitoring'

const CATEGORY_ROOT = '/Categories/'
const MONITORING_PILLAR = 'household monitoring system'
const CHART_LABEL = 'interactive charts'
const IMPACT_TAG = 'impact assessment'
const MONITORING_TAGS = new Set([
  'diem-monitoring',
  'household monitoring',
  'household monitoring system',
  'household survey',
  'household survey questionnaire',
  'household survey report',
])

export type MonitoringProductType =
  | 'Country brief'
  | 'Findings presentation'
  | 'Questionnaire'
  | 'Report'
  | 'Public dataset'
  | 'Supporting material'
  | 'Methodology or guidance'

export interface MonitoringProduct extends ArcGISItem {
  key: string
  productType: MonitoringProductType
  countries: string[]
  languages: string[]
  year: number
  round?: string
  roundValue?: string
  publicationDate?: number
  expectedPublicationDate?: number
  releaseStatus?: SurveyReleaseStatus
}

export interface MonitoringProductCatalog {
  audience: 'public' | 'contributor'
  items: MonitoringProduct[]
  countries: Array<{ iso3: string, name: string, productCount: number }>
  productTypes: MonitoringProductType[]
  years: number[]
  languages: string[]
  fetchedAt: Date
}

export interface MonitoringProductCatalogOptions {
  signal?: AbortSignal
  contributor?: boolean
  authenticatedRequest?: AuthenticatedCatalogRequest
}

function categoryValues(categories: string[], branch: string) {
  const prefix = `${CATEGORY_ROOT}${branch}/`
  return [...new Set(categories
    .filter((category) => category.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((category) => category.slice(prefix.length).trim())
    .filter(Boolean))]
}

function hasMonitoringMetadata(item: ArcGISItem) {
  const categories = item.groupCategories || []
  const pillars = categoryValues(categories, 'DIEM pillars')
  const products = categoryValues(categories, 'Monitoring products')
  return products.length > 0
    || pillars.some((pillar) => pillar.toLowerCase() === MONITORING_PILLAR)
    || (item.tags || []).some((tag) => MONITORING_TAGS.has(tag.trim().toLowerCase()))
}

function hasExactTag(item: ArcGISItem, expected: string) {
  return (item.tags || []).some((tag) => tag.trim().toLowerCase() === expected)
}

function inferredProductType(item: ArcGISItem, linkedLabel?: string): MonitoringProductType {
  const configured = categoryValues(item.groupCategories || [], 'Monitoring products')[0]
  if (configured) return configured as MonitoringProductType

  const text = `${linkedLabel || ''} ${item.title} ${(item.tags || []).join(' ')}`.toLowerCase()
  if (text.includes('questionnaire')) return 'Questionnaire'
  if (text.includes('country brief')) return 'Country brief'
  if (text.includes('finding') || text.includes('presentation')) return 'Findings presentation'
  if (text.includes('methodolog') || text.includes('guidance') || text.includes('manual')) return 'Methodology or guidance'
  if (text.includes('report') || /\bbrief\b/.test(text)) return 'Report'
  if (['Feature Service', 'CSV', 'Microsoft Excel', 'GeoJson'].includes(item.type)) return 'Public dataset'
  return 'Supporting material'
}

function inferredYear(item: ArcGISItem, release?: SurveyRelease) {
  if (release?.publicationDate) return new Date(release.publicationDate).getUTCFullYear()
  const years = [...`${item.title} ${item.snippet || ''}`.matchAll(/\b(20\d{2})\b/g)]
    .map((match) => Number(match[1]))
  return years.length ? Math.max(...years) : new Date(item.modified).getUTCFullYear()
}

function inferredLanguages(item: ArcGISItem, categories: string[]) {
  const configured = categoryValues(categories, 'Languages')
  if (configured.length) return configured
  const text = `${item.title} ${item.url || ''}`.toLowerCase()
  if (/\b(questionnaire ménage|résultats|rapport|note d.information)\b/.test(text) || /(?:fr)(?:$|[/?#])/i.test(item.url || '')) return ['French']
  if (/\b(cuestionario|resultados|informe)\b/.test(text) || /(?:es)(?:$|[/?#])/i.test(item.url || '')) return ['Spanish']
  return ['English']
}

function normalizedItem(
  item: ArcGISItem,
  release?: SurveyRelease,
  linkedLabel?: string,
): MonitoringProduct {
  const categories = item.groupCategories || []
  const countries = release
    ? [release.iso3]
    : categoryValues(categories, 'Countries').map((value) => value.toUpperCase())
  return {
    ...item,
    key: release ? `${item.id}-${release.id}-${linkedLabel || 'product'}` : item.id,
    productType: inferredProductType(item, linkedLabel),
    countries,
    languages: inferredLanguages(item, categories),
    year: inferredYear(item, release),
    round: release?.round,
    roundValue: release?.roundValue,
    publicationDate: release?.publicationDate,
    expectedPublicationDate: release?.expectedPublicationDate,
    releaseStatus: release?.status,
  }
}

export async function fetchMonitoringProductCatalog(
  options: MonitoringProductCatalogOptions = {},
): Promise<MonitoringProductCatalog> {
  const { signal, contributor = false, authenticatedRequest } = options
  const [catalog, releases] = await Promise.all([
    fetchCatalog(signal, contributor ? authenticatedRequest : undefined),
    fetchSurveyReleases(signal, { includeUpcomingProducts: contributor }),
  ])
  const itemsById = new Map(catalog.items.map((item) => [item.id.toLowerCase(), item]))
  const linkedIds = new Set<string>()
  const linked = releases.flatMap((release) => release.products.flatMap((product) => {
    if (product.label.toLowerCase() === CHART_LABEL || !product.itemId) return []
    const item = itemsById.get(product.itemId)
    if (!item || hasExactTag(item, IMPACT_TAG)) return []
    linkedIds.add(item.id.toLowerCase())
    return [normalizedItem(item, release, product.label)]
  }))
  const unlinked = contributor ? catalog.items
    .filter((item) => (
      !linkedIds.has(item.id.toLowerCase())
      && !hasExactTag(item, IMPACT_TAG)
      && hasMonitoringMetadata(item)
    ))
    .map((item) => normalizedItem(item)) : []

  const items = [...linked, ...unlinked].sort((left, right) => (
    (right.publicationDate || right.modified) - (left.publicationDate || left.modified)
  ))
  const countryCodes = [...new Set(items.flatMap((item) => item.countries))]
  const countries = countryCodes.map((iso3) => ({
    iso3,
    name: countryDefinition(iso3).name,
    productCount: items.filter((item) => item.countries.includes(iso3)).length,
  })).sort((left, right) => left.name.localeCompare(right.name))

  return {
    audience: contributor ? 'contributor' : 'public',
    items,
    countries,
    productTypes: [...new Set(items.map((item) => item.productType))].sort(),
    years: [...new Set(items.map((item) => item.year))].sort((left, right) => right - left),
    languages: [...new Set(items.flatMap((item) => item.languages))].sort(),
    fetchedAt: catalog.fetchedAt,
  }
}
