import countryMetadata from '@d3-maps/atlas/metadata/countries'
import type { ArcGISItem } from '../types'

export const COUNTRY_GROUP_ID = 'c27d3dbba52343c6addfd61edaaa3e86'
export const CROSS_COUNTRY_CODE = 'XXX'
const REST_ROOT = 'https://www.arcgis.com/sharing/rest'
const PAGE_SIZE = 100

export const PRODUCT_TYPES = [
  'Country Briefs',
  'Assessment Reports',
  'Key Findings Presentations',
  'Questionnaires',
  'Thematic Datasets',
  'Charts',
  'EVE flood reports',
  'Crop calendar',
  'Storymaps',
  'Photo gallery',
  'Other DIEM documents',
] as const

export type ProductType = (typeof PRODUCT_TYPES)[number] | 'Unclassified'

interface AtlasCountry {
  name: string
  isoA3?: string
  adm0A3: string
  continent: string
  region: string
  subregion: string
}

export interface CountryDefinition {
  iso3: string
  name: string
  region: string
  continent: string
  subregion: string
}

export interface CountryResource extends ArcGISItem {
  countries: string[]
  productTypes: ProductType[]
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
  const prefix = '/Categories/Item Type/'
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

function extractCountries(categories: string[]) {
  const prefix = '/Categories/Countries/'
  return [...new Set(categories
    .filter((category) => category.toLowerCase().startsWith(prefix.toLowerCase()))
    .map((category) => category.slice(prefix.length).toUpperCase())
    .filter((value) => /^[A-Z]{3}$/.test(value)))]
}

function normalizeItem(item: ArcGISItem) {
  const categories = item.groupCategories || []
  const product = extractProductTypes(categories)
  return {
    item: {
      ...item,
      countries: extractCountries(categories),
      productTypes: product.types,
    } satisfies CountryResource,
    malformed: product.malformed,
  }
}

function searchUrl(start: number) {
  const params = new URLSearchParams({
    f: 'json',
    num: String(PAGE_SIZE),
    start: String(start),
    sortField: 'modified',
    sortOrder: 'desc',
  })
  return `${REST_ROOT}/content/groups/${COUNTRY_GROUP_ID}/search?${params}`
}

async function fetchPage(start: number): Promise<GroupSearchResponse> {
  const response = await fetch(searchUrl(start))
  if (!response.ok) throw new Error(`Country catalog request failed (${response.status})`)
  const data = await response.json() as GroupSearchResponse
  if (data.error) throw new Error(data.error.message)
  return data
}

function summarizeCountry(iso3: string, items: CountryResource[]): CountrySummary {
  const typeCounts: Record<string, number> = {}
  items.forEach((item) => item.productTypes.forEach((type) => {
    typeCounts[type] = (typeCounts[type] || 0) + 1
  }))
  return {
    ...countryDefinition(iso3),
    resourceCount: items.length,
    latestModified: Math.max(...items.map((item) => item.modified), 0),
    typeCounts,
  }
}

let catalogPromise: Promise<CountryCatalog> | undefined

export function fetchCountryCatalog(): Promise<CountryCatalog> {
  if (catalogPromise) return catalogPromise

  catalogPromise = (async () => {
    const firstPage = await fetchPage(1)
    const starts: number[] = []
    for (let start = PAGE_SIZE + 1; start <= firstPage.total; start += PAGE_SIZE) starts.push(start)
    const remaining = await Promise.all(starts.map(fetchPage))
    const normalized = [firstPage, ...remaining]
      .flatMap((page) => page.results)
      .map(normalizeItem)
    const items = normalized.map((entry) => entry.item)
    const countryCodes = [...new Set(items.flatMap((item) => item.countries))]
    const realCountries = countryCodes
      .filter((code) => code !== CROSS_COUNTRY_CODE)
      .map((code) => summarizeCountry(code, items.filter((item) => item.countries.includes(code))))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      items,
      countries: realCountries,
      crossCountry: countryCodes.includes(CROSS_COUNTRY_CODE)
        ? summarizeCountry(CROSS_COUNTRY_CODE, items.filter((item) => item.countries.includes(CROSS_COUNTRY_CODE)))
        : undefined,
      fetchedAt: new Date(),
      diagnostics: {
        withoutCountry: items.filter((item) => !item.countries.length).length,
        withoutType: items.filter((item) => item.productTypes.includes('Unclassified')).length,
        malformedTypes: normalized.filter((entry) => entry.malformed).length,
      },
    }
  })().catch((error) => {
    catalogPromise = undefined
    throw error
  })

  return catalogPromise
}

export function resourcesForCountry(catalog: CountryCatalog, iso3: string) {
  const code = iso3.toUpperCase()
  return catalog.items.filter((item) => item.countries.includes(code))
}
