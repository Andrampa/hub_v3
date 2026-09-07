import type { ArcGISItem } from '../types'

/*
 * `itemTheme` and `itemCountry` were removed on 2026-09-07. Both guessed a
 * classification from title text - the theme by regex over title and tags, the
 * country from whatever preceded the first dash - and both became unreferenced
 * when the homepage and the catalogue moved onto the publisher-assigned
 * pathway and country categories in the content group. Neither had a caller
 * anywhere in src/.
 *
 * They are not worth reviving. `itemCountry` returned the entire title as a
 * country name whenever the title had no " - " separator, which is 171 of the
 * 900 records currently in the group ("Flooding in Chad, 2023", "EVE 2.0 app"),
 * and a title-guessed theme is exactly the provisional classification
 * AGENTS.md says must not be presented as DIEM taxonomy. Country and product
 * classification belong to `services/countries.ts`, which reads the categories
 * the publisher actually assigned.
 */

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
/**
 * How a DIEM title names a survey round, in every language the group publishes.
 *
 * Spanish `ronda` was missing until 2026-09-07, so the nine Honduras, Colombia
 * and Guatemala reports titled "Informe de seguimiento DIEM - Ronda N" carried
 * no round: no edition badge on the card, and an "unsequenced" row on the
 * country round timeline for all three Spanish-language countries. Add a word
 * here rather than a second regex when a fourth language appears.
 */
const ROUND_IN_TITLE = /\b(?:round|cycle|ronde|ronda|ciclo)\s*#?\s*(\d+)\b/i

export function itemEdition(item: ArcGISItem) {
  const round = item.title.match(ROUND_IN_TITLE)
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
  const match = item.title.match(ROUND_IN_TITLE)
  if (!match) return undefined
  const round = Number(match[1])
  // A three-digit "round" is a period or a typo, never a survey round; DIEM is
  // at round 14 after six years.
  return Number.isFinite(round) && round > 0 && round < 100 ? round : undefined
}
