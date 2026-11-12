// Derive decorative fills from the Hub's local UN Geodata, with no network access.
// Run after refreshing the brief export or rebuilding the UN boundary data.
import { readFile, writeFile } from 'node:fs/promises'
import { geoArea, geoCentroid } from 'd3-geo'
import mapshaper from 'mapshaper'
import { merge } from 'topojson-client'

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'))
const world = await readJson('../src/assets/geo/un-world.topo.json')
const { briefs } = await readJson('../src/data/briefSpotlight.json')
const countries = [...new Set(briefs.map(({ iso3 }) => iso3))].sort()
const worldAreas = world.objects.areas.geometries.filter(({ type }) => type)
const features = countries.flatMap((iso3) => {
  const areas = worldAreas.filter(({ properties }) =>
    properties.isoclr === iso3 && (properties.iso3cd === iso3 || properties.stscod === 99))
  return areas.length ? [{ type: 'Feature', properties: { iso3 }, geometry: merge(world, areas) }] : []
})

function windForD3(geometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  for (const rings of polygons) {
    if (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI) {
      rings.forEach((ring) => ring.reverse())
    }
  }
  return geometry
}

// Simplify the distant land layer only. Country highlights use the Hub's
// boundary geometry at its original detail.
const land = { type: 'Feature', properties: { layer: 'land' }, geometry: merge(world, worldAreas) }
const output = await mapshaper.applyCommands(
  '-i land.json -simplify interval=40km keep-shapes -o format=geojson land-light.json',
  { 'land.json': JSON.stringify({ type: 'FeatureCollection', features: [land] }) },
)
const coast = windForD3(JSON.parse(output['land-light.json']).features[0].geometry)
const outlines = Object.fromEntries(features.map((feature) => {
  const outline = windForD3(feature.geometry)
  return [feature.properties.iso3, { center: geoCentroid(outline), outline }]
}))
const globe = JSON.stringify({ land: coast, countries: outlines }, (_, value) =>
  typeof value === 'number' ? Number(value.toFixed(3)) : value)
await writeFile(new URL('../src/data/briefSpotlightShapes.json', import.meta.url), globe + '\n')
