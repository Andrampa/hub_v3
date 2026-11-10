/**
 * Contextual filter counts for `/countries/:iso3`.
 *
 * The country page used to count product types and pathways over the whole
 * country inventory, whatever else was selected. With "Hazard impact" chosen,
 * the Questionnaires tile still said 11 on `/countries/afg` and gave nothing
 * when clicked. Each option is now counted against every other active
 * constraint, but not against its own facet, so a count always states how many
 * results choosing that option would give from where the reader is.
 *
 * A family counts once per option even when several language variants carry
 * the value, and a family carrying several types or pathways counts under each,
 * so the per-option counts are not expected to add up to the total.
 */
import { itemYear } from './catalog'
import type { ProductFamily } from './productFamilies'
import type { CountryResource } from '../services/countries'

export type CountryFacet = 'pathway' | 'type' | 'year'

export interface CountryFacetSelection {
  /** Stored values, or the facet's "All" value from COUNTRY_FACET_ALL. */
  pathway: string
  type: string
  year: string
}

export const COUNTRY_FACET_ALL: CountryFacetSelection = {
  pathway: 'All pathways',
  type: 'All products',
  year: 'All years',
}

type Family = ProductFamily<CountryResource>

function familyValues(family: Family, facet: CountryFacet): Set<string> {
  if (facet === 'pathway') return new Set(family.variants.flatMap((item) => item.evidencePathways))
  if (facet === 'type') return new Set(family.variants.flatMap((item) => item.productTypes))
  return new Set(family.variants.map((item) => String(itemYear(item))))
}

function matchesFacet(family: Family, facet: CountryFacet, value: string) {
  return value === COUNTRY_FACET_ALL[facet] || familyValues(family, facet).has(value)
}

/**
 * Whether a family passes the search and every facet, optionally ignoring one
 * facet. `matchedIds` is the search result; undefined means no search applied.
 */
export function familyMatchesCountryFilters(
  family: Family,
  selection: CountryFacetSelection,
  matchedIds: Set<string> | undefined,
  ignore?: CountryFacet,
) {
  if (matchedIds && !matchedIds.has(family.id)) return false
  return (['pathway', 'type', 'year'] as const).every((facet) => (
    facet === ignore || matchesFacet(family, facet, selection[facet])
  ))
}

export interface CountryFacetCounts {
  /** Results the facet's "All" option would give: every other filter applied. */
  all: number
  /** Results per value, under the same other filters. Absent means zero. */
  byValue: Map<string, number>
}

export function countryFacetCounts(
  families: Family[],
  selection: CountryFacetSelection,
  matchedIds: Set<string> | undefined,
): Record<CountryFacet, CountryFacetCounts> {
  const result = {} as Record<CountryFacet, CountryFacetCounts>
  ;(['pathway', 'type', 'year'] as const).forEach((facet) => {
    const byValue = new Map<string, number>()
    let all = 0
    families.forEach((family) => {
      if (!familyMatchesCountryFilters(family, selection, matchedIds, facet)) return
      all += 1
      familyValues(family, facet).forEach((value) => byValue.set(value, (byValue.get(value) || 0) + 1))
    })
    result[facet] = { all, byValue }
  })
  return result
}
