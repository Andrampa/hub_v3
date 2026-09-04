import { itemLanguage } from './productFamilies'
import type { CountryResource, EvidencePathway } from '../services/countries'

/**
 * Product citations, following the three DIEM reference forms published in the
 * data access guide. The guide cites the collection; a product page can be more
 * precise, so the product's own title sits in front of the series it belongs to
 * and the link resolves to the product rather than to the Hub's front door.
 *
 * The date in brackets is the access date, which is what "[Cited date]" in the
 * guide asks the reader to replace. It is filled in at render time rather than
 * left as a placeholder, because a placeholder is the part people forget.
 */
export const CITATION_LANGUAGES = ['English', 'Français', 'Español'] as const
export type CitationLanguage = (typeof CITATION_LANGUAGES)[number]

interface SeriesName {
  English: string
  Français: string
  Español: string
}

/**
 * The programme series a product belongs to, named as the guide names it: the
 * English form first, with the translated form in brackets where one is used.
 * Agricultural calendars are produced by the monitoring system, so they cite it.
 */
const SERIES_BY_PATHWAY: Record<EvidencePathway, SeriesName> = {
  'Regular monitoring': {
    English: 'DIEM-Monitoring',
    Français: 'DIEM-Monitoring [DIEM-Suivi]',
    Español: 'DIEM-Monitoring [DIEM-Monitoreo]',
  },
  'Seasonal calendar': {
    English: 'DIEM-Monitoring',
    Français: 'DIEM-Monitoring [DIEM-Suivi]',
    Español: 'DIEM-Monitoring [DIEM-Monitoreo]',
  },
  'Hazard impact': {
    English: 'DIEM-Impact',
    Français: 'DIEM-Impact',
    Español: 'DIEM-Impact [DIEM-Impacto]',
  },
  'Research & analysis': {
    English: 'DIEM-Research and Analysis',
    Français: 'DIEM-Research and Analysis [DIEM-Recherche et analyse]',
    Español: 'DIEM-Research and Analysis [DIEM-Investigación y análisis]',
  },
}

/** Ordered, so a product carrying two pathways cites the one that produced it. */
const PATHWAY_PRIORITY: EvidencePathway[] = [
  'Regular monitoring',
  'Hazard impact',
  'Research & analysis',
  'Seasonal calendar',
]

const PHRASES: Record<CitationLanguage, { in: string; cited: string; city: string; locale: string }> = {
  English: { in: 'In', cited: 'Cited', city: 'Rome', locale: 'en-GB' },
  Français: { in: 'Dans', cited: 'Consulté le', city: 'Rome', locale: 'fr-FR' },
  Español: { in: 'En', cited: 'Consultado el', city: 'Roma', locale: 'es-ES' },
}

export function productUrl(itemId: string) {
  return `https://data-in-emergencies.fao.org/catalog/${itemId}`
}

function seriesFor(item: CountryResource, language: CitationLanguage) {
  const pathway = PATHWAY_PRIORITY.find((candidate) => item.evidencePathways.includes(candidate))
  return pathway ? SERIES_BY_PATHWAY[pathway][language] : undefined
}

function accessDate(language: CitationLanguage, on: Date) {
  const formatted = new Intl.DateTimeFormat(PHRASES[language].locale, {
    day: 'numeric', month: 'long', year: 'numeric',
  }).format(on)
  // Spanish and French style the day-month join differently from English, and
  // Intl already knows how; only the bracketed verb is ours.
  return `${PHRASES[language].cited} ${formatted}`
}

export function citationFor(item: CountryResource, language: CitationLanguage, on = new Date()) {
  const year = new Date(item.created).getUTCFullYear()
  const series = seriesFor(item, language)
  const phrases = PHRASES[language]
  const collection = 'Data in Emergencies (DIEM) Hub'
  const parts = [
    `FAO. ${year}.`,
    `${item.title.trim()}.`,
    `${phrases.in}: ${series ? `${series}. ` : ''}${collection}.`,
    `${phrases.city}.`,
    `[${accessDate(language, on)}].`,
    productUrl(item.id),
  ]
  return parts.join(' ')
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
