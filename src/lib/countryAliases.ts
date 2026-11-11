/** Search terms for existing country pages, keyed by their Hub country codes. */
const countryAliases: Readonly<Record<string, readonly string[]>> = {
  CAF: ['CAR', 'RCA', 'République centrafricaine'],
  CIV: ['Ivory Coast'],
  COD: ['DRC', 'DR Congo', 'Democratic Republic of Congo', 'Congo-Kinshasa', 'RDC', 'République démocratique du Congo', 'Zaire'],
  COG: ['Congo-Brazzaville', 'Republic of Congo', 'Republic of the Congo', 'République du Congo'],
  CPV: ['Cape Verde'],
  KHM: ['Kampuchea', 'Democratic Kampuchea'],
  LKA: ['Ceylon'],
  MMR: ['Burma'],
  PSE: ['Palestine', 'State of Palestine'],
  SYR: ['Syria', 'Syrian Arab Republic'],
  TLS: ['East Timor'],
  TZA: ['Tanzania', 'United Republic of Tanzania', 'TZN'],
  TZN: ['Tanzania', 'United Republic of Tanzania', 'TZA'],
  VCT: ['St Vincent and the Grenadines', 'Saint Vincent & the Grenadines', 'St Vincent & the Grenadines'],
  VEN: ['Venezuela', 'Bolivarian Republic of Venezuela', 'Venezuela Bolivarian Republic of'],
  VNM: ['Vietnam', 'Viet Nam'],
}

export function normalizeCountryText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function matchesCountryAlias(iso3: string, normalizedQuery: string) {
  // Accept separated initials such as D.R.C. without collapsing longer names.
  const query = /^(?:[a-z] ){2}[a-z]$/.test(normalizedQuery)
    ? normalizedQuery.replaceAll(' ', '')
    : normalizedQuery
  return countryAliases[iso3]?.some((alias) => normalizeCountryText(alias) === query) ?? false
}
