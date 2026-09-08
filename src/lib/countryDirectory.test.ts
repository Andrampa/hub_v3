import { describe, expect, it } from 'vitest'
import { countryMatchesQuery, filterCountries, normalizeCountryText } from './countryDirectory'

const niger = { name: 'Niger', iso3: 'NER', iso2: 'NE', region: 'Africa' }
const nigeria = { name: 'Nigeria', iso3: 'NGA', iso2: 'NG', region: 'Africa' }
const ivory = { name: 'Côte d’Ivoire', iso3: 'CIV', iso2: 'CI', region: 'Africa' }
const yemen = { name: 'Yemen', iso3: 'YEM', iso2: 'YE', region: 'Near East' }
// Chad is the useful case for the code rules: its ISO3 and ISO2 disagree after
// the first letter and neither shares a fragment with its name, so each rule
// can be exercised without the name match answering first.
const chad = { name: 'Chad', iso3: 'TCD', iso2: 'TD', region: 'Africa' }
const countries = [niger, nigeria, ivory, yemen]

describe('normalizeCountryText', () => {
  it('strips accents, case and punctuation', () => {
    expect(normalizeCountryText('Côte d’Ivoire')).toBe('cote d ivoire')
    expect(normalizeCountryText('  Sri-Lanka ')).toBe('sri lanka')
  })
})

describe('countryMatchesQuery', () => {
  it('matches any part of the name, case and accent insensitively', () => {
    expect(countryMatchesQuery(nigeria, 'nig')).toBe(true)
    expect(countryMatchesQuery(nigeria, 'GERIA')).toBe(true)
    expect(countryMatchesQuery(ivory, 'cote')).toBe(true)
    expect(countryMatchesQuery(ivory, "côte d'ivoire")).toBe(true)
  })

  it('matches an ISO3 code from its start', () => {
    expect(countryMatchesQuery(niger, 'ner')).toBe(true)
    expect(countryMatchesQuery(niger, 'NE')).toBe(true)
    expect(countryMatchesQuery(nigeria, 'nga')).toBe(true)
  })

  it('does not match a code fragment that is not a prefix', () => {
    // "cd" ends TCD but is not how anyone reaches Chad by code, and matching it
    // would pull in every code containing those letters in that order.
    expect(countryMatchesQuery(chad, 'cd')).toBe(false)
  })

  it('matches an ISO2 code, exactly', () => {
    // Reachable by ISO2 even where it shares nothing with the name or the ISO3.
    expect(countryMatchesQuery(chad, 'td')).toBe(true)
    // A different two-letter code is not a match, so ISO2 does not behave as a
    // second, looser prefix rule.
    expect(countryMatchesQuery(chad, 'dt')).toBe(false)
  })

  it('treats an empty or blank query as no filter', () => {
    expect(countryMatchesQuery(yemen, '')).toBe(true)
    expect(countryMatchesQuery(yemen, '   ')).toBe(true)
  })

  it('rejects a query that matches nothing', () => {
    expect(countryMatchesQuery(yemen, 'zzz')).toBe(false)
  })
})

describe('filterCountries', () => {
  it('applies region and query together', () => {
    expect(filterCountries(countries, { region: 'Africa', query: 'nig' })).toEqual([niger, nigeria])
    expect(filterCountries(countries, { region: 'Near East', query: 'nig' })).toEqual([])
  })

  it('returns everything for the default region and no query', () => {
    expect(filterCountries(countries, { region: 'All regions', query: '' })).toHaveLength(4)
  })

  it('reaches a country in three letters', () => {
    // The review's acceptance criterion for the directory.
    expect(filterCountries(countries, { region: 'All regions', query: 'yem' })).toEqual([yemen])
  })
})
