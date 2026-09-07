import { describe, expect, it } from 'vitest'
import {
  buildCatalogSearchIndex,
  extractItemIds,
  foldText,
  matchingFamilyIds,
  searchCatalog,
  searchCountries,
} from './catalogSearch'
import { groupProductFamilies } from './productFamilies'
import type { CountryResource, CountrySummary } from '../services/countries'

/**
 * Search runs entirely over the catalogue already in memory, and the same
 * predicate drives the type-ahead and the result grid - so a disagreement here
 * shows as suggestions that do not match the results underneath them.
 */
function resource(overrides: Partial<CountryResource> = {}): CountryResource {
  return {
    id: '1'.repeat(32),
    title: 'Niger - DIEM Monitoring Brief - Round 8',
    type: 'PDF',
    owner: 'diem_publisher',
    created: Date.UTC(2024, 0, 1),
    modified: Date.UTC(2024, 0, 1),
    tags: [],
    groupCategories: [],
    countries: ['NER'],
    productTypes: ['Country Briefs'],
    evidencePathways: ['Regular monitoring'],
    ...overrides,
  } as CountryResource
}

const indexOf = (items: CountryResource[]) => buildCatalogSearchIndex(groupProductFamilies(items))

describe('extractItemIds', () => {
  it('finds a bare id, and one inside an item or REST URL', () => {
    const id = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
    expect(extractItemIds(id)).toEqual([id])
    expect(extractItemIds(`https://www.arcgis.com/home/item.html?id=${id}`)).toEqual([id])
    expect(extractItemIds(`look at ${id.toUpperCase()} please`)).toEqual([id])
  })

  it('ignores anything that is not exactly 32 hex characters', () => {
    expect(extractItemIds('a1b2c3')).toEqual([])
    expect(extractItemIds('z'.repeat(32))).toEqual([])
  })
})

describe('foldText', () => {
  it('strips accents so a French title is reachable from an unaccented query', () => {
    expect(foldText('République démocratique du Congo')).toBe('republique democratique du congo')
    expect(foldText('Note d’information')).toBe('note d’information')
  })
})

describe('searchCatalog', () => {
  it('treats a complete item id as an exact lookup, not as words', () => {
    const wanted = resource({ id: 'a'.repeat(32), title: 'Wanted product' })
    const other = resource({ id: 'b'.repeat(32), title: 'Something else' })
    const results = searchCatalog(indexOf([wanted, other]), `https://www.arcgis.com/home/item.html?id=${'a'.repeat(32)}`)
    expect(results).toHaveLength(1)
    expect(results[0].family.primary.id).toBe('a'.repeat(32))
  })

  it('requires every token to match, so a second word narrows the result', () => {
    const items = [
      resource({ id: 'a'.repeat(32), title: 'Niger - DIEM Monitoring Brief - Round 8' }),
      resource({ id: 'b'.repeat(32), title: 'Niger - Household Questionnaire - Round 8' }),
    ]
    expect(searchCatalog(indexOf(items), 'niger')).toHaveLength(2)
    expect(searchCatalog(indexOf(items), 'niger questionnaire')).toHaveLength(1)
  })

  it('does not let a short token match inside a longer number', () => {
    // "round 8" must not offer Round 28.
    const items = [resource({ id: 'a'.repeat(32), title: 'Niger - Brief - Round 28' })]
    expect(searchCatalog(indexOf(items), 'round 8')).toHaveLength(0)
  })

  it('finds a product by a country named only in the group category', () => {
    // About 5% of products do not name their country in the title.
    const item = resource({ id: 'a'.repeat(32), title: 'Household questionnaire', countries: ['NER'] })
    expect(searchCatalog(indexOf([item]), 'niger')).toHaveLength(1)
  })

  it('never matches the machine tags that carry family and language plumbing', () => {
    const item = resource({
      id: 'a'.repeat(32),
      title: 'Niger - Brief',
      tags: ['DIEM-FAMILY:' + 'b'.repeat(32), 'DIEM-LANGUAGE:French'],
    })
    expect(searchCatalog(indexOf([item]), 'diem-family')).toHaveLength(0)
  })

  it('returns nothing for an empty or whitespace query', () => {
    const index = indexOf([resource()])
    expect(searchCatalog(index, '')).toEqual([])
    expect(searchCatalog(index, '   ')).toEqual([])
  })
})

describe('matchingFamilyIds', () => {
  it('is undefined for an empty query, so the grid stays unfiltered', () => {
    // undefined and "an empty set" mean opposite things to the caller.
    expect(matchingFamilyIds(indexOf([resource()]), '')).toBeUndefined()
  })

  it('is an empty set when a real query matches nothing', () => {
    expect(matchingFamilyIds(indexOf([resource()]), 'zzzznothing')?.size).toBe(0)
  })

  it('agrees with the suggestion list about what a query means', () => {
    const items = [
      resource({ id: 'a'.repeat(32), title: 'Niger - DIEM Monitoring Brief - Round 8' }),
      resource({ id: 'b'.repeat(32), title: 'Mali - Household Questionnaire - Round 3', countries: ['MLI'] }),
    ]
    const index = indexOf(items)
    const suggested = new Set(searchCatalog(index, 'niger').map((match) => match.family.id))
    expect(matchingFamilyIds(index, 'niger')).toEqual(suggested)
  })
})

describe('searchCountries', () => {
  const countries = [
    { iso3: 'NER', name: 'Niger', resourceCount: 33 },
    { iso3: 'NGA', name: 'Nigeria', resourceCount: 29 },
    { iso3: 'AFG', name: 'Afghanistan', resourceCount: 12 },
  ] as CountrySummary[]

  it('matches at a word boundary only, so a fragment does not offer everything', () => {
    expect(searchCountries(countries, 'ni').map((c) => c.iso3)).toEqual(['NER', 'NGA'])
    expect(searchCountries(countries, 'ni').map((c) => c.iso3)).not.toContain('AFG')
  })

  it('resolves an exact ISO3 code', () => {
    expect(searchCountries(countries, 'nga').map((c) => c.iso3)).toEqual(['NGA'])
  })

  it('breaks a tie on how much evidence a country has', () => {
    expect(searchCountries(countries, 'nig')[0].iso3).toBe('NER')
  })
})
