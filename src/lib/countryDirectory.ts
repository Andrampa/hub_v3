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
