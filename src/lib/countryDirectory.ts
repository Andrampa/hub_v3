/**
 * Text matching for the country directory on `/countries`.
 *
 * A directory of 54 countries had six region buttons and no text filter, so the
 * only way to reach one was 21 screens of scrolling or precise pointing at the
 * atlas. Readers type what they know: a name, part of a name, or the ISO3 code
 * that appears on every card and in every Hub URL.
 *
 * Matching is deliberately forgiving about accents and case — someone looking
 * for Côte d'Ivoire types "cote" — and deliberately strict about ISO codes,
 * which are prefixes rather than substrings so "ner" finds Niger rather than
 * every country whose name happens to contain those letters.
 */

export interface DirectoryCountry {
  name: string
  iso3: string
  iso2?: string
  region: string
}

/**
 * Lowercased, accent-stripped, punctuation-normalised. Apostrophes and hyphens
 * become spaces so "cote d ivoire", "cote-d'ivoire" and "Côte d’Ivoire" agree,
 * and the curly apostrophe ArcGIS stores does not defeat a typed straight one.
 */
export function normalizeCountryText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function countryMatchesQuery(country: DirectoryCountry, query: string) {
  const needle = normalizeCountryText(query)
  if (!needle) return true
  const name = normalizeCountryText(country.name)
  if (name.includes(needle)) return true
  // A code is matched from its start: "ner" is Niger, not every name containing
  // those three letters in that order.
  if (normalizeCountryText(country.iso3).startsWith(needle)) return true
  // ISO2 only on an exact match; two letters are too short to be a prefix
  // anyone means, and every two-letter code collides with several names.
  return Boolean(country.iso2) && normalizeCountryText(country.iso2 || '') === needle
}

export function filterCountries<T extends DirectoryCountry>(
  countries: readonly T[],
  { region, query }: { region: string; query: string },
  allRegions = 'All regions',
) {
  return countries.filter((country) => (
    (region === allRegions || country.region === region) && countryMatchesQuery(country, query)
  ))
}

/**
 * How much of the country directory a narrow screen shows at once.
 *
 * The full directory is 54 cards and about 17,600 px tall at 375 px — roughly
 * 21 screen-heights below the atlas.
 *
 * The contract, precisely:
 *
 * - Only the revealed slice is rendered. Below the breakpoint the cards beyond
 *   it are not in the DOM at all, so a crawler that renders the page sees the
 *   first batch and the control, not all 54 cards.
 * - Filtering and searching are computed against the complete catalogue, never
 *   against the slice, so a search reaches a country that has not been revealed.
 * - A result set that fits inside one batch is shown whole and the control does
 *   not appear, so an exact match is never behind a press.
 * - Every country keeps its own URL, listed in `sitemap.xml` and linked from
 *   the atlas above, so discoverability does not depend on this control.
 *
 * The reveal is a rendering budget for one narrow viewport, not a restriction
 * on what the page contains.
 */
export const DIRECTORY_REVEAL_STEP = 12

export interface DirectoryReveal {
  /** How many cards to render now. */
  visibleCount: number
  /** Matches not yet rendered. */
  remaining: number
  /** How many the next press would add, for the control's own label. */
  nextBatch: number
  hasMore: boolean
}

export function directoryReveal(
  total: number,
  revealed: number,
  step = DIRECTORY_REVEAL_STEP,
): DirectoryReveal {
  // `revealed` is a count of batches already asked for; the first is free.
  const visibleCount = Math.min(total, Math.max(step, revealed))
  const remaining = Math.max(0, total - visibleCount)
  return {
    visibleCount,
    remaining,
    nextBatch: Math.min(step, remaining),
    hasMore: remaining > 0,
  }
}

/**
 * The results line. It has to distinguish "54 countries match" from "12 of 54
 * shown", because a reader who cannot see the other 42 has no way to tell a
 * short list from a truncated one.
 */
export function directoryCountLabel(total: number, visibleCount: number) {
  const noun = total === 1 ? 'country' : 'countries'
  if (visibleCount >= total) {
    return `${total} ${noun} ${total === 1 ? 'matches' : 'match'} your current view.`
  }
  return `Showing ${visibleCount} of ${total} ${noun} matching your current view.`
}
