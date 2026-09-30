import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchSurveyCollectionPeriods, isMonitoringRoundProduct } from './monitoring'

type Row = { admin0_isocode: string; round: string; coll_start_date?: number; coll_end_date?: number }

/** Serves `rows` in pages of `pageSize`, honouring resultOffset as ArcGIS does. */
function registerServing(rows: Row[], pageSize: number, options: { stallAt?: number; suppressFlag?: boolean } = {}) {
  const offsets: number[] = []
  const fetchMock = vi.fn(async (input: string) => {
    const offset = Number(new URL(input).searchParams.get('resultOffset') || 0)
    offsets.push(offset)
    const page = options.stallAt !== undefined && offset >= options.stallAt ? [] : rows.slice(offset, offset + pageSize)
    return new Response(JSON.stringify({
      features: page.map((attributes) => ({ attributes })),
      // An explicit record count can make a real service omit this flag.
      exceededTransferLimit: options.suppressFlag ? false : offset + pageSize < rows.length,
    }))
  })
  vi.stubGlobal('fetch', fetchMock)
  return { offsets }
}

const day = (value: string) => Date.parse(`${value}T00:00:00Z`)

afterEach(() => vi.unstubAllGlobals())

describe('survey collection periods', () => {
  it('matches a survey on country and round', async () => {
    registerServing([
      { admin0_isocode: 'NGA', round: 'Round 07', coll_start_date: day('2024-09-06'), coll_end_date: day('2024-09-23') },
      { admin0_isocode: 'NGA', round: 'Round 08', coll_start_date: day('2025-09-09'), coll_end_date: day('2025-09-25') },
    ], 2000)

    const periods = await fetchSurveyCollectionPeriods([{ adm0Iso3: 'NGA', round: 8 }])

    expect(periods.get('NGA:8')).toEqual({ start: day('2025-09-09'), end: day('2025-09-25') })
    expect(periods.has('NGA:7')).toBe(false)
  })

  it('follows every page, so a survey on a later page is not reported as undated', async () => {
    const rows: Row[] = Array.from({ length: 5 }, (_, index) => ({
      admin0_isocode: 'NGA',
      round: `Round ${String(index + 1).padStart(2, '0')}`,
      coll_start_date: day('2024-01-01'),
      coll_end_date: day('2024-01-20'),
    }))
    const { offsets } = registerServing(rows, 2)

    const periods = await fetchSurveyCollectionPeriods([{ adm0Iso3: 'NGA', round: 5 }])

    // Round 5 sits on the third page; the single-page read used to miss it.
    expect(offsets).toEqual([0, 2, 4])
    expect(periods.get('NGA:5')).toBeDefined()
  })

  it('keeps reading after a full page even when the transfer flag is missing', async () => {
    const rows: Row[] = Array.from({ length: 4_500 }, (_, index) => ({
      admin0_isocode: 'NGA',
      round: `Round ${index + 1}`,
      coll_start_date: day('2024-01-01'),
    }))
    const { offsets } = registerServing(rows, 2_000, { suppressFlag: true })

    const periods = await fetchSurveyCollectionPeriods([{ adm0Iso3: 'NGA', round: 4_321 }])

    // A full page is evidence of more; the flag alone is not trusted to say so.
    expect(offsets).toEqual([0, 2_000, 4_000])
    expect(periods.get('NGA:4321')).toBeDefined()
  })

  it('treats an empty page after an unflagged full page as the end, not a stall', async () => {
    // Exactly two full pages: the third request legitimately comes back empty.
    const rows: Row[] = Array.from({ length: 4_000 }, (_, index) => ({
      admin0_isocode: 'NGA',
      round: `Round ${index + 1}`,
      coll_start_date: day('2024-01-01'),
    }))
    const { offsets } = registerServing(rows, 2_000, { suppressFlag: true })

    const periods = await fetchSurveyCollectionPeriods([{ adm0Iso3: 'NGA', round: 4_000 }])

    expect(offsets).toEqual([0, 2_000, 4_000])
    expect(periods.get('NGA:4000')).toBeDefined()
  })

  it('fails rather than returning a silently truncated register', async () => {
    const rows: Row[] = Array.from({ length: 5 }, (_, index) => ({
      admin0_isocode: 'NGA',
      round: `Round 0${index + 1}`,
      coll_start_date: day('2024-01-01'),
    }))
    registerServing(rows, 2, { stallAt: 2 })

    await expect(fetchSurveyCollectionPeriods([{ adm0Iso3: 'NGA', round: 5 }]))
      .rejects.toThrow(/not read completely/)
  })

  it('leaves out a pair the register holds twice rather than guessing between them', async () => {
    registerServing([
      { admin0_isocode: 'NGA', round: 'Round 08', coll_start_date: day('2025-09-09') },
      { admin0_isocode: 'NGA', round: 'Round 08', coll_start_date: day('2025-10-01') },
    ], 2000)

    const periods = await fetchSurveyCollectionPeriods([{ adm0Iso3: 'NGA', round: 8 }])

    expect(periods.has('NGA:8')).toBe(false)
  })

  it('makes no request for identifiers that cannot be country codes', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const periods = await fetchSurveyCollectionPeriods([{ adm0Iso3: "N'GA", round: 8 }])

    expect(periods.size).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('isMonitoringRoundProduct', () => {
  const itemId = 'a'.repeat(32)
  const published = {
    ObjectId: 1, admin0_isocode: 'NER', admin0_name_en: 'Niger', round: 'Round 08',
    round_validated: 'yes', validation_date: day('2025-10-01'),
  }

  function serving(rows: Array<Record<string, unknown>>) {
    const fetchMock = vi.fn(async (_input: string) => new Response(JSON.stringify({ features: rows.map((attributes) => ({ attributes })) })))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('asks only for rows whose product links mention the item', async () => {
    const fetchMock = serving([{ ...published, report_link: `https://www.arcgis.com/home/item.html?id=${itemId}` }])

    expect(await isMonitoringRoundProduct(itemId.toUpperCase())).toBe(true)
    const where = new URL(fetchMock.mock.calls[0][0]).searchParams.get('where')
    expect(where).toContain(`LOWER(report_link) LIKE '%${itemId}%'`)
    expect(where).not.toBe('1=1')
  })

  it('does not count a round that is not published', async () => {
    serving([{ ...published, round_validated: 'no', survey_outdated: 'yes', report_link: itemId }])

    expect(await isMonitoringRoundProduct(itemId)).toBe(false)
  })

  it('does not count a row whose link names a different item', async () => {
    // LIKE only narrows the rows; the parsed product id still decides.
    serving([{ ...published, report_link: `https://www.arcgis.com/home/item.html?id=${'b'.repeat(32)}` }])

    expect(await isMonitoringRoundProduct(itemId)).toBe(false)
  })

  it('makes no request for a value that is not an item id', async () => {
    const fetchMock = serving([])

    expect(await isMonitoringRoundProduct("x' OR '1'='1")).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
