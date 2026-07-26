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

const SURVEY_RELEASE_LAYER_URL = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/OER_Monitoring_System_View/FeatureServer/0'
const SURVEY_RELEASE_QUERY_URL = `${SURVEY_RELEASE_LAYER_URL}/query`
const SURVEY_EXPLORER_URL = 'https://data-in-emergencies-hqfao.hub.arcgis.com/pages/monitoring-country-specific/'
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
}

interface SurveyReleaseResponse {
  features?: Array<{ attributes?: SurveyReleaseAttributes }>
  exceededTransferLimit?: boolean
  error?: { message?: string }
}

export type SurveyReleaseStatus = 'upcoming' | 'published'

export interface SurveyProduct {
  label: string
  url: string
}

export interface SurveyRelease {
  id: number
  iso3: string
  country: string
  round: string
  status: SurveyReleaseStatus
  collectionStart?: number
  collectionEnd?: number
  publicationDate?: number
  expectedPublicationDate?: number
  products: SurveyProduct[]
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

function countryBriefUrl(value: unknown) {
  const idOrUrl = text(value)
  if (!idOrUrl) return undefined
  if (/^https:\/\//i.test(idOrUrl)) return idOrUrl
  return `https://data-in-emergencies.fao.org/datasets/${encodeURIComponent(idOrUrl)}/explore`
}

function explorerUrl(iso3: string) {
  const filter = `dataSource_20-0:admin0_isocode='${iso3}'`
  const query = new URLSearchParams({
    'id:c46alxin9:query:page': 'Indicators',
    'id:c46alxin9:query:data_filter': filter,
  })
  return `${SURVEY_EXPLORER_URL}?${query}`
}

function surveyProducts(attributes: SurveyReleaseAttributes, iso3: string): SurveyProduct[] {
  const candidates: Array<[string, string | undefined]> = [
    ['Explore survey', explorerUrl(iso3)],
    ['Country brief', countryBriefUrl(attributes.country_brief_link)],
    ['Findings', itemUrl(attributes.findings_present_link)],
    ['Questionnaire', itemUrl(attributes.questionn_link)],
    ['Report', itemUrl(attributes.report_link)],
    ['Interactive charts', itemUrl(attributes.charts_link)],
  ]
  return candidates.flatMap(([label, url]) => url ? [{ label, url }] : [])
}

function excludedRound(round: string) {
  return round === 'Round 98' || round === 'Round 99'
}

function normalizeSurvey(attributes: SurveyReleaseAttributes): SurveyRelease | undefined {
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
    status: isUpcoming ? 'upcoming' : 'published',
    collectionStart: Number.isFinite(attributes.coll_start_date) ? attributes.coll_start_date : undefined,
    collectionEnd: Number.isFinite(attributes.coll_end_date) ? attributes.coll_end_date : undefined,
    publicationDate,
    expectedPublicationDate: isUpcoming && stagingDate ? stagingDate + 28 * 24 * 60 * 60 * 1000 : undefined,
    products: isPublished ? surveyProducts(attributes, iso3) : [],
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

export async function fetchSurveyReleases(signal?: AbortSignal): Promise<SurveyRelease[]> {
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
      const survey = normalizeSurvey(attributes)
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

export const SURVEY_RELEASE_SOURCE_URL = SURVEY_RELEASE_LAYER_URL
