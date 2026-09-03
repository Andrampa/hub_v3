import type { ProductFamily } from './productFamilies'
import { MACHINE_TAG_PATTERN } from './productFamilies'
import { CROSS_COUNTRY_CODE, countryDefinition, type CountryResource, type CountrySummary } from '../services/countries'

/**
 * Suggestion matching runs entirely against the catalog the page already
 * downloaded, so typing costs no requests. The group endpoint's own `q=`
 * search was measured at 200-640ms per call and ranks service layers above
 * country products, so it is deliberately not used here.
 */

export interface FamilyMatch {
  family: ProductFamily<CountryResource>
  score: number
}

interface IndexedFamily {
  family: ProductFamily<CountryResource>
  /** Every variant title, so a French edition is findable by its own words. */
  title: string
  /** Resolved country names: 5% of products name their country only in the group category. */
  countries: string
  /** Item type, product types, shock types, monitoring products and editorial tags. */
  facets: string
  modified: number
}

export type CatalogSearchIndex = IndexedFamily[]

const CATEGORY_FACETS = ['/categories/product types/', '/categories/shock types/', '/categories/monitoring products/']

/**
 * Snippets and descriptions are deliberately not indexed. Most snippets repeat
 * the title, and descriptions match words that appear nowhere on the card, so a
 * suggestion list built from them reads as broken.
 */
export function foldText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function categoryValues(item: CountryResource) {
  return (item.groupCategories || []).flatMap((category) => {
    const prefix = CATEGORY_FACETS.find((value) => category.toLowerCase().startsWith(value))
    return prefix ? [category.slice(prefix.length)] : []
  })
}

export function buildCatalogSearchIndex(families: ProductFamily<CountryResource>[]): CatalogSearchIndex {
  return families.map((family) => {
    const countries = [...new Set(family.variants.flatMap((variant) => variant.countries))]
      .map((code) => (code === CROSS_COUNTRY_CODE ? 'Cross-country' : countryDefinition(code).name))
    const facets = [...new Set(family.variants.flatMap((variant) => [
      variant.type,
      ...categoryValues(variant),
      ...(variant.tags || []).filter((tag) => !MACHINE_TAG_PATTERN.test(tag.trim())),
    ]))]
    return {
      family,
      title: foldText(family.variants.map((variant) => variant.title).join(' | ')),
      countries: foldText(countries.join(' ')),
      facets: foldText(facets.join(' ')),
      modified: family.latestModified,
    }
  })
}

/**
 * A word-boundary hit outranks a hit buried inside a longer word, and a very
 * short token only counts at a boundary so "round 8" does not match "Round 28".
 */
function fieldScore(haystack: string, token: string) {
  const position = haystack.indexOf(token)
  if (position < 0) return 0
  const startsWord = position === 0 || !/[a-z0-9]/.test(haystack[position - 1])
  if (!startsWord) return token.length > 2 ? 1 : 0
  return /[a-z0-9]/.test(haystack[position + token.length] || ' ') ? 2 : 3
}

export function queryTokens(query: string) {
  return foldText(query.trim()).split(/\s+/).filter(Boolean)
}

/** Every token must match somewhere, so "questionnaire round 8" narrows instead of widening. */
export function searchCatalog(index: CatalogSearchIndex, query: string, limit = 6): FamilyMatch[] {
  const tokens = queryTokens(query)
  if (!tokens.length) return []
  const matches: FamilyMatch[] = []
  for (const entry of index) {
    let score = 0
    let matchesAll = true
    for (const token of tokens) {
      const tokenScore = fieldScore(entry.title, token) * 10
        + fieldScore(entry.countries, token) * 8
        + fieldScore(entry.facets, token) * 4
      if (!tokenScore) {
        matchesAll = false
        break
      }
      score += tokenScore
    }
    if (matchesAll) matches.push({ family: entry.family, score })
  }
  return matches
    .sort((a, b) => b.score - a.score || b.family.latestModified - a.family.latestModified)
    .slice(0, limit)
}

export function searchCountries(countries: CountrySummary[], query: string, limit = 3) {
  const tokens = queryTokens(query)
  if (!tokens.length) return []
  return countries
    .map((country) => {
      const name = foldText(country.name)
      const score = tokens.reduce((total, token) => {
        // Countries only match at a word boundary: "ni" should not offer Afghanistan.
        const boundaryScore = fieldScore(name, token)
        const value = boundaryScore > 1 ? boundaryScore : foldText(country.iso3) === token ? 3 : 0
        return value && total >= 0 ? total + value : -1
      }, 0)
      return { country, score }
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.country.resourceCount - a.country.resourceCount)
    .slice(0, limit)
    .map((entry) => entry.country)
}

/**
 * Same matching rules as the suggestion list, exposed as a predicate so the
 * catalogue page and the homepage can never disagree about what a query means.
 */
export function matchingFamilyIds(index: CatalogSearchIndex, query: string) {
  const tokens = queryTokens(query)
  if (!tokens.length) return undefined
  const ids = new Set<string>()
  for (const entry of index) {
    const matchesAll = tokens.every((token) => (
      fieldScore(entry.title, token) || fieldScore(entry.countries, token) || fieldScore(entry.facets, token)
    ))
    if (matchesAll) ids.add(entry.family.id)
  }
  return ids
}
