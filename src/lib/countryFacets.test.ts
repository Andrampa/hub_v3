import { describe, expect, it } from 'vitest'
import { COUNTRY_FACET_ALL, countryFacetCounts, familyMatchesCountryFilters } from './countryFacets'
import { groupProductFamilies } from './productFamilies'
import type { CountryResource, EvidencePathway, ProductType } from '../services/countries'

let next = 0
function resource(
  productTypes: ProductType[],
  evidencePathways: EvidencePathway[],
  year: number,
  overrides: Partial<CountryResource> = {},
): CountryResource {
  next += 1
  return {
    id: String(next).padStart(32, '0'),
    title: `Afghanistan - product ${next}`,
    type: 'PDF',
    owner: 'diem_publisher',
    access: 'public',
    created: Date.UTC(year, 5, 1),
    modified: Date.UTC(year, 5, 1),
    tags: [],
    countries: ['AFG'],
    productTypes,
    evidencePathways,
    ...overrides,
  }
}

/**
 * The Afghanistan shape from 2026-11-10: questionnaires only under regular
 * monitoring, assessment reports only under hazard impact, plus one family
 * published in two languages and one carrying two types.
 */
const english = resource(['Country Briefs'], ['Regular monitoring'], 2025, { title: 'Afghanistan - Brief - Round 8', tags: ['DIEM-FAMILY:' + 'f'.repeat(32), 'DIEM-LANGUAGE:English'] })
const french = resource(['Country Briefs'], ['Regular monitoring'], 2025, { title: 'Afghanistan - Note - Round 8', tags: ['DIEM-FAMILY:' + 'f'.repeat(32), 'DIEM-LANGUAGE:French'] })
const items = [
  resource(['Questionnaires'], ['Regular monitoring'], 2024),
  resource(['Questionnaires'], ['Regular monitoring'], 2025),
  english,
  french,
  resource(['Assessment Reports'], ['Hazard impact'], 2025),
  resource(['Assessment Reports', 'Storymaps'], ['Hazard impact'], 2024),
  resource(['Crop calendar'], ['Seasonal calendar'], 2023),
  resource(['Other DIEM documents'], [], 2024),
]
const families = groupProductFamilies(items)

describe('countryFacetCounts', () => {
  it('counts a two-language family once', () => {
    expect(families).toHaveLength(7)
    const counts = countryFacetCounts(families, COUNTRY_FACET_ALL, undefined)
    expect(counts.type.byValue.get('Country Briefs')).toBe(1)
    expect(counts.pathway.byValue.get('Regular monitoring')).toBe(3)
  })

  it('counts a multi-type family under each type, so counts can exceed the total', () => {
    const counts = countryFacetCounts(families, COUNTRY_FACET_ALL, undefined)
    expect(counts.type.all).toBe(7)
    const sum = [...counts.type.byValue.values()].reduce((a, b) => a + b, 0)
    expect(sum).toBe(8)
  })

  it('narrows the type counts by the selected pathway', () => {
    const counts = countryFacetCounts(families, { ...COUNTRY_FACET_ALL, pathway: 'Hazard impact' }, undefined)
    expect(counts.type.all).toBe(2)
    expect(counts.type.byValue.get('Questionnaires')).toBeUndefined()
    expect(counts.type.byValue.get('Assessment Reports')).toBe(2)
  })

  it('does not narrow a facet by its own selection', () => {
    const counts = countryFacetCounts(families, { ...COUNTRY_FACET_ALL, type: 'Questionnaires' }, undefined)
    // Every type keeps its full count; the pathway and year counts narrow.
    expect(counts.type.byValue.get('Assessment Reports')).toBe(2)
    expect(counts.pathway.all).toBe(2)
    expect(counts.pathway.byValue.get('Hazard impact')).toBeUndefined()
    expect(counts.year.byValue.get('2024')).toBe(1)
    expect(counts.year.byValue.get('2025')).toBe(1)
  })

  it('applies the search to every facet', () => {
    const questionnaireIds = new Set(families.filter((family) => family.primary.productTypes.includes('Questionnaires')).map((family) => family.id))
    const counts = countryFacetCounts(families, COUNTRY_FACET_ALL, questionnaireIds)
    expect(counts.type.all).toBe(2)
    expect(counts.pathway.byValue.get('Hazard impact')).toBeUndefined()
  })

  it('leaves a family with no pathway out of every pathway but in "All pathways"', () => {
    const counts = countryFacetCounts(families, { ...COUNTRY_FACET_ALL, type: 'Other DIEM documents' }, undefined)
    expect(counts.pathway.all).toBe(1)
    expect(counts.pathway.byValue.size).toBe(0)
  })
})

describe('familyMatchesCountryFilters', () => {
  it('matches the filtered list the counts describe', () => {
    const selection = { ...COUNTRY_FACET_ALL, pathway: 'Hazard impact', year: '2024' }
    const matched = families.filter((family) => familyMatchesCountryFilters(family, selection, undefined))
    expect(matched).toHaveLength(1)
    expect(countryFacetCounts(families, selection, undefined).type.byValue.get('Storymaps')).toBe(1)
  })
})
