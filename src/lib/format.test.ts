import { describe, expect, it } from 'vitest'
import { formatDate, formatNumber } from './format'

describe('formatDate', () => {
  it('writes day, full month and year', () => {
    expect(formatDate(Date.UTC(2024, 5, 12))).toBe('12 June 2024')
    expect(formatDate(new Date(Date.UTC(2026, 8, 1)))).toBe('1 September 2026')
  })

  it('reads timestamps in UTC so a late-evening upload keeps its day', () => {
    expect(formatDate(Date.UTC(2025, 11, 31, 23, 30))).toBe('31 December 2025')
  })
})

describe('formatNumber', () => {
  it('separates thousands with a non-breaking space, not a comma', () => {
    expect(formatNumber(1240)).toBe('1 240')
    expect(formatNumber(2049380)).toBe('2 049 380')
    expect(formatNumber(20000)).not.toContain(',')
  })

  it('leaves small numbers and decimals alone', () => {
    expect(formatNumber(54)).toBe('54')
    expect(formatNumber(4819.2)).toBe('4 819.2')
  })
})
