// Builds src/assets/geo/un-world.topo.json from the official UN Geodata
// simplified service (UN Geospatial). Run with `npm run build:boundaries`.
//
// Country areas (BNDA) and boundary lines (BNDL) are converted into ONE shared
// topology before simplification, so a boundary that is also an area edge is
// the same arc in both layers and cannot drift from its fill. Nothing is added,
// cut or redrawn: the UN attributes that drive the symbology are kept as
// published (`isoclr` for fills, `bdytyp` for line style).
//
// The build fails when a line type appears that the Hub has no symbol for, or
// when a boundary line leaves the area edges other than where the source
// itself draws a line inside an area (the Line of Control and its neighbours).
import { writeFile } from 'node:fs/promises'
import mapshaper from 'mapshaper'

const SERVICE = 'https://pro-ags2.dfs.un.org/arcgis/rest/services/Hosted/UN_Geodata_simplified/FeatureServer'
const ITEM = 'https://geoportal.un.org/arcgis/sharing/rest/content/items/fa74ef8499094e41bf0d025006e37fc9'
const AREAS_LAYER = 2
const LINES_LAYER = 1
// 0 is coastline and 99 marks non-boundary construction lines; both are left out.
const DRAWN_LINE_TYPES = new Set([1, 2, 3, 4])
// Simplification threshold in metres: under one pixel at the Hub's 8x maximum
// zoom on the 960-unit world map, where a pixel is about 5 km at the equator.
const INTERVAL_METRES = 4000
// Coordinate grid: 360 degrees / 20,000 steps is 0.4 pixel at 8x.
const QUANTIZATION = 20000
const OUTPUT = new URL('../src/assets/geo/un-world.topo.json', import.meta.url)

async function getJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${response.status} ${url}`)
  const body = await response.json()
  if (body.error) throw new Error(`${url}: ${JSON.stringify(body.error)}`)
  return body
}

async function queryLayer(layer, where, outFields) {
  const count = (await getJson(`${SERVICE}/${layer}/query?where=${encodeURIComponent(where)}&returnCountOnly=true&f=json`)).count
  const features = []
  while (features.length < count) {
    const page = await getJson(`${SERVICE}/${layer}/query?${new URLSearchParams({
      where,
      outFields,
      outSR: '4326',
      orderByFields: 'objectid',
      resultOffset: String(features.length),
      f: 'geojson',
    })}`)
    if (!page.features.length) throw new Error(`Layer ${layer} stopped after ${features.length} of ${count} features`)
    features.push(...page.features)
  }
  return { type: 'FeatureCollection', features }
}

const item = await getJson(`${ITEM}?f=json`)
const areas = await queryLayer(AREAS_LAYER, '1=1', 'objectid,iso3cd,isoclr,stscod')
const lines = await queryLayer(LINES_LAYER, 'bdytyp NOT IN (0, 99)', 'objectid,iso3cd,bdytyp')

const unknownTypes = [...new Set(lines.features.map((line) => line.properties.bdytyp))]
  .filter((type) => !DRAWN_LINE_TYPES.has(type))
if (unknownTypes.length) {
  throw new Error(`UN boundary types without a Hub symbol: ${unknownTypes.join(', ')}. Add a style before rebuilding.`)
}

const output = await mapshaper.applyCommands(
  [
    '-i areas.json lines.json combine-files',
    `-simplify interval=${INTERVAL_METRES} keep-shapes`,
    '-filter-fields iso3cd,isoclr,stscod target=areas',
    '-filter-fields iso3cd,bdytyp target=lines',
    `-o format=topojson quantization=${QUANTIZATION} target=* un-world.topo.json`,
  ].join(' '),
  { 'areas.json': areas, 'lines.json': lines },
)
const topology = JSON.parse(output['un-world.topo.json'])

// Every boundary arc must also be an area edge, unless the source draws that
// line inside an area: those arcs are not shared with any fill, so they cannot
// misalign with one, and are reported for review.
const flatten = (value) => (Array.isArray(value) ? value.flatMap(flatten) : [value])
const arcIndex = (index) => (index < 0 ? ~index : index)
const areaArcs = new Set(flatten(topology.objects.areas.geometries.map((geometry) => geometry.arcs)).map(arcIndex))
const interior = topology.objects.lines.geometries.filter((geometry) =>
  flatten(geometry.arcs).map(arcIndex).some((index) => !areaArcs.has(index)))
const report = interior.map((geometry) => `${geometry.properties.iso3cd} (type ${geometry.properties.bdytyp})`)
// Reviewed on 2026-09-22 against the 2025-10-07 source: the Line of Control
// and the two Pakistan / Jammu and Kashmir segments that meet it run inside the
// Jammu and Kashmir area; the Congo segment is a 3 km link across the river
// whose two ends are area vertices.
const EXPECTED_INTERIOR = new Set(['IND_PAK (type 4)', 'PAK_xjk (type 1)', 'PAK_xjk (type 3)', 'COD_COG (type 1)'])
const unexpected = report.filter((entry) => !EXPECTED_INTERIOR.has(entry))
if (unexpected.length) {
  throw new Error(`Boundary lines no longer on area edges: ${unexpected.join(', ')}. Inspect them before accepting the build.`)
}

// Features narrower than the coordinate grid collapse; they are invisible at
// every zoom the Hub offers, and listed so nobody mistakes them for missing data.
const collapsed = ['areas', 'lines'].flatMap((layer) => topology.objects[layer].geometries
  .filter((geometry) => !geometry.type)
  .map((geometry) => `${layer === 'areas' ? 'area' : 'line'} ${geometry.properties.iso3cd}`))

topology.source = {
  name: 'UN Geodata simplified',
  publisher: 'United Nations Geospatial',
  item: 'https://geoportal.un.org/arcgis/home/item.html?id=fa74ef8499094e41bf0d025006e37fc9',
  service: SERVICE,
  modified: new Date(item.modified).toISOString().slice(0, 10),
  retrieved: new Date().toISOString().slice(0, 10),
  simplification: `mapshaper -simplify interval=${INTERVAL_METRES} keep-shapes, shared topology`,
  terms: 'Non-commercial use; the United Nations must be credited as the source.',
}
await writeFile(OUTPUT, `${JSON.stringify(topology)}\n`)
console.log(`Wrote ${areas.features.length} areas and ${lines.features.length} boundary lines (source modified ${topology.source.modified}).`)
if (collapsed.length) console.log(`Below the coordinate grid, not drawn: ${collapsed.join(', ')}`)
if (report.length) console.log(`Lines drawn inside areas, as published: ${report.join(', ')}`)
