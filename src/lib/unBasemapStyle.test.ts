import { describe, expect, it } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { prepareBasemapStyle, UN_LABEL_SOURCE_LAYER } from './unBasemapStyle'

const UN = 'https://tiles.arcgis.com/tiles/Mj0hjvkNtV7NRhA7/arcgis/rest/services/UN_Basemap/VectorTileServer'
const ESRI = 'https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer'

// The shape of the ArcGIS style: one source with explicit tiles, one with a url only.
const authored = {
  version: 8,
  sources: {
    esri: { type: 'vector', url: ESRI, tiles: [`${ESRI}/tile/{z}/{y}/{x}.pbf`] },
    UN_boundaries: { type: 'vector', url: UN },
  },
  layers: [
    { id: 'Land', type: 'fill', source: 'esri', 'source-layer': 'Land' },
    { id: 'Country_Line_Boundaries/Dashed', type: 'line', source: 'UN_boundaries', 'source-layer': 'Country_Line_Boundaries', paint: { 'line-dasharray': [8, 4] } },
    { id: 'UN labels/Member States', type: 'symbol', source: 'UN_boundaries', 'source-layer': UN_LABEL_SOURCE_LAYER, layout: { 'text-field': '{_name}', visibility: 'none' }, paint: {} },
    { id: 'Admin0 point/large', type: 'symbol', source: 'esri', 'source-layer': 'Admin0 point', layout: { 'text-field': '{_name}', visibility: 'none' } },
  ],
} as unknown as StyleSpecification

describe('prepareBasemapStyle', () => {
  const prepared = prepareBasemapStyle(authored, {
    [UN]: { tiles: ['tile/{z}/{y}/{x}.pbf'], maxLOD: 13 },
    [ESRI]: { tiles: ['tile/{z}/{y}/{x}.pbf'], maxLOD: 16 },
  })

  it('gives every vector source explicit tiles and its real maximum level', () => {
    expect(prepared.sources.UN_boundaries).toEqual({ type: 'vector', tiles: [`${UN}/tile/{z}/{y}/{x}.pbf`], maxzoom: 13 })
    expect(prepared.sources.esri).toEqual({ type: 'vector', tiles: [`${ESRI}/tile/{z}/{y}/{x}.pbf`], maxzoom: 16 })
  })

  it('shows UN country names and leaves Esri names hidden', () => {
    const layer = (id: string) => prepared.layers.find((candidate) => candidate.id === id)
    expect(layer('UN labels/Member States')?.layout).toMatchObject({ visibility: 'visible' })
    expect(layer('Admin0 point/large')?.layout).toMatchObject({ visibility: 'none' })
  })

  it('keeps the authored boundary symbology untouched', () => {
    expect(prepared.layers[1]).toBe(authored.layers[1])
  })
})
