import type { StyleSpecification } from 'maplibre-gl'

// Decides when the MapLibre background has failed for good, so the dataset map
// can swap it for the bundled UN geometry. MapLibre reports tile, sprite, font
// and WebGL problems asynchronously as events, long after the layer was added.
//
// Terminal: a source that draws the UN boundary lines fails `failureLimit`
// times before delivering any tile, or has delivered none after `timeoutMs`,
// or the WebGL context is lost. The map must never show a background without
// the UN boundaries. Isolated errors after a source has delivered tiles, and
// sprite or font errors, only cost symbols or labels and are left alone.

/** The UN boundary lines; a background without them is not acceptable. */
export const BOUNDARY_SOURCE_LAYER = 'Country_Line_Boundaries'

export type BasemapFailure = 'no-boundaries' | 'source' | 'timeout' | 'context'

interface EventSource {
  on(type: string, listener: (event: { sourceId?: string; tile?: unknown }) => void): unknown
  off(type: string, listener: (event: { sourceId?: string; tile?: unknown }) => void): unknown
}

/** Sources whose visible layers draw the UN boundary lines. */
export function boundarySources(style: StyleSpecification) {
  return [...new Set(style.layers.flatMap((layer) =>
    'source-layer' in layer && layer['source-layer'] === BOUNDARY_SOURCE_LAYER && layer.layout?.visibility !== 'none'
      ? [layer.source as string]
      : []))]
}

export function watchBasemapHealth(
  map: EventSource,
  sources: string[],
  onFailure: (reason: BasemapFailure) => void,
  { failureLimit = 3, timeoutMs = 20000 }: { failureLimit?: number; timeoutMs?: number } = {},
) {
  let settled = false
  const loaded = new Set<string>()
  const failures = new Map<string, number>()

  const fail = (reason: BasemapFailure) => {
    if (settled) return
    stop()
    onFailure(reason)
  }
  const onData = (event: { sourceId?: string; tile?: unknown }) => {
    if (!event.sourceId || !event.tile || !sources.includes(event.sourceId)) return
    loaded.add(event.sourceId)
    if (sources.every((source) => loaded.has(source))) {
      window.clearTimeout(timer)
    }
  }
  const onError = (event: { sourceId?: string }) => {
    const source = event.sourceId
    if (!source || !sources.includes(source) || loaded.has(source)) return
    const count = (failures.get(source) || 0) + 1
    failures.set(source, count)
    if (count >= failureLimit) fail('source')
  }
  const onContextLost = () => fail('context')

  function stop() {
    settled = true
    window.clearTimeout(timer)
    map.off('sourcedata', onData)
    map.off('error', onError)
    map.off('webglcontextlost', onContextLost)
  }

  map.on('sourcedata', onData)
  map.on('error', onError)
  map.on('webglcontextlost', onContextLost)
  const timer = window.setTimeout(() => {
    if (!sources.every((source) => loaded.has(source))) fail('timeout')
  }, timeoutMs)
  if (!sources.length) fail('no-boundaries')

  return stop
}
