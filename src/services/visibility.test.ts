import { describe, expect, it } from 'vitest'
import { isWithheld, opendataField, visibilityClause, visibilityScope, WITHHELD_WHERE, withVisibility } from './visibility'

const withFlag = { fields: [{ name: 'adm0_iso3', alias: '', type: 'esriFieldTypeString' }, { name: 'opendata', alias: '', type: 'esriFieldTypeSmallInteger' }] }
const withoutFlag = { fields: [{ name: 'adm0_iso3', alias: '', type: 'esriFieldTypeString' }] }

describe('content visibility', () => {
  it('limits a non-Contributor to released rows on a layer that carries the flag', () => {
    expect(visibilityClause(withFlag, false)).toBe('opendata = 1')
  })

  it('shows a Contributor everything, including rows not yet released', () => {
    expect(visibilityClause(withFlag, true)).toBeUndefined()
  })

  it('fails closed on a layer without the flag: nothing is marked released, so nothing is shown', () => {
    // The dashboard fails open here; the Hub deliberately does not.
    expect(visibilityClause(withoutFlag, false)).toBe(WITHHELD_WHERE)
    expect(isWithheld(visibilityClause(withoutFlag, false))).toBe(true)
  })

  it('trusts only an explicitly declared release-filtered microdata view', () => {
    expect(visibilityClause(withoutFlag, false, 'microdata', true)).toBeUndefined()
    expect(visibilityClause(withoutFlag, false, 'microdata', false)).toBe(WITHHELD_WHERE)
    expect(visibilityClause(withoutFlag, false, 'aggregate', true)).toBeUndefined()
    expect(visibilityClause(withFlag, false, 'microdata', true)).toBe('opendata = 1')
  })

  it('still shows a Contributor a layer without the flag', () => {
    expect(visibilityClause(withoutFlag, true)).toBeUndefined()
  })

  it('uses the field name exactly as the layer spells it', () => {
    const upper = { fields: [{ name: 'OPENDATA', alias: '', type: 'esriFieldTypeSmallInteger' }] }
    expect(opendataField(upper)).toBe('OPENDATA')
    expect(visibilityClause(upper, false)).toBe('OPENDATA = 1')
  })

  it('ANDs the clause into an existing filter, and replaces a match-all one', () => {
    expect(withVisibility("adm0_iso3 = 'NGA'", 'opendata = 1')).toBe("(adm0_iso3 = 'NGA') AND opendata = 1")
    expect(withVisibility('1=1', 'opendata = 1')).toBe('opendata = 1')
    expect(withVisibility("adm0_iso3 = 'NGA'", undefined)).toBe("adm0_iso3 = 'NGA'")
  })

  it('names the two scopes differently, for cache keys', () => {
    expect(visibilityScope(true)).not.toBe(visibilityScope(false))
  })
})

describe('scope of the rule', () => {
  it('governs survey data - aggregates and microdata, grant views included', async () => {
    const { governedByVisibility } = await import('./visibility')
    expect(governedByVisibility('aggregate')).toBe(true)
    expect(governedByVisibility('microdata')).toBe(true)
  })

  it('fails open on an unflagged aggregate, closed on unflagged microdata', () => {
    const withoutFlag = { fields: [{ name: 'round', alias: '', type: 'esriFieldTypeInteger' }] }
    expect(visibilityClause(withoutFlag, false, 'aggregate')).toBeUndefined()
    expect(visibilityClause(withoutFlag, false, 'microdata')).toBe(WITHHELD_WHERE)
  })

  it('leaves boundaries, documentation and catalogue datasets alone', async () => {
    const { governedByVisibility } = await import('./visibility')
    expect(governedByVisibility('reference')).toBe(false)
    expect(governedByVisibility('metadata')).toBe(false)
    expect(governedByVisibility('public')).toBe(false)
  })
})
