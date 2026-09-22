import { describe, expect, it } from 'vitest'
import { countryWithDisputedSurroundings, WORLD_GEOMETRY_SOURCE, worldAreas, worldBoundaries } from './unGeometry'

const area = (iso3: string) => worldAreas.find((candidate) => candidate.iso3 === iso3)

describe('UN world geometry', () => {
  it('leaves the areas the UN assigns to no state neutral', () => {
    const neutral = worldAreas.filter((candidate) => candidate.kind === 'neutral').map((candidate) => candidate.iso3)
    expect(neutral.sort()).toEqual(['xac', 'xjk'])
  })

  it('draws one shape and one link per state, including its UN-coloured disputed parts', () => {
    const ids = worldAreas.map((candidate) => candidate.iso3)
    expect(new Set(ids).size).toBe(ids.length)
    expect(area('SOM')?.kind).toBe('country')
    // No separate shapes for areas the UN does not recognise as states.
    expect(area('SOL')).toBeUndefined()
    expect(area('KOS')).toBeUndefined()
    expect(area('CYN')).toBeUndefined()
    // Gaza and the West Bank are one Palestine link.
    expect(area('PSE')?.feature.geometry.coordinates.length).toBeGreaterThanOrEqual(2)
  })

  it('keeps territories apart from their administering state', () => {
    expect(area('GRL')?.kind).toBe('territory')
    expect(area('DNK')?.kind).toBe('country')
    // Western Sahara carries its own UN fill, so it is never part of Morocco.
    expect(area('ESH')).toBeDefined()
  })

  it('draws every UN boundary symbol', () => {
    expect(worldBoundaries.map((group) => group.style).sort()).toEqual(['control', 'international', 'mandate', 'undetermined'])
  })

  it('shows a country beside the neutral areas that touch it', () => {
    const pakistan = countryWithDisputedSurroundings('PAK')
    expect(pakistan?.neutral.map((neutral) => neutral.iso3)).toContain('xjk')
    expect(pakistan?.boundaries.map((group) => group.style)).toEqual(expect.arrayContaining(['undetermined', 'control']))
    expect(countryWithDisputedSurroundings('KEN')?.neutral).toEqual([])
    expect(countryWithDisputedSurroundings('xjk')).toBeUndefined()
  })

  it('records where the geometry came from', () => {
    expect(WORLD_GEOMETRY_SOURCE.publisher).toBe('United Nations Geospatial')
    expect(WORLD_GEOMETRY_SOURCE.modified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
