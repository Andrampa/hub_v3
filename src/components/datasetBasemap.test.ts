// @vitest-environment happy-dom
import L from 'leaflet'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { BASEMAP_ATTRIBUTION, FALLBACK_ATTRIBUTION } from '../lib/unBasemapStyle'

type Listener = (event: { sourceId?: string; tile?: unknown }) => void

// A stand-in for MapLibre's map: only the event surface the health watch uses.
function glEvents() {
  const listeners = new Map<string, Set<Listener>>()
  return {
    on: (type: string, listener: Listener) => listeners.set(type, (listeners.get(type) || new Set()).add(listener)),
    off: (type: string, listener: Listener) => listeners.get(type)?.delete(listener),
    fire: (type: string, event: { sourceId?: string; tile?: unknown } = {}) => listeners.get(type)?.forEach((listener) => listener(event)),
  }
}

const mocks = vi.hoisted(() => ({
  loadBasemapStyle: vi.fn(),
  maplibreGL: vi.fn(),
}))

vi.mock('../lib/unBasemapStyle', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/unBasemapStyle')>()),
  loadBasemapStyle: mocks.loadBasemapStyle,
}))
vi.mock('@maplibre/maplibre-gl-leaflet', () => ({ maplibreGL: mocks.maplibreGL }))
vi.mock('maplibre-gl/dist/maplibre-gl.css', () => ({}))

const { addDatasetBasemap } = await import('./datasetBasemap')

const STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'un', type: 'line', source: 'UN_boundaries', 'source-layer': 'Country_Line_Boundaries' }],
} as unknown as StyleSpecification

let container: HTMLDivElement
let map: L.Map
let events: ReturnType<typeof glEvents>
let glLayer: L.Layer | undefined

function fakeGlLayer() {
  events = glEvents()
  const GlLayer = L.Layer.extend({
    onAdd() {},
    onRemove() {},
    getMaplibreMap: () => events,
    getContainer: () => document.createElement('div'),
  })
  glLayer = new GlLayer()
  return glLayer
}

async function settle() {
  for (let i = 0; i < 10; i += 1) await new Promise((resolve) => setTimeout(resolve, 0))
}

/** Waits until the MapLibre layer is on the map, however long the imports take. */
async function attached() {
  await vi.waitFor(() => expect(glLayer && map.hasLayer(glLayer)).toBe(true), { timeout: 5000 })
}

const attribution = () => (map.attributionControl as unknown as { _attributions: Record<string, number> })._attributions
const hasFallback = () => Boolean(map.getPane('diemBasemapFallback')?.querySelector('path'))

beforeEach(() => {
  glLayer = undefined
  container = document.createElement('div')
  document.body.append(container)
  map = L.map(container).setView([10, 30], 4)
  mocks.loadBasemapStyle.mockReset().mockResolvedValue(STYLE)
  mocks.maplibreGL.mockReset().mockImplementation(fakeGlLayer)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({} as RenderingContext)
})

afterEach(() => {
  map.remove()
  container.remove()
  vi.restoreAllMocks()
})

describe('addDatasetBasemap', () => {
  it('draws the ArcGIS style and credits its sources', async () => {
    addDatasetBasemap(map)
    await attached()
    expect(attribution()[BASEMAP_ATTRIBUTION]).toBe(1)
    expect(hasFallback()).toBe(false)
  })

  it('adds nothing when removed while the style is still loading', async () => {
    let resolveStyle: (style: StyleSpecification) => void = () => {}
    mocks.loadBasemapStyle.mockReturnValue(new Promise((resolve) => { resolveStyle = resolve }))
    const remove = addDatasetBasemap(map)
    remove()
    resolveStyle(STYLE)
    await settle()
    expect(mocks.maplibreGL).not.toHaveBeenCalled()
    expect(Object.keys(attribution())).toEqual([])
    expect(hasFallback()).toBe(false)
  })

  it('falls back to the bundled UN geometry when the style cannot be read', async () => {
    mocks.loadBasemapStyle.mockRejectedValue(new Error('offline'))
    addDatasetBasemap(map)
    await vi.waitFor(() => expect(hasFallback()).toBe(true), { timeout: 5000 })
    expect(attribution()[FALLBACK_ATTRIBUTION]).toBe(1)
    expect(attribution()[BASEMAP_ATTRIBUTION]).toBeFalsy()
  })

  it('falls back without loading MapLibre when the browser has no WebGL', async () => {
    vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null)
    addDatasetBasemap(map)
    await vi.waitFor(() => expect(hasFallback()).toBe(true), { timeout: 5000 })
    expect(mocks.loadBasemapStyle).not.toHaveBeenCalled()
    expect(mocks.maplibreGL).not.toHaveBeenCalled()
  })

  it('replaces the style once when its UN boundaries fail to load after attaching', async () => {
    addDatasetBasemap(map)
    await attached()
    for (let i = 0; i < 6; i += 1) events.fire('error', { sourceId: 'UN_boundaries' })
    await vi.waitFor(() => expect(hasFallback()).toBe(true), { timeout: 5000 })
    expect(map.hasLayer(glLayer!)).toBe(false)
    expect(map.getPane('diemBasemapFallback')!.children).toHaveLength(1)
    expect(attribution()[FALLBACK_ATTRIBUTION]).toBe(1)
    expect(attribution()[BASEMAP_ATTRIBUTION]).toBeFalsy()
  })

  it('replaces the style when the WebGL context is lost', async () => {
    addDatasetBasemap(map)
    await attached()
    events.fire('sourcedata', { sourceId: 'UN_boundaries', tile: {} })
    events.fire('webglcontextlost')
    await vi.waitFor(() => expect(hasFallback()).toBe(true), { timeout: 5000 })
    expect(map.hasLayer(glLayer!)).toBe(false)
  })

  it('keeps the style through isolated errors once boundary tiles arrived', async () => {
    addDatasetBasemap(map)
    await attached()
    events.fire('sourcedata', { sourceId: 'UN_boundaries', tile: {} })
    for (let i = 0; i < 6; i += 1) events.fire('error', { sourceId: 'UN_boundaries' })
    await settle()
    expect(map.hasLayer(glLayer!)).toBe(true)
    expect(hasFallback()).toBe(false)
  })

  it('removes the background and its credit', async () => {
    const remove = addDatasetBasemap(map)
    await attached()
    remove()
    expect(map.hasLayer(glLayer!)).toBe(false)
    expect(Object.values(attribution()).every((count) => !count)).toBe(true)
  })
})
