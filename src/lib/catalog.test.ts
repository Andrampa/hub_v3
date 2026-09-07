// @vitest-environment happy-dom
// cleanText parses HTML with DOMParser, which node does not have. Everything
// else in this file is pure.
import { describe, expect, it } from 'vitest'
import {
  cleanText,
  distinctSummary,
  isHazardImpactAssessment,
  itemEdition,
  itemRound,
  itemYear,
} from './catalog'
import type { ArcGISItem } from '../types'

/**
 * These functions decide what every card on the site says: its date, its round
 * badge, its summary, and whether it is counted in the 122-assessment headline.
 * They read mutable ArcGIS metadata and mostly infer from titles, so the cases
 * that matter are the malformed ones - which is what this file is for.
 */
function item(overrides: Partial<ArcGISItem> = {}): ArcGISItem {
  return {
    id: 'a'.repeat(32),
    title: 'Niger - DIEM Monitoring Brief - Round 7',
    type: 'PDF',
    owner: 'diem_publisher',
    created: Date.UTC(2023, 4, 4),
    modified: Date.UTC(2026, 7, 24),
    tags: [],
    ...overrides,
  } as ArcGISItem
}

describe('itemYear', () => {
  it('reads the catalogue entry date from created, not modified', () => {
    // The August 2026 category migration rewrote `modified` across the group.
    // A facet built on it reported 2026 for products published years earlier.
    expect(itemYear(item({ created: Date.UTC(2021, 0, 9), modified: Date.UTC(2026, 7, 24) }))).toBe(2021)
  })

  it('reads created in UTC, so a timezone cannot shift the year', () => {
    expect(itemYear(item({ created: Date.UTC(2022, 11, 31, 23, 30) }))).toBe(2022)
  })
})

describe('itemRound', () => {
  it('reads a round in every language the group publishes', () => {
    expect(itemRound(item({ title: 'Mali - Brief - Round 7' }))).toBe(7)
    expect(itemRound(item({ title: 'RDC - Note - cycle 11' }))).toBe(11)
    expect(itemRound(item({ title: 'Niger - Bulletin de suivi DIEM - Cycle 9' }))).toBe(9)
    expect(itemRound(item({ title: 'RDC - Note d’information - ronde 8' }))).toBe(8)
    // Spanish was missing until 2026-09-07. Nine live Honduras, Colombia and
    // Guatemala reports parsed no round at all; this is the regression guard.
    expect(itemRound(item({ title: 'Honduras - Informe de seguimiento DIEM - Ronda 5' }))).toBe(5)
    expect(itemRound(item({ title: 'Guatemala - Informe de seguimiento DIEM - Ronda 4' }))).toBe(4)
    expect(itemRound(item({ title: 'Honduras - Ciclo 3' }))).toBe(3)
  })

  it('tolerates the # and the spacing variants the group actually contains', () => {
    expect(itemRound(item({ title: 'Mozambique - EVE report for Round #55' }))).toBe(55)
    expect(itemRound(item({ title: 'Nigeria - Household Questionnaire - Round8' }))).toBe(8)
  })

  it('rejects a three-digit number, which is a period or a typo', () => {
    // DIEM is at round 14 after six years, so a "round 120" is never a round.
    expect(itemRound(item({ title: 'Mozambique - EVE biweekly report - Period 120' }))).toBeUndefined()
    expect(itemRound(item({ title: 'Somewhere - Round 100' }))).toBeUndefined()
  })

  it('returns undefined rather than guessing when the title declares no round', () => {
    // A title written differently is a missing number, not a missing product:
    // the round timeline must show a gap only where one is declared.
    expect(itemRound(item({ title: 'Niger - Calendrier agricole' }))).toBeUndefined()
    expect(itemRound(item({ title: 'Rice Production Trend: 2021 compared to 2020' }))).toBeUndefined()
  })
})

describe('itemEdition', () => {
  it('prefers the round over any year in the title', () => {
    expect(itemEdition(item({ title: 'Mali - Brief - Round 7 - 2024' }))).toBe('Round 7')
  })

  it('falls back to month/year, then to a bare year', () => {
    expect(itemEdition(item({ title: 'Nepal - Assessment - 08 2026' }))).toBe('08/2026')
    expect(itemEdition(item({ title: 'Nigeria - Impact Assessment of the 2025 floods' }))).toBe('2025')
  })

  it('says nothing when the title carries no edition', () => {
    expect(itemEdition(item({ title: 'Niger - Agricultural calendar' }))).toBeUndefined()
  })
})

describe('isHazardImpactAssessment', () => {
  it('requires the exact tag, because ArcGIS tag search is stemmed', () => {
    // `tags:"impact assessment"` also matches "Rapid Impact Assessment"
    // elsewhere in the organization, so the count is filtered here instead.
    expect(isHazardImpactAssessment(item({ tags: ['Impact Assessment'] }))).toBe(true)
    expect(isHazardImpactAssessment(item({ tags: ['  impact assessment  '] }))).toBe(true)
    expect(isHazardImpactAssessment(item({ tags: ['rapid impact assessment'] }))).toBe(false)
    expect(isHazardImpactAssessment(item({ tags: [] }))).toBe(false)
    expect(isHazardImpactAssessment(item({ tags: undefined }))).toBe(false)
  })

  it('excludes the layers a product is built from', () => {
    // Counting these would inflate the headline figure with components no
    // reader ever opens.
    for (const type of ['Feature Service', 'Web Map', 'Image', 'CSV', 'Service Definition']) {
      expect(isHazardImpactAssessment(item({ type, tags: ['impact assessment'] }))).toBe(false)
    }
    expect(isHazardImpactAssessment(item({ type: 'StoryMap', tags: ['impact assessment'] }))).toBe(true)
  })
})

describe('cleanText', () => {
  it('strips markup and collapses whitespace', () => {
    expect(cleanText('<p>Flood   impact</p>\n<p>in Nigeria</p>')).toBe('Flood impact in Nigeria')
  })

  it('is empty for undefined and for markup carrying no text', () => {
    expect(cleanText(undefined)).toBe('')
    expect(cleanText('<div><br/></div>')).toBe('')
  })
})

describe('distinctSummary', () => {
  it('drops a snippet that only restates the title', () => {
    // "Mali - DIEM Monitoring Brief - Round 7" with the snippet "DIEM
    // Monitoring Brief - Round 7" filled a whole column of the grid with the
    // same words, and was the loudest reason the catalogue looked generated.
    expect(distinctSummary(item({
      title: 'Mali - DIEM Monitoring Brief - Round 7',
      snippet: 'DIEM Monitoring Brief - Round 7',
    }))).toBe('')
  })

  it('drops a snippet that merely wraps the title', () => {
    expect(distinctSummary(item({ title: 'Round 7', snippet: 'Mali - DIEM Monitoring Brief - Round 7' }))).toBe('')
  })

  it('ignores punctuation and case when comparing', () => {
    expect(distinctSummary(item({
      title: 'Niger — DIEM Monitoring Brief: Round 7',
      snippet: 'niger diem monitoring brief round 7',
    }))).toBe('')
  })

  it('keeps a summary that actually adds something', () => {
    expect(distinctSummary(item({
      title: 'Mali - DIEM Monitoring Brief - Round 7',
      snippet: 'Findings from 1,240 households across five regions.',
    }))).toBe('Findings from 1,240 households across five regions.')
  })

  it('falls back to the description when there is no snippet', () => {
    expect(distinctSummary(item({
      title: 'Chad - Flood impact assessment',
      snippet: '',
      description: '<p>Cropland flooded across three regions.</p>',
    }))).toBe('Cropland flooded across three regions.')
  })

  it('is empty when the record carries nothing', () => {
    expect(distinctSummary(item({ snippet: undefined, description: undefined }))).toBe('')
  })

  it('drops a summary a very short title happens to be contained in', () => {
    // Known and accepted: the comparison is a substring test in both
    // directions, so a one-word title swallows any summary containing it. No
    // record in the group has a title short enough for this to bite, and the
    // alternative - a similarity threshold - would let real duplicates through.
    expect(distinctSummary(item({ title: 'Chad', snippet: 'Chad flood impact, 2023.' }))).toBe('')
  })
})
