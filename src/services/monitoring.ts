const MONITORING_STATISTICS_URL = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/monitoring_system_sde_diem_statistics_for_homepage/FeatureServer/0/query'

interface MonitoringStatisticsResponse {
  features?: Array<{
    attributes?: {
      hh_interviewed?: number
      tot_surveys?: number
      survey_date_char?: string
      last_publish_date_text?: string
    }
  }>
  error?: { message?: string }
}

export interface MonitoringStatistics {
  householdsInterviewed: number
  surveys: number
  latestSurveyDate?: string
  lastPublicationDate?: string
}

export async function fetchMonitoringStatistics(signal?: AbortSignal): Promise<MonitoringStatistics> {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: 'hh_interviewed,tot_surveys,survey_date_char,last_publish_date_text',
    returnGeometry: 'false',
  })
  const response = await fetch(`${MONITORING_STATISTICS_URL}?${params}`, { signal })
  if (!response.ok) throw new Error(`Monitoring statistics request failed (${response.status})`)

  const data = await response.json() as MonitoringStatisticsResponse
  if (data.error) throw new Error(data.error.message || 'Monitoring statistics could not be read.')
  const attributes = data.features?.[0]?.attributes
  if (!attributes || !Number.isFinite(attributes.hh_interviewed) || !Number.isFinite(attributes.tot_surveys)) {
    throw new Error('Monitoring statistics are not available in the expected format.')
  }

  return {
    householdsInterviewed: attributes.hh_interviewed!,
    surveys: attributes.tot_surveys!,
    latestSurveyDate: attributes.survey_date_char,
    lastPublicationDate: attributes.last_publish_date_text,
  }
}

export const MONITORING_STATISTICS_SOURCE_URL = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/monitoring_system_sde_diem_statistics_for_homepage/FeatureServer'

/**
 * Countries ever covered by the monitoring system: the number of distinct
 * `admin0_isocode` values in the monitoring configuration table.
 *
 * This is deliberately a constant rather than a live query. The value changes
 * only when the programme starts monitoring a new country, which is rare, and
 * the homepage should not pay for a request on every visit to learn it.
 *
 * This counts countries the *monitoring system* has surveyed. It is a smaller
 * population than the countries with discoverable products in the Hub content
 * group, which the country explorer computes live. The two figures are labelled
 * distinctly on the homepage so they can never read as a contradiction.
 *
 * Verified 28 July 2026 (42 countries). Re-run to confirm:
 *   GET https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/
 *       OER_Monitoring_System_View/FeatureServer/0/query
 *       ?where=1%3D1&outFields=admin0_isocode&returnDistinctValues=true
 *       &returnGeometry=false&f=json
 */
export const MONITORING_COUNTRIES_COVERED = 42

/** Programme start, used to date every cumulative figure on the homepage. */
export const MONITORING_SINCE_LABEL = 'Since June 2020'

const SURVEY_RELEASE_LAYER_URL = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/OER_Monitoring_System_View/FeatureServer/0'
const SURVEY_RELEASE_QUERY_URL = `${SURVEY_RELEASE_LAYER_URL}/query`
const ARCGIS_ITEM_URL = 'https://www.arcgis.com/home/item.html?id='
const PAGE_SIZE = 2000

interface SurveyReleaseAttributes {
  ObjectId?: number
  admin0_isocode?: string
  admin0_name_en?: string
  round?: string
  round_validated?: string
  coll_start_date?: number
  coll_end_date?: number
  staging_date?: number
  validation_date?: number
  survey_outdated?: string
  country_brief_link?: string
  findings_present_link?: string
  questionn_link?: string
  report_link?: string
  charts_link?: string
  shocks_dashboard?: string
  crop_dashboard?: string
  livestock_dashboard?: string
  fsl_dashboard?: string
  needs_dashboard?: string
}

// Legacy per-theme dashboards, keyed by the Monitoring application's theme ids.
// For pre-V2 surveys the application still renders these dashboards, so a theme
// is offered only where the survey row carries one.
const LEGACY_THEME_FIELDS = {
  shocks: 'shocks_dashboard',
  crop: 'crop_dashboard',
  livestock: 'livestock_dashboard',
  food_security: 'fsl_dashboard',
  needs: 'needs_dashboard',
} as const satisfies Record<string, keyof SurveyReleaseAttributes>

interface SurveyReleaseResponse {
  features?: Array<{ attributes?: SurveyReleaseAttributes }>
  exceededTransferLimit?: boolean
  error?: { message?: string }
}

export type SurveyReleaseStatus = 'upcoming' | 'published'

export interface SurveyProduct {
  label: string
  url: string
  /** Stable ArcGIS item identifier when the monitoring table links to one. */
  itemId?: string
}

export interface SurveyRelease {
  id: number
  iso3: string
  country: string
  round: string
  /** Round as the Monitoring application addresses it: "Round 07" becomes "7". */
  roundValue: string
  status: SurveyReleaseStatus
  collectionStart?: number
  collectionEnd?: number
  publicationDate?: number
  expectedPublicationDate?: number
  products: SurveyProduct[]
  /** Monitoring theme ids that this survey carries a legacy dashboard for. */
  legacyThemes: string[]
}

export interface CountryMonitoringRound {
  id: number
  round: string
  roundValue: string
  collectionEnd?: number
  publicationDate?: number
}

export interface CountryMonitoringCoverage {
  iso3: string
  country: string
  rounds: CountryMonitoringRound[]
  latest: CountryMonitoringRound
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function itemUrl(value: unknown) {
  const idOrUrl = text(value)
  if (!idOrUrl) return undefined
  if (/^https:\/\//i.test(idOrUrl)) return idOrUrl
  return `${ARCGIS_ITEM_URL}${encodeURIComponent(idOrUrl)}`
}

function arcgisItemId(value: unknown) {
  const idOrUrl = text(value)
  const match = idOrUrl.match(/(?:\bid=|\/datasets\/|\/items\/)?([a-f0-9]{32})(?:\b|\/)/i)
  return match?.[1]?.toLowerCase()
}

function countryBriefUrl(value: unknown) {
  const idOrUrl = text(value)
  if (!idOrUrl) return undefined
  if (/^https:\/\//i.test(idOrUrl)) return idOrUrl
  return `https://data-in-emergencies.fao.org/datasets/${encodeURIComponent(idOrUrl)}/explore`
}

// Only the Monitoring application may host a dashboard link, so an unexpected
// host is dropped rather than rendered.
function legacyThemes(attributes: SurveyReleaseAttributes) {
  return Object.entries(LEGACY_THEME_FIELDS).flatMap(([theme, field]) => {
    try {
      const url = new URL(text(attributes[field]))
      const trusted = url.protocol === 'https:' && url.hostname.toLowerCase() === 'hqfao.maps.arcgis.com'
      return trusted ? [theme] : []
    } catch {
      return []
    }
  })
}

function surveyProducts(attributes: SurveyReleaseAttributes): SurveyProduct[] {
  const candidates: Array<[string, unknown, string | undefined]> = [
    ['Country brief', attributes.country_brief_link, countryBriefUrl(attributes.country_brief_link)],
    ['Findings', attributes.findings_present_link, itemUrl(attributes.findings_present_link)],
    ['Questionnaire', attributes.questionn_link, itemUrl(attributes.questionn_link)],
    ['Report', attributes.report_link, itemUrl(attributes.report_link)],
    ['Interactive charts', attributes.charts_link, itemUrl(attributes.charts_link)],
  ]
  return candidates.flatMap(([label, source, url]) => url ? [{
    label,
    url,
    itemId: arcgisItemId(source) || arcgisItemId(url),
  }] : [])
}

function excludedRound(round: string) {
  return round === 'Round 98' || round === 'Round 99'
}

function normalizeSurvey(
  attributes: SurveyReleaseAttributes,
  includeUpcomingProducts = false,
): SurveyRelease | undefined {
  const iso3 = text(attributes.admin0_isocode).toUpperCase()
  const country = text(attributes.admin0_name_en)
  const round = text(attributes.round)
  if (!Number.isFinite(attributes.ObjectId) || !iso3 || !country || !round || excludedRound(round)) return undefined

  const validated = text(attributes.round_validated).toLowerCase()
  const outdated = text(attributes.survey_outdated).toLowerCase()
  const publicationDate = Number.isFinite(attributes.validation_date) ? attributes.validation_date : undefined
  const isPublished = validated === 'yes' && Boolean(publicationDate) && country.toLowerCase() !== 'uganda'
  const isUpcoming = validated === 'no' && outdated === 'no' && iso3 !== 'UGA'
  if (!isPublished && !isUpcoming) return undefined

  const stagingDate = Number.isFinite(attributes.staging_date) ? attributes.staging_date : undefined
  return {
    id: attributes.ObjectId!,
    iso3,
    country,
    round,
    roundValue: normalizedRoundValue(round),
    status: isUpcoming ? 'upcoming' : 'published',
    collectionStart: Number.isFinite(attributes.coll_start_date) ? attributes.coll_start_date : undefined,
    collectionEnd: Number.isFinite(attributes.coll_end_date) ? attributes.coll_end_date : undefined,
    publicationDate,
    expectedPublicationDate: isUpcoming && stagingDate ? stagingDate + 28 * 24 * 60 * 60 * 1000 : undefined,
    products: isPublished || includeUpcomingProducts ? surveyProducts(attributes) : [],
    legacyThemes: isPublished ? legacyThemes(attributes) : [],
  }
}

async function fetchSurveyPage(offset: number, signal?: AbortSignal) {
  const params = new URLSearchParams({
    f: 'json',
    where: '1=1',
    outFields: [
      'ObjectId', 'admin0_isocode', 'admin0_name_en', 'round', 'round_validated',
      'coll_start_date', 'coll_end_date', 'staging_date', 'validation_date', 'survey_outdated',
      'country_brief_link', 'findings_present_link', 'questionn_link', 'report_link', 'charts_link',
      ...Object.values(LEGACY_THEME_FIELDS),
    ].join(','),
    returnGeometry: 'false',
    orderByFields: 'ObjectId ASC',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
  })
  const response = await fetch(`${SURVEY_RELEASE_QUERY_URL}?${params}`, { signal })
  if (!response.ok) throw new Error(`Survey schedule request failed (${response.status})`)
  const data = await response.json() as SurveyReleaseResponse
  if (data.error) throw new Error(data.error.message || 'Survey schedule could not be read.')
  return data
}

export async function fetchSurveyReleases(
  signal?: AbortSignal,
  options: { includeUpcomingProducts?: boolean } = {},
): Promise<SurveyRelease[]> {
  const rows: SurveyReleaseAttributes[] = []
  let offset = 0
  while (true) {
    const page = await fetchSurveyPage(offset, signal)
    const pageRows = (page.features || []).flatMap((feature) => feature.attributes ? [feature.attributes] : [])
    rows.push(...pageRows)
    if (!page.exceededTransferLimit || pageRows.length === 0) break
    offset += pageRows.length
  }

  return rows
    .flatMap((attributes) => {
      const survey = normalizeSurvey(attributes, options.includeUpcomingProducts)
      return survey ? [survey] : []
    })
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === 'upcoming' ? -1 : 1
      if (a.status === 'upcoming') return (a.expectedPublicationDate || Number.MAX_SAFE_INTEGER) - (b.expectedPublicationDate || Number.MAX_SAFE_INTEGER)
      return (b.publicationDate || 0) - (a.publicationDate || 0)
    })
}

function normalizedRoundValue(value: string) {
  const match = value.match(/^round\s*0*(\d+)$/i) || value.match(/^0*(\d+)$/)
  return match ? String(Number(match[1])) : value
}

/**
 * Returns only rounds that the Monitoring application exposes to anonymous
 * visitors. The country page intentionally uses a small ISO-filtered request
 * instead of downloading the complete monitoring release catalogue.
 */
export async function fetchCountryMonitoringCoverage(
  iso3: string,
  signal?: AbortSignal,
): Promise<CountryMonitoringCoverage | undefined> {
  const normalizedIso = iso3.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(normalizedIso)) return undefined

  const params = new URLSearchParams({
    f: 'json',
    where: [
      `admin0_isocode = '${normalizedIso}'`,
      `round_validated = 'Yes'`,
      `(survey_outdated IS NULL OR survey_outdated <> 'Yes')`,
    ].join(' AND '),
    outFields: [
      'ObjectId', 'admin0_isocode', 'admin0_name_en', 'round', 'round_validated',
      'coll_end_date', 'validation_date', 'survey_outdated',
    ].join(','),
    returnGeometry: 'false',
    orderByFields: 'validation_date DESC,ObjectId DESC',
    resultRecordCount: '100',
  })
  const response = await fetch(`${SURVEY_RELEASE_QUERY_URL}?${params}`, { signal })
  if (!response.ok) throw new Error(`Country monitoring coverage request failed (${response.status})`)
  const data = await response.json() as SurveyReleaseResponse
  if (data.error) throw new Error(data.error.message || 'Country monitoring coverage could not be read.')

  const visibleRows = (data.features || [])
    .flatMap((feature) => feature.attributes ? [feature.attributes] : [])
    .filter((attributes) => (
      text(attributes.admin0_isocode).toUpperCase() === normalizedIso
      && text(attributes.round_validated).toLowerCase() === 'yes'
      && text(attributes.survey_outdated).toLowerCase() !== 'yes'
      && !excludedRound(text(attributes.round))
    ))

  const seen = new Set<string>()
  const rounds = visibleRows.flatMap((attributes) => {
    const round = text(attributes.round)
    const roundValue = normalizedRoundValue(round)
    if (!Number.isFinite(attributes.ObjectId) || !round || !roundValue || seen.has(roundValue)) return []
    seen.add(roundValue)
    return [{
      id: attributes.ObjectId!,
      round,
      roundValue,
      collectionEnd: Number.isFinite(attributes.coll_end_date) ? attributes.coll_end_date : undefined,
      publicationDate: Number.isFinite(attributes.validation_date) ? attributes.validation_date : undefined,
    }]
  }).sort((a, b) => {
    const dateDifference = (b.publicationDate || 0) - (a.publicationDate || 0)
    if (dateDifference) return dateDifference
    return (Number(b.roundValue) || 0) - (Number(a.roundValue) || 0)
  })

  if (!rounds.length) return undefined
  return {
    iso3: normalizedIso,
    country: text(visibleRows[0]?.admin0_name_en) || normalizedIso,
    rounds,
    latest: rounds[0],
  }
}

/** A per-country register has tens of rows; this only stops a runaway loop. */
const MAX_REGISTER_PAGES = 20

export interface SurveyCollectionPeriod {
  start?: number
  end?: number
}

/**
 * Collection dates for specific surveys, from the public survey register.
 *
 * The aggregate data services carry only country and round, so this is the one
 * place a survey's fieldwork period is recorded. Rounds are numbered per country
 * across the whole programme rather than restarting per questionnaire
 * generation - Nigeria's rounds 1-3 are 2021-22 and 4 onwards 2023 on, with no
 * repeats - so country and round identify one register row. A pair that matches
 * none, or more than one, is left out rather than guessed.
 */
export async function fetchSurveyCollectionPeriods(
  surveys: Array<{ adm0Iso3: string; round: number }>,
  signal?: AbortSignal,
): Promise<Map<string, SurveyCollectionPeriod>> {
  const periods = new Map<string, SurveyCollectionPeriod>()
  const countries = Array.from(new Set(surveys.map((survey) => survey.adm0Iso3.toUpperCase())))
    .filter((iso3) => /^[A-Z]{3}$/.test(iso3))
  if (!countries.length) return periods

  // Paged and ordered, and never cut short quietly. A truncated read would make
  // a survey on a later page look as if the register held no dates for it -
  // a false statement written into the manifest, not merely a missing one.
  const rows: SurveyReleaseAttributes[] = []
  for (let page = 0, offset = 0; ; page += 1) {
    if (page >= MAX_REGISTER_PAGES) throw new Error('The survey register returned more pages than expected and was not read completely.')
    const params = new URLSearchParams({
      f: 'json',
      where: `admin0_isocode IN (${countries.map((iso3) => `'${iso3}'`).join(',')})`,
      outFields: 'ObjectId,admin0_isocode,round,coll_start_date,coll_end_date',
      returnGeometry: 'false',
      orderByFields: 'ObjectId ASC',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    })
    const response = await fetch(`${SURVEY_RELEASE_QUERY_URL}?${params}`, { signal })
    if (!response.ok) throw new Error(`Survey register request failed (${response.status})`)
    const data = await response.json() as SurveyReleaseResponse
    if (data.error) throw new Error(data.error.message || 'The survey register could not be read.')
    const pageRows = (data.features || []).flatMap((feature) => feature.attributes ? [feature.attributes] : [])
    rows.push(...pageRows)
    // A full page means there may be more even without the flag: an explicit
    // record count can suppress `exceededTransferLimit`, the same trap survey
    // discovery guards against. "Full" is PAGE_SIZE because the register's own
    // maxRecordCount is 2 000 (measured 2026-09-21), so it never returns fewer
    // rows than requested unless it has run out.
    if (!data.exceededTransferLimit && pageRows.length < PAGE_SIZE) break
    if (!pageRows.length) throw new Error('The survey register reported more rows but returned none, so it was not read completely.')
    offset += pageRows.length
  }

  const wanted = new Set(surveys.map((survey) => `${survey.adm0Iso3.toUpperCase()}:${Math.trunc(survey.round)}`))
  const matches = new Map<string, SurveyCollectionPeriod[]>()
  for (const attributes of rows) {
    const round = Number(normalizedRoundValue(text(attributes.round)))
    if (!Number.isInteger(round)) continue
    const key = `${text(attributes.admin0_isocode).toUpperCase()}:${round}`
    if (!wanted.has(key)) continue
    const period = {
      start: Number.isFinite(attributes.coll_start_date) ? attributes.coll_start_date : undefined,
      end: Number.isFinite(attributes.coll_end_date) ? attributes.coll_end_date : undefined,
    }
    matches.set(key, [...(matches.get(key) || []), period])
  }
  for (const [key, candidates] of matches) {
    if (candidates.length === 1 && (candidates[0].start || candidates[0].end)) periods.set(key, candidates[0])
  }
  return periods
}

export const SURVEY_RELEASE_SOURCE_URL = SURVEY_RELEASE_LAYER_URL

/**
 * The surveys the register marks `round_validated = Yes`, keyed `ISO3:round`
 * (round as an integer, so "Round 08" and 8 meet). Community members are offered
 * only these surveys in the data workspace; Contributors see every survey.
 *
 * Throws when the register cannot be read: the caller must fail closed rather
 * than treat an unreadable register as "everything is validated".
 */
export async function fetchValidatedSurveyKeys(signal?: AbortSignal): Promise<Set<string>> {
  const keys = new Set<string>()
  let offset = 0
  while (true) {
    const params = new URLSearchParams({
      f: 'json',
      where: `round_validated = 'Yes'`,
      outFields: 'ObjectId,admin0_isocode,round,round_validated',
      returnGeometry: 'false',
      orderByFields: 'ObjectId ASC',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    })
    const response = await fetch(`${SURVEY_RELEASE_QUERY_URL}?${params}`, { signal })
    if (!response.ok) throw new Error(`Survey register request failed (${response.status})`)
    const data = await response.json() as SurveyReleaseResponse
    if (data.error) throw new Error(data.error.message || 'The survey register could not be read.')
    const rows = (data.features || []).flatMap((feature) => feature.attributes ? [feature.attributes] : [])
    for (const attributes of rows) {
      if (text(attributes.round_validated).toLowerCase() !== 'yes') continue
      const iso3 = text(attributes.admin0_isocode).toUpperCase()
      const round = Number(normalizedRoundValue(text(attributes.round)))
      if (/^[A-Z]{3}$/.test(iso3) && Number.isInteger(round)) keys.add(`${iso3}:${round}`)
    }
    if (!data.exceededTransferLimit || rows.length === 0) break
    offset += rows.length
  }
  return keys
}

let validatedSurveyKeys: Promise<Set<string>> | undefined

/** `fetchValidatedSurveyKeys`, read once per session; a failed read is retried next time. */
export function loadValidatedSurveyKeys() {
  validatedSurveyKeys ||= fetchValidatedSurveyKeys().catch((error) => {
    validatedSurveyKeys = undefined
    throw error
  })
  return validatedSurveyKeys
}
