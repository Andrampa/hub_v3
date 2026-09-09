import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchPhotoGalleries,
  galleriesForCountry,
  galleryForFlickrAlbum,
  galleryForLegacyItem,
  resetPhotoGalleryCache,
  type PhotoGallery,
} from './photoGalleries'

/**
 * Country pages read galleries from this catalogue, so the country codes it
 * parses decide which photographs appear on which page. The codes are an
 * editor-typed string field, and a gallery shared by two countries records both
 * in it, so the parsing has to survive the separators editors actually use and
 * must never promote a typed country name into an assignment.
 */
const FLICKR_ALBUM = 'https://www.flickr.com/photos/faoemergencies/albums/72177720328904503/'

function row(overrides: Record<string, unknown> = {}) {
  return {
    attributes: {
      gallery_id: 'afg-monitoring-r9',
      title: 'Afghanistan',
      summary: 'Face-to-face household interviews.',
      flickr_url: FLICKR_ALBUM,
      thumbnail_url: 'https://live.staticflickr.com/65535/54772380727_275558796f_b.jpg',
      thumbnail_alt: 'Enumerator interviewing a farmer',
      country_iso3: 'AFG',
      country_name: 'Afghanistan',
      event_or_round: 'Round 9',
      gallery_date: Date.UTC(2024, 8, 23),
      featured: 0,
      display_order: 0,
      credit: 'FAO emergencies / Flickr',
      ...overrides,
    },
  }
}

function respondWith(features: ReturnType<typeof row>[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ features, exceededTransferLimit: false }),
  })
}

async function loadGalleries(features: ReturnType<typeof row>[]) {
  vi.stubGlobal('fetch', respondWith(features))
  return fetchPhotoGalleries()
}

afterEach(() => {
  resetPhotoGalleryCache()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('photo gallery country assignment', () => {
  it('reads a single country code', async () => {
    const [gallery] = await loadGalleries([row()])
    expect(gallery.countryIso3List).toEqual(['AFG'])
    expect(gallery.countryIso3).toBe('AFG')
  })

  it('reads a gallery shared by several countries', async () => {
    const [gallery] = await loadGalleries([row({ country_iso3: 'IRQ;LBN', country_name: 'Iraq and Lebanon' })])
    expect(gallery.countryIso3List).toEqual(['IRQ', 'LBN'])
  })

  it.each([', ', ' / ', ' ', '|'])('accepts %j between codes', async (separator) => {
    const [gallery] = await loadGalleries([row({ country_iso3: `IRQ${separator}LBN` })])
    expect(gallery.countryIso3List).toEqual(['IRQ', 'LBN'])
  })

  it('records no country rather than reading one from the country name', async () => {
    const [gallery] = await loadGalleries([row({ country_iso3: '', country_name: 'Iraq and Lebanon' })])
    expect(gallery.countryIso3List).toEqual([])
  })

  // 'and' is three letters and 'AND' is Andorra, so a prose value read word by
  // word would assign a gallery to a country nobody reviewed it for.
  it.each(['Iraq and Lebanon', 'Global', 'Iraq & Lebanon'])('drops the prose value %j', async (value) => {
    const [gallery] = await loadGalleries([row({ country_iso3: value })])
    expect(gallery.countryIso3List).toEqual([])
  })

  it('still reads codes beside a prose segment', async () => {
    const [gallery] = await loadGalleries([row({ country_iso3: 'Iraq and Lebanon; LBN' })])
    expect(gallery.countryIso3List).toEqual(['LBN'])
  })

  it('keeps the field date rather than any record date', async () => {
    const [gallery] = await loadGalleries([row({ gallery_date: Date.UTC(2024, 8, 23) })])
    expect(gallery.date.toISOString().slice(0, 10)).toBe('2024-09-23')
  })

  it('rejects an album that is not an FAO emergencies album', async () => {
    const galleries = await loadGalleries([row({ flickr_url: 'https://www.flickr.com/photos/someoneelse/albums/1/' })])
    expect(galleries).toEqual([])
  })
})

describe('galleriesForCountry', () => {
  const galleries = [
    { id: 'older', countryIso3List: ['AFG'], date: new Date('2023-02-15'), displayOrder: 0 },
    { id: 'newer', countryIso3List: ['AFG'], date: new Date('2024-09-23'), displayOrder: 0 },
    { id: 'shared', countryIso3List: ['IRQ', 'LBN'], date: new Date('2022-08-07'), displayOrder: 0 },
    { id: 'unassigned', countryIso3List: [], date: new Date('2024-12-31'), displayOrder: 0 },
  ] as PhotoGallery[]

  it('returns the galleries of one country, newest first', () => {
    expect(galleriesForCountry(galleries, 'AFG').map((gallery) => gallery.id)).toEqual(['newer', 'older'])
  })

  it('returns a shared gallery to each of its countries', () => {
    expect(galleriesForCountry(galleries, 'IRQ').map((gallery) => gallery.id)).toEqual(['shared'])
    expect(galleriesForCountry(galleries, 'lbn').map((gallery) => gallery.id)).toEqual(['shared'])
  })

  it('never places an unassigned gallery on a country page', () => {
    expect(galleriesForCountry(galleries, 'XXX')).toEqual([])
    expect(galleriesForCountry(galleries, 'SDN')).toEqual([])
  })
})

/**
 * Hub addresses pointing at the retired StoryMap wrappers are still in
 * circulation, and the catalogue row is what they now stand for. A gallery
 * published the modern way records no wrapper at all, so the lookup has to stay
 * silent for it rather than guessing.
 */
describe('galleryForLegacyItem', () => {
  const WRAPPER_IRQ = 'c19d2a911002483788e289293501875f'
  const WRAPPER_LBN = '2967bf588f36424592cfee80af2a1c0c'

  it('resolves a wrapper item to the gallery that replaced it', async () => {
    const galleries = await loadGalleries([row({ legacy_item_id: WRAPPER_IRQ })])
    expect(galleryForLegacyItem(galleries, WRAPPER_IRQ)?.id).toBe('afg-monitoring-r9')
    expect(galleryForLegacyItem(galleries, WRAPPER_IRQ.toUpperCase())?.id).toBe('afg-monitoring-r9')
  })

  it('resolves both wrappers of a gallery that replaced two', async () => {
    const galleries = await loadGalleries([row({ legacy_item_id: `${WRAPPER_IRQ};${WRAPPER_LBN}` })])
    expect(galleryForLegacyItem(galleries, WRAPPER_IRQ)?.id).toBe('afg-monitoring-r9')
    expect(galleryForLegacyItem(galleries, WRAPPER_LBN)?.id).toBe('afg-monitoring-r9')
  })

  it('leaves a gallery published without a wrapper unmatched', async () => {
    const galleries = await loadGalleries([row({ legacy_item_id: '' })])
    expect(galleries[0].legacyItemIds).toEqual([])
    expect(galleryForLegacyItem(galleries, WRAPPER_IRQ)).toBeUndefined()
  })

  it('ignores a value that is not an item id', async () => {
    const galleries = await loadGalleries([row({ legacy_item_id: 'see the Afghanistan storymap' })])
    expect(galleries[0].legacyItemIds).toEqual([])
    expect(galleryForLegacyItem(galleries, 'not-an-item-id')).toBeUndefined()
  })
})

/**
 * The fallback for a wrapper whose item ID has not been recorded on its row.
 * The album is the only thing the wrapper and the catalogue genuinely share, so
 * a near-match must not be accepted in its place.
 */
describe('galleryForFlickrAlbum', () => {
  it('matches the gallery published from that album', async () => {
    const galleries = await loadGalleries([row()])
    expect(galleryForFlickrAlbum(galleries, '72177720328904503')?.id).toBe('afg-monitoring-r9')
  })

  it('matches nothing for an album the catalogue does not publish', async () => {
    const galleries = await loadGalleries([row()])
    expect(galleryForFlickrAlbum(galleries, '99999999999999999')).toBeUndefined()
    expect(galleryForFlickrAlbum(galleries, undefined)).toBeUndefined()
  })
})

describe('shared loading', () => {
  it('serves a second caller from one request', async () => {
    const fetchMock = respondWith([row()])
    vi.stubGlobal('fetch', fetchMock)
    const [first, second] = await Promise.all([fetchPhotoGalleries(), fetchPhotoGalleries()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(second).toBe(first)
  })

  it('reports an abort to the caller that asked for one', async () => {
    vi.stubGlobal('fetch', respondWith([row()]))
    const controller = new AbortController()
    controller.abort()
    await expect(fetchPhotoGalleries(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
