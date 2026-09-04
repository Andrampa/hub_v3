import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from 'geojson'
import {
  DATA_PORTAL,
  DATA_REST,
  resolveProtectedResource,
  type ProtectedDataResource,
  type ProtectedRequester,
  type ResolvedDataResource,
} from './protectedData'
import { ALL_PROTECTED_DATA_RESOURCES } from './protectedData'
import { COMMUNITY_PORTAL } from './auth'

export const MAP_FEATURE_LIMIT = 250
export const BROWSER_EXPORT_LIMIT = 20000

/**
 * How many distinct values a filter dropdown holds before the field falls back
 * to free text.
 *
 * The option list is produced by the service with `returnDistinctValues`, so
 * its cost is independent of table size: a five-million-record layer answers a
 * distinct query on `adm0_name` with the same few hundred rows a small one
 * does. The cap exists for the reader, not the server -- past a few hundred
 * options a select is worse than typing. One extra value is always requested so
 * a truncated list can be recognised instead of silently shortened.
 */
export const FILTER_OPTION_LIMIT = 500

export interface ServiceLayerReference {
  id: number
  name: string
}

export interface CodedValue {
  name: string
  code: string | number
}

export interface FieldDomain {
  type?: string
  codedValues?: CodedValue[]
}

export interface FeatureField {
  name: string
  alias: string
  type: string
  domain?: FieldDomain | null
}

export interface FeatureServiceInfo {
  layers?: ServiceLayerReference[]
  tables?: ServiceLayerReference[]
  capabilities?: string
  maxRecordCount?: number
}

export interface FeatureLayerInfo {
  id: number
  name: string
  geometryType?: string
  objectIdField?: string
  displayField?: string
  fields: FeatureField[]
  maxRecordCount?: number
  supportsPagination?: boolean
  supportsStatistics?: boolean
  supportedQueryFormats?: string
  extent?: { spatialReference?: { wkid?: number } }
  editingInfo?: { lastEditDate?: number }
}

export interface DatasetDefinition {
  resource: ResolvedDataResource
  serviceUrl: string
  layerUrl: string
  layer: FeatureLayerInfo
  isTable: boolean
}

export interface DatasetFilter {
  id: string
  fieldName: string
  operator: 'equals' | 'contains' | 'greaterThan' | 'lessThan'
  value: string
}

interface QueryResponse {
  features?: Array<{ attributes: Record<string, unknown> }>
  exceededTransferLimit?: boolean
}

interface GeoJsonResponse extends FeatureCollection<Geometry, GeoJsonProperties> {
  exceededTransferLimit?: boolean
}

interface EsriGeometryFeature {
  attributes: Record<string, unknown>
  geometry?: {
    x?: number
    y?: number
    points?: number[][]
    paths?: number[][][]
    rings?: number[][][]
  }
}

interface EsriGeometryResponse {
  geometryType?: 'esriGeometryPoint' | 'esriGeometryMultipoint' | 'esriGeometryPolyline' | 'esriGeometryPolygon'
  features?: EsriGeometryFeature[]
  exceededTransferLimit?: boolean
}

export function resourceForDataset(id: string) {
  return ALL_PROTECTED_DATA_RESOURCES.find((resource) => resource.id === id)
}

export function usableFields(fields: FeatureField[]) {
  return fields.filter((field) => !/^shape__|^objectid$|^globalid$/i.test(field.name))
}

/**
 * The country and round fields a `?country=&round=` deep link addresses.
 *
 * This is the entry contract for links arriving from the Monitoring dashboard,
 * which carries the country and exact survey round the user was looking at.
 * ISO3 is preferred over a country name because that is what the dashboard
 * sends and what survives spelling and language differences.
 */
export function deepLinkFields(fields: FeatureField[]) {
  const country = fields.find((field) => /^(adm0_iso3|iso3)$/i.test(field.name))
    || fields.find((field) => /^(adm0_name|country)$/i.test(field.name))
  const round = fields.find((field) => /^(round|round_num|survey_round)$/i.test(field.name))
  return { country, round }
}

export function filtersFromDeepLink(
  fields: FeatureField[],
  values: { country?: string | null; round?: string | null },
): DatasetFilter[] {
  const targets = deepLinkFields(fields)
  const filters: DatasetFilter[] = []
  const country = values.country?.trim()
  const round = values.round?.trim()
  if (targets.country && country) {
    filters.push({
      id: `deeplink-country`,
      fieldName: targets.country.name,
      operator: 'equals',
      // ISO3 fields are stored uppercase; a lowercase code in a link would
      // otherwise return an empty, and silently wrong, result set.
      value: /iso3/i.test(targets.country.name) ? country.toUpperCase() : country,
    })
  }
  if (targets.round && round && /^\d+$/.test(round)) {
    filters.push({ id: `deeplink-round`, fieldName: targets.round.name, operator: 'equals', value: round })
  }
  return filters
}

export function fieldIsNumeric(field: FeatureField | undefined) {
  return /smallinteger|integer|single|double|oid/i.test(field?.type || '')
}

export function fieldIsText(field: FeatureField | undefined) {
  return /string|guid|globalid/i.test(field?.type || '')
}

export interface FieldOptions {
  values: string[]
  /** True when the field has more distinct values than a dropdown should hold. */
  truncated: boolean
}

/**
 * Options a field declares itself, with no query at all.
 *
 * A coded-value domain is the authoritative list for the field, so it is
 * preferred over sampling distinct values: it is free, exact, and includes
 * codes that happen to be unused in the current data.
 */
export function codedValueOptions(field: FeatureField | undefined): string[] | undefined {
  const coded = field?.domain?.codedValues
  if (!coded?.length) return undefined
  return coded.map((entry) => String(entry.code))
}

/** Fields worth offering a value list for. Dates and blobs stay free entry. */
export function fieldSupportsOptions(field: FeatureField | undefined) {
  if (!field) return false
  if (codedValueOptions(field)) return true
  return fieldIsText(field) || /smallinteger|integer/i.test(field.type)
}

/**
 * Distinct values for one attribute, for the filter dropdown.
 *
 * Deliberately unfiltered (`1=1`): the option list describes the dataset, not
 * the current selection, so adding one filter must not silently empty the
 * choices available for the next one.
 */
export async function fetchFieldOptions(
  definition: DatasetDefinition,
  field: FeatureField,
  requester: ProtectedRequester,
): Promise<FieldOptions> {
  const coded = codedValueOptions(field)
  if (coded) return { values: coded, truncated: false }

  const response = await requester<QueryResponse>(`${definition.layerUrl}/query`, {
    where: '1=1',
    outFields: field.name,
    returnDistinctValues: 'true',
    returnGeometry: 'false',
    orderByFields: field.name,
    resultRecordCount: String(FILTER_OPTION_LIMIT + 1),
  })
  const values = (response.features || [])
    .map((feature) => feature.attributes[field.name])
    .filter((value) => value !== null && value !== undefined && String(value).trim() !== '')
    .map((value) => String(value))
  const unique = Array.from(new Set(values))
  if (unique.length > FILTER_OPTION_LIMIT) return { values: [], truncated: true }
  return { values: unique, truncated: false }
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''")
}

function escapeSqlLike(value: string) {
  return escapeSql(value)
    .replaceAll('$', '$$$$')
    .replaceAll('%', '$%')
    .replaceAll('_', '$_')
}

export function buildWhere(filters: DatasetFilter[], fields: FeatureField[]) {
  const clauses = filters.flatMap((filter) => {
    const field = fields.find((candidate) => candidate.name === filter.fieldName)
    const value = filter.value.trim()
    if (!field || !value) return []
    const numeric = fieldIsNumeric(field)
    if (numeric) {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) return []
      const operator = filter.operator === 'greaterThan' ? '>' : filter.operator === 'lessThan' ? '<' : '='
      return [`${field.name} ${operator} ${parsed}`]
    }
    if (filter.operator === 'contains') return [`UPPER(${field.name}) LIKE '%${escapeSqlLike(value).toUpperCase()}%' ESCAPE '$'`]
    return [`${field.name} = '${escapeSql(value)}'`]
  })
  return clauses.length ? clauses.join(' AND ') : '1=1'
}

function normalizedServiceUrl(url: string) {
  return url.replace(/\/+$/, '')
}

export async function fetchDatasetDefinition(
  datasetId: string,
  requester: ProtectedRequester,
): Promise<DatasetDefinition> {
  const resource = resourceForDataset(datasetId)
  if (!resource) throw new Error('This dataset is not configured in the DIEM data workspace.')
  const resolved = await resolveProtectedResource(resource, requester)
  if (resolved.access === 'restricted') throw new Error('Your community account does not have access to this dataset.')
  if (resolved.access !== 'available' || !resolved.item) throw new Error('The dataset details could not be read from the content platform.')
  if (!resolved.item.url) throw new Error('This item does not expose a queryable data service yet.')

  const serviceUrl = normalizedServiceUrl(resolved.item.url)
  const service = await requester<FeatureServiceInfo>(serviceUrl)
  const layerReference = service.layers?.[0] || service.tables?.[0]
  if (!layerReference) throw new Error('This service does not expose a feature layer or table for exploration.')

  const isTable = !service.layers?.some((layer) => layer.id === layerReference.id)
  const layerUrl = `${serviceUrl}/${layerReference.id}`
  const layer = await requester<FeatureLayerInfo>(layerUrl)
  return { resource: resolved, serviceUrl, layerUrl, layer, isTable }
}

export async function fetchRecordCount(definition: DatasetDefinition, where: string, requester: ProtectedRequester) {
  const response = await requester<{ count?: number }>(`${definition.layerUrl}/query`, {
    where,
    returnCountOnly: 'true',
    returnGeometry: 'false',
  })
  return response.count || 0
}

export async function fetchTablePreview(
  definition: DatasetDefinition,
  where: string,
  requester: ProtectedRequester,
  limit = 30,
) {
  return requester<QueryResponse>(`${definition.layerUrl}/query`, {
    where,
    outFields: '*',
    returnGeometry: 'false',
    resultRecordCount: String(limit),
    orderByFields: definition.layer.objectIdField ? `${definition.layer.objectIdField} ASC` : undefined,
  })
}

export interface MapExtent {
  xmin: number
  ymin: number
  xmax: number
  ymax: number
}

export interface GeometryPreview {
  collection: GeoJsonResponse
  /**
   * The service had more features in this extent than the map asked for, so
   * what is drawn is a sample. Zooming in shrinks the extent and lets the same
   * budget cover everything inside it.
   */
  truncated: boolean
}

/**
 * Geometry for the map, bounded by both the filter and the current view.
 *
 * The 250-feature budget is a rendering limit, not a data limit. Passing the
 * map's extent means that budget is spent on what the user is actually looking
 * at, so zooming into a crowded area progressively reveals every feature in it
 * rather than showing the same arbitrary 250 for the whole filter.
 */
export async function fetchGeometryPreview(
  definition: DatasetDefinition,
  where: string,
  requester: ProtectedRequester,
  extent?: MapExtent,
): Promise<GeometryPreview> {
  if (definition.isTable || !definition.layer.geometryType) {
    return { collection: { type: 'FeatureCollection', features: [] } as GeoJsonResponse, truncated: false }
  }
  const availableFieldNames = new Set(definition.layer.fields.map((field) => field.name.toLowerCase()))
  const response = await requester<EsriGeometryResponse>(`${definition.layerUrl}/query`, {
    f: 'json',
    where,
    ...(extent ? {
      geometry: JSON.stringify({ ...extent, spatialReference: { wkid: 4326 } }),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
    } : {}),
    // Some long-lived ArcGIS views retain a stale displayField after their
    // schema changes. Asking for that missing field rejects the whole geometry
    // query, so only send names that still exist in the live layer schema.
    outFields: Array.from(new Set([
      definition.layer.objectIdField,
      definition.layer.displayField,
      ...usableFields(definition.layer.fields)
        .filter((field) => /^(adm[0-2]_(name|iso3)|adm_name|country|name)$/i.test(field.name))
        .slice(0, 8)
        .map((field) => field.name),
    ].filter((name): name is string => !!name && availableFieldNames.has(name.toLowerCase())))).join(',') || '*',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '4',
    maxAllowableOffset: '0.02',
    resultRecordCount: String(MAP_FEATURE_LIMIT),
    returnExceededLimitFeatures: 'false',
  })
  return {
    collection: esriFeaturesToGeoJson(response),
    // The service is asked for exactly the budget, so a full page means there
    // were at least that many; `exceededTransferLimit` is not set when the cap
    // came from `resultRecordCount` rather than the layer's own maximum.
    truncated: (response.features?.length || 0) >= MAP_FEATURE_LIMIT,
  }
}

function normalizePosition(position: number[]) {
  const [x, y, ...rest] = position
  if (Math.abs(x) <= 180 && Math.abs(y) <= 90) return position
  const longitude = (x / 20037508.34) * 180
  const latitude = (Math.atan(Math.exp((y / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90
  return [longitude, latitude, ...rest]
}

function signedRingArea(ring: number[][]) {
  let area = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index]
    const next = ring[index + 1]
    area += (current[0] * next[1]) - (next[0] * current[1])
  }
  return area / 2
}

function pointInRing(point: number[], ring: number[][]) {
  let inside = false
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index, index += 1) {
    const [x, y] = ring[index]
    const [previousX, previousY] = ring[previous]
    const crosses = ((y > point[1]) !== (previousY > point[1]))
      && (point[0] < ((previousX - x) * (point[1] - y)) / ((previousY - y) || Number.EPSILON) + x)
    if (crosses) inside = !inside
  }
  return inside
}

function arcgisRingsToGeoJson(rings: number[][][]) {
  const normalized = rings.map((ring) => ring.map(normalizePosition))
  const outerRings = normalized.filter((ring) => signedRingArea(ring) < 0)
  const holeRings = normalized.filter((ring) => signedRingArea(ring) >= 0)

  if (!outerRings.length) {
    return normalized.map((ring) => [signedRingArea(ring) < 0 ? [...ring].reverse() : ring])
  }

  const polygons = outerRings.map((ring) => [[...ring].reverse()])
  for (const hole of holeRings) {
    const ownerIndex = outerRings.findIndex((outer) => pointInRing(hole[0], outer))
    if (ownerIndex >= 0) polygons[ownerIndex].push([...hole].reverse())
    else polygons.push([hole])
  }
  return polygons
}

function esriGeometryToGeoJson(
  geometryType: EsriGeometryResponse['geometryType'],
  geometry: EsriGeometryFeature['geometry'],
): Geometry | undefined {
  if (!geometry) return undefined
  if (geometryType === 'esriGeometryPoint' && Number.isFinite(geometry.x) && Number.isFinite(geometry.y)) {
    return { type: 'Point', coordinates: normalizePosition([geometry.x as number, geometry.y as number]) }
  }
  if (geometryType === 'esriGeometryMultipoint' && geometry.points) return { type: 'MultiPoint', coordinates: geometry.points.map(normalizePosition) }
  if (geometryType === 'esriGeometryPolyline' && geometry.paths) {
    const paths = geometry.paths.map((path) => path.map(normalizePosition))
    return geometry.paths.length === 1
      ? { type: 'LineString', coordinates: paths[0] }
      : { type: 'MultiLineString', coordinates: paths }
  }
  if (geometryType === 'esriGeometryPolygon' && geometry.rings) {
    const polygons = arcgisRingsToGeoJson(geometry.rings)
    return polygons.length === 1
      ? { type: 'Polygon', coordinates: polygons[0] }
      : { type: 'MultiPolygon', coordinates: polygons }
  }
  return undefined
}

function esriFeaturesToGeoJson(response: EsriGeometryResponse): GeoJsonResponse {
  return {
    type: 'FeatureCollection',
    features: (response.features || []).flatMap((feature) => {
      const geometry = esriGeometryToGeoJson(response.geometryType, feature.geometry)
      return geometry ? [{ type: 'Feature' as const, properties: feature.attributes, geometry }] : []
    }),
  }
}

async function fetchEsriGeoJsonPages(
  definition: DatasetDefinition,
  where: string,
  requester: ProtectedRequester,
  expectedCount: number,
) {
  const features: Feature<Geometry, GeoJsonProperties>[] = []
  const pageSize = Math.min(definition.layer.maxRecordCount || 1000, 1000)
  let offset = 0
  while (offset < expectedCount) {
    const requested = Math.min(pageSize, expectedCount - offset)
    const page = await requester<EsriGeometryResponse>(`${definition.layerUrl}/query`, {
      f: 'json',
      where,
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      resultOffset: String(offset),
      resultRecordCount: String(requested),
      orderByFields: definition.layer.objectIdField ? `${definition.layer.objectIdField} ASC` : undefined,
    })
    const converted = esriFeaturesToGeoJson(page)
    features.push(...converted.features)
    const returned = page.features?.length || 0
    if (!returned) throw new Error(`The data service stopped after ${offset.toLocaleString()} of ${expectedCount.toLocaleString()} expected records. Narrow the filters and try again.`)
    offset += returned
  }
  return { type: 'FeatureCollection', features } as GeoJsonResponse
}

async function fetchAllAttributes(
  definition: DatasetDefinition,
  where: string,
  requester: ProtectedRequester,
  expectedCount: number,
) {
  const rows: Record<string, unknown>[] = []
  const pageSize = Math.min(definition.layer.maxRecordCount || 1000, 1000)
  let offset = 0
  while (offset < expectedCount) {
    const requested = Math.min(pageSize, expectedCount - offset)
    const page = await requester<QueryResponse>(`${definition.layerUrl}/query`, {
      where,
      outFields: '*',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(requested),
      orderByFields: definition.layer.objectIdField ? `${definition.layer.objectIdField} ASC` : undefined,
    })
    const pageRows = (page.features || []).map((feature) => feature.attributes)
    rows.push(...pageRows)
    if (!pageRows.length) throw new Error(`The data service stopped after ${offset.toLocaleString()} of ${expectedCount.toLocaleString()} expected records. Narrow the filters and try again.`)
    offset += pageRows.length
  }
  return rows
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

export async function downloadCsv(
  definition: DatasetDefinition,
  where: string,
  count: number,
  requester: ProtectedRequester,
) {
  if (count > BROWSER_EXPORT_LIMIT) throw new Error(`This filtered result has more than ${BROWSER_EXPORT_LIMIT.toLocaleString()} records. Use the service API for a larger automated extraction.`)
  const rows = await fetchAllAttributes(definition, where, requester, count)
  const columns = usableFields(definition.layer.fields).map((field) => field.name)
  const lines = [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))]
  return new Blob(['\uFEFF', lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

export async function downloadGeoJson(
  definition: DatasetDefinition,
  where: string,
  count: number,
  requester: ProtectedRequester,
) {
  if (count > BROWSER_EXPORT_LIMIT) throw new Error(`This filtered result has more than ${BROWSER_EXPORT_LIMIT.toLocaleString()} records. Use the service API for a larger automated extraction.`)
  const response = await fetchEsriGeoJsonPages(definition, where, requester, count)
  return new Blob([JSON.stringify(response)], { type: 'application/geo+json' })
}

/** Excel rejects the characters [ ] : * ? / \ in sheet names, and anything past 31 characters. */
function excelSheetName(name: string) {
  return name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 31) || 'Data'
}

/**
 * Excel, built here rather than requested from the export service.
 *
 * The service cannot produce `.xlsx` at all, and Excel is the format
 * non-GIS users ask for first, so it is assembled from the same paged
 * attribute fetch that backs the CSV export. Field aliases become the header
 * row because they are what the schema shows the reader, and numeric fields
 * are written as numbers so totals and pivots work without re-typing columns.
 * The 20,000-record cap applies for the same reason it applies to CSV: the
 * whole result is held in memory before the file is written.
 */
export async function downloadXlsx(
  definition: DatasetDefinition,
  where: string,
  count: number,
  requester: ProtectedRequester,
) {
  if (count > BROWSER_EXPORT_LIMIT) throw new Error(`This filtered result has more than ${BROWSER_EXPORT_LIMIT.toLocaleString()} records. Use the service API for a larger automated extraction.`)
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const rows = await fetchAllAttributes(definition, where, requester, count)
  const columns = usableFields(definition.layer.fields)

  const header = columns.map((field) => ({
    value: field.alias || field.name,
    fontWeight: 'bold' as const,
  }))
  const body = rows.map((row) => columns.map((field) => {
    const value = row[field.name]
    if (value === null || value === undefined || value === '') return null
    if (fieldIsNumeric(field) && typeof value === 'number' && Number.isFinite(value)) {
      return { value, type: Number }
    }
    return { value: String(value), type: String }
  }))

  return writeXlsxFile([header, ...body], {
    sheet: excelSheetName(definition.layer.name),
    stickyRowsCount: 1,
    columns: columns.map(() => ({ width: 22 })),
  }).toBlob()
}

export type HubDownloadFormat = 'csv' | 'shp' | 'geojson' | 'kml'

/**
 * Formats the DIEM Hub export generator actually serves.
 *
 * The generator rejects anything outside this set with "Unsupported file
 * format. Supported file formats are csv, shapefile, geojson, kml", so Excel,
 * File Geodatabase, GeoPackage and SQLite were buttons that could never
 * succeed. Excel is now produced in the browser by `downloadXlsx` instead; the
 * remaining three are gone until Phase 2 owns generation and can offer them for
 * real. CSV and GeoJSON stay listed because the type is shared with
 * `hubDownloadRequest`, but the explorer builds both locally.
 */
export const HUB_DOWNLOAD_FORMATS: Array<{ format: HubDownloadFormat; label: string; spatial: boolean; route: string; extension: string }> = [
  { format: 'csv', label: 'CSV', spatial: false, route: 'csv', extension: 'csv' },
  { format: 'shp', label: 'Shapefile', spatial: true, route: 'shapefile', extension: 'zip' },
  { format: 'geojson', label: 'GeoJSON', spatial: true, route: 'geojson', extension: 'geojson' },
  { format: 'kml', label: 'KML / KMZ', spatial: true, route: 'kml', extension: 'kmz' },
]

const DIEM_HUB_DOWNLOAD_API = 'https://data-in-emergencies.fao.org/api/download/v1/items'

export function hubDownloadRequest(definition: DatasetDefinition, format: HubDownloadFormat, where: string) {
  const descriptor = HUB_DOWNLOAD_FORMATS.find((candidate) => candidate.format === format)
  if (!descriptor) throw new Error('This download format is not configured.')
  return {
    descriptor,
    url: `${DIEM_HUB_DOWNLOAD_API}/${definition.resource.id}/${descriptor.route}`,
    params: { layers: String(definition.layer.id), where },
  }
}

function startsWithBytes(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value)
}

export async function validatePackagedDownload(blob: Blob, format: HubDownloadFormat) {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer())
  const isZip = startsWithBytes(bytes, [0x50, 0x4b])
  const beginning = new TextDecoder().decode(bytes).trimStart().toLowerCase()

  if (format === 'shp' && !isZip) {
    throw new Error('The export service did not return the expected packaged file.')
  }
  if (format === 'kml') {
    if (isZip) return { blob, extension: 'kmz' }
    if (beginning.startsWith('<?xml') || beginning.startsWith('<kml')) return { blob, extension: 'kml' }
    throw new Error('The export service did not return a valid KML or KMZ file.')
  }

  const descriptor = HUB_DOWNLOAD_FORMATS.find((candidate) => candidate.format === format)
  return { blob, extension: descriptor?.extension || 'bin' }
}

export function apiLinks(definition: DatasetDefinition, where: string) {
  const query = new URLSearchParams({
    f: 'json',
    where,
    outFields: '*',
    returnGeometry: 'true',
  })
  return {
    service: definition.serviceUrl,
    layer: definition.layerUrl,
    query: `${definition.layerUrl}/query?${query}`,
    item: `${DATA_PORTAL}/home/item.html?id=${definition.resource.id}`,
    itemMetadata: `${DATA_REST}/content/items/${definition.resource.id}?f=json`,
  }
}

/**
 * Bulk extraction scripts, for results past the browser download limit.
 *
 * The scripts authenticate with the community username and password rather
 * than a pasted token: a token expires within the hour, so a long extraction
 * could die halfway through, and the user had to go and find the token first.
 * Credentials are prompted for at run time and never written into the file, so
 * a copied script can be shared or committed without leaking anything. This
 * exchange only works for ArcGIS built-in community accounts; an account
 * federated through enterprise SSO has no password to present here.
 */
export function bulkDownloadScripts(definition: DatasetDefinition, where: string) {
  const queryUrl = `${definition.layerUrl}/query`
  const tokenUrl = `${COMMUNITY_PORTAL}/sharing/rest/generateToken`
  const filename = `${definition.resource.fallbackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-bulk.csv`
  const python = `# DIEM bulk attribute download (Python 3, standard library only)
#
# Run it and enter your DIEM community username and password when prompted.
# The password is masked in a terminal or a small dialog and is never stored.
# Accounts that sign in through enterprise SSO cannot use this exchange.
import csv
import getpass
import json
import sys
import urllib.parse
import urllib.request

TOKEN_URL = ${JSON.stringify(tokenUrl)}
QUERY_URL = ${JSON.stringify(queryUrl)}
WHERE = ${JSON.stringify(where)}
# Easy filter examples: remove the leading # from one line, then edit its value.
# Text values need single quotes inside the SQL expression.
# WHERE = "adm0_ISO3 = 'AFG'"
# WHERE = "adm0_ISO3 = 'AFG' AND round = 1"
OUTPUT = ${JSON.stringify(filename)}
REFERER = ${JSON.stringify(COMMUNITY_PORTAL)}


def post(url, parameters):
    body = urllib.parse.urlencode({"f": "json", **parameters}).encode()
    with urllib.request.urlopen(url, body) as response:
        payload = json.load(response)
    if "error" in payload:
        raise RuntimeError(payload["error"])
    return payload


def read_password():
    # IDLE replaces stdin with a shell stream that cannot disable echo, which
    # makes getpass warn and can expose the password. Use a masked standard-
    # library dialog there, while retaining the normal terminal prompt in a
    # command prompt, PowerShell or Unix shell.
    if getattr(sys.stdin, "isatty", lambda: False)() and getattr(sys.stderr, "isatty", lambda: False)():
        return getpass.getpass("Password: ")
    try:
        import tkinter as tk
        from tkinter import simpledialog
        root = tk.Tk()
        root.withdraw()
        try:
            password = simpledialog.askstring("DIEM community sign-in", "Password:", show="*", parent=root)
        finally:
            root.destroy()
        if password is None:
            raise KeyboardInterrupt("Password entry cancelled.")
        return password
    except ImportError:
        return getpass.getpass("Password: ")


def sign_in():
    username = input("DIEM community username: ").strip()
    password = read_password()
    result = post(TOKEN_URL, {
        "username": username,
        "password": password,
        "referer": REFERER,
        "expiration": 120,
    })
    token = result.get("token")
    if not token:
        raise RuntimeError("The portal did not return a token for these credentials.")
    return token


TOKEN = sign_in()


def service_post(parameters):
    return post(QUERY_URL, {"token": TOKEN, **parameters})


id_result = service_post({"where": WHERE, "returnIdsOnly": "true"})
object_ids = id_result.get("objectIds", [])
rows = []
for start in range(0, len(object_ids), 1000):
    page = service_post({
        "objectIds": ",".join(map(str, object_ids[start:start + 1000])),
        "outFields": "*",
        "returnGeometry": "false",
    })
    rows.extend(feature["attributes"] for feature in page.get("features", []))

if rows:
    with open(OUTPUT, "w", newline="", encoding="utf-8-sig") as target:
        writer = csv.DictWriter(target, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
print(f"Saved {len(rows):,} records to {OUTPUT}")
`
  const r = `# DIEM bulk attribute download (R)
#
# Packages: install.packages(c("httr", "jsonlite"))
# Optional, for a non-echoing password prompt: install.packages("askpass")
# Run it and enter your DIEM community username and password when prompted.
# The password is not stored in this file.
# Accounts that sign in through enterprise SSO cannot use this exchange.
library(httr)
library(jsonlite)

token_url <- ${JSON.stringify(tokenUrl)}
query_url <- ${JSON.stringify(queryUrl)}
where <- ${JSON.stringify(where)}
# Easy filter examples: remove the leading # from one line, then edit its value.
# Text values need single quotes inside the SQL expression.
# where <- "adm0_ISO3 = 'AFG'"
# where <- "adm0_ISO3 = 'AFG' AND round = 1"
output <- ${JSON.stringify(filename)}
referer <- ${JSON.stringify(COMMUNITY_PORTAL)}

post_json <- function(url, parameters) {
  response <- POST(url, body = c(list(f = "json"), parameters), encode = "form")
  stop_for_status(response)
  payload <- fromJSON(content(response, as = "text", encoding = "UTF-8"), simplifyVector = TRUE)
  if (!is.null(payload$error)) stop(toJSON(payload$error, auto_unbox = TRUE))
  payload
}

sign_in <- function() {
  username <- trimws(readline("DIEM community username: "))
  password <- if (requireNamespace("askpass", quietly = TRUE)) {
    askpass::askpass("Password: ")
  } else {
    readline("Password (visible): ")
  }
  result <- post_json(token_url, list(
    username = username,
    password = password,
    referer = referer,
    expiration = 120
  ))
  if (is.null(result$token)) stop("The portal did not return a token for these credentials.")
  result$token
}

token <- sign_in()

service_post <- function(parameters) {
  post_json(query_url, c(list(token = token), parameters))
}

id_result <- service_post(list(where = where, returnIdsOnly = "true"))
object_ids <- unlist(id_result$objectIds)
pages <- list()
if (length(object_ids) > 0) {
  for (start in seq(1, length(object_ids), by = 1000)) {
    batch <- object_ids[start:min(start + 999, length(object_ids))]
    page <- service_post(list(
      objectIds = paste(batch, collapse = ","),
      outFields = "*",
      returnGeometry = "false"
    ))
    pages[[length(pages) + 1]] <- page$features$attributes
  }
}
result <- if (length(pages)) do.call(rbind, pages) else data.frame()
write.csv(result, output, row.names = FALSE, fileEncoding = "UTF-8")
message(sprintf("Saved %s records to %s", format(nrow(result), big.mark = ","), output))
`
  return { python, r }
}
