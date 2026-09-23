import { HUB_ORIGIN } from '../lib/hubOrigin'
import { microdataLicenceText } from './microdataLicence'
import { formatNumber } from '../lib/format'
import { fetchValidatedSurveyKeys } from './monitoring'
import {
  deepLinkFields, fetchDatasetDefinition, fetchGrantDatasetDefinition,
  csvCell, usableFields, type DatasetDefinition,
} from './dataExplorer'
import { DOCUMENTATION_RESOURCES, GENERATIONS, resourceLink, type ProtectedRequester } from './protectedData'
import { compressInWorker, type BundleProgress } from './surveyBundle'
import { isWithheld, visibilityClause, withVisibility } from './visibility'
import type { MicrodataComponent, MicrodataSurvey, MicrodataSurveyComponent } from './microdataSurveyAccess'

export const MICRODATA_SURVEY_LIMIT = 10

/** Validated against live V2 ten-survey and V3 two-table browser probes on 2026-09-23. */
export const MICRODATA_PACKAGE_BUDGET: MicrodataPackageBudget = {
  records: 50_000,
  uncompressedBytes: 40_000_000,
  dataFiles: 20,
}

/** The builder checks both counted rows and actual encoded bytes before emitting an archive. */
export interface MicrodataPackageBudget {
  records: number
  uncompressedBytes: number
  dataFiles: number
}

export interface MicrodataBundleOptions {
  surveys: MicrodataSurvey[]
  includeV3Optional: boolean
  contributor: boolean
  requester: ProtectedRequester
  budget: MicrodataPackageBudget
  signal?: AbortSignal
  onProgress?: (progress: BundleProgress) => void
  zip?: (files: Record<string, Uint8Array>, signal?: AbortSignal) => Promise<Uint8Array>
  now?: () => Date
  /** Injected for tests; production always re-resolves the current ArcGIS item. */
  resolve?: (component: MicrodataSurveyComponent, requester: ProtectedRequester) => Promise<DatasetDefinition>
}

interface DataFileManifest {
  path: string
  survey_key: string
  generation: string
  component: MicrodataComponent
  authorizing_source: 'master' | 'grant'
  item_id: string
  layer_id: number
  layer_name: string
  item_modified?: string
  query_endpoint: string
  query_parameters: Record<string, string>
  record_count: number
  test_data: boolean
}

interface ResolvedComponent {
  survey: MicrodataSurvey
  component: MicrodataSurveyComponent
  definition: DatasetDefinition
  where: string
  count: number
}

function assertLive(signal?: AbortSignal) {
  if (signal?.aborted) throw new Error('The microdata package was cancelled.')
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function surveyFolder(survey: MicrodataSurvey) {
  return `${survey.testData ? 'TEST_DATA_' : ''}${survey.adm0Iso3}_R${String(survey.round).padStart(2, '0')}_${survey.generation}`
}

function chosenComponents(survey: MicrodataSurvey, includeOptional: boolean) {
  const required = survey.generation === 'v3' ? 'mandatory' : 'household'
  const mandatory = survey.components.find((component) => component.component === required)
  if (!mandatory) throw new Error(`${survey.countryName} round ${survey.round} has no accessible ${required} table.`)
  if (survey.generation !== 'v3' || !includeOptional) return [mandatory]
  const optional = survey.components.find((component) => component.component === 'optional')
  if (!optional) throw new Error(`${survey.countryName} round ${survey.round} has no accessible optional table.`)
  if (optional.source !== mandatory.source
    || (optional.source === 'grant' && optional.grantId !== mandatory.grantId)) {
    throw new Error(`${survey.countryName} round ${survey.round} has no optional table from the same authorized source as its mandatory table.`)
  }
  return [mandatory, optional]
}

async function resolveCurrent(component: MicrodataSurveyComponent, requester: ProtectedRequester) {
  return component.source === 'grant'
    ? fetchGrantDatasetDefinition(component.itemId, requester)
    : fetchDatasetDefinition(component.itemId, requester)
}

function componentWhere(survey: MicrodataSurvey, definition: DatasetDefinition, contributor: boolean) {
  const fields = deepLinkFields(definition.layer.fields)
  if (!fields.country || !/iso3/i.test(fields.country.name) || !fields.round) {
    throw new Error('The household table no longer exposes its country code and round fields.')
  }
  const visibility = visibilityClause(definition.layer, contributor, 'microdata', definition.resource.releaseFiltered)
  if (isWithheld(visibility)) throw new Error('This household table has no release flag, so it is available to Contributors only.')
  const where = withVisibility(
    `${fields.country.name} = '${survey.adm0Iso3.replaceAll("'", "''")}' AND ${fields.round.name} = ${survey.round}`,
    visibility,
  )
  return { where, countryField: fields.country.name, roundField: fields.round.name }
}

function validateResolvedSource(survey: MicrodataSurvey, component: MicrodataSurveyComponent, definition: DatasetDefinition) {
  if (definition.resource.id !== component.itemId || definition.resource.version !== survey.generation) {
    throw new Error(`${survey.countryName} round ${survey.round} changed source or questionnaire version. Refresh access and try again.`)
  }
  if (component.source === 'grant') {
    const grant = definition.grant
    if (!grant || !grant.bulkExportEnabled) throw new Error('Bulk export is not enabled for this grant.')
    if (grant.grantId !== component.grantId) throw new Error('This grant changed. Refresh access and try again.')
    if (!grant.surveyScope.some((scope) => scope.adm0_iso3 === survey.adm0Iso3 && scope.round === survey.round)) {
      throw new Error(`${survey.countryName} round ${survey.round} is no longer in this grant.`)
    }
    const expected = component.component === 'household' ? 'legacy'
      : component.component === 'mandatory' ? 'core' : 'optional'
    if (grant.component !== expected) throw new Error('The grant component changed. Refresh access and try again.')
  }
}

function documentationText(survey: MicrodataSurvey, included: MicrodataComponent[]) {
  const generation = GENERATIONS[survey.generation]
  const documents = DOCUMENTATION_RESOURCES.filter((resource) => (
    resource.version === survey.generation && (resource.audience === 'microdata' || resource.audience === 'both')
  ))
  const lines = [
    `Household microdata documentation — ${survey.countryName}, round ${survey.round}`,
    `Questionnaire: ${generation.label} (${generation.name})`,
    `Included tables: ${included.join(', ')}`,
    '',
    'Field descriptions and codebook',
  ]
  if (documents.length) {
    lines.push(...documents.map((resource) => `- ${resource.fallbackTitle}: ${resourceLink(resource)}`))
  } else {
    lines.push(`No field descriptions or codebook have been published for ${generation.label} yet.`,
      'Do not use an earlier generation\'s codebook in their place.')
  }
  if (survey.generation === 'v3') {
    lines.push('', 'V3 mandatory and optional tables are separate. To combine them for analysis,',
      'join on survey_id + hh_id. Optional questions were not asked in every survey;',
      'an absent optional row is not the same as a household non-response.')
  }
  lines.push('', `Data access guide: ${HUB_ORIGIN}/data/guide`)
  return `${lines.join('\n')}\n`
}

/** A live, authorization-aware count; no household rows are retained. */
export async function preflightMicrodataPackage(options: Omit<MicrodataBundleOptions, 'budget'> & { budget?: MicrodataPackageBudget }) {
  const { surveys, requester, signal, onProgress } = options
  if (!surveys.length) throw new Error('Select at least one microdata survey.')
  if (surveys.length > MICRODATA_SURVEY_LIMIT || new Set(surveys.map((survey) => survey.key)).size !== surveys.length) {
    throw new Error(`Select no more than ${MICRODATA_SURVEY_LIMIT} distinct surveys in one microdata package.`)
  }
  if (new Set(surveys.map((survey) => survey.testData)).size > 1) {
    throw new Error('Test data and production microdata cannot share one package.')
  }
  if (surveys.some((survey) => survey.testData && !options.contributor)) {
    throw new Error('V3 test microdata is available to Contributors only.')
  }
  if (surveys.some((survey) => survey.generation === 'v3' && !survey.testData)
    && !DOCUMENTATION_RESOURCES.some((resource) => resource.version === 'v3' && (resource.audience === 'microdata' || resource.audience === 'both'))) {
    throw new Error('V3 production microdata requires its own field descriptions and codebook before packaging.')
  }
  const chosen = surveys.flatMap((survey) => chosenComponents(survey, options.includeV3Optional)
    .map((component) => ({ survey, component })))
  if (options.budget && chosen.length > options.budget.dataFiles) throw new Error(`This selection exceeds the ${options.budget.dataFiles}-file package limit.`)

  if (!options.contributor) {
    const validated = await fetchValidatedSurveyKeys().catch(() => null)
    if (!validated) throw new Error('The survey register could not be checked. No package was created.')
    if (surveys.some((survey) => !validated.has(`${survey.adm0Iso3}:${survey.round}`))) {
      throw new Error('A selected survey is no longer validated for release. Refresh your selection and try again.')
    }
  }

  const resolved: ResolvedComponent[] = []
  let recordCount = 0
  for (const [index, { survey, component }] of chosen.entries()) {
    assertLive(signal)
    onProgress?.({ stage: 'reading-schema', completed: index, total: chosen.length,
      label: `${survey.countryName} round ${survey.round}` })
    const definition = await (options.resolve || resolveCurrent)(component, requester)
    validateResolvedSource(survey, component, definition)
    const { where } = componentWhere(survey, definition, options.contributor)
    const countResponse = await requester<{ count?: number }>(`${definition.layerUrl}/query`, {
      where, returnCountOnly: 'true', returnGeometry: 'false',
    }, { signal })
    const count = countResponse.count || 0
    recordCount += count
    if (options.budget && recordCount > options.budget.records) {
      throw new Error(`This package would hold ${formatNumber(recordCount)} records, above its measured ${formatNumber(options.budget.records)}-record limit.`)
    }
    resolved.push({ survey, component, definition, where, count })
    onProgress?.({ stage: 'counting', completed: index + 1, total: chosen.length })
  }
  return { resolved, recordCount, dataFileCount: chosen.length }
}

/** Encode bounded pages so a full household table is never materialized as one row array. */
async function fetchBoundedCsv(
  definition: DatasetDefinition, where: string, columns: string[], expectedCount: number,
  requester: ProtectedRequester, remainingBytes: number, signal?: AbortSignal,
) {
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = [encoder.encode(`\uFEFF${columns.join(',')}`)]
  let bytes = chunks[0].byteLength
  if (bytes > remainingBytes) throw new Error('This package exceeds its measured browser-memory budget. Select fewer surveys.')
  const pageSize = Math.min(definition.layer.maxRecordCount || 100, 100)
  let offset = 0
  while (offset < expectedCount) {
    assertLive(signal)
    const requested = Math.min(pageSize, expectedCount - offset)
    const response = await requester<{ features?: Array<{ attributes: Record<string, unknown> }> }>(
      `${definition.layerUrl}/query`, {
        where, outFields: '*', returnGeometry: 'false',
        resultOffset: String(offset), resultRecordCount: String(requested),
        orderByFields: definition.layer.objectIdField ? `${definition.layer.objectIdField} ASC` : undefined,
      }, { signal },
    )
    const rows = response.features || []
    if (!rows.length || rows.length > requested) throw new Error('The household service returned an incomplete or invalid page. No package was created.')
    const chunk = encoder.encode(`\r\n${rows.map(({ attributes }) => columns.map((column) => csvCell(attributes[column])).join(',')).join('\r\n')}`)
    bytes += chunk.byteLength
    if (bytes > remainingBytes) throw new Error('This package exceeds its measured browser-memory budget. Select fewer surveys.')
    chunks.push(chunk)
    offset += rows.length
  }
  const csv = new Uint8Array(bytes)
  let cursor = 0
  for (const chunk of chunks) { csv.set(chunk, cursor); cursor += chunk.byteLength }
  return { csv, rowCount: offset }
}

/** Revalidates, counts, downloads and compresses atomically. No partial package is returned. */
export async function buildMicrodataBundle(options: MicrodataBundleOptions) {
  const { surveys, requester, budget, signal, onProgress } = options
  const { resolved, recordCount } = await preflightMicrodataPackage(options)

  const now = options.now?.() || new Date()
  const files: Record<string, Uint8Array> = {}
  const manifestFiles: DataFileManifest[] = []
  const encode = (value: string) => new TextEncoder().encode(value)
  let uncompressedBytes = 0
  for (const [index, entry] of resolved.entries()) {
    assertLive(signal)
    const { survey, component, definition, where, count } = entry
    const columns = usableFields(definition.layer.fields).map((field) => field.name)
    const { csv, rowCount } = await fetchBoundedCsv(definition, where, columns, count,
      requester, budget.uncompressedBytes - uncompressedBytes, signal)
    const finalCount = await requester<{ count?: number }>(`${definition.layerUrl}/query`, {
      where, returnCountOnly: 'true', returnGeometry: 'false',
    }, { signal })
    if (rowCount !== count || (finalCount.count || 0) !== count) {
      throw new Error(`${survey.countryName} round ${survey.round} changed while downloading. No partial package was created.`)
    }
    const folder = surveyFolder(survey)
    const fileName = `${folder}_household${survey.generation === 'v3' ? `_${component.component}` : ''}.csv`
    const path = `${folder}/data/${fileName}`
    uncompressedBytes += csv.byteLength
    if (uncompressedBytes > budget.uncompressedBytes) {
      throw new Error('This package exceeds its measured browser-memory budget. Select fewer surveys.')
    }
    files[path] = csv
    manifestFiles.push({
      path, survey_key: survey.key, generation: survey.generation,
      component: component.component, authorizing_source: component.source,
      item_id: component.itemId, layer_id: definition.layer.id,
      layer_name: definition.layer.name,
      item_modified: definition.resource.item?.modified ? new Date(definition.resource.item.modified).toISOString() : undefined,
      query_endpoint: `${definition.layerUrl}/query`,
      query_parameters: { where, outFields: '*', returnGeometry: 'false', f: 'json' },
      record_count: count, test_data: survey.testData,
    })
    onProgress?.({ stage: 'downloading', completed: index + 1, total: resolved.length,
      label: `${survey.countryName} round ${survey.round} · ${component.component}` })
  }

  for (const survey of surveys) {
    const folder = surveyFolder(survey)
    const included = manifestFiles.filter((file) => file.survey_key === survey.key).map((file) => file.component)
    files[`${folder}/survey.txt`] = encode(`${survey.countryName} (${survey.adm0Iso3}), round ${survey.round}\nQuestionnaire: ${GENERATIONS[survey.generation].label}\n${survey.testData ? 'TEST DATA — simulated records, not survey results.\n' : ''}`)
    files[`${folder}/documentation_and_metadata.txt`] = encode(documentationText(survey, included))
  }
  const manifest = {
    package_schema_version: 1, kind: 'household-microdata', generated: now.toISOString(),
    hub: HUB_ORIGIN, test_data: surveys[0].testData,
    surveys: surveys.map((survey) => ({ key: survey.key, country: survey.countryName,
      adm0_iso3: survey.adm0Iso3, round: survey.round, generation: survey.generation,
      folder: surveyFolder(survey) })),
    files: manifestFiles,
  }
  files['manifest.json'] = encode(`${JSON.stringify(manifest, null, 2)}\n`)
  files['LICENCE.txt'] = encode(microdataLicenceText())
  files['README.txt'] = encode([
    'DIEM household microdata',
    '========================',
    `Generated: ${now.toISOString()}`,
    `Surveys: ${surveys.length}; data files: ${manifestFiles.length}; records: ${formatNumber(recordCount)}`,
    surveys[0].testData ? 'TEST DATA — simulated records for infrastructure review; do not cite as survey results.' : '',
    'Each survey has its own folder. Read its documentation_and_metadata.txt for version-matched field descriptions and codebook links.',
    'V3 mandatory and optional CSVs are separate; join on survey_id + hh_id if needed.',
    'All requested surveys and components are included. No partial package is returned.',
    '',
  ].filter(Boolean).join('\n'))

  assertLive(signal)
  onProgress?.({ stage: 'compressing', completed: 0, total: 1 })
  const archive = await (options.zip || compressInWorker)(files, signal)
  assertLive(signal)
  onProgress?.({ stage: 'ready', completed: 1, total: 1 })
  const fileName = `${surveys[0].testData ? 'TEST_DATA_' : ''}DIEM_microdata_${isoDate(now)}.zip`
  return {
    fileName, blob: new Blob([archive as BlobPart], { type: 'application/zip' }),
    fileCount: manifestFiles.length, recordCount, uncompressedBytes,
  }
}
