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

export const MAP_FEATURE_LIMIT = 250
export const BROWSER_EXPORT_LIMIT = 20000

export interface ServiceLayerReference {
  id: number
  name: string
}

export interface FeatureField {
  name: string
  alias: string
  type: string
  domain?: unknown
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

export function fieldIsNumeric(field: FeatureField | undefined) {
  return /smallinteger|integer|single|double|oid/i.test(field?.type || '')
}

export function fieldIsText(field: FeatureField | undefined) {
  return /string|guid|globalid/i.test(field?.type || '')
}

function escapeSql(value: string) {
  return value.replaceAll("'", "''")
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
    if (filter.operator === 'contains') return [`UPPER(${field.name}) LIKE '%${escapeSql(value).toUpperCase()}%'`]
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
  if (resolved.access !== 'available' || !resolved.item) throw new Error('The dataset details could not be read from ArcGIS Online.')
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

export async function fetchGeometryPreview(
  definition: DatasetDefinition,
  where: string,
  requester: ProtectedRequester,
) {
  if (definition.isTable || !definition.layer.geometryType) return { type: 'FeatureCollection', features: [] } as GeoJsonResponse
  const response = await requester<EsriGeometryResponse>(`${definition.layerUrl}/query`, {
    f: 'json',
    where,
    outFields: Array.from(new Set([
      definition.layer.objectIdField,
      definition.layer.displayField,
      ...usableFields(definition.layer.fields)
        .filter((field) => /^(adm[0-2]_(name|iso3)|adm_name|country|name)$/i.test(field.name))
        .slice(0, 8)
        .map((field) => field.name),
    ].filter(Boolean))).join(',') || '*',
    returnGeometry: 'true',
    outSR: '4326',
    geometryPrecision: '4',
    maxAllowableOffset: '0.02',
    resultRecordCount: String(MAP_FEATURE_LIMIT),
    returnExceededLimitFeatures: 'false',
  })
  return esriFeaturesToGeoJson(response)
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
  maximum: number,
) {
  const features: Feature<Geometry, GeoJsonProperties>[] = []
  const pageSize = Math.min(definition.layer.maxRecordCount || 1000, 1000)
  for (let offset = 0; offset < maximum; offset += pageSize) {
    const page = await requester<EsriGeometryResponse>(`${definition.layerUrl}/query`, {
      f: 'json',
      where,
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      resultOffset: String(offset),
      resultRecordCount: String(Math.min(pageSize, maximum - offset)),
      orderByFields: definition.layer.objectIdField ? `${definition.layer.objectIdField} ASC` : undefined,
    })
    const converted = esriFeaturesToGeoJson(page)
    features.push(...converted.features)
    const returned = page.features?.length || 0
    if (returned < pageSize || !page.exceededTransferLimit) break
  }
  return { type: 'FeatureCollection', features } as GeoJsonResponse
}

async function fetchAllAttributes(
  definition: DatasetDefinition,
  where: string,
  requester: ProtectedRequester,
  maximum = BROWSER_EXPORT_LIMIT,
) {
  const rows: Record<string, unknown>[] = []
  const pageSize = Math.min(definition.layer.maxRecordCount || 1000, 1000)
  for (let offset = 0; offset < maximum; offset += pageSize) {
    const page = await requester<QueryResponse>(`${definition.layerUrl}/query`, {
      where,
      outFields: '*',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(pageSize),
    })
    const pageRows = (page.features || []).map((feature) => feature.attributes)
    rows.push(...pageRows)
    if (pageRows.length < pageSize || !page.exceededTransferLimit) break
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
  const rows = await fetchAllAttributes(definition, where, requester)
  const columns = usableFields(definition.layer.fields).map((field) => field.name)
  const lines = [columns.join(','), ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(','))]
  return new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8' })
}

export async function downloadGeoJson(
  definition: DatasetDefinition,
  where: string,
  count: number,
  requester: ProtectedRequester,
) {
  if (count > BROWSER_EXPORT_LIMIT) throw new Error(`This filtered result has more than ${BROWSER_EXPORT_LIMIT.toLocaleString()} records. Use the service API for a larger automated extraction.`)
  const response = await fetchEsriGeoJsonPages(definition, where, requester, BROWSER_EXPORT_LIMIT)
  return new Blob([JSON.stringify(response)], { type: 'application/geo+json' })
}

export type HubDownloadFormat = 'csv' | 'shp' | 'geojson' | 'kml' | 'filegdb' | 'xlsx' | 'sqlite' | 'geopackage'

export const HUB_DOWNLOAD_FORMATS: Array<{ format: HubDownloadFormat; label: string; spatial: boolean; route: string; extension: string }> = [
  { format: 'csv', label: 'CSV', spatial: false, route: 'csv', extension: 'csv' },
  { format: 'xlsx', label: 'Excel', spatial: false, route: 'excel', extension: 'xlsx' },
  { format: 'shp', label: 'Shapefile', spatial: true, route: 'shapefile', extension: 'zip' },
  { format: 'geojson', label: 'GeoJSON', spatial: true, route: 'geojson', extension: 'geojson' },
  { format: 'kml', label: 'KML / KMZ', spatial: true, route: 'kml', extension: 'kmz' },
  { format: 'filegdb', label: 'File Geodatabase', spatial: true, route: 'filegdb', extension: 'zip' },
  { format: 'geopackage', label: 'GeoPackage', spatial: true, route: 'geoPackage', extension: 'gpkg' },
  { format: 'sqlite', label: 'SQLite', spatial: true, route: 'sqlite', extension: 'sqlite' },
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
    itemData: `${DATA_REST}/content/items/${definition.resource.id}/data?f=json`,
  }
}

export function bulkDownloadScripts(definition: DatasetDefinition, where: string) {
  const queryUrl = `${definition.layerUrl}/query`
  const filename = `${definition.resource.fallbackTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-bulk.csv`
  const python = `# DIEM bulk attribute download (Python 3, standard library only)
# Set a short-lived ArcGIS token before running:
# Windows PowerShell: $env:ARCGIS_TOKEN="your-token"
import csv
import json
import os
import urllib.parse
import urllib.request

QUERY_URL = ${JSON.stringify(queryUrl)}
WHERE = ${JSON.stringify(where)}
OUTPUT = ${JSON.stringify(filename)}
TOKEN = os.environ["ARCGIS_TOKEN"]

def arcgis_post(parameters):
    body = urllib.parse.urlencode({"f": "json", "token": TOKEN, **parameters}).encode()
    with urllib.request.urlopen(QUERY_URL, body) as response:
        payload = json.load(response)
    if "error" in payload:
        raise RuntimeError(payload["error"])
    return payload

id_result = arcgis_post({"where": WHERE, "returnIdsOnly": "true"})
object_ids = id_result.get("objectIds", [])
rows = []
for start in range(0, len(object_ids), 1000):
    page = arcgis_post({
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
# Packages: install.packages(c("httr", "jsonlite"))
# Set a short-lived token before running:
# Sys.setenv(ARCGIS_TOKEN="your-token")
library(httr)
library(jsonlite)

query_url <- ${JSON.stringify(queryUrl)}
where <- ${JSON.stringify(where)}
output <- ${JSON.stringify(filename)}
token <- Sys.getenv("ARCGIS_TOKEN")
if (token == "") stop("Set ARCGIS_TOKEN before running this script.")

arcgis_post <- function(parameters) {
  response <- POST(query_url, body = c(list(f="json", token=token), parameters), encode="form")
  stop_for_status(response)
  payload <- fromJSON(content(response, as="text", encoding="UTF-8"), simplifyVector=TRUE)
  if (!is.null(payload$error)) stop(toJSON(payload$error, auto_unbox=TRUE))
  payload
}

id_result <- arcgis_post(list(where=where, returnIdsOnly="true"))
object_ids <- unlist(id_result$objectIds)
pages <- list()
if (length(object_ids) > 0) {
  for (start in seq(1, length(object_ids), by=1000)) {
    batch <- object_ids[start:min(start + 999, length(object_ids))]
    page <- arcgis_post(list(
      objectIds=paste(batch, collapse=","),
      outFields="*",
      returnGeometry="false"
    ))
    pages[[length(pages) + 1]] <- page$features$attributes
  }
}
result <- if (length(pages)) do.call(rbind, pages) else data.frame()
write.csv(result, output, row.names=FALSE, fileEncoding="UTF-8")
message(sprintf("Saved %s records to %s", format(nrow(result), big.mark=","), output))
`
  return { python, r }
}
