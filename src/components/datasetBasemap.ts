import L from 'leaflet'
import { BASEMAP_ATTRIBUTION, FALLBACK_ATTRIBUTION, loadBasemapStyle } from '../lib/unBasemapStyle'
import { boundarySources, watchBasemapHealth } from './basemapHealth'

// Background for the Leaflet dataset map, beneath the DIEM features.
//
// The ArcGIS vector style is drawn by MapLibre inside Leaflet's tile pane, so
// the DIEM layers, popups and controls keep working exactly as before. MapLibre
// is loaded with the map, not with the page. The map falls back to the Hub's own
// UN geometry, drawn by Leaflet, when the style or its service metadata cannot
// be read, when the browser has no WebGL, or when MapLibre later reports that
// the UN boundaries cannot be drawn (basemapHealth.ts). The fallback happens at
// most once, and the table, filters and downloads never depend on either.

const FALLBACK_PANE = 'diemBasemapFallback'
const FALLBACK_DASHES: Record<string, string | undefined> = {
  international: undefined,
  mandate: '5 2 1 2',
  undetermined: '4 3',
  control: '1 3',
}

async function fallbackLayer(map: L.Map) {
  const { worldAreaCollection, worldBoundaries } = await import('../lib/unGeometry')
  if (!map.getPane(FALLBACK_PANE)) {
    const pane = map.createPane(FALLBACK_PANE)
    pane.style.zIndex = '250'
    pane.style.pointerEvents = 'none'
  }
  return L.layerGroup([
    L.geoJSON(worldAreaCollection, {
      pane: FALLBACK_PANE,
      interactive: false,
      style: { stroke: false, fillColor: '#f4f4f4', fillOpacity: 1 },
    }),
    ...worldBoundaries.map(({ style, geometry }) => L.geoJSON(geometry, {
      pane: FALLBACK_PANE,
      interactive: false,
      style: { color: '#828282', weight: style === 'control' ? 1.4 : 0.8, dashArray: FALLBACK_DASHES[style], lineCap: 'round' },
    })),
  ])
}

function hasWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

/** Adds the background to a map; the returned function removes it. */
export function addDatasetBasemap(map: L.Map) {
  const controller = new AbortController()
  let layer: L.Layer | undefined
  let removed = false
  let fellBack = false
  let attribution: string | undefined
  let stopWatching: (() => void) | undefined

  const credit = (text?: string) => {
    if (attribution) map.attributionControl?.removeAttribution(attribution)
    attribution = text
    if (text) map.attributionControl?.addAttribution(text)
  }

  const useFallback = async () => {
    if (fellBack || removed) return
    fellBack = true
    stopWatching?.()
    layer?.remove()
    layer = undefined
    credit(undefined)
    const fallback = await fallbackLayer(map)
    if (removed) return
    layer = fallback.addTo(map)
    credit(FALLBACK_ATTRIBUTION)
  }

  void (async () => {
    // Checked first: the MapLibre layer registers its move handlers before it
    // creates its WebGL context, and a failed add leaves them throwing on every
    // pan, which would also stop the map reporting its extent.
    if (!hasWebGL()) {
      await useFallback()
      return
    }
    try {
      const [style, { maplibreGL }] = await Promise.all([
        loadBasemapStyle(controller.signal),
        import('@maplibre/maplibre-gl-leaflet'),
        import('maplibre-gl/dist/maplibre-gl.css'),
      ])
      if (removed) return
      const gl = maplibreGL({ style, interactive: false, attributionControl: false })
      try {
        layer = gl.addTo(map)
      } catch {
        // The WebGL context failed after all. Detach the half-added layer by
        // hand: its own onRemove assumes a MapLibre map that never existed.
        Object.entries(gl.getEvents?.() || {}).forEach(([type, handler]) => map.off(type, handler, gl))
        gl.getContainer()?.remove()
        delete (map as unknown as { _layers: Record<number, L.Layer> })._layers[L.Util.stamp(gl)]
        layer = undefined
        await useFallback()
        return
      }
      credit(BASEMAP_ATTRIBUTION)
      stopWatching = watchBasemapHealth(gl.getMaplibreMap(), boundarySources(style), () => void useFallback())
    } catch {
      await useFallback()
    }
  })()

  return () => {
    removed = true
    controller.abort()
    stopWatching?.()
    layer?.remove()
    credit(undefined)
  }
}
