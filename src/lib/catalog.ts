import type { ArcGISItem } from '../types'

const themeMatchers: Array<[string, RegExp]> = [
  ['Monitoring', /country brief|household survey|diem charts|findings presentation|monitoring/i],
  ['Impact', /impact assessment|impact assesment/i],
  ['Early warning', /diem eve|early warning|eve biweekly/i],
  ['Stories', /storymap|story map/i],
  ['Agriculture', /crop calendar|agricultural calendar|agriculture/i],
]

const genericPrefixes = new Set([
  'cross-country findings',
  'data in emergencies',
  'diem',
  'global',
  'other',
])

export function itemTheme(item: ArcGISItem) {
  const haystack = [item.title, ...(item.tags || [])].join(' ')
  return themeMatchers.find(([, pattern]) => pattern.test(haystack))?.[0] || 'Other'
}

const HAZARD_IMPACT_ASSESSMENT_TAG = 'impact assessment'

/**
 * Web maps, services and images tagged as impact assessments are the layers a
 * product is built from, not the published product itself. Counting them would
 * inflate the headline figure with components a reader never opens.
 */
const SUPPORTING_ITEM_TYPES = new Set([
  'Feature Service',
  'Map Service',
  'Image Service',
  'Web Map',
  'Image',
  'Table',
  'CSV',
  'Service Definition',
  'Code Attachment',
])

/**
 * A published hazard impact assessment. Callers must only pass items that are
 * already known to be in the Hub content group; ArcGIS tag search is stemmed,
 * so `tags:"impact assessment"` also matches variants such as
 * "Rapid Impact Assessment" that exist elsewhere in the organization.
 */
export function isHazardImpactAssessment(item: ArcGISItem) {
  if (SUPPORTING_ITEM_TYPES.has(item.type)) return false
  return (item.tags || []).some((tag) => tag.trim().toLowerCase() === HAZARD_IMPACT_ASSESSMENT_TAG)
}
export function itemCountry(item: ArcGISItem) {
  const prefix = item.title.trim().split(/\s+-\s+/)[0]?.trim()
  if (!prefix || prefix.length > 45 || genericPrefixes.has(prefix.toLowerCase())) return undefined
  return prefix
}

/**
 * The year a product entered the catalogue, taken from `created`.
 *
 * `modified` is the ArcGIS record's last-touched timestamp, not a publication
 * date: the August 2026 category migration rewrote it for most of the group, so
 * a facet built on it would report 2026 for products published years earlier.
 * `created` is untouched by re-tagging and spans 2020 to the present.
 */
export function itemYear(item: ArcGISItem) {
  return new Date(item.created).getUTCFullYear()
}

export function cleanText(value?: string) {
  if (!value) return ''
  const document = new DOMParser().parseFromString(value, 'text/html')
  return document.body.textContent?.replace(/\s+/g, ' ').trim() || ''
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat('en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(timestamp))
}

/**
 * A record summary worth printing.
 *
 * Most ArcGIS snippets restate the title, often with only the country prefix
 * removed ("Mali - DIEM Monitoring Brief - Round 7" / "DIEM Monitoring Brief -
 * Round 7"). Printing both fills a whole column of a card grid with the same
 * words, so a summary that adds nothing is dropped and the caller decides what
 * to say instead.
 */
export function distinctSummary(item: ArcGISItem) {
  const summary = cleanText(item.snippet || item.description)
  if (!summary) return ''
  const fold = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const foldedTitle = fold(item.title)
  const foldedSummary = fold(summary)
  if (!foldedSummary) return ''
  return foldedTitle.includes(foldedSummary) || foldedSummary.includes(foldedTitle) ? '' : summary
}

/**
 * The part of a title that distinguishes one product from its siblings.
 *
 * Series titles differ only by a round or cycle number, so that number is the
 * one token worth showing when a product has no distinguishing thumbnail.
 */
export function itemEdition(item: ArcGISItem) {
  const round = item.title.match(/\b(?:round|cycle|ronde|ciclo)\s*#?\s*(\d+)\b/i)
  if (round) return `Round ${round[1]}`
  const monthYear = item.title.match(/\b(0[1-9]|1[0-2])[\s/-](20\d{2})\b/)
  if (monthYear) return `${monthYear[1]}/${monthYear[2]}`
  const year = item.title.match(/\b(20[1-3]\d)\b/)
  return year ? year[1] : undefined
}

/**
 * The round number a title declares, or undefined when it declares none.
 *
 * Rounds are parsed from titles because the content group holds no round field,
 * so anything built on this must show only what parses and say so: a title
 * written differently is a missing number, not a missing product.
 */
export function itemRound(item: ArcGISItem) {
  const match = item.title.match(/\b(?:round|cycle|ronde|ciclo)\s*#?\s*(\d+)\b/i)
  if (!match) return undefined
  const round = Number(match[1])
  // A three-digit "round" is a period or a typo, never a survey round; DIEM is
  // at round 14 after six years.
  return Number.isFinite(round) && round > 0 && round < 100 ? round : undefined
}
