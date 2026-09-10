import { itemRound } from './catalog'
import { itemLanguage } from './productFamilies'
import type { CountryResource } from '../services/countries'

/**
 * Product citations, in the two forms FAO's publications editor set out:
 *
 * - a fixed publication (a report, brief, spreadsheet, a PDF or a card linking
 *   to one) cites as a publication: `FAO. Year. *Title*. Rome. URL.` No
 *   container, no access date - the thing cited does not change.
 * - a living product (a StoryMap, dashboard, web app or updating service)
 *   cites as a part of the Hub: `FAO. Year. Title. In: *DIEM Hub*. Rome.
 *   [Cited date]. URL.` The access date is there because what the reader saw
 *   can change after that date.
 *
 * The author is always FAO. That is a policy, not a fallback for missing data:
 * individual authors are not recorded in any authoritative ArcGIS field, and an
 * owner username is not a bibliographic author.
 *
 * The year is taken from `created`, the same publication proxy country pages
 * use. It is the upload date, not a publication date, and ArcGIS holds no
 * better one; `modified` would be worse, since metadata edits move it.
 *
 * Everything is built as one structured model. The page renders it with the
 * emphasised part in italics, and the clipboard gets the same text flattened,
 * so the two can never say different things.
 */
export const CITATION_LANGUAGES = ['English', 'Français', 'Español'] as const
export type CitationLanguage = (typeof CITATION_LANGUAGES)[number]

export type CitationForm = 'static' | 'living'

/** A run of citation text, italicised when `emphasis` is set. */
export interface CitationSegment {
  text: string
  emphasis?: boolean
}

export interface CitationModel {
  form: CitationForm
  author: string
  year: number
  title: string
  place: string
  /** Living form only: the localized "In" and the container it introduces. */
  container?: { label: string; name: string }
  /** Living form only: the bracketed access statement, without brackets. */
  accessed?: string
  url: string
}

const AUTHOR = 'FAO'
const CONTAINER = 'DIEM Hub'
const HUB_URL = 'https://data-in-emergencies.fao.org'

const PHRASES: Record<CitationLanguage, {
  in: string; cited: string; placeholder: string; city: string; locale: string
}> = {
  English: { in: 'In:', cited: 'Cited', placeholder: 'date', city: 'Rome', locale: 'en-GB' },
  Français: { in: 'Dans :', cited: 'Consulté le', placeholder: 'date', city: 'Rome', locale: 'fr-FR' },
  Español: { in: 'En:', cited: 'Consultado el', placeholder: 'fecha', city: 'Roma', locale: 'es-ES' },
}

/**
 * ArcGIS item types whose content can change after they are published. Only
 * these cite in the living form; every other type, including ones not seen
 * yet, cites as a fixed publication, which is how almost all FAO products are
 * cited. The split is by item type alone: EVE's app and dashboard are living,
 * its PDF flood reports are publications, with no product-type rule needed.
 */
const LIVING_TYPES = new Set([
  'StoryMap',
  'Dashboard',
  'Web Mapping Application',
  'Web Experience',
  'Hub Page',
  'Web Map',
  'Feature Service',
  'Map Service',
  'Image Service',
])

export function citationForm(item: Pick<CountryResource, 'type'>): CitationForm {
  return LIVING_TYPES.has(item.type) ? 'living' : 'static'
}

export function productUrl(itemId: string) {
  return `${HUB_URL}/catalog/${itemId}`
}

/**
 * The durable address to cite. A DOI or an FAO Open Knowledge handle outlives
 * this catalogue - deprecated items are removed from the content group as the
 * Hub is built - so where a product has one, that is what a reference should
 * carry. Everything else cites its Hub product page, the only stable address it
 * has; a StoryMap's own URL is an application address, not a reference.
 */
const PERSISTENT_HOSTS = [/^https?:\/\/(dx\.)?doi\.org\//i, /^https?:\/\/openknowledge\.fao\.org\//i]

export function citationUrl(item: CountryResource) {
  const url = item.url?.trim()
  return url && PERSISTENT_HOSTS.some((pattern) => pattern.test(url)) ? url : productUrl(item.id)
}

/**
 * The round a citation should state. Taken from the product's own title where
 * it is there, and otherwise from a sibling edition's: a French brief titled
 * without its round is the same round as the English edition it is grouped
 * with, and "DIEM-Monitoring, Niger" without a round describes fourteen
 * documents.
 */
export function citationRound(item: CountryResource, siblings: CountryResource[] = []) {
  return itemRound(item) ?? siblings.map((sibling) => itemRound(sibling)).find(Boolean)
}

/**
 * The title as cited: the published title, with a borrowed round folded into
 * it when the title does not already state one. "Round" stays English in every
 * language, as it is in the titles that do carry it. A trailing full stop is
 * dropped so the citation's own punctuation does not double it.
 */
function effectiveTitle(item: CountryResource, round?: number) {
  const title = item.title.trim().replace(/\.+$/, '')
  return round && !itemRound(item) ? `${title}, Round ${round}` : title
}

function accessStatement(language: CitationLanguage, on?: Date) {
  const phrases = PHRASES[language]
  // Spanish and French style the day-month join differently from English, and
  // Intl already knows how; only the verb is ours. Without a date - a generic
  // example the reader is told to complete - the localized placeholder stays.
  const date = on
    ? new Intl.DateTimeFormat(phrases.locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(on)
    : phrases.placeholder
  return `${phrases.cited} ${date}`
}

export function citationModel(
  item: CountryResource,
  language: CitationLanguage,
  { on = new Date(), round }: { on?: Date; round?: number } = {},
): CitationModel {
  const form = citationForm(item)
  const phrases = PHRASES[language]
  return {
    form,
    author: AUTHOR,
    year: new Date(item.created).getUTCFullYear(),
    title: effectiveTitle(item, round),
    place: phrases.city,
    ...(form === 'living' && {
      container: { label: phrases.in, name: CONTAINER },
      accessed: accessStatement(language, on),
    }),
    url: citationUrl(item),
  }
}

/**
 * The collection the data guide and the data workspace ask people to cite for
 * DIEM data in general. It is the Hub's living monitoring collection, so it
 * takes the living form; its title keeps the translated name in brackets.
 */
const COLLECTION_TITLE: Record<CitationLanguage, string> = {
  English: 'DIEM-Monitoring',
  Français: 'DIEM-Monitoring [DIEM-Suivi]',
  Español: 'DIEM-Monitoring [DIEM-Monitoreo]',
}
const COLLECTION_YEAR = 2026

/** Without `on`, the access date is the placeholder the reader replaces. */
export function collectionCitationModel(language: CitationLanguage, { on }: { on?: Date } = {}): CitationModel {
  const phrases = PHRASES[language]
  return {
    form: 'living',
    author: AUTHOR,
    year: COLLECTION_YEAR,
    title: COLLECTION_TITLE[language],
    place: phrases.city,
    container: { label: phrases.in, name: CONTAINER },
    accessed: accessStatement(language, on),
    url: HUB_URL,
  }
}

/**
 * The citation as runs of text. Only the title of a fixed publication, or the
 * Hub's name in a living one, is emphasised; the full stop after it is not.
 */
export function citationSegments(model: CitationModel): CitationSegment[] {
  const head = `${model.author}. ${model.year}. `
  if (model.form === 'static' || !model.container) {
    return [
      { text: head },
      { text: model.title, emphasis: true },
      { text: `. ${model.place}. ${model.url}` },
    ]
  }
  return [
    { text: `${head}${model.title}. ${model.container.label} ` },
    { text: model.container.name, emphasis: true },
    { text: `. ${model.place}. ${model.accessed ? `[${model.accessed}]. ` : ''}${model.url}` },
  ]
}

/** Plain text, for the clipboard: the same runs, without the emphasis. */
export function citationText(model: CitationModel) {
  return citationSegments(model).map((segment) => segment.text).join('')
}

export function citationFor(
  item: CountryResource,
  language: CitationLanguage,
  options: { on?: Date; round?: number } = {},
) {
  return citationText(citationModel(item, language, options))
}

/**
 * The citation a reader is offered first: the product's own language when it is
 * one of the three DIEM publishes reference forms for, English otherwise.
 */
export function defaultCitationLanguage(item: CountryResource): CitationLanguage {
  const language = itemLanguage(item)
  if (language === 'French') return 'Français'
  if (language === 'Spanish') return 'Español'
  return 'English'
}
