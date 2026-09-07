import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CROSS_COUNTRY_CODE,
  countryDefinition,
  fetchCountryCatalog,
  itemCountryCodes,
  itemHasMultiCountryScope,
  itemHubLink,
  resourcesForCountry,
  type CountryCatalog,
} from './countries'
import type { ArcGISItem } from '../types'

/**
 * This module decides what the public can see. `Catalog role/Discoverable
 * product` is the gate every discovery surface depends on, and the category
 * paths it reads are editor-maintained strings in ArcGIS, so the parsing has to
 * survive case changes, whitespace and the bracketed lists the 2026 migration
 * left behind.
 */
const DISCOVERABLE = '/Categories/Catalog role/Discoverable product'

function record(id: string, categories: string[], overrides: Partial<ArcGISItem> = {}): ArcGISItem {
  return {
    id,
    title: `Item ${id}`,
    type: 'PDF',
    owner: 'diem_publisher',
    created: Date.UTC(2024, 0, 1),
    modified: Date.UTC(2024, 0, 1),
    tags: [],
    groupCategories: categories,
    ...overrides,
  } as ArcGISItem
}

const id = (n: number) => String(n).repeat(32).slice(0, 32)

describe('itemCountryCodes', () => {
  it('reads ISO3 codes from the publisher-assigned country categories', () => {
    expect(itemCountryCodes(record(id(1), ['/Categories/Countries/NER', '/Categories/Countries/MLI'])))
      .toEqual(['NER', 'MLI'])
  })

  it('matches the category path case-insensitively and uppercases the code', () => {
    // The paths are editor-typed and their casing has changed before.
    expect(itemCountryCodes(record(id(1), ['/categories/countries/ner']))).toEqual(['NER'])
  })

  it('rejects anything that is not an ISO3 code', () => {
    expect(itemCountryCodes(record(id(1), ['/Categories/Countries/Niger', '/Categories/Countries/N']))).toEqual([])
  })

  it('de-duplicates and is empty when no country is assigned', () => {
    expect(itemCountryCodes(record(id(1), ['/Categories/Countries/NER', '/Categories/Countries/NER'])))
      .toEqual(['NER'])
    expect(itemCountryCodes(record(id(1), []))).toEqual([])
  })
})

describe('itemHasMultiCountryScope', () => {
  it('requires the explicit scope category, never the absence of a country', () => {
    expect(itemHasMultiCountryScope(record(id(1), ['/Categories/Geographic scope/Multi-country']))).toBe(true)
    expect(itemHasMultiCountryScope(record(id(1), ['/categories/geographic scope/multi-country']))).toBe(true)
    expect(itemHasMultiCountryScope(record(id(1), []))).toBe(false)
    expect(itemHasMultiCountryScope(record(id(1), ['/Categories/Geographic scope/Regional']))).toBe(false)
  })
})

describe('itemHubLink', () => {
  it('sends a discoverable product to its Hub product page', () => {
    expect(itemHubLink(record(id(1), [DISCOVERABLE]))).toEqual({ kind: 'product', to: `/catalog/${id(1)}` })
  })

  it('keeps a direct link for an item without the catalog role', () => {
    // The product page resolves through the group and requires that exact
    // category, so linking without it would say "no longer published" about
    // something that is published. Three ArcGIS applications are in this case.
    expect(itemHubLink(record(id(2), [], { url: 'https://experience.arcgis.com/experience/abc' })))
      .toEqual({ kind: 'external', href: 'https://experience.arcgis.com/experience/abc' })
  })

  it('falls back to the ArcGIS item page for a roleless item with no url', () => {
    expect(itemHubLink(record(id(3), []))).toEqual({
      kind: 'external',
      href: `https://www.arcgis.com/home/item.html?id=${id(3)}`,
    })
  })

  it('matches the catalog role exactly, not as a prefix', () => {
    expect(itemHubLink(record(id(4), ['/Categories/Catalog role/Discoverable product supporting'])).kind)
      .toBe('external')
    expect(itemHubLink(record(id(4), ['/CATEGORIES/CATALOG ROLE/DISCOVERABLE PRODUCT'])).kind).toBe('product')
  })
})

describe('countryDefinition', () => {
  it('names the cross-country pseudo-country', () => {
    expect(countryDefinition(CROSS_COUNTRY_CODE).name).toBe('Cross-country analysis')
  })

  it('resolves a real country and keeps an unknown code addressable', () => {
    expect(countryDefinition('NER').name).toBe('Niger')
    expect(countryDefinition('ZZZ').name).toBe('ZZZ')
  })
})

/**
 * Progressive delivery. `fetchCountryCatalog` memoizes at module scope, so each
 * test resets the module registry to get a clean loader.
 */
describe('fetchCountryCatalog', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  /** Serves `total` records across pages of 100, one page per fetch call. */
  function stubGroupSearch(total: number, onPage?: (start: number) => void) {
    vi.stubGlobal('sessionStorage', {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    })
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const start = Number(new URL(url).searchParams.get('start'))
      onPage?.(start)
      const results = Array.from(
        { length: Math.min(100, total - start + 1) },
        (_, index) => record(id(start + index), [DISCOVERABLE, '/Categories/Countries/NER']),
      )
      return { ok: true, json: async () => ({ total, start, num: results.length, nextStart: -1, results }) }
    }))
  }

  it('publishes a usable catalogue after the first page, then completes', async () => {
    stubGroupSearch(350)
    const { fetchCountryCatalog: fetchFresh } = await import('./countries')

    const partials: CountryCatalog[] = []
    const final = await fetchFresh((partial) => partials.push(partial))

    // 350 records is four pages. The reader gets the first 100 immediately
    // rather than waiting for 1.86 MB of JSON to finish arriving.
    expect(partials.length).toBeGreaterThan(0)
    expect(partials[0].items).toHaveLength(100)
    expect(final.items).toHaveLength(350)
  })

  it('marks every partial incomplete and only the resolved catalogue complete', async () => {
    stubGroupSearch(350)
    const { fetchCountryCatalog: fetchFresh } = await import('./countries')

    const partials: CountryCatalog[] = []
    const final = await fetchFresh((partial) => partials.push(partial))

    // The catalogue page reads this to say "counts will rise" instead of
    // presenting a floor as a total.
    expect(partials.every((partial) => partial.complete === false)).toBe(true)
    expect(final.complete).toBe(true)
  })

  it('never publishes the same set twice: no partial equals the final count', async () => {
    stubGroupSearch(350)
    const { fetchCountryCatalog: fetchFresh } = await import('./countries')

    const partials: CountryCatalog[] = []
    const final = await fetchFresh((partial) => partials.push(partial))

    expect(partials.some((partial) => partial.items.length === final.items.length)).toBe(false)
  })

  it('still pages in parallel, so time to a complete catalogue is unchanged', async () => {
    const order: number[] = []
    stubGroupSearch(350, (start) => order.push(start))
    const { fetchCountryCatalog: fetchFresh } = await import('./countries')
    await fetchFresh()

    // Page 1 first because the total is unknown until it lands; the rest fire
    // together rather than in sequence.
    expect(order[0]).toBe(1)
    expect(order.slice(1).sort((a, b) => a - b)).toEqual([101, 201, 301])
  })

  it('publishes nothing at all for a single-page group', async () => {
    stubGroupSearch(40)
    const { fetchCountryCatalog: fetchFresh } = await import('./countries')

    const partials: CountryCatalog[] = []
    const final = await fetchFresh((partial) => partials.push(partial))

    expect(partials).toHaveLength(0)
    expect(final.complete).toBe(true)
    expect(final.items).toHaveLength(40)
  })

  it('excludes records without the catalog role from items and counts them', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        total: 2,
        start: 1,
        num: 2,
        nextStart: -1,
        results: [
          record(id(1), [DISCOVERABLE, '/Categories/Countries/NER']),
          record(id(2), ['/Categories/Countries/NER']),
        ],
      }),
    })))
    const { fetchCountryCatalog: fetchFresh } = await import('./countries')

    const catalog = await fetchFresh()
    expect(catalog.items).toHaveLength(1)
    expect(catalog.diagnostics.excludedByCatalogRole).toBe(1)
  })

  it('surfaces a failed request rather than resolving with a partial catalogue', async () => {
    vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: () => undefined, removeItem: () => undefined })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
    const { fetchCountryCatalog: fetchFresh } = await import('./countries')

    await expect(fetchFresh()).rejects.toThrow(/503/)
  })
})

describe('resourcesForCountry', () => {
  it('matches the ISO3 code case-insensitively', () => {
    const catalog = {
      items: [
        { ...record(id(1), []), countries: ['NER'], productTypes: [], evidencePathways: [] },
        { ...record(id(2), []), countries: ['MLI'], productTypes: [], evidencePathways: [] },
      ],
    } as unknown as CountryCatalog
    expect(resourcesForCountry(catalog, 'ner')).toHaveLength(1)
    expect(resourcesForCountry(catalog, 'NER')[0].id).toBe(id(1))
  })
})
