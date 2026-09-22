import type { ArcGISItem } from '../types'
import { fetchCatalog, type AuthenticatedCatalogRequest } from './arcgis'
import { itemHubLink, type HubLinkTarget } from './countries'
import { fetchSurveyReleases, type SurveyRelease } from './monitoring'

const CATEGORY_ROOT = '/Categories/'
const CHART_LABEL = 'interactive charts'
const IMPACT_TAG = 'impact assessment'

export type MonitoringProductType =
  | 'Country brief'
  | 'Findings presentation'
  | 'Questionnaire'
  | 'Report'
  | 'Public dataset'
  | 'Supporting material'
  | 'Methodology or guidance'

/** One product of a survey round, as the table lists it. */
export interface RoundProduct {
  key: string
  type: MonitoringProductType
  title: string
  languages: string[]
  link: HubLinkTarget
}

export interface SurveyRound extends SurveyRelease {
  roundProducts: RoundProduct[]
}

export interface SurveyRoundCatalog {
  audience: 'public' | 'contributor'
  rounds: SurveyRound[]
  /** Set when the Hub catalog could not be read; rounds then keep their raw links. */
  catalogError?: string
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

function hasExactTag(item: ArcGISItem, expected: string) {
  return (item.tags || []).some((tag) => tag.trim().toLowerCase() === expected)
}

function inferredProductType(item: Pick<ArcGISItem, 'title' | 'tags' | 'type' | 'groupCategories'>, linkedLabel?: string): MonitoringProductType {
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

function inferredLanguages(item: ArcGISItem, categories: string[]) {
  const configured = categoryValues(categories, 'Languages')
  if (configured.length) return configured
  const text = `${item.title} ${item.url || ''}`.toLowerCase()
  if (/\b(questionnaire ménage|résultats|rapport|note d.information)\b/.test(text) || /(?:fr)(?:$|[/?#])/i.test(item.url || '')) return ['French']
  if (/\b(cuestionario|resultados|informe)\b/.test(text) || /(?:es)(?:$|[/?#])/i.test(item.url || '')) return ['Spanish']
  return ['English']
}

const TYPE_ORDER: MonitoringProductType[] = [
  'Country brief', 'Findings presentation', 'Report', 'Questionnaire',
  'Public dataset', 'Methodology or guidance', 'Supporting material',
]

/**
 * Attaches to each round the products its monitoring record links to. A link
 * that resolves to a Hub catalog item takes that item's title, languages and
 * Hub product page; a link the catalog does not hold keeps the monitoring
 * service's own URL. Interactive charts are left out (the table's Explore
 * action covers them), and so are items tagged as impact assessments.
 */
export function joinRoundProducts(releases: SurveyRelease[], catalogItems: ArcGISItem[]): SurveyRound[] {
  const itemsById = new Map(catalogItems.map((item) => [item.id.toLowerCase(), item]))
  return releases.map((release) => {
    const seen = new Set<string>()
    const roundProducts = release.products.flatMap((product): RoundProduct[] => {
      if (product.label.toLowerCase() === CHART_LABEL) return []
      const item = product.itemId ? itemsById.get(product.itemId) : undefined
      if (item && hasExactTag(item, IMPACT_TAG)) return []
      const key = item?.id.toLowerCase() || product.url
      if (seen.has(key)) return []
      seen.add(key)
      if (!item) {
        return [{
          key,
          type: inferredProductType({ title: '', tags: [], type: '', groupCategories: [] }, product.label),
          title: product.label,
          languages: [],
          link: { kind: 'external', href: product.url },
        }]
      }
      return [{
        key,
        type: inferredProductType(item, product.label),
        title: item.title,
        languages: inferredLanguages(item, item.groupCategories || []),
        link: itemHubLink(item),
      }]
    })
    roundProducts.sort((left, right) => TYPE_ORDER.indexOf(left.type) - TYPE_ORDER.indexOf(right.type))
    return { ...release, roundProducts }
  })
}

/**
 * Household survey rounds from the monitoring service, each with the products
 * it links to. Catalog items no round points at belong to other DIEM work and
 * are not listed.
 */
export async function fetchSurveyRoundCatalog(
  options: MonitoringProductCatalogOptions = {},
): Promise<SurveyRoundCatalog> {
  const { signal, contributor = false, authenticatedRequest } = options
  // The rounds are the table; the catalog only enriches their products, so a
  // catalog failure degrades to the monitoring service's own links.
  const [catalog, releases] = await Promise.all([
    fetchCatalog(signal, contributor ? authenticatedRequest : undefined)
      .then((result) => ({ items: result.items, error: undefined }))
      .catch((reason: Error) => {
        if (reason.name === 'AbortError') throw reason
        return { items: [], error: reason.message }
      }),
    fetchSurveyReleases(signal, { includeUpcomingProducts: contributor }),
  ])
  return {
    audience: contributor ? 'contributor' : 'public',
    rounds: joinRoundProducts(releases, catalog.items),
    catalogError: catalog.error,
  }
}
