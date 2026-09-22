import { feature, merge, neighbors } from 'topojson-client'
import type { Feature, FeatureCollection, LineString, MultiLineString, MultiPolygon } from 'geojson'
import type { GeometryCollection, MultiPolygon as TopoMultiPolygon, Polygon as TopoPolygon, Topology } from 'topojson-specification'
import world from '../assets/geo/un-world.topo.json'

// World geometry for the Hub's projected maps: UN Geodata simplified, built by
// `npm run build:boundaries`. Every political choice here is read from the UN
// attributes, never from a list kept in this code:
// - `isoclr` is the UN's own fill assignment for an area;
// - `stscod` 99 marks an area whose sovereignty is in dispute;
// - `bdytyp` is the boundary line's symbol.

interface AreaProperties { iso3cd: string; isoclr: string; stscod: number }
interface LineProperties { iso3cd: string; bdytyp: number }

type AreaGeometry = (TopoPolygon<AreaProperties> | TopoMultiPolygon<AreaProperties>)

const topology = world as unknown as Topology<{
  areas: GeometryCollection<AreaProperties>
  lines: GeometryCollection<LineProperties>
}>

// Features smaller than the coordinate grid, such as the Holy See, have no
// geometry left after the build; the build lists them.
const areaGeometries = (topology.objects.areas.geometries as AreaGeometry[]).filter((geometry) => geometry.type)
const ISO_ALPHA3 = /^[A-Z]{3}$/

/**
 * `country`: an area the UN fills in its own colour, merged with any disputed
 * area it fills in that colour, so one country is one shape and one link.
 * Western Sahara is one, as the UN colours it separately.
 * `territory`: an area the UN fills in its administering state's colour, such
 * as Greenland; drawn plainly, never merged into or linked as that state.
 * `neutral`: an area the UN leaves to no state, because its fill code is not an
 * ISO 3166 country code.
 */
export type AreaKind = 'country' | 'territory' | 'neutral'

export interface WorldArea {
  /** ISO3 of the country, or the UN code of a territory or neutral area. */
  iso3: string
  kind: AreaKind
  feature: Feature<MultiPolygon, { iso3: string }>
}

function areaKind({ iso3cd, isoclr, stscod }: AreaProperties): AreaKind {
  if (!ISO_ALPHA3.test(isoclr)) return 'neutral'
  return iso3cd === isoclr || stscod === 99 ? 'country' : 'territory'
}

function groupKey(properties: AreaProperties) {
  return areaKind(properties) === 'country' ? properties.isoclr : properties.iso3cd
}

const groups = new Map<string, { kind: AreaKind; geometries: AreaGeometry[] }>()
areaGeometries.forEach((geometry) => {
  const properties = geometry.properties!
  const key = groupKey(properties)
  const group = groups.get(key) || { kind: areaKind(properties), geometries: [] }
  group.geometries.push(geometry)
  groups.set(key, group)
})

export const worldAreas: WorldArea[] = [...groups.entries()].map(([iso3, { kind, geometries }]) => ({
  iso3,
  kind,
  feature: { type: 'Feature', properties: { iso3 }, geometry: merge(topology, geometries) },
}))

export const worldAreaCollection: FeatureCollection<MultiPolygon, { iso3: string }> = {
  type: 'FeatureCollection',
  features: worldAreas.map((area) => area.feature),
}

/** UN boundary symbols, keyed by `bdytyp`; the build rejects any other value. */
export const BOUNDARY_STYLES = {
  1: 'international',
  2: 'mandate',
  3: 'undetermined',
  4: 'control',
} as const

export type BoundaryStyle = (typeof BOUNDARY_STYLES)[keyof typeof BOUNDARY_STYLES]

const lineFeatures = (feature(topology, topology.objects.lines) as FeatureCollection<LineString | MultiLineString | null, LineProperties>).features
  .filter((line): line is Feature<LineString | MultiLineString, LineProperties> => line.geometry !== null)

function linesAsMultiLine(lines: Feature<LineString | MultiLineString, LineProperties>[]): MultiLineString {
  return {
    type: 'MultiLineString',
    coordinates: lines.flatMap(({ geometry }) => geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates]),
  }
}

export interface BoundaryGroup {
  style: BoundaryStyle
  geometry: MultiLineString
}

function groupLines(lines: Feature<LineString | MultiLineString, LineProperties>[]): BoundaryGroup[] {
  return (Object.entries(BOUNDARY_STYLES) as [string, BoundaryStyle][]).flatMap(([type, style]) => {
    const matching = lines.filter((line) => line.properties.bdytyp === Number(type))
    return matching.length ? [{ style, geometry: linesAsMultiLine(matching) }] : []
  })
}

/** Every drawn boundary, one geometry per symbol. */
export const worldBoundaries = groupLines(lineFeatures)

// The UN codes each area group answers to, so its boundary lines can be found:
// a line's `iso3cd` names the two areas it separates, such as `IND_xjk`.
const codesByIso = new Map<string, Set<string>>()
areaGeometries.forEach((geometry) => {
  const key = groupKey(geometry.properties!)
  codesByIso.set(key, (codesByIso.get(key) || new Set()).add(geometry.properties!.iso3cd))
})

const areaNeighbours = neighbors(areaGeometries)

/**
 * A country with the neutral areas that touch it, and only the boundaries that
 * outline those shapes: the country-profile outline, where India is shown with
 * Jammu and Kashmir beside it rather than silently cropped.
 */
export function countryWithDisputedSurroundings(iso3: string) {
  const country = worldAreas.find((area) => area.iso3 === iso3 && area.kind === 'country')
  if (!country) return undefined
  const ownCodes = codesByIso.get(iso3) || new Set<string>()
  const neutralCodes = new Set<string>()
  areaGeometries.forEach((geometry, index) => {
    if (!ownCodes.has(geometry.properties!.iso3cd)) return
    areaNeighbours[index].forEach((neighbour) => {
      const properties = areaGeometries[neighbour].properties!
      if (areaKind(properties) === 'neutral') neutralCodes.add(properties.iso3cd)
    })
  })
  const neutral = worldAreas.filter((area) => area.kind === 'neutral' && neutralCodes.has(area.iso3))
  const outlined = new Set([...ownCodes, ...neutralCodes])
  const boundaries = groupLines(lineFeatures.filter((line) => line.properties.iso3cd.split('_').some((code) => outlined.has(code))))
  return { country, neutral, boundaries }
}

export const WORLD_GEOMETRY_SOURCE = (world as unknown as { source: { name: string; publisher: string; modified: string } }).source
