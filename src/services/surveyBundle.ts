import {
  BROWSER_EXPORT_LIMIT,
  fetchLayerRows,
  rowsToCsv,
  usableFields,
  type FeatureLayerInfo,
} from './dataExplorer'
import { formatNumber } from '../lib/format'
import {
  DATA_PORTAL,
  DOCUMENTATION_RESOURCES,
  GENERATIONS,
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
 * The file ceiling counts *data files* - one CSV per survey and theme, the unit
 * the Download button names. It was once called plain `files` while counting
 * only these, which misdescribed the archive. The archive's full entry count
 * follows from it exactly: three entries per data file (the CSV and its two
 * schema files), two per survey, three at the root - so bounding data files
 * bounds the archive too.
 */
export const PACKAGE_BUDGETS = {
  member: { records: 50_000, dataFiles: 60 },
  contributor: { records: 200_000, dataFiles: 250 },
} as const

export type PackageBudget = { records: number; dataFiles: number }

/** Why a package cannot be built as selected, in words a user can act on; undefined when it can. */
export function packageBudgetProblem(recordCount: number, dataFileCount: number, budget: PackageBudget) {
  if (dataFileCount > budget.dataFiles) {
    return `This package would hold ${formatNumber(dataFileCount)} data files; one package can hold ${formatNumber(budget.dataFiles)}. Remove some surveys or themes and build a second package.`
  }
  if (recordCount > budget.records) {
    return `This package would hold ${formatNumber(recordCount)} records; one package can hold ${formatNumber(budget.records)}. Remove some surveys or themes, or use the generated Python or R script for larger extractions.`
  }
  return undefined
}

/**
 * Bundle contract, per `docs/data_access_restructure.md` section 11.
 *
 * One archive with folders - never nested zips - and the same layout for one
 * survey as for ten, so a script written against one package works against
 * every package.
 */
export const AGGREGATED_LICENCE = `DIEM aggregated survey data

Licence: Creative Commons Attribution 4.0 International (CC BY 4.0)
https://creativecommons.org/licenses/by/4.0/legalcode.en

Also subject to the FAO Statistical Database Terms of Use
https://www.fao.org/contact-us/terms/db-terms-of-use/en

Required citation
Source of data: FAO. [year]. [Country]: DIEM-Monitoring assessments results
([month and year]). In: FAO Data in Emergencies Hub. Rome. [date accessed].
https://data-in-emergencies.fao.org

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
 * The field list, from the authoritative layer definition.
 *
 * Every CSV therefore ships with its exact technical schema even when the
 * published codebook cannot be retrieved, which is the common case today: V3
 * documentation does not exist yet and cross-portal items are not fetchable
 * from the browser.
 */
function fieldsCsv(layer: FeatureLayerInfo) {
  const rows = layer.fields.map((field) => ({
    name: field.name,
    alias: field.alias || field.name,
    type: field.type,
    coded_values: field.domain?.codedValues
      ? field.domain.codedValues.map((value) => `${value.code}=${value.name}`).join(' | ')
      : '',
  }))
  return rowsToCsv(['name', 'alias', 'type', 'coded_values'], rows)
}

function documentationLink(resource: (typeof DOCUMENTATION_RESOURCES)[number]) {
  return resource.staticLink || resource.href || `${DATA_PORTAL}/home/item.html?id=${resource.id}`
}

/**
 * Links to the generation's published documentation, and says plainly when
 * there is none.
 *
 * The items are linked, not embedded: several live on another portal the
 * browser cannot read, and some need a signed-in session to open. The exact
 * technical schema of every file is embedded next door regardless.
 */
function resourcesText(survey: AvailableSurvey, themes: SurveyThemeSource[]) {
  const generation = GENERATIONS[survey.generation]
  // Aggregated documentation only, and fail closed: a document nobody has
  // labelled is left out rather than risk pointing at a microdata codebook for
  // fields this package does not contain.
  const documents = DOCUMENTATION_RESOURCES.filter((resource) => (
    resource.version === survey.generation
    && (resource.audience === 'aggregate' || resource.audience === 'both')
  ))
  const lines = [
    `Documentation for ${generation.label} - ${generation.name}`,
    '',
  ]
  if (documents.length) {
    lines.push(
      'Published field descriptions and codebooks for this generation. Some open',
      'only after signing in to the DIEM Hub with the account that built this package.',
      '',
      ...documents.map((resource) => `- ${resource.fallbackTitle}: ${documentationLink(resource)}`),
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
    'The exact technical schema of every CSV in this folder is included alongside',
    'this file, one *.fields.csv and one *.layer-schema.json per data file.',
    '',
    'Source services:',
    ...themes.map((theme) => `- ${theme.label}: ${theme.layerUrl}`),
    '',
    'DIEM data access guide: https://data-in-emergencies.fao.org/data/guide',
  )
  return `${lines.join('\n')}\n`
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
  survey: string
  country: string
  adm0_iso3: string
  round: number
  generation: string
  theme: string
  item_id: string
  layer_id: number
  layer_name: string
  item_modified?: string
  /** Endpoint and parameters are separate: no token-bearing URL is ever written. */
  query_endpoint: string
  query_parameters: Record<string, string>
  record_count: number
  collection_start: string | null
  collection_end: string | null
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
  if (!slices.length) throw new Error('Select at least one survey and thematic area.')
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
    if (count > BROWSER_EXPORT_LIMIT) {
      throw new Error(`${label} holds ${formatNumber(count)} records, more than the ${formatNumber(BROWSER_EXPORT_LIMIT)} a browser download can build. Use the generated Python or R script for this survey instead.`)
    }
    counts.push(count)
    report('counting', index + 1, slices.length, label)
  }
  const overBudget = packageBudgetProblem(counts.reduce((total, count) => total + count, 0), slices.length, options.budget)
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
    const path = `${folder}/data/${stem}.csv`
    files[path] = encode(rowsToCsv(columns, rows))
    recordCount += rows.length

    // Schema per data file, named after it. Each theme is a different layer
    // with its own fields; one schema per survey would describe only one CSV.
    files[`${folder}/metadata/${stem}.fields.csv`] = encode(fieldsCsv(layer))
    files[`${folder}/metadata/${stem}.layer-schema.json`] = encode(`${JSON.stringify({
      data_file: `data/${stem}.csv`,
      theme: theme.label,
      layer_url: theme.layerUrl,
      name: layer.name,
      objectIdField: layer.objectIdField,
      maxRecordCount: layer.maxRecordCount,
      fields: layer.fields,
    }, null, 2)}\n`)

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
      query_parameters: { where, outFields: '*', returnGeometry: 'false', f: 'json' },
      record_count: rows.length,
      collection_start: collectionFor(survey).collection_start,
      collection_end: collectionFor(survey).collection_end,
      test_data: theme.testData,
    })
    report('downloading', index + 1, slices.length, label)
  }

  ensureLive(signal)
  const bySurvey = new Map<string, { survey: AvailableSurvey; themes: SurveyThemeSource[] }>()
  for (const { survey, theme } of slices) {
    const entry = bySurvey.get(survey.key)
    if (entry) entry.themes.push(theme)
    else bySurvey.set(survey.key, { survey, themes: [theme] })
  }

  report('metadata', 0, bySurvey.size)
  for (const [index, { survey, themes }] of Array.from(bySurvey.values()).entries()) {
    ensureLive(signal)
    const folder = surveyFolderName(survey)
    files[`${folder}/survey.txt`] = encode(surveyText(survey, themes, collectionFor(survey)))
    files[`${folder}/metadata/resources.txt`] = encode(resourcesText(survey, themes))
    report('metadata', index + 1, bySurvey.size)
  }

  const testData = slices.some((slice) => slice.survey.testData)
  const manifest = {
    generated: now.toISOString(),
    accessed,
    /*
     * No account name. It would add a privacy exposure to a file that gets
     * forwarded, and reproducing the extract needs the query, not the person.
     */
    hub: 'https://data-in-emergencies.fao.org',
    licence: 'CC BY 4.0 with the FAO Statistical Database Terms of Use',
    test_data: testData,
    surveys: Array.from(bySurvey.values()).map(({ survey, themes }) => ({
      key: survey.key,
      country: survey.countryName,
      adm0_iso3: survey.adm0Iso3,
      round: survey.round,
      generation: survey.generation,
      folder: surveyFolderName(survey),
      ...collectionFor(survey),
      themes: themes.map((theme) => theme.label),
      test_data: survey.testData,
    })),
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
  for (const survey of manifest.surveys) {
    lines.push(`${survey.folder}/`)
    lines.push(`  ${survey.country}, Round ${survey.round} (${survey.generation})`)
    lines.push(`  Themes: ${survey.themes.join(', ')}`)
    lines.push('  data/     one CSV per theme, filtered to this survey')
    lines.push('  metadata/ field descriptions, the layer schema and source links')
    lines.push('')
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
