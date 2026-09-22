import { HUB_ORIGIN } from '../lib/hubOrigin'
import {
  BROWSER_EXPORT_LIMIT,
  fetchLayerRows,
  rowsToCsv,
  usableFields,
  type FeatureLayerInfo,
} from './dataExplorer'
import { formatNumber } from '../lib/format'
import {
  ANALYSIS_TOOLS,
  DOCUMENTATION_RESOURCES,
  GENERATIONS,
  REFERENCE_RESOURCES,
  resourceLink,
  type ProtectedRequester,
} from './protectedData'
import { surveySliceWhere, type AvailableSurvey, type SurveyThemeSource } from './surveyAccess'
import { fetchSurveyCollectionPeriods, type SurveyCollectionPeriod } from './monitoring'

/**
 * The most one browser-built package may hold.
 *
 * Measured, not guessed: the authenticated probe (`docs/data_access_restructure.md`
 * section 4) found the largest thematic table holds 2 698 rows across *every*
 * survey, so a single survey's slice is tens to low hundreds of rows. These
 * ceilings therefore sit well above any real selection while still bounding
 * memory and time - they exist to stop a pathological case, not ordinary use.
 * Contributors get a larger budget, never an unlimited one: an unbounded browser
 * operation runs out of memory or dies mid-download, and anything bigger belongs
 * to the generated scripts or the planned export service.
 *
 * Data-file and source-slice ceilings are separate: a combined CSV can contain
 * many survey/theme slices, each of which still needs a count and row query.
 */
export const PACKAGE_BUDGETS = {
  member: { records: 50_000, dataFiles: 60, sourceSlices: 60 },
  contributor: { records: 200_000, dataFiles: 250, sourceSlices: 250 },
} as const

export type PackageBudget = { records: number; dataFiles: number; sourceSlices?: number }
export type BundleLayout = 'per-survey' | 'combined-by-source'

/** Why a package cannot be built as selected, in words a user can act on; undefined when it can. */
export function packageBudgetProblem(recordCount: number, dataFileCount: number, budget: PackageBudget, sourceSliceCount = dataFileCount) {
  if (dataFileCount > budget.dataFiles) {
    return `This package would hold ${formatNumber(dataFileCount)} data files; one package can hold ${formatNumber(budget.dataFiles)}. Remove some surveys or themes and build a second package.`
  }
  if (sourceSliceCount > (budget.sourceSlices ?? budget.dataFiles)) {
    return `This package would read ${formatNumber(sourceSliceCount)} survey and theme combinations; one package can read ${formatNumber(budget.sourceSlices ?? budget.dataFiles)}. Remove some surveys or themes and build a second package.`
  }
  if (recordCount > budget.records) {
    return `This package would hold ${formatNumber(recordCount)} records; one package can hold ${formatNumber(budget.records)}. Remove some surveys or themes, or use the generated Python or R script for larger extractions.`
  }
  return undefined
}

/**
 * Bundle contract, per `docs/data_access_restructure.md` section 11.
 *
 * One archive with folders, never nested zips. The manifest identifies the
 * selected layout so readers can handle either archive shape.
 */
export const AGGREGATED_LICENCE = `DIEM aggregated survey data

Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
https://creativecommons.org/licenses/by/4.0/legalcode.en

Also subject to the FAO Statistical Database Terms of Use
https://www.fao.org/contact-us/terms/db-terms-of-use/en

Required citation
Source of data: FAO. [year]. [Country]: DIEM-Monitoring assessments results
([month and year]). In: FAO Data in Emergencies Hub. Rome. [date accessed].
${HUB_ORIGIN}

Household-level microdata is NOT covered by this licence. It is released under
separate and stricter conditions and is not included in this package.
`

export type BundleStage =
  | 'preparing'
  | 'reading-schema'
  | 'counting'
  | 'downloading'
  | 'metadata'
  | 'compressing'
  | 'ready'

export interface BundleProgress {
  stage: BundleStage
  completed: number
  total: number
  /** The file being worked on, for a progress line a user can read. */
  label?: string
}

export interface BundleSlice {
  survey: AvailableSurvey
  theme: SurveyThemeSource
}

export interface BundleOptions {
  slices: BundleSlice[]
  layout?: BundleLayout
  /** Combinations the review named as omitted, carried into the archive. */
  omitted?: Array<{ surveyKey: string; themeLabel: string; reason: string }>
  requester: ProtectedRequester
  /** Enforced again here after the build's own counts, not only in the UI. */
  budget: PackageBudget
  onProgress?: (progress: BundleProgress) => void
  signal?: AbortSignal
  /** Injected in tests; the real archive is compressed in a dedicated worker. */
  zip?: (files: Record<string, Uint8Array>, signal?: AbortSignal) => Promise<Uint8Array>
  /** Injected in tests; the real lookup reads the public survey register. */
  collectionPeriods?: typeof fetchSurveyCollectionPeriods
  now?: () => Date
}

export interface BundleResult {
  fileName: string
  blob: Blob
  fileCount: number
  recordCount: number
}

class BundleCancelled extends Error {
  constructor() {
    super('The package was cancelled.')
    this.name = 'BundleCancelled'
  }
}

export function isBundleCancelled(error: unknown) {
  return error instanceof Error && error.name === 'BundleCancelled'
}

/**
 * Compresses in a dedicated worker, which Cancel terminates outright.
 *
 * Not fflate's asynchronous `zip`: despite its callback shape it compresses any
 * file under 160 000 bytes synchronously on the calling thread, which is nearly
 * every survey CSV, so the page froze and an abort could not even be heard until
 * compression had finished. The worker, and fflate inside it, load only when a
 * package is actually built.
 */
function compressInWorker(files: Record<string, Uint8Array>, signal?: AbortSignal) {
  ensureLive(signal)
  const worker = new Worker(new URL('./bundleCompression.worker.ts', import.meta.url), { type: 'module' })
  return new Promise<Uint8Array>((resolve, reject) => {
    const finish = () => {
      worker.terminate()
      signal?.removeEventListener('abort', onAbort)
    }
    const onAbort = () => {
      finish()
      reject(new BundleCancelled())
    }
    worker.onmessage = (event: MessageEvent<{ archive?: Uint8Array; error?: string }>) => {
      finish()
      if (event.data.archive) resolve(event.data.archive)
      else reject(new Error(event.data.error || 'The package could not be compressed.'))
    }
    worker.onerror = (event) => {
      finish()
      reject(new Error(event.message || 'The package could not be compressed.'))
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    // Transferred, not copied: the page does not need these buffers again.
    const buffers = new Set(Object.values(files).map((file) => file.buffer as ArrayBuffer))
    worker.postMessage(files, Array.from(buffers))
  })
}

/**
 * The archive's name. Shared by the review step and the builder, so the name a
 * user is shown before downloading is provably the name of the file they get.
 */
export function bundleFileName(testData: boolean, date: Date) {
  return `${testData ? 'TEST_DATA_' : ''}DIEM_aggregated_${isoDate(date)}.zip`
}

/** `NGA_R08_v2`, with the generation in the name so unzipped files cannot be confused. */
export function surveyFolderName(survey: AvailableSurvey) {
  const round = String(Math.trunc(survey.round)).padStart(2, '0')
  const base = `${survey.adm0Iso3}_R${round}_${survey.generation}`
  return survey.testData ? `TEST_DATA_${base}` : base
}

function safeName(value: string) {
  return value.normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

/** The exact source contract required for rows to share a CSV. */
export function bundleSourceKey(theme: SurveyThemeSource) {
  return JSON.stringify([
    theme.generation, theme.resourceId, theme.layerId, theme.layerUrl.replace(/\/+$/, ''),
    theme.id, theme.countryField, theme.roundField, theme.visibilityWhere || '', theme.testData,
  ])
}

export function groupBundleSlices(slices: BundleSlice[]): BundleSlice[][] {
  const groups = new Map<string, BundleSlice[]>()
  for (const slice of slices) {
    const key = bundleSourceKey(slice.theme)
    const group = groups.get(key)
    if (group) group.push(slice)
    else groups.set(key, [slice])
  }
  return Array.from(groups.values())
}

export function bundleDataFileCount(slices: BundleSlice[], layout: BundleLayout) {
  return layout === 'combined-by-source' ? groupBundleSlices(slices).length : slices.length
}

export function combinedFileName(theme: SurveyThemeSource) {
  const prefix = theme.testData ? 'TEST_DATA_' : ''
  return `${prefix}${theme.generation}_${safeName(theme.label)}.csv`
}

/** Only sources with the same human filename need a suffix. */
export function combinedFileNames(groups: BundleSlice[][]) {
  const names = new Map<string, string>()
  const used = new Set<string>()
  const baseCounts = new Map<string, number>()
  for (const group of groups) {
    const base = combinedFileName(group[0].theme)
    baseCounts.set(base, (baseCounts.get(base) || 0) + 1)
  }
  for (const group of groups) {
    const theme = group[0].theme
    const key = bundleSourceKey(theme)
    const base = combinedFileName(theme)
    let name = base
    if ((baseCounts.get(base) || 0) > 1 || used.has(name)) {
      const suffix = `${safeName(theme.resourceId).slice(0, 8)}_${theme.layerId}`
      name = base.replace(/\.csv$/, `_${suffix}.csv`)
      let number = 2
      while (used.has(name)) {
        name = base.replace(/\.csv$/, `_${suffix}_${number}.csv`)
        number += 1
      }
    }
    names.set(key, name)
    used.add(name)
  }
  return names
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10)
}

function encode(text: string) {
  return new TextEncoder().encode(text)
}

function ensureLive(signal?: AbortSignal) {
  if (signal?.aborted) throw new BundleCancelled()
}


/**
 * One plain-text file per survey with every link a reader needs to interpret
 * its CSVs: the generation and why generations differ, that generation's
 * aggregated field descriptions and metadata, the reference boundaries the ADM
 * codes join to, the API and analysis tools, and the exact source services.
 *
 * Items are linked, not embedded: several live on another portal the browser
 * cannot read, and some need a signed-in session to open. This replaces the
 * per-file field lists, which repeated the raw layer schema without explaining it.
 */
function documentationForGeneration(generationId: AvailableSurvey['generation'], title: string, themes: SurveyThemeSource[]) {
  const generation = GENERATIONS[generationId]
  // Aggregated documentation only, and fail closed: a document nobody has
  // labelled is left out rather than risk pointing at a microdata codebook for
  // fields this package does not contain.
  const documents = DOCUMENTATION_RESOURCES.filter((resource) => (
    resource.version === generationId
    && (resource.audience === 'aggregate' || resource.audience === 'both')
  ))
  const lines = [
    title,
    '='.repeat(title.length),
    '',
    'Questionnaire generation',
    '------------------------',
    `${generation.label} - ${generation.name} (${generation.period})`,
    'Each generation has its own fields, codes and data structure. Why, and what',
    'that means for comparing surveys across generations:',
    `${HUB_ORIGIN}/data/guide#generations`,
    generation.comparability,
    '',
    `Aggregated data field descriptions and metadata (${generation.label})`,
    '-'.repeat(`Aggregated data field descriptions and metadata (${generation.label})`.length),
  ]
  if (documents.length) {
    lines.push(
      'What every column in this folder\'s CSVs means. Some open only after signing',
      'in to the DIEM Hub with the account that built this package.',
      '',
      ...documents.map((resource) => `- ${resource.fallbackTitle}: ${resourceLink(resource)}`),
    )
  } else {
    lines.push(
      `No field descriptions or codebook have been published for ${generation.label} yet.`,
      'They are released with the first survey of this generation. Do not use an',
      'earlier generation\'s codebook in their place: the fields and codes differ.',
    )
  }
  lines.push(
    '',
    'Administrative reference boundaries',
    '-----------------------------------',
    'Join geographic fields to these using the official ADM codes.',
    '',
    ...REFERENCE_RESOURCES.map((resource) => `- ${resource.fallbackTitle}: ${resourceLink(resource)}`),
    '',
    'API and analysis tools',
    '----------------------',
    ...ANALYSIS_TOOLS.map((tool) => `- ${tool.title} (${tool.kind}): ${tool.href}\n  ${tool.description}`),
    '',
    'Source services',
    '---------------',
    'The exact layers this folder\'s CSVs were read from. manifest.json records',
    'the filter applied to each, so any table can be reproduced or refreshed.',
    '',
    ...themes.map((theme) => `- ${theme.label}: ${theme.layerUrl}`),
    '',
    'Citation, licences and methodology',
    '----------------------------------',
    `DIEM data access guide: ${HUB_ORIGIN}/data/guide`,
  )
  return `${lines.join('\n')}\n`
}

export function documentationText(survey: AvailableSurvey, themes: SurveyThemeSource[]) {
  return documentationForGeneration(
    survey.generation,
    `Documentation and metadata - ${survey.countryName} (${survey.adm0Iso3}), Round ${survey.round}`,
    themes,
  )
}

function combinedDocumentationText(generationId: AvailableSurvey['generation'], themes: SurveyThemeSource[]) {
  return documentationForGeneration(
    generationId,
    `Documentation and metadata - ${GENERATIONS[generationId].label} combined survey data`,
    Array.from(new Map(themes.map((theme) => [bundleSourceKey(theme), theme])).values()),
  )
}

interface CollectionRecord {
  collection_start: string | null
  collection_end: string | null
  /** Where the dates came from, or why there are none: a blank must never read as an unknown survey. */
  collection_period_source: string
}

const REGISTER_SOURCE = 'DIEM monitoring survey register, matched on country and round'

function collectionRecord(period: SurveyCollectionPeriod | undefined, unavailable?: string): CollectionRecord {
  const day = (value?: number) => (value ? new Date(value).toISOString().slice(0, 10) : null)
  if (period) return { collection_start: day(period.start), collection_end: day(period.end), collection_period_source: REGISTER_SOURCE }
  return {
    collection_start: null,
    collection_end: null,
    collection_period_source: unavailable || 'Not recorded in the DIEM monitoring survey register',
  }
}

function surveyText(survey: AvailableSurvey, themes: SurveyThemeSource[], collection: CollectionRecord) {
  const generation = GENERATIONS[survey.generation]
  const lines = [
    `${survey.countryName} (${survey.adm0Iso3}) - Round ${survey.round}`,
    '',
    `Questionnaire generation: ${generation.label} - ${generation.name} (${generation.period})`,
    collection.collection_start || collection.collection_end
      ? `Data collection: ${collection.collection_start || 'unknown'} to ${collection.collection_end || 'unknown'}`
      : `Data collection: dates unavailable (${collection.collection_period_source})`,
    `Themes in this folder: ${themes.map((theme) => theme.label).join(', ') || 'none'}`,
    '',
    generation.comparability,
  ]
  if (survey.testData) {
    lines.unshift(
      'TEST DATA - NOT SURVEY RESULTS',
      'These records are simulated and were published for infrastructure review.',
      'They must not be cited or reported as evidence.',
      '',
    )
  }
  return `${lines.join('\n')}\n`
}

interface ManifestFile {
  path: string
  survey?: string
  surveys?: Array<{ key: string; adm0_iso3: string; round: number; record_count: number }>
  country?: string
  adm0_iso3?: string
  round?: number
  generation: string
  theme: string
  item_id: string
  layer_id: number
  layer_name: string
  item_modified?: string
  /** Endpoint and parameters are separate: no token-bearing URL is ever written. */
  query_endpoint: string
  query_parameters?: Record<string, string>
  source_queries?: Array<{ survey: string; parameters: Record<string, string> }>
  country_field: string
  round_field: string
  record_count: number
  collection_start?: string | null
  collection_end?: string | null
  test_data: boolean
}

/**
 * Builds the archive.
 *
 * Transactional by design: a failure anywhere throws, and no partial archive is
 * handed back. A user who is told a package is ready must be able to rely on it
 * being complete, and an incomplete extract that looks whole is the one outcome
 * this cannot produce.
 */
/**
 * Builds the archive.
 *
 * An abort that lands inside a request surfaces as whatever the network layer
 * throws; it is reported as the cancellation it is, never as a failure the user
 * has to read and dismiss.
 */
export async function buildSurveyBundle(options: BundleOptions): Promise<BundleResult> {
  try {
    return await assembleSurveyBundle(options)
  } catch (error) {
    if (options.signal?.aborted && !isBundleCancelled(error)) throw new BundleCancelled()
    throw error
  }
}

async function assembleSurveyBundle(options: BundleOptions): Promise<BundleResult> {
  const { slices, requester, onProgress, signal } = options
  const layout = options.layout || 'per-survey'
  const groups = groupBundleSlices(slices)
  const combinedNames = combinedFileNames(groups)
  if (!slices.length) throw new Error('Select at least one survey and thematic area.')
  if (slices.some(({ survey, theme }) => survey.generation !== theme.generation || survey.testData !== theme.testData)) {
    throw new Error('The selected survey and source do not have matching questionnaire generation or test-data status. Refresh the survey list and try again.')
  }
  if (new Set(slices.map(({ survey }) => survey.testData)).size > 1) {
    throw new Error('Test data and survey results cannot be included in the same package.')
  }
  const now = options.now?.() || new Date()
  const accessed = isoDate(now)
  const report = (stage: BundleStage, completed: number, total: number, label?: string) => {
    onProgress?.({ stage, completed, total, label })
  }

  ensureLive(signal)
  report('preparing', 0, slices.length)

  // One schema read per distinct layer, not per slice: the same thematic layer
  // serves every survey drawn from it.
  const layers = new Map<string, FeatureLayerInfo>()
  const layerUrls = Array.from(new Set(slices.map((slice) => slice.theme.layerUrl)))
  report('reading-schema', 0, layerUrls.length)
  for (const [index, layerUrl] of layerUrls.entries()) {
    ensureLive(signal)
    layers.set(layerUrl, await requester<FeatureLayerInfo>(layerUrl, undefined, { signal }))
    report('reading-schema', index + 1, layerUrls.length)
  }

  const files: Record<string, Uint8Array> = {}
  const manifestFiles: ManifestFile[] = []
  let recordCount = 0

  // Counted again here, not trusted from the review step: the data may have
  // changed since, and the budget must hold for what is actually fetched.
  report('counting', 0, slices.length)
  const counts: number[] = []
  for (const [index, { survey, theme }] of slices.entries()) {
    ensureLive(signal)
    const label = `${survey.countryName} · Round ${survey.round} · ${theme.label}`
    const counted = await requester<{ count?: number }>(`${theme.layerUrl}/query`, {
      where: surveySliceWhere(survey, theme),
      returnCountOnly: 'true',
      returnGeometry: 'false',
    }, { signal })
    const count = counted.count || 0
    if (layout === 'per-survey' && count > BROWSER_EXPORT_LIMIT) {
      throw new Error(`${label} holds ${formatNumber(count)} records, more than the ${formatNumber(BROWSER_EXPORT_LIMIT)} a browser download can build. Use the generated Python or R script for this survey instead.`)
    }
    counts.push(count)
    report('counting', index + 1, slices.length, label)
  }
  if (layout === 'combined-by-source') {
    const groupCounts = new Map<string, number>()
    slices.forEach((slice, index) => {
      const key = bundleSourceKey(slice.theme)
      groupCounts.set(key, (groupCounts.get(key) || 0) + counts[index])
    })
    for (const group of groups) {
      const total = groupCounts.get(bundleSourceKey(group[0].theme)) || 0
      if (total > BROWSER_EXPORT_LIMIT) {
        throw new Error(`${group[0].theme.label} (${group[0].theme.generation}) would contain ${formatNumber(total)} records in one CSV, more than the ${formatNumber(BROWSER_EXPORT_LIMIT)} a browser download can build. Use separate survey folders for this selection.`)
      }
    }
  }
  const overBudget = packageBudgetProblem(
    counts.reduce((total, count) => total + count, 0),
    bundleDataFileCount(slices, layout), options.budget, slices.length,
  )
  if (overBudget) throw new Error(overBudget)

  // Enrichment, not a precondition: a register outage leaves the dates blank
  // with the reason written down, rather than failing an otherwise valid package.
  const distinctSurveys = Array.from(new Map(slices.map(({ survey }) => [survey.key, survey])).values())
  let periods = new Map<string, SurveyCollectionPeriod>()
  let periodsUnavailable: string | undefined
  try {
    periods = await (options.collectionPeriods || fetchSurveyCollectionPeriods)(distinctSurveys, signal)
  } catch (error) {
    ensureLive(signal)
    periodsUnavailable = `The DIEM monitoring survey register could not be read when this package was built (${error instanceof Error ? error.message : 'unknown error'})`
  }
  const collectionFor = (survey: AvailableSurvey) => collectionRecord(
    periods.get(`${survey.adm0Iso3}:${Math.trunc(survey.round)}`),
    periodsUnavailable,
  )

  const combinedRows = new Map<string, Record<string, unknown>[]>()
  const combinedEntries = new Map<string, ManifestFile>()
  for (const [index, slice] of slices.entries()) {
    ensureLive(signal)
    const { survey, theme } = slice
    const layer = layers.get(theme.layerUrl)
    if (!layer) throw new Error(`The schema for ${theme.label} could not be read.`)
    const where = surveySliceWhere(survey, theme)
    const label = `${survey.countryName} · Round ${survey.round} · ${theme.label}`
    const count = counts[index]

    report('downloading', index, slices.length, label)
    const columns = usableFields(layer.fields).map((field) => field.name)
    const rows = count ? await fetchLayerRows(theme.layerUrl, layer, where, requester, count, signal) : []
    const folder = surveyFolderName(survey)
    const stem = `${folder}_${safeName(theme.label)}`
    const path = layout === 'per-survey'
      ? `${folder}/data/${stem}.csv`
      : `${theme.testData ? 'TEST_DATA_' : ''}${theme.generation}/data/${combinedNames.get(bundleSourceKey(theme))}`
    recordCount += rows.length

    const queryParameters = { where, outFields: '*', returnGeometry: 'false', f: 'json' }
    if (layout === 'combined-by-source') {
      const key = bundleSourceKey(theme)
      const existingRows = combinedRows.get(key) || []
      existingRows.push(...rows)
      combinedRows.set(key, existingRows)
      const existing = combinedEntries.get(key)
      const contribution = { key: survey.key, adm0_iso3: survey.adm0Iso3, round: survey.round, record_count: rows.length }
      if (existing) {
        existing.surveys!.push(contribution)
        existing.source_queries!.push({ survey: survey.key, parameters: queryParameters })
        existing.record_count += rows.length
      } else {
        const entry: ManifestFile = {
          path, surveys: [contribution], generation: survey.generation, theme: theme.label,
          item_id: theme.resourceId, layer_id: theme.layerId, layer_name: theme.layerName,
          item_modified: theme.itemModified ? new Date(theme.itemModified).toISOString() : undefined,
          query_endpoint: `${theme.layerUrl}/query`,
          source_queries: [{ survey: survey.key, parameters: queryParameters }],
          country_field: theme.countryField, round_field: theme.roundField,
          record_count: rows.length, test_data: theme.testData,
        }
        combinedEntries.set(key, entry)
        manifestFiles.push(entry)
      }
    } else {
      files[path] = encode(rowsToCsv(columns, rows))
      manifestFiles.push({
      path,
      survey: survey.key,
      country: survey.countryName,
      adm0_iso3: survey.adm0Iso3,
      round: survey.round,
      generation: survey.generation,
      theme: theme.label,
      item_id: theme.resourceId,
      layer_id: theme.layerId,
      layer_name: theme.layerName,
      item_modified: theme.itemModified ? new Date(theme.itemModified).toISOString() : undefined,
      query_endpoint: `${theme.layerUrl}/query`,
      query_parameters: queryParameters,
      country_field: theme.countryField,
      round_field: theme.roundField,
      record_count: rows.length,
      collection_start: collectionFor(survey).collection_start,
      collection_end: collectionFor(survey).collection_end,
      test_data: theme.testData,
      })
    }
    report('downloading', index + 1, slices.length, label)
  }

  if (layout === 'combined-by-source') {
    const paths = new Set<string>()
    for (const group of groups) {
      const theme = group[0].theme
      const key = bundleSourceKey(theme)
      const layer = layers.get(theme.layerUrl)!
      const columns = usableFields(layer.fields).map((field) => field.name)
      const entry = combinedEntries.get(key)!
      if (paths.has(entry.path)) throw new Error(`Two data sources would produce the same file name: ${entry.path}`)
      paths.add(entry.path)
      if ((combinedRows.get(key) || []).length > BROWSER_EXPORT_LIMIT) {
        throw new Error(`${theme.label} (${theme.generation}) grew beyond the ${formatNumber(BROWSER_EXPORT_LIMIT)}-record file limit while downloading. Use separate survey folders for this selection.`)
      }
      files[entry.path] = encode(rowsToCsv(columns, combinedRows.get(key) || []))
    }
  }
  const finalBudgetProblem = packageBudgetProblem(recordCount, bundleDataFileCount(slices, layout), options.budget, slices.length)
  if (finalBudgetProblem) throw new Error(finalBudgetProblem)

  ensureLive(signal)
  const bySurvey = new Map<string, { survey: AvailableSurvey; themes: SurveyThemeSource[] }>()
  for (const { survey, theme } of slices) {
    const entry = bySurvey.get(survey.key)
    if (entry) entry.themes.push(theme)
    else bySurvey.set(survey.key, { survey, themes: [theme] })
  }
  const surveyMetadata = Array.from(bySurvey.values()).map(({ survey, themes }) => ({
    key: survey.key,
    country: survey.countryName,
    adm0_iso3: survey.adm0Iso3,
    round: survey.round,
    generation: survey.generation,
    folder: layout === 'per-survey' ? surveyFolderName(survey) : `${survey.testData ? 'TEST_DATA_' : ''}${survey.generation}`,
    ...collectionFor(survey),
    themes: themes.map((theme) => theme.label),
    test_data: survey.testData,
  }))

  if (layout === 'per-survey') {
    report('metadata', 0, bySurvey.size)
    for (const [index, { survey, themes }] of Array.from(bySurvey.values()).entries()) {
      ensureLive(signal)
      const folder = surveyFolderName(survey)
      files[`${folder}/survey.txt`] = encode(surveyText(survey, themes, collectionFor(survey)))
      files[`${folder}/documentation_and_metadata.txt`] = encode(documentationText(survey, themes))
      report('metadata', index + 1, bySurvey.size)
    }
  } else {
    const generations = Array.from(new Set(slices.map(({ survey }) => survey.generation)))
    report('metadata', 0, generations.length)
    for (const [index, generationId] of generations.entries()) {
      ensureLive(signal)
      const generationSlices = slices.filter(({ survey }) => survey.generation === generationId)
      const folder = `${generationSlices[0].survey.testData ? 'TEST_DATA_' : ''}${generationId}`
      const members = surveyMetadata.filter((survey) => survey.generation === generationId)
      const header = ['survey_key', 'adm0_iso3', 'country', 'round', 'generation', 'collection_start', 'collection_end', 'collection_period_source', 'themes', 'test_data']
      const data = members.map((survey) => ({
        survey_key: survey.key, adm0_iso3: survey.adm0_iso3, country: survey.country,
        round: survey.round, generation: survey.generation,
        collection_start: survey.collection_start, collection_end: survey.collection_end,
        collection_period_source: survey.collection_period_source,
        themes: survey.themes.join('; '), test_data: survey.test_data,
      }))
      files[`${folder}/surveys.csv`] = encode(rowsToCsv(header, data))
      files[`${folder}/documentation_and_metadata.txt`] = encode(combinedDocumentationText(generationId, generationSlices.map(({ theme }) => theme)))
      report('metadata', index + 1, generations.length)
    }
  }

  const testData = slices.some((slice) => slice.survey.testData)
  const manifest = {
    package_schema_version: 2,
    layout,
    generated: now.toISOString(),
    accessed,
    /*
     * No account name. It would add a privacy exposure to a file that gets
     * forwarded, and reproducing the extract needs the query, not the person.
     */
    hub: HUB_ORIGIN,
    licence: 'CC BY 4.0 with the FAO Statistical Database Terms of Use',
    test_data: testData,
    surveys: surveyMetadata,
    files: manifestFiles,
    not_included: options.omitted || [],
  }
  files['manifest.json'] = encode(`${JSON.stringify(manifest, null, 2)}\n`)
  files['LICENCE.txt'] = encode(AGGREGATED_LICENCE)
  files['README.txt'] = encode(readmeText(manifest, recordCount))

  ensureLive(signal)
  report('compressing', 0, 1)
  const compress = options.zip || compressInWorker
  const archive = await compress(files, signal)
  ensureLive(signal)
  report('ready', 1, 1)

  const fileName = bundleFileName(testData, now)
  return {
    fileName,
    blob: new Blob([archive as BlobPart], { type: 'application/zip' }),
    fileCount: Object.keys(files).length,
    recordCount,
  }
}

type BundleManifest = {
  package_schema_version: number
  layout: BundleLayout
  generated: string
  accessed: string
  test_data: boolean
  surveys: Array<{ country: string; round: number; generation: string; folder: string; themes: string[] }>
  files: ManifestFile[]
  not_included: Array<{ surveyKey: string; themeLabel: string; reason: string }>
}

/** The human counterpart of the manifest, including what is deliberately absent. */
export function readmeText(manifest: BundleManifest, recordCount: number) {
  const lines = [
    'DIEM aggregated survey data',
    '===========================',
    '',
    `Generated: ${manifest.generated}`,
    `Data accessed: ${manifest.accessed}`,
    `Surveys: ${manifest.surveys.length}`,
    `Data files: ${manifest.files.length}`,
    `Records: ${formatNumber(recordCount)}`,
    '',
  ]

  if (manifest.test_data) {
    lines.push(
      'WARNING - THIS PACKAGE CONTAINS TEST DATA',
      'The records are simulated and were published for infrastructure review.',
      'They are not survey results and must not be cited.',
      '',
    )
  }

  lines.push('Contents', '--------')
  if (manifest.layout === 'per-survey') {
    for (const survey of manifest.surveys) {
      lines.push(`${survey.folder}/`)
      lines.push(`  ${survey.country}, Round ${survey.round} (${survey.generation})`)
      lines.push(`  Themes: ${survey.themes.join(', ')}`)
      lines.push('  data/     one CSV per theme, filtered to this survey')
      lines.push('  documentation_and_metadata.txt  field descriptions, metadata, boundaries, tools and source links')
      lines.push('')
    }
  } else {
    lines.push('Surveys share a CSV only when they use the same questionnaire generation and source layer.')
    lines.push('Use the country and round columns to identify rows from each survey.', '')
    for (const folder of new Set(manifest.surveys.map((survey) => survey.folder))) {
      lines.push(`${folder}/`, '  surveys.csv  survey identities, collection periods and included themes',
        '  documentation_and_metadata.txt  field descriptions and source links')
      for (const file of manifest.files.filter((entry) => entry.path.startsWith(`${folder}/`))) {
        lines.push(`  ${file.path.slice(folder.length + 1)}: ${formatNumber(file.record_count)} records`)
        for (const survey of file.surveys || []) {
          lines.push(`    ${survey.key}: ${formatNumber(survey.record_count)} records`)
        }
      }
      lines.push('')
    }
  }

  lines.push(
    'Every file records its exact source service, layer and filter in',
    'manifest.json, so any table here can be reproduced or refreshed.',
    '',
  )

  lines.push('Not included', '------------')
  if (manifest.not_included.length) {
    lines.push('These survey and theme combinations were requested but are absent:')
    for (const entry of manifest.not_included) {
      lines.push(`- ${entry.surveyKey} - ${entry.themeLabel}: ${entry.reason}`)
    }
    lines.push(
      '',
      '"Not collected for this survey" describes how that survey was run.',
      '"Could not be retrieved" is a failure that may clear on a later attempt.',
    )
  } else {
    lines.push('Nothing was omitted: every requested survey and theme is present.')
  }
  lines.push('', 'Licence and citation: see LICENCE.txt', '')

  return lines.join('\n')
}
