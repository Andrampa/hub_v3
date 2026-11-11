import { describe, expect, it, vi } from 'vitest'
import spotlightExport from '../data/briefSpotlight.json'
import {
  HISTORY_KEY,
  HISTORY_LIMIT,
  attribution,
  callToAction,
  eligibleEntries,
  monthsInWindow,
  pickNext,
  previousRound,
  readHistory,
  recencyWeight,
  rememberCard,
  roundLabel,
  trackSpotlight,
  type SpotlightBrief,
  type SpotlightCard,
  type SpotlightData,
  type SpotlightEntry,
} from './briefSpotlight'

const NOW = Date.parse('2026-11-11T00:00:00Z')

function brief(survey: string, released: string, overrides: Partial<SpotlightBrief> = {}): SpotlightBrief {
  const [iso3, round] = survey.split('_R')
  return {
    survey,
    iso3,
    rounds: [Number(round)],
    language: 'en',
    title: `${iso3} brief`,
    released,
    record_url: `https://openknowledge.fao.org/handle/20.500.14283/${survey}`,
    agol_item_id: `item-${survey}`,
    ...overrides,
  }
}

function card(id: string, overrides: Partial<SpotlightCard> = {}): SpotlightCard {
  return {
    id,
    survey: id.split('-')[0],
    item_type: 'finding',
    chapter: 'drivers',
    kind: 'estimate',
    treatment: 'headline',
    headline: `Finding ${id}`,
    context: {},
    quote: { text: 'A verbatim quote from the brief.', page: 2, lang: 'en' },
    ...overrides,
  }
}

function data(briefs: SpotlightBrief[], cards: SpotlightCard[]): SpotlightData {
  return { schema_version: 1, licence: 'CC BY 4.0', chapters: { drivers: 'Why?' }, briefs, cards }
}

const TCD10 = brief('TCD_R10', '2026-11-06')
const TCD9 = brief('TCD_R9', '2026-01-07')
const LBN9 = brief('LBN_R9', '2026-10-20')
const SAMPLE = data([TCD10, TCD9, LBN9], [
  card('TCD_R10-F01', { treatment: 'count', chapter: 'aghin_overview' }),
  card('TCD_R10-F02'),
  card('TCD_R9-F01', { treatment: 'ring' }),
  card('LBN_R9-F01', { treatment: 'bars' }),
])
const ALL_ITEMS = new Set(SAMPLE.briefs.map((entry) => entry.agol_item_id))
const sequence = (...values: number[]) => {
  let index = 0
  return () => values[Math.min(index++, values.length - 1)]
}

describe('eligibleEntries', () => {
  it('shows nothing until a brief is in the public catalogue', () => {
    expect(eligibleEntries(SAMPLE, new Set())).toEqual([])
    const onlyLebanon = eligibleEntries(SAMPLE, new Set(['item-LBN_R9', 'unrelated']))
    expect(onlyLebanon.map((entry) => entry.card.id)).toEqual(['LBN_R9-F01'])
  })

  it('drops a card whose brief has no link', () => {
    const unlinked = data([brief('TCD_R10', '2026-11-06', { record_url: '' })], [card('TCD_R10-F01')])
    expect(eligibleEntries(unlinked, new Set(['item-TCD_R10']))).toEqual([])
  })

  it('narrows to one country on a country page', () => {
    expect(eligibleEntries(SAMPLE, ALL_ITEMS, 'tcd').map((entry) => entry.brief.iso3)).toEqual(['TCD', 'TCD', 'TCD'])
  })
})

describe('pickNext', () => {
  const pool = eligibleEntries(SAMPLE, ALL_ITEMS)

  it('returns nothing for an empty pool and the only card for a pool of one', () => {
    expect(pickNext([])).toBeUndefined()
    const single = pool.slice(0, 1)
    expect(pickNext(single)).toBe(single[0])
    expect(pickNext(single, { current: single[0], seen: [single[0].card.id] })).toBe(single[0])
  })

  it('never repeats the card on screen and moves to another country when it can', () => {
    for (const value of [0, 0.2, 0.5, 0.8, 0.999]) {
      const next = pickNext(pool, { current: pool[0], now: NOW, random: () => value })
      expect(next?.card.id).not.toBe(pool[0].card.id)
      expect(next?.brief.iso3).toBe('LBN')
    }
  })

  it('stays in the country when it is the only one (country page)', () => {
    const chad = eligibleEntries(SAMPLE, ALL_ITEMS, 'TCD')
    const next = pickNext(chad, { current: chad[0], now: NOW, random: () => 0 })
    expect(next?.brief.iso3).toBe('TCD')
    expect(next?.card.id).not.toBe(chad[0].card.id)
  })

  it('skips cards seen on earlier visits while others remain, then starts again', () => {
    const next = pickNext(pool, { seen: ['TCD_R10-F01', 'TCD_R10-F02', 'LBN_R9-F01'], now: NOW, random: () => 0 })
    expect(next?.card.id).toBe('TCD_R9-F01')
    expect(pickNext(pool, { seen: pool.map((entry) => entry.card.id), now: NOW, random: () => 0 })).toBeDefined()
  })

  it('weights the first card toward the newest brief', () => {
    const counts = new Map<string, number>()
    for (let step = 0; step < 200; step += 1) {
      const picked = pickNext(pool, { now: NOW, random: () => (step + 0.5) / 200 })!
      counts.set(picked.card.survey, (counts.get(picked.card.survey) || 0) + 1)
    }
    expect(counts.get('TCD_R10')!).toBeGreaterThan(counts.get('TCD_R9') || 0)
    expect(counts.get('LBN_R9')!).toBeGreaterThan(counts.get('TCD_R9') || 0)
  })

  it('halves a brief’s weight every sixty days', () => {
    expect(recencyWeight('2026-11-11', NOW)).toBe(1)
    expect(recencyWeight('2026-09-12', NOW)).toBeCloseTo(0.5, 5)
    expect(recencyWeight('2027-01-01', NOW)).toBe(1)
  })

  it('uses the random draw across the whole weight', () => {
    const picks = new Set([0, 0.999].map((value) => pickNext(pool, { now: NOW, random: sequence(value) })?.card.id))
    expect(picks.size).toBe(2)
  })
})

describe('previousRound', () => {
  const pool = eligibleEntries(SAMPLE, ALL_ITEMS)

  it('offers the same country’s earlier round only when the export holds it', () => {
    expect(previousRound(pool, TCD10)?.card.id).toBe('TCD_R9-F01')
    expect(previousRound(pool, TCD9)).toBeUndefined()
    expect(previousRound(pool, LBN9)).toBeUndefined()
  })
})

describe('wording', () => {
  it('builds the attribution and the call to action from the brief', () => {
    expect(attribution(TCD10, 'Chad')).toBe('From the Chad brief, November 2026')
    expect(callToAction(TCD10, 'Chad')).toBe('Read the Chad brief')
    expect(callToAction({ ...TCD10, language: 'fr' }, 'Chad')).toBe('Read the Chad brief (in French)')
    expect(roundLabel(TCD10)).toBe('Round 10')
    expect(roundLabel(brief('YEM_R29', '2025-11-06', { rounds: [28, 29] }))).toBe('Rounds 28–29')
  })

  it('lights a month window, including one that runs over the year end', () => {
    expect(monthsInWindow(6, 9)).toEqual([6, 7, 8, 9])
    expect(monthsInWindow(11, 1)).toEqual([11, 12, 1])
    expect(monthsInWindow(4, 4)).toEqual([4])
  })
})

describe('history', () => {
  function memoryStorage(initial?: string) {
    const values = new Map<string, string>(initial === undefined ? [] : [[HISTORY_KEY, initial]])
    return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
  }

  it('keeps the most recent cards, newest last, without duplicates', () => {
    const storage = memoryStorage()
    for (let index = 0; index < HISTORY_LIMIT + 3; index += 1) rememberCard(storage, `card-${index}`)
    expect(rememberCard(storage, 'card-5')).toHaveLength(HISTORY_LIMIT)
    expect(readHistory(storage).at(-1)).toBe('card-5')
    expect(readHistory(storage).filter((id) => id === 'card-5')).toHaveLength(1)
  })

  it('survives missing, blocked or corrupt storage', () => {
    expect(readHistory(undefined)).toEqual([])
    expect(readHistory(memoryStorage('not json'))).toEqual([])
    expect(readHistory(memoryStorage('{"a":1}'))).toEqual([])
    const blocked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
    expect(rememberCard(blocked, 'card-1')).toEqual(['card-1'])
  })
})

describe('trackSpotlight', () => {
  const entry: SpotlightEntry = { card: card('TCD_R10-F01', { treatment: 'count' }), brief: TCD10 }

  it('reports the card, never the visitor, and is silent without the tag', () => {
    expect(() => trackSpotlight('brief_spotlight_click', entry)).not.toThrow()
    const gtag = vi.fn()
    vi.stubGlobal('gtag', gtag)
    trackSpotlight('brief_spotlight_click', entry)
    vi.unstubAllGlobals()
    expect(gtag).toHaveBeenCalledWith('event', 'brief_spotlight_click', {
      card_id: 'TCD_R10-F01', survey: 'TCD_R10', chapter: 'drivers', treatment: 'count',
    })
  })
})

describe('generated export', () => {
  const exported = spotlightExport as unknown as SpotlightData
  const briefs = new Map(exported.briefs.map((entry) => [entry.survey, entry]))

  it('gives every card a linked brief, a verbatim quote and a supported graphic', () => {
    expect(exported.cards.length).toBeGreaterThan(0)
    for (const item of exported.cards) {
      const source = briefs.get(item.survey)
      expect(source?.record_url, item.id).toMatch(/^https:\/\/openknowledge\.fao\.org\//)
      expect(source?.agol_item_id, item.id).toMatch(/^[0-9a-f]{32}$/)
      expect(item.quote.text.length, item.id).toBeGreaterThan(10)
      expect(item.headline.length, item.id).toBeLessThanOrEqual(240)
      if (item.treatment === 'count' || item.treatment === 'ring') expect(item.figure, item.id).toBeTruthy()
      if (item.treatment === 'bars') expect(item.bars, item.id).toHaveLength(2)
      if (item.treatment === 'timeline') expect(item.months, item.id).toBeTruthy()
    }
  })

  it('carries no review material and no IPC wording', () => {
    const text = JSON.stringify(exported)
    for (const forbidden of ['review_note', 'content_sha256', 'pdf_file', 'authored_by', 'signoffs']) {
      expect(text).not.toContain(forbidden)
    }
    for (const item of exported.cards) expect(item.headline, item.id).not.toMatch(/\bIPC\b/)
  })
})
