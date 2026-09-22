import { describe, expect, it } from 'vitest'
import { countryWithDisputedSurroundings, WORLD_GEOMETRY_SOURCE, worldAreas, worldBoundaries } from './unGeometry'

const area = (iso3: string) => worldAreas.find((candidate) => candidate.iso3 === iso3)

describe('UN world geometry', () => {
  it('leaves the areas the UN assigns to no state neutral', () => {
    const neutral = worldAreas.filter((candidate) => candidate.kind === 'neutral').map((candidate) => candidate.iso3)
    // Jammu and Kashmir, Aksai Chin, and Abyei from UN Geospatial ClearMap.
    expect(neutral.sort()).toEqual(['xAB', 'xac', 'xjk'])
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
    expect(countryWithDisputedSurroundings('IND')?.neutral.map((neutral) => neutral.iso3)).toEqual(['xjk'])
    expect(countryWithDisputedSurroundings('KEN')?.neutral).toEqual([])
    // Abyei is disputed between Sudan and South Sudan, and shown with both.
    expect(countryWithDisputedSurroundings('SDN')?.neutral.map((neutral) => neutral.iso3)).toEqual(['xAB'])
    expect(countryWithDisputedSurroundings('SSD')?.neutral.map((neutral) => neutral.iso3)).toEqual(['xAB'])
    // Afghanistan meets Jammu and Kashmir only along an international boundary.
    expect(countryWithDisputedSurroundings('AFG')?.neutral).toEqual([])
    expect(countryWithDisputedSurroundings('xjk')).toBeUndefined()
  })

  it('outlines a country without covering its disputed lines', () => {
    const kenya = countryWithDisputedSurroundings('KEN')!.outline
    expect(kenya.coordinates.length).toBeGreaterThan(0)
    // No stretch of a dashed or dotted UN line is drawn over by the solid
    // outline: Pakistan's with Jammu and Kashmir, South Sudan's with Sudan.
    const segments = (lines: number[][][]) => new Set(lines.flatMap((line) =>
      line.slice(1).map((point, index) => [line[index].join(), point.join()].sort().join('|'))))
    for (const iso3 of ['PAK', 'SSD', 'SDN']) {
      const shape = countryWithDisputedSurroundings(iso3)!
      const outline = segments(shape.outline.coordinates)
      const special = shape.boundaries.filter((group) => group.style !== 'international').flatMap((group) => [...segments(group.geometry.coordinates)])
      expect(special.length, iso3).toBeGreaterThan(0)
      expect(special.filter((segment) => outline.has(segment)), iso3).toEqual([])
    }
  })

  it('records where the geometry came from', () => {
    expect(WORLD_GEOMETRY_SOURCE.publisher).toBe('United Nations Geospatial')
    expect(WORLD_GEOMETRY_SOURCE.modified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
