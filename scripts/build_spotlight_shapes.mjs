// Derive decorative fills from the Hub's local UN Geodata, with no network access.
// Run after refreshing the brief export or rebuilding the UN boundary data.
import { readFile, writeFile } from 'node:fs/promises'
import { geoArea, geoCentroid, geoGraticule, geoOrthographic, geoPath } from 'd3-geo'
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
const grid = geoGraticule().stepMajor([45, 45]).stepMinor([45, 45]).precision(12)()
const shapes = Object.fromEntries(features.map((feature) => {
  windForD3(feature.geometry)
  const [longitude, latitude] = geoCentroid(feature)
  const projection = geoOrthographic().rotate([-longitude, -latitude]).translate([100, 100]).scale(96)
  const path = geoPath(projection)
  const country = path.digits(2)(feature)
  if (!country) throw new Error(`No projected country outline for ${feature.properties.iso3}`)
  return [feature.properties.iso3, {
    land: path.digits(0)(coast),
    grid: path.digits(0)(grid),
    country,
  }]
}))
await writeFile(new URL('../src/data/briefSpotlightShapes.json', import.meta.url), JSON.stringify(shapes) + '\n')
