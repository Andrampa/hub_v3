import countryMetadata from '@d3-maps/atlas/metadata/countries'
import { groupProductFamilies } from '../lib/productFamilies'
import type { ArcGISItem } from '../types'
import { CONTENT_GROUP_ID } from './arcgis'

export const CROSS_COUNTRY_CODE = 'XXX'
const REST_ROOT = 'https://www.arcgis.com/sharing/rest'
const PAGE_SIZE = 100

export const PRODUCT_TYPES = [
  'Country Briefs',
  'Assessment Reports',
  'Key Findings Presentations',
  'Questionnaires',
  'EVE flood reports',
  'DIEM EVE',
  'Crop calendar',
  'Storymaps',
  'Photo gallery',
  'Other DIEM documents',
] as const

export type ProductType = (typeof PRODUCT_TYPES)[number] | 'Unclassified'

export const EVIDENCE_PATHWAYS = [
  'Regular monitoring',
  'Hazard impact',
  'Research & analysis',
  'Seasonal calendar',
] as const

export type EvidencePathway = (typeof EVIDENCE_PATHWAYS)[number]

interface AtlasCountry {
  name: string
  isoA3?: string
  isoA2?: string
  adm0A3: string
  continent: string
  region: string
  subregion: string
}

export interface CountryDefinition {
  iso3: string
  iso2?: string
  name: string
  region: string
  continent: string
  subregion: string
}

export interface CountryResource extends ArcGISItem {
  countries: string[]
  productTypes: ProductType[]
  evidencePathways: EvidencePathway[]
}

export interface CountrySummary extends CountryDefinition {
  resourceCount: number
  latestModified: number
  typeCounts: Record<string, number>
}

export interface CountryCatalog {
  items: CountryResource[]
  countries: CountrySummary[]
  crossCountry?: CountrySummary
  fetchedAt: Date
  diagnostics: {
    withoutCountry: number
    withoutType: number
    malformedTypes: number
    /** Hub items excluded because they are not independent catalog products. */
    excludedByCatalogRole: number
  }
}

interface GroupSearchResponse {
  total: number
  nextStart: number
  results: ArcGISItem[]
  error?: { message: string }
}

const metadata = countryMetadata as AtlasCountry[]
const metadataByIso = new Map(
  metadata.flatMap((country) => {
    const iso3 = country.isoA3 || country.adm0A3
    return iso3 ? [[iso3.toUpperCase(), country] as const] : []
  }),
)

const canonicalTypeLookup = new Map(
  PRODUCT_TYPES.map((type) => [type.toLowerCase(), type] as const),
)

const typeAliases: Record<string, ProductType> = {
  'country reports': 'Assessment Reports',
  'diem eve': 'EVE flood reports',
}

function regionFor(country: AtlasCountry) {
  if (country.subregion === 'Northern Africa' || country.subregion === 'Western Asia') {
    return 'Near East & North Africa'
  }
  if (country.continent === 'Africa') return 'Africa'
  if (country.continent === 'Asia' || country.continent === 'Oceania') return 'Asia & Pacific'
  if (country.continent === 'North America' || country.continent === 'South America') {
    return 'Latin America & Caribbean'
  }
  if (country.continent === 'Europe') return 'Europe'
  return 'Other'
}

export function countryDefinition(iso3: string): CountryDefinition {
  const code = iso3.toUpperCase()
  if (code === CROSS_COUNTRY_CODE) {
    return {
      iso3: code,
      name: 'Cross-country analysis',
      region: 'Global',
      continent: 'Global',
      subregion: 'Global',
    }
  }
  const metadataCode = code === 'TZN' ? 'TZA' : code
  const country = metadataByIso.get(metadataCode)
  return {
    iso3: code,
    iso2: country?.isoA2 && /^[A-Z]{2}$/.test(country.isoA2) ? country.isoA2.toLowerCase() : undefined,
    name: country?.name || code,
    region: country ? regionFor(country) : 'Other',
    continent: country?.continent || 'Other',
    subregion: country?.subregion || 'Other',
  }
}

function normalizeProductType(value: string): ProductType | undefined {
  const clean = value.trim()
  if (!clean) return undefined
  const canonical = canonicalTypeLookup.get(clean.toLowerCase())
  return canonical || typeAliases[clean.toLowerCase()]
}

function extractProductTypes(categories: string[]) {
  const prefix = '/Categories/Product types/'
  const rawValues = categories
    .filter((category) => category.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((category) => category.slice(prefix.length))

  let malformed = false
  const types = rawValues.flatMap((raw) => {
    if (raw.trim().startsWith('[')) {
      malformed = true
      return [...raw.matchAll(/'([^']+)'/g)].map((match) => match[1])
    }
    return [raw]
  })

  const normalized = [...new Set(types.map(normalizeProductType).filter(Boolean))] as ProductType[]
  return { types: normalized.length ? normalized : ['Unclassified' as const], malformed }
}

function extractEvidencePathways(categories: string[], productTypes: ProductType[]) {
  const prefix = '/Categories/DIEM pillars/'
  const pillarLookup: Record<string, EvidencePathway> = {
    'household monitoring system': 'Regular monitoring',
    'hazard impact assessment': 'Hazard impact',
    research: 'Research & analysis',
  }
  const pathways = categories
    .filter((category) => category.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((category) => pillarLookup[category.slice(prefix.length).trim().toLowerCase()])
    .filter((pathway): pathway is EvidencePathway => Boolean(pathway))

  // Crop calendar is already an explicit, publisher-controlled product type.
  if (productTypes.includes('Crop calendar')) pathways.push('Seasonal calendar')
  return [...new Set(pathways)]
}

function extractCountries(categories: string[]) {
  const prefix = '/Categories/Countries/'
  return [...new Set(categories
    .filter((category) => category.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((category) => category.slice(prefix.length).toUpperCase())
    .filter((value) => /^[A-Z]{3}$/.test(value)))]
}

/** Publisher-managed country assignments from the Hub group's category tree. */
export function itemCountryCodes(item: ArcGISItem) {
  return extractCountries(item.groupCategories || [])
}

/** Multi-country scope is explicit; absence of a country category is not enough. */
export function itemHasMultiCountryScope(item: ArcGISItem) {
  return isMultiCountry(item.groupCategories || [])
}

function isDiscoverableProduct(categories: string[]) {
  return categories.some((category) => (
    category.toLowerCase() === '/categories/catalog role/discoverable product'
  ))
}

function isMultiCountry(categories: string[]) {
  return categories.some((category) => (
    category.toLowerCase() === '/categories/geographic scope/multi-country'
  ))
}

function normalizeItem(item: ArcGISItem) {
  const categories = item.groupCategories || []
  const product = extractProductTypes(categories)
  const countries = extractCountries(categories)
  return {
    item: {
      ...item,
      countries: countries.length ? countries : isMultiCountry(categories) ? [CROSS_COUNTRY_CODE] : [],
      productTypes: product.types,
      evidencePathways: extractEvidencePathways(categories, product.types),
    } satisfies CountryResource,
    malformed: product.malformed,
    discoverable: isDiscoverableProduct(categories),
  }
}

function searchUrl(start: number, query?: string) {
  const params = new URLSearchParams({
    f: 'json',
    num: String(PAGE_SIZE),
    start: String(start),
    sortField: 'modified',
    sortOrder: 'desc',
  })
  if (query) params.set('q', query)
  return `${REST_ROOT}/content/groups/${CONTENT_GROUP_ID}/search?${params}`
}

async function fetchPage(start: number, query?: string): Promise<GroupSearchResponse> {
  const response = await fetch(searchUrl(start, query))
  if (!response.ok) throw new Error(`Country catalog request failed (${response.status})`)
  const data = await response.json() as GroupSearchResponse
  if (data.error) throw new Error(data.error.message)
  return data
}

/**
 * Resolves a product from the live Hub group rather than the catalogue cache.
 * A public ArcGIS item that has left the group must not remain discoverable via
 * a copied Hub URL, even when its item metadata is still public.
 */
export async function fetchCurrentCatalogProduct(id: string): Promise<CountryResource | undefined> {
  if (!/^[a-f0-9]{32}$/i.test(id)) return undefined
  const response = await fetchPage(1, `id:${id}`)
  const exact = response.results.find((item) => item.id.toLowerCase() === id.toLowerCase())
  if (!exact) return undefined
  const normalized = normalizeItem(exact)
  return normalized.discoverable ? normalized.item : undefined
}

function summarizeCountry(iso3: string, items: CountryResource[]): CountrySummary {
  const families = groupProductFamilies(items)
  const typeCounts: Record<string, number> = {}
  families.forEach((family) => [...new Set(family.variants.flatMap((item) => item.productTypes))].forEach((type) => {
    typeCounts[type] = (typeCounts[type] || 0) + 1
  }))
  return {
    ...countryDefinition(iso3),
    resourceCount: families.length,
    latestModified: Math.max(...items.map((item) => item.modified), 0),
    typeCounts,
  }
}

/**
 * Session cache for the normalized group.
 *
 * A cold load pages the whole content group: eleven requests of a hundred
 * records before a single card can render. The in-memory promise below only
 * survives client-side navigation, so a reload, a new tab or a returning
 * visitor paid that cost again. The normalized items are about 750 kB of JSON,
 * well inside the session quota, and ArcGIS stays authoritative: the cache is
 * only ever a head start, every load still revalidates against the group, and
 * a failure to read or write it is never fatal.
 */
const CACHE_KEY = `diem-hub-country-catalog:${CONTENT_GROUP_ID}:v1`
/** How long a cached copy may be served before a load waits for the network. */
const CACHE_TTL_MS = 15 * 60 * 1000

interface CachedCatalog {
  fetchedAt: number
  items: CountryResource[]
  diagnostics: CountryCatalog['diagnostics']
}

function readCache(): CachedCatalog | undefined {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as CachedCatalog
    if (!Array.isArray(parsed.items) || !parsed.items.length || !Number.isFinite(parsed.fetchedAt)) return undefined
    return parsed
  } catch {
    // Unavailable in private browsing, or written by an older shape. Refetch.
    return undefined
  }
}

/**
 * Only the declared contract is persisted, never the whole ArcGIS response.
 *
 * `normalizeItem` spreads the raw item, so fields this application never reads
 * ride along: `licenseInfo` is 498 kB of licence boilerplate across the group
 * and is only ever read for protected data items, and `typeKeywords` and
 * `accessInformation` are read nowhere. Projecting to the typed fields takes
 * the cache from about 1.8 MB to under 600 kB.
 */
function projectForCache(item: CountryResource): CountryResource {
  return {
    id: item.id,
    title: item.title,
    type: item.type,
    owner: item.owner,
    created: item.created,
    modified: item.modified,
    tags: item.tags,
    snippet: item.snippet,
    description: item.description,
    thumbnail: item.thumbnail,
    url: item.url,
    access: item.access,
    groupCategories: item.groupCategories,
    countries: item.countries,
    productTypes: item.productTypes,
    evidencePathways: item.evidencePathways,
  }
}

function writeCache(catalog: CountryCatalog) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      fetchedAt: catalog.fetchedAt.getTime(),
      items: catalog.items.map(projectForCache),
      diagnostics: catalog.diagnostics,
    } satisfies CachedCatalog))
  } catch {
    // A full or disabled session store must never break the page.
  }
}

/** Rebuilds the country summaries a cached item list implies. */
function assembleCatalog(
  items: CountryResource[],
  diagnostics: CountryCatalog['diagnostics'],
  fetchedAt: Date,
): CountryCatalog {
  const countryCodes = [...new Set(items.flatMap((item) => item.countries))]
  return {
    items,
    countries: countryCodes
      .filter((code) => code !== CROSS_COUNTRY_CODE)
      .map((code) => summarizeCountry(code, items.filter((item) => item.countries.includes(code))))
      .sort((a, b) => a.name.localeCompare(b.name)),
    crossCountry: countryCodes.includes(CROSS_COUNTRY_CODE)
      ? summarizeCountry(CROSS_COUNTRY_CODE, items.filter((item) => item.countries.includes(CROSS_COUNTRY_CODE)))
      : undefined,
    fetchedAt,
    diagnostics,
  }
}

let catalogPromise: Promise<CountryCatalog> | undefined

export function fetchCountryCatalog(): Promise<CountryCatalog> {
  if (catalogPromise) return catalogPromise

  const cached = readCache()
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    catalogPromise = Promise.resolve(
      assembleCatalog(cached.items, cached.diagnostics, new Date(cached.fetchedAt)),
    )
    // Refresh in the background so the next load starts from current data. The
    // page already has its records, so a failure here is not surfaced.
    void requestCatalog().then(writeCache).catch(() => undefined)
    return catalogPromise
  }

  catalogPromise = requestCatalog()
    .then((catalog) => {
      writeCache(catalog)
      return catalog
    })
    .catch((error) => {
      catalogPromise = undefined
      throw error
    })

  return catalogPromise
}

async function requestCatalog(): Promise<CountryCatalog> {
  const firstPage = await fetchPage(1)
  const starts: number[] = []
  for (let start = PAGE_SIZE + 1; start <= firstPage.total; start += PAGE_SIZE) starts.push(start)
  const remaining = await Promise.all(starts.map((start) => fetchPage(start)))
  const normalized = [firstPage, ...remaining]
    .flatMap((page) => page.results)
    .map(normalizeItem)
  const items = normalized.filter((entry) => entry.discoverable).map((entry) => entry.item)

  return assembleCatalog(items, {
    withoutCountry: items.filter((item) => !item.countries.length).length,
    withoutType: items.filter((item) => item.productTypes.includes('Unclassified')).length,
    malformedTypes: normalized.filter((entry) => entry.discoverable && entry.malformed).length,
    excludedByCatalogRole: normalized.filter((entry) => !entry.discoverable).length,
  }, new Date())
}

export function resourcesForCountry(catalog: CountryCatalog, iso3: string) {
  const code = iso3.toUpperCase()
  return catalog.items.filter((item) => item.countries.includes(code))
}
