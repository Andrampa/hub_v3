// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { StyleSpecification } from 'maplibre-gl'
import { boundarySources, watchBasemapHealth } from './basemapHealth'

type Listener = (event: { sourceId?: string; tile?: unknown }) => void

function emitter() {
  const listeners = new Map<string, Set<Listener>>()
  return {
    on: (type: string, listener: Listener) => listeners.set(type, (listeners.get(type) || new Set()).add(listener)),
    off: (type: string, listener: Listener) => listeners.get(type)?.delete(listener),
    fire: (type: string, event: { sourceId?: string; tile?: unknown } = {}) => listeners.get(type)?.forEach((listener) => listener(event)),
    count: () => [...listeners.values()].reduce((total, set) => total + set.size, 0),
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('boundarySources', () => {
  it('finds the sources whose visible layers draw the UN boundary lines', () => {
    const style = {
      version: 8,
      sources: {},
      layers: [
        { id: 'land', type: 'fill', source: 'esri', 'source-layer': 'Land' },
        { id: 'un', type: 'line', source: 'UN_boundaries', 'source-layer': 'Country_Line_Boundaries' },
        { id: 'esri', type: 'line', source: 'esri', 'source-layer': 'Country_Line_Boundaries', layout: { visibility: 'none' } },
      ],
    } as unknown as StyleSpecification
    expect(boundarySources(style)).toEqual(['UN_boundaries'])
  })
})

describe('watchBasemapHealth', () => {
  it('fails once when the boundary source never delivers a tile', () => {
    const map = emitter()
    const onFailure = vi.fn()
    watchBasemapHealth(map, ['UN'], onFailure)
    map.fire('error', { sourceId: 'UN' })
    map.fire('error', { sourceId: 'UN' })
    expect(onFailure).not.toHaveBeenCalled()
    map.fire('error', { sourceId: 'UN' })
    map.fire('error', { sourceId: 'UN' })
    expect(onFailure).toHaveBeenCalledTimes(1)
    expect(onFailure).toHaveBeenCalledWith('source')
    expect(map.count()).toBe(0)
  })

  it('ignores errors from other sources, from sprites and fonts, and after tiles arrived', () => {
    const map = emitter()
    const onFailure = vi.fn()
    watchBasemapHealth(map, ['UN'], onFailure)
    for (let i = 0; i < 5; i += 1) map.fire('error', { sourceId: 'esri' })
    for (let i = 0; i < 5; i += 1) map.fire('error', {})
    map.fire('sourcedata', { sourceId: 'UN', tile: {} })
    for (let i = 0; i < 5; i += 1) map.fire('error', { sourceId: 'UN' })
    vi.advanceTimersByTime(60000)
    expect(onFailure).not.toHaveBeenCalled()
  })

  it('fails when no boundary tile has arrived in time', () => {
    const map = emitter()
    const onFailure = vi.fn()
    watchBasemapHealth(map, ['UN'], onFailure, { timeoutMs: 1000 })
    map.fire('sourcedata', { sourceId: 'UN' }) // metadata, not a tile
    vi.advanceTimersByTime(1000)
    expect(onFailure).toHaveBeenCalledWith('timeout')
  })

  it('fails when the WebGL context is lost', () => {
    const map = emitter()
    const onFailure = vi.fn()
    watchBasemapHealth(map, ['UN'], onFailure)
    map.fire('sourcedata', { sourceId: 'UN', tile: {} })
    map.fire('webglcontextlost')
    expect(onFailure).toHaveBeenCalledWith('context')
  })

  it('fails at once when the style draws no UN boundaries', () => {
    const onFailure = vi.fn()
    watchBasemapHealth(emitter(), [], onFailure)
    expect(onFailure).toHaveBeenCalledWith('no-boundaries')
  })

  it('stops listening when stopped', () => {
    const map = emitter()
    const onFailure = vi.fn()
    const stop = watchBasemapHealth(map, ['UN'], onFailure)
    stop()
    map.fire('webglcontextlost')
    vi.advanceTimersByTime(60000)
    expect(onFailure).not.toHaveBeenCalled()
    expect(map.count()).toBe(0)
  })
})
