import { afterEach, describe, expect, it, vi } from 'vitest'
import { readLegacyHubAddress, resolveLegacyHubSlug } from './legacyHubAddress'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readLegacyHubAddress', () => {
  it('reads the item id out of every viewer the previous site served', () => {
    const id = 'ae7bde039c97489e95420cb8ecadddb6'
    for (const path of [
      `/documents/${id}/about`,
      `/documents/${id}`,
      `/maps/${id}`,
      `/maps/${id}/explore`,
      `/apps/${id}/explore`,
      `/apps/${id}`,
    ]) {
      expect(readLegacyHubAddress(path)).toEqual({ kind: 'item', itemId: id })
    }
  })

  it('leaves the previous site\'s own pages alone: no product answers for one', () => {
    const id = 'ae7bde039c97489e95420cb8ecadddb6'
    expect(readLegacyHubAddress('/pages/about')).toBeUndefined()
    expect(readLegacyHubAddress(`/pages/${id}`)).toBeUndefined()
    expect(readLegacyHubAddress('/pages/hqfao::where-we-work')).toBeUndefined()
  })

  it('refuses a malformed escape rather than throwing out of the render', () => {
    expect(() => readLegacyHubAddress('/documents/%ZZ/about')).not.toThrow()
    expect(readLegacyHubAddress('/documents/%ZZ/about')).toBeUndefined()
    expect(readLegacyHubAddress('/maps/%E0%A4%A')).toBeUndefined()
  })

  it('normalizes a capitalized item id, which ArcGIS treats as the same item', () => {
    expect(readLegacyHubAddress('/maps/AE7BDE039C97489E95420CB8ECADDDB6'))
      .toEqual({ kind: 'item', itemId: 'ae7bde039c97489e95420cb8ecadddb6' })
  })

  it('reads a Hub slug, including the percent-encoded accents editors wrote', () => {
    expect(readLegacyHubAddress('/documents/hqfao::cameroon-agricultural-calendar/about'))
      .toEqual({ kind: 'slug', slug: 'hqfao::cameroon-agricultural-calendar' })
    expect(readLegacyHubAddress('/documents/hqfao::r%C3%A9publique-centrafricaine-calendrier-agricole/about'))
      .toEqual({ kind: 'slug', slug: 'hqfao::république-centrafricaine-calendrier-agricole' })
  })

  it('claims nothing it cannot translate, so the address still reaches the 404 page', () => {
    expect(readLegacyHubAddress('/pages/about')).toBeUndefined()
    expect(readLegacyHubAddress('/documents')).toBeUndefined()
    expect(readLegacyHubAddress('/catalog/ae7bde039c97489e95420cb8ecadddb6')).toBeUndefined()
    expect(readLegacyHubAddress('/maps/not-an-item')).toBeUndefined()
  })
})

describe('resolveLegacyHubSlug', () => {
  function stubFetch(status: number, payload: unknown) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(payload),
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  it('asks ArcGIS, not the previous site, which item a slug names', async () => {
    const fetchMock = stubFetch(200, { data: [{ id: '88be426f293a464c8117a6d8e48e00e2' }] })
    await expect(resolveLegacyHubSlug('hqfao::burkina-faso-calendrier-agricole'))
      .resolves.toBe('88be426f293a464c8117a6d8e48e00e2')
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      'https://hub.arcgis.com/api/v3/datasets?filter%5Bslug%5D=hqfao%3A%3Aburkina-faso-calendrier-agricole',
    )
  })

  it('drops the layer suffix a feature layer dataset id carries', async () => {
    stubFetch(200, { data: [{ id: '88be426f293a464c8117a6d8e48e00e2_0' }] })
    await expect(resolveLegacyHubSlug('hqfao::a-layer')).resolves.toBe('88be426f293a464c8117a6d8e48e00e2')
  })

  it('resolves to nothing rather than failing when the slug answers for no item', async () => {
    stubFetch(200, { data: [] })
    await expect(resolveLegacyHubSlug('hqfao::withdrawn')).resolves.toBeUndefined()
  })

  it('resolves to nothing when the lookup is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(resolveLegacyHubSlug('hqfao::anything')).resolves.toBeUndefined()
  })
})
