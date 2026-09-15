import { describe, expect, it } from 'vitest'
import { recentReleases, releaseWindowStart } from './recentReleases'

const NOW = Date.UTC(2026, 8, 15)
const at = (month: number, day = 1, year = 2026) => ({ id: `${year}-${month}-${day}`, created: Date.UTC(year, month, day) })

describe('releaseWindowStart', () => {
  it('goes back six calendar months', () => {
    expect(releaseWindowStart(NOW)).toBe(Date.UTC(2026, 2, 15))
  })
})

describe('recentReleases', () => {
  it('keeps products created inside the window, newest first', () => {
    const items = [at(3), at(8), at(5), at(6), at(7), at(4), at(1)]
    const result = recentReleases(items, NOW)
    expect(result.fallback).toBe(false)
    expect(result.items.map((item) => item.id)).toEqual(['2026-8-1', '2026-7-1', '2026-6-1', '2026-5-1', '2026-4-1', '2026-3-1'])
  })

  it('falls back to the latest N when the window is too thin', () => {
    const items = [at(8), at(1), at(0), at(11, 1, 2025), at(10, 1, 2025), at(9, 1, 2025)]
    const result = recentReleases(items, NOW)
    expect(result.fallback).toBe(true)
    expect(result.items).toHaveLength(5)
    expect(result.items[0].id).toBe('2026-8-1')
  })

  it('does not flag a fallback when the whole catalogue is inside the window', () => {
    const result = recentReleases([at(8), at(7)], NOW)
    expect(result).toMatchObject({ fallback: false })
    expect(result.items).toHaveLength(2)
  })

  it('ignores future or missing dates', () => {
    const result = recentReleases([at(11), { id: 'bad', created: Number.NaN }, at(8)], NOW, 6, 1)
    expect(result.items.map((item) => item.id)).toEqual(['2026-8-1'])
  })

  it('does not mutate the input order', () => {
    const items = [at(3), at(8)]
    recentReleases(items, NOW)
    expect(items[0].id).toBe('2026-3-1')
  })
})
