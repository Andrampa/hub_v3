import { HUB_ORIGIN } from '../lib/hubOrigin'
import { microdataLicenceText } from './microdataLicence'
import { formatNumber } from '../lib/format'
import { fetchValidatedSurveyKeys } from './monitoring'
import {
  deepLinkFields, fetchDatasetDefinition, fetchGrantDatasetDefinition,
  csvCell, CSV_TEXT_NEUTRALISATION, usableFields, type DatasetDefinition,
} from './dataExplorer'
import { DOCUMENTATION_RESOURCES, GENERATIONS, resourceLink, type ProtectedRequester } from './protectedData'
import { compressInWorker, type BundleProgress } from './surveyBundle'
import { isWithheld, visibilityClause, withVisibility } from './visibility'
import type { MicrodataComponent, MicrodataSurvey, MicrodataSurveyComponent } from './microdataSurveyAccess'
import {
  labelPlan, labelRow, labelStatus, labelStatusText, valueLabelsCsv,
  type AuditedDomains, type LabelPlan, type LabelStatus, type MicrodataValues,
  type UnlabelledCodes, type ValueLabelSource,
} from './microdataLabels'

export const MICRODATA_SURVEY_LIMIT = 10

/**
 * Validated against live V2 ten-survey and V3 two-table browser probes on 2026-09-23.
 * `uncompressedBytes` counts every data CSV written, coded and labelled alike;
 * `sourceTables` limits the tables read, and "Both" writes two CSVs per table.
 */
export const MICRODATA_PACKAGE_BUDGET: MicrodataPackageBudget = {
  records: 50_000,
  uncompressedBytes: 40_000_000,
  sourceTables: 20,
}

/** The builder checks both counted rows and actual encoded bytes before emitting an archive. */
export interface MicrodataPackageBudget {
  records: number
  uncompressedBytes: number
  sourceTables: number
}

/** CSV files a package writes for each source table. */
export function outputFilesPerTable(values: MicrodataValues = 'codes') {
  return values === 'both' ? 2 : 1
}

export interface MicrodataBundleOptions {
  surveys: MicrodataSurvey[]
  includeV3Optional: boolean
  contributor: boolean
  /** Coded values (default), domain labels in place of codes, or both files. */
  values?: MicrodataValues
  requester: ProtectedRequester
  budget: MicrodataPackageBudget
  signal?: AbortSignal
  onProgress?: (progress: BundleProgress) => void
  zip?: (files: Record<string, Uint8Array>, signal?: AbortSignal) => Promise<Uint8Array>
  now?: () => Date
  /** Injected for tests; production always re-resolves the current ArcGIS item. */
  resolve?: (component: MicrodataSurveyComponent, requester: ProtectedRequester) => Promise<DatasetDefinition>
  /** Injected for tests; production reads `src/data/auditedDomains.json`. */
  audit?: AuditedDomains
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
  values: 'coded' | 'labelled'
  label_source?: 'arcgis_domains'
  labelled_fields?: string[]
  fields_without_domain?: string[]
  ambiguous_domains?: string[]
  unlabelled_codes?: Record<string, UnlabelledCodes>
}

interface ValueLabelManifest {
  survey_key: string
  component: MicrodataComponent
  item_id: string
  status: 'verified' | 'unverified'
  reason?: string
  basis?: string
  audited_at?: string
}

interface ResolvedComponent {
  survey: MicrodataSurvey
  component: MicrodataSurveyComponent
  definition: DatasetDefinition
  where: string
  count: number
  labels: LabelStatus
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
  if (options.budget && chosen.length > options.budget.sourceTables) {
    throw new Error(`This selection reads ${chosen.length} tables; one package can read ${options.budget.sourceTables}. Select fewer surveys.`)
  }

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
    const labels = await labelStatus(survey.generation, component.component, component.source,
      component.itemId, definition.layer.fields, options.audit)
    resolved.push({ survey, component, definition, where, count, labels })
    onProgress?.({ stage: 'counting', completed: index + 1, total: chosen.length })
  }
  const values = options.values || 'codes'
  const unverified = resolved.filter((entry) => !entry.labels.verified)
  if (values !== 'codes' && unverified.length) {
    const detail = unverified.map(({ survey, component, labels }) => (
      `${survey.countryName} round ${survey.round} ${component.component}: ${labelStatusText(labels)}`
    )).join('; ')
    throw new Error(`Labels cannot be verified for this selection (${detail}). Choose coded values, or remove these surveys.`)
  }
  return {
    resolved, recordCount, sourceTableCount: chosen.length,
    outputFileCount: chosen.length * outputFilesPerTable(values),
  }
}

type RowTransform = (attributes: Record<string, unknown>) => Record<string, unknown>

const MEMORY_BUDGET_ERROR = 'This package exceeds its measured browser-memory budget. Select fewer surveys, or choose coded or labelled values instead of both.'

/**
 * Encode bounded pages so a full household table is never materialized as one
 * row array. Each page is fetched once and written to every requested output,
 * so coded and labelled files share rows and order by construction.
 */
async function fetchBoundedCsv(
  definition: DatasetDefinition, where: string, columns: string[], expectedCount: number,
  requester: ProtectedRequester, remainingBytes: number, signal: AbortSignal | undefined,
  transforms: Array<RowTransform | undefined>,
) {
  const encoder = new TextEncoder()
  const outputs = transforms.map((transform) => ({ transform, chunks: [encoder.encode(`\uFEFF${columns.join(',')}`)] }))
  let bytes = outputs.reduce((total, output) => total + output.chunks[0].byteLength, 0)
  if (bytes > remainingBytes) throw new Error(MEMORY_BUDGET_ERROR)
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
    for (const output of outputs) {
      const chunk = encoder.encode(`\r\n${rows.map(({ attributes }) => {
        const row = output.transform ? output.transform(attributes) : attributes
        return columns.map((column) => csvCell(row[column])).join(',')
      }).join('\r\n')}`)
      bytes += chunk.byteLength
      if (bytes > remainingBytes) throw new Error(MEMORY_BUDGET_ERROR)
      output.chunks.push(chunk)
    }
    offset += rows.length
  }
  const csvs = outputs.map(({ chunks }) => {
    const csv = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
    let cursor = 0
    for (const chunk of chunks) { csv.set(chunk, cursor); cursor += chunk.byteLength }
    return csv
  })
  return { csvs, rowCount: offset }
}

/** Revalidates, counts, downloads and compresses atomically. No partial package is returned. */
export async function buildMicrodataBundle(options: MicrodataBundleOptions) {
  const { surveys, requester, budget, signal, onProgress } = options
  const { resolved, recordCount } = await preflightMicrodataPackage(options)
  const values = options.values || 'codes'

  const now = options.now?.() || new Date()
  const files: Record<string, Uint8Array> = {}
  const manifestFiles: DataFileManifest[] = []
  const valueLabels: ValueLabelManifest[] = []
  const labelSources = new Map<string, ValueLabelSource[]>()
  const encode = (value: string) => new TextEncoder().encode(value)
  let uncompressedBytes = 0
  for (const [index, entry] of resolved.entries()) {
    assertLive(signal)
    const { survey, component, definition, where, count, labels } = entry
    const columns = usableFields(definition.layer.fields).map((field) => field.name)
    const plan: LabelPlan = labelPlan(definition.layer.fields, columns)
    const unlabelled: Record<string, UnlabelledCodes> = {}
    const labelTransform: RowTransform = (attributes) => labelRow(attributes, plan, unlabelled)
    const outputs: Array<'coded' | 'labelled'> = values === 'codes' ? ['coded'] : values === 'labels' ? ['labelled'] : ['coded', 'labelled']
    const { csvs, rowCount } = await fetchBoundedCsv(definition, where, columns, count,
      requester, budget.uncompressedBytes - uncompressedBytes, signal,
      outputs.map((kind) => (kind === 'labelled' ? labelTransform : undefined)))
    const finalCount = await requester<{ count?: number }>(`${definition.layerUrl}/query`, {
      where, returnCountOnly: 'true', returnGeometry: 'false',
    }, { signal })
    if (rowCount !== count || (finalCount.count || 0) !== count) {
      throw new Error(`${survey.countryName} round ${survey.round} changed while downloading. No partial package was created.`)
    }
    const folder = surveyFolder(survey)
    const stem = `${folder}_household${survey.generation === 'v3' ? `_${component.component}` : ''}`
    for (const [outputIndex, kind] of outputs.entries()) {
      const csv = csvs[outputIndex]
      const path = `${folder}/data/${stem}${kind === 'labelled' ? '_labelled' : ''}.csv`
      uncompressedBytes += csv.byteLength
      if (uncompressedBytes > budget.uncompressedBytes) throw new Error(MEMORY_BUDGET_ERROR)
      files[path] = csv
      manifestFiles.push({
        path, survey_key: survey.key, generation: survey.generation,
        component: component.component, authorizing_source: component.source,
        item_id: component.itemId, layer_id: definition.layer.id,
        layer_name: definition.layer.name,
        item_modified: definition.resource.item?.modified ? new Date(definition.resource.item.modified).toISOString() : undefined,
        query_endpoint: `${definition.layerUrl}/query`,
        query_parameters: { where, outFields: '*', returnGeometry: 'false', f: 'json' },
        record_count: count, test_data: survey.testData, values: kind,
        ...(kind === 'labelled' ? {
          label_source: 'arcgis_domains' as const,
          labelled_fields: plan.labelled.map(({ field }) => field),
          fields_without_domain: plan.fieldsWithoutDomain,
          ambiguous_domains: plan.ambiguousDomains,
          unlabelled_codes: unlabelled,
        } : {}),
      })
    }
    valueLabels.push({
      survey_key: survey.key, component: component.component, item_id: component.itemId,
      ...(labels.verified
        ? { status: 'verified' as const, basis: labels.audit.basis, audited_at: labels.audit.audited_at }
        : { status: 'unverified' as const, reason: labels.reason }),
    })
    if (labels.verified) {
      const sources = labelSources.get(survey.key) || []
      sources.push({ component: component.component, itemId: component.itemId, layerId: definition.layer.id, plan })
      labelSources.set(survey.key, sources)
    }
    onProgress?.({ stage: 'downloading', completed: index + 1, total: resolved.length,
      label: `${survey.countryName} round ${survey.round} · ${component.component}` })
  }

  for (const survey of surveys) {
    const folder = surveyFolder(survey)
    const included = [...new Set(manifestFiles.filter((file) => file.survey_key === survey.key).map((file) => file.component))]
    files[`${folder}/survey.txt`] = encode(`${survey.countryName} (${survey.adm0Iso3}), round ${survey.round}\nQuestionnaire: ${GENERATIONS[survey.generation].label}\n${survey.testData ? 'TEST DATA — simulated records, not survey results.\n' : ''}`)
    files[`${folder}/documentation_and_metadata.txt`] = encode(documentationText(survey, included))
    files[`${folder}/value_labels.csv`] = encode(valueLabelsCsv(labelSources.get(survey.key) || []))
  }
  const unverifiedLabels = valueLabels.filter((entry) => entry.status === 'unverified')
  const manifest = {
    package_schema_version: 2, kind: 'household-microdata', generated: now.toISOString(),
    hub: HUB_ORIGIN, test_data: surveys[0].testData, values,
    csv_text_neutralisation: CSV_TEXT_NEUTRALISATION,
    surveys: surveys.map((survey) => ({ key: survey.key, country: survey.countryName,
      adm0_iso3: survey.adm0Iso3, round: survey.round, generation: survey.generation,
      folder: surveyFolder(survey) })),
    files: manifestFiles,
    value_labels: valueLabels,
  }
  files['manifest.json'] = encode(`${JSON.stringify(manifest, null, 2)}\n`)
  files['LICENCE.txt'] = encode(microdataLicenceText())
  files['README.txt'] = encode([
    'DIEM household microdata',
    '========================',
    `Generated: ${now.toISOString()}`,
    `Surveys: ${surveys.length}; data files: ${manifestFiles.length}; records: ${formatNumber(recordCount)}`,
    surveys[0].testData ? 'TEST DATA — simulated records for infrastructure review; do not cite as survey results.' : null,
    'Each survey has its own folder. Read its documentation_and_metadata.txt for version-matched field descriptions and codebook links.',
    'V3 mandatory and optional CSVs are separate; join on survey_id + hh_id if needed.',
    'All requested surveys and components are included. No partial package is returned.',
    CSV_TEXT_NEUTRALISATION,
    '',
    'Values and labels',
    '-----------------',
    values === 'codes' ? 'Data files hold coded values.'
      : values === 'labels' ? 'Data files ending in _labelled.csv replace coded values with their labels.'
        : 'Each table is written twice: coded values, and a _labelled.csv copy with the same columns, rows and row order.',
    'Labels come from the coded-value domains on the ArcGIS layers, which DIEM maintains as the authoritative value labels.',
    'They are used only where those domains match the audited version; manifest.json records the audit basis per table.',
    'Where the published codebook wording differs, the labels in this package take precedence.',
    'In a labelled file, a code with no label is kept as the raw code, and empty values stay empty. manifest.json lists,',
    'per labelled file, the fields labelled, fields without a domain, and any unlabelled codes.',
    'Each survey folder has value_labels.csv (component, item_id, layer_id, variable, code, label) for verified tables.',
    unverifiedLabels.length
      ? `value_labels.csv omits tables whose labels could not be verified: ${unverifiedLabels.map((entry) => `${entry.survey_key} ${entry.component} (${entry.reason})`).join('; ')}. It is not a codebook for them.`
      : null,
    '',
  ].filter((line) => line !== null).join('\n'))

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
