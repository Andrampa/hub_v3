/**
 * Brief spotlight: selection and wording rules, kept free of React so they can
 * be tested directly.
 *
 * The cards come from `src/data/briefSpotlight.json`, a public export generated
 * from the private brief-knowledge corpus by
 * `python -m management.brief_knowledge.cli export-public` in `hh_survey_v3`.
 * The export decides what may be shown and which graphic a card supports; this
 * module only decides which card to show next and never rewrites a figure.
 */

export type SpotlightTreatment = 'count' | 'ring' | 'bars' | 'timeline' | 'headline'

export interface SpotlightBar {
  literal: string
  label: string
  /** Bar length, 0 to 1, drawn from the two printed figures. */
  ratio: number
  current: boolean
}

export interface SpotlightCard {
  id: string
  survey: string
  item_type: 'finding' | 'recommendation'
  chapter: string
  kind: string
  treatment: SpotlightTreatment
  headline: string
  /** The figure exactly as the brief prints it, in the brief's language. */
  figure?: string
  figure_lang?: string
  fraction?: number
  bars?: SpotlightBar[]
  months?: { start: number; end: number; label: string }
  context: { population?: string; geography?: string; period?: string }
  quote: { text: string; page: number; lang: string }
}

export interface SpotlightBrief {
  survey: string
  iso3: string
  rounds: number[]
  language: string
  title: string
  /** Release day on FAO Open Knowledge, `YYYY-MM-DD`. */
  released: string
  record_url: string
  agol_item_id: string
}

export interface SpotlightData {
  schema_version: number
  licence: string
  chapters: Record<string, string>
  briefs: SpotlightBrief[]
  cards: SpotlightCard[]
}

export interface SpotlightEntry {
  card: SpotlightCard
  brief: SpotlightBrief
}

/** Briefs lose half their weight every two months, so new ones lead without hiding the rest. */
export const RECENCY_HALF_LIFE_DAYS = 60
export const HISTORY_LIMIT = 8
export const HISTORY_KEY = 'diem-hub:brief-spotlight:seen'
const DAY_MS = 24 * 60 * 60 * 1000
const GRAPHIC: ReadonlySet<SpotlightTreatment> = new Set(['count', 'ring', 'bars'])
const LANGUAGE_NAMES: Record<string, string> = { fr: 'French', es: 'Spanish', ar: 'Arabic' }

/**
 * Cards whose brief is in the public Hub catalogue right now.
 *
 * A product outside the DIEM Hub content group is never visible on the Hub, so
 * the export alone is not enough: the brief's ArcGIS item must be among the
 * catalogue items the page has loaded. `iso3` narrows the pool on a country page.
 */
export function eligibleEntries(
  data: SpotlightData,
  catalogItemIds: ReadonlySet<string>,
  iso3?: string,
): SpotlightEntry[] {
  const briefs = new Map(
    data.briefs
      .filter((brief) => catalogItemIds.has(brief.agol_item_id) && brief.record_url)
      .filter((brief) => !iso3 || brief.iso3 === iso3.toUpperCase())
      .map((brief) => [brief.survey, brief]),
  )
  return data.cards.flatMap((card) => {
    const brief = briefs.get(card.survey)
    return brief ? [{ card, brief }] : []
  })
}

export function recencyWeight(released: string, now: number) {
  const age = Math.max(0, now - Date.parse(`${released}T00:00:00Z`)) / DAY_MS
  return Math.pow(0.5, age / RECENCY_HALF_LIFE_DAYS)
}

/**
 * The next card: a weighted draw that favours recent briefs and, after the
 * first card, a different country, chapter and graphic than the one on screen.
 *
 * Each survey's weight is shared between its cards, so a survey with more
 * eligible cards is not shown more often. Cards seen recently (this visit and
 * earlier ones) are left out while anything else remains.
 */
export function pickNext(
  pool: SpotlightEntry[],
  options: { current?: SpotlightEntry; seen?: readonly string[]; now?: number; random?: () => number } = {},
): SpotlightEntry | undefined {
  const { current, seen = [], now = Date.now(), random = Math.random } = options
  if (!pool.length) return undefined
  const seenIds = new Set(seen)
  let candidates = pool.filter((entry) => entry.card.id !== current?.card.id && !seenIds.has(entry.card.id))
  if (!candidates.length) candidates = pool.filter((entry) => entry.card.id !== current?.card.id)
  if (!candidates.length) return pool[0]

  const otherCountry = candidates.filter((entry) => entry.brief.iso3 !== current?.brief.iso3)
  if (current && otherCountry.length) candidates = otherCountry

  const perSurvey = new Map<string, number>()
  for (const entry of candidates) perSurvey.set(entry.card.survey, (perSurvey.get(entry.card.survey) || 0) + 1)

  const weights = candidates.map((entry) => {
    let weight = recencyWeight(entry.brief.released, now) / (perSurvey.get(entry.card.survey) || 1)
    if (current) {
      if (entry.card.chapter === current.card.chapter) weight *= 0.3
      if (entry.card.treatment === current.card.treatment) weight *= 0.3
    } else if (GRAPHIC.has(entry.card.treatment)) {
      // The first card has three seconds to earn attention: lead with a figure.
      weight *= 3
    }
    return weight
  })
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let draw = random() * total
  for (let index = 0; index < candidates.length; index += 1) {
    draw -= weights[index]
    if (draw <= 0) return candidates[index]
  }
  return candidates[candidates.length - 1]
}

export function spotlightCycle(pool: SpotlightEntry[], seen: readonly string[], current?: SpotlightEntry) {
  const cycle: SpotlightEntry[] = current ? [current] : []
  let remaining = current ? pool.filter(({ card }) => card.id !== current.card.id) : pool
  while (remaining.length && cycle.length < 20) {
    const next = pickNext(remaining, { current: cycle[cycle.length - 1], seen })!
    cycle.push(next)
    remaining = remaining.filter(({ card }) => card.id !== next.card.id)
  }
  return cycle
}

/** The same country's previous round, when the export holds a brief for it. */
export function previousRound(pool: SpotlightEntry[], brief: SpotlightBrief): SpotlightEntry | undefined {
  const round = Math.min(...brief.rounds)
  const earlier = pool
    .filter((entry) => entry.brief.iso3 === brief.iso3 && Math.max(...entry.brief.rounds) < round)
    .sort((a, b) => Math.max(...b.brief.rounds) - Math.max(...a.brief.rounds))
  if (!earlier.length) return undefined
  const latest = earlier.filter((entry) => entry.brief.survey === earlier[0].brief.survey)
  return latest.find((entry) => GRAPHIC.has(entry.card.treatment)) || latest[0]
}

export function roundLabel(brief: SpotlightBrief) {
  const rounds = [...brief.rounds].sort((a, b) => a - b)
  return rounds.length > 1 ? `Rounds ${rounds[0]}–${rounds[rounds.length - 1]}` : `Round ${rounds[0]}`
}

export function releaseMonth(brief: SpotlightBrief) {
  return new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${brief.released}T00:00:00Z`))
}

/** "From the Chad brief, November 2026": shown on every card. */
export function attribution(brief: SpotlightBrief, countryName: string) {
  return `From the ${countryName} brief, ${releaseMonth(brief)}`
}

export function callToAction(brief: SpotlightBrief, countryName: string) {
  const language = LANGUAGE_NAMES[brief.language]
  return `Read the ${countryName} brief${language ? ` (in ${language})` : ''}`
}

export function mentionsAghin(card: SpotlightCard) {
  return /\bAgHiN\b/.test([card.headline, card.context.population, ...(card.bars || []).map((bar) => bar.label)].join(' '))
}

/** Months lit on the twelve-month track; a window may run over the year end. */
export function monthsInWindow(start: number, end: number) {
  const months: number[] = []
  for (let month = start; ; month = (month % 12) + 1) {
    months.push(month)
    if (month === end || months.length === 12) break
  }
  return months
}

export function readHistory(storage: Pick<Storage, 'getItem'> | undefined): string[] {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string').slice(-HISTORY_LIMIT) : []
  } catch {
    return []
  }
}

export function rememberCard(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, id: string) {
  const history = [...readHistory(storage).filter((seen) => seen !== id), id].slice(-HISTORY_LIMIT)
  try {
    storage?.setItem(HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Private windows and blocked storage: the spotlight simply repeats sooner.
  }
  return history
}

type SpotlightEvent = 'brief_spotlight_impression' | 'brief_spotlight_click'

/**
 * Reports to the Google Analytics tag the Hub already loads. The outcome that
 * matters is clicks to the brief per card shown; nothing about the visitor is sent.
 */
export function trackSpotlight(event: SpotlightEvent, entry: SpotlightEntry) {
  const gtag = (globalThis as { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag !== 'function') return
  gtag('event', event, {
    card_id: entry.card.id,
    survey: entry.card.survey,
    chapter: entry.card.chapter,
    treatment: entry.card.treatment,
  })
}
