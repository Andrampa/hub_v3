const DEFAULT_PHOTO_GALLERY_SERVICE_URL = 'https://services5.arcgis.com/sjP4Ugu5s0dZWLjd/arcgis/rest/services/DIEM_Hub_3.0_%E2%80%94_Photo_gallery_catalogue/FeatureServer/0'

export interface PhotoGallery {
  id: string
  title: string
  summary: string
  flickrUrl: string
  thumbnailUrl: string
  thumbnailAlt: string
  /** First assigned code, kept for surfaces that show a single origin. */
  countryIso3: string
  /**
   * Every assigned code, from the catalogue's country field alone. Empty means
   * the gallery records no country: not that it is global, which no stored
   * value states, and which the country name must never be read as.
   */
  countryIso3List: string[]
  countryName: string
  /**
   * Item IDs of the StoryMap wrappers this gallery replaces, if any.
   *
   * The wrappers existed only to carry a Flickr link before the catalogue did,
   * and Hub URLs pointing at them are still in circulation. A gallery published
   * the modern way records none, which is the expected state from now on.
   */
  legacyItemIds: string[]
  eventOrRound: string
  date: Date
  featured: boolean
  displayOrder: number
  credit: string
}

interface GalleryAttributes {
  gallery_id?: string
  title?: string
  summary?: string
  flickr_url?: string
  thumbnail_url?: string
  thumbnail_alt?: string
  country_iso3?: string
  country_name?: string
  legacy_item_id?: string
  event_or_round?: string
  gallery_date?: number | string
  featured?: number
  display_order?: number
  credit?: string
}

interface GalleryQueryResponse {
  features?: Array<{ attributes: GalleryAttributes }>
  exceededTransferLimit?: boolean
  error?: { message?: string }
}

const PAGE_SIZE = 100

/** How long a loaded catalogue is reused before a caller waits on the network. */
const CACHE_TTL_MS = 15 * 60 * 1000

function serviceUrl() {
  const configured = import.meta.env.VITE_PHOTO_GALLERY_SERVICE_URL?.trim()
  return (configured || DEFAULT_PHOTO_GALLERY_SERVICE_URL).replace(/\/$/, '')
}

function safeExternalUrl(value: string | undefined, kind: 'flickr' | 'thumbnail') {
  if (!value) return ''
  try {
    const url = new URL(value)
    const isFlickrGallery = kind === 'flickr'
      && url.protocol === 'https:'
      && url.hostname === 'www.flickr.com'
      && /^\/photos\/faoemergencies\/(?:albums|sets)\//.test(url.pathname)
    const isFlickrImage = kind === 'thumbnail'
      && url.protocol === 'https:'
      && url.hostname === 'live.staticflickr.com'
    return isFlickrGallery || isFlickrImage ? url.href : ''
  } catch {
    return ''
  }
}

/**
 * Country codes recorded for one gallery.
 *
 * A single-country row stores one code and a shared row stores several, so the
 * separator an editor reaches for is accepted in all its usual forms rather
 * than dictated to them. A segment is taken only when every word in it is a
 * three-letter code, because a prose value must not yield one: 'Iraq and
 * Lebanon' contains 'and', and 'AND' is Andorra. Reading that as an assignment
 * would put photographs on a country page nobody reviewed them for.
 */
function extractCountryCodes(value: string | undefined) {
  const codes = String(value || '')
    .split(/[;,/|]+/)
    .flatMap((segment) => {
      const words = segment.trim().toUpperCase().split(/\s+/).filter(Boolean)
      return words.length && words.every((word) => /^[A-Z]{3}$/.test(word)) ? words : []
    })
  return [...new Set(codes)]
}

/**
 * ArcGIS item IDs recorded against one gallery.
 *
 * A gallery that replaced two wrappers records both, so the field is read as a
 * list on the same separators as the country codes. Only a 32-character hex id
 * is kept: anything else an editor typed there addresses no item.
 */
function extractLegacyItemIds(value: string | undefined) {
  return [...new Set(String(value || '')
    .split(/[;,/|\s]+/)
    .map((id) => id.trim().toLowerCase())
    .filter((id) => /^[a-f0-9]{32}$/.test(id)))]
}

function normalizeGallery(attributes: GalleryAttributes): PhotoGallery | undefined {
  const id = String(attributes.gallery_id || '').trim()
  const title = String(attributes.title || '').trim()
  const flickrUrl = safeExternalUrl(attributes.flickr_url, 'flickr')
  const rawDate = attributes.gallery_date
  const date = new Date(typeof rawDate === 'number' ? rawDate : String(rawDate || ''))
  if (!id || !title || !flickrUrl || Number.isNaN(date.getTime())) return undefined

  const countryIso3List = extractCountryCodes(attributes.country_iso3)

  return {
    id,
    title,
    summary: String(attributes.summary || '').trim(),
    flickrUrl,
    thumbnailUrl: safeExternalUrl(attributes.thumbnail_url, 'thumbnail'),
    thumbnailAlt: String(attributes.thumbnail_alt || '').trim(),
    countryIso3: countryIso3List[0] || '',
    countryIso3List,
    countryName: String(attributes.country_name || '').trim(),
    legacyItemIds: extractLegacyItemIds(attributes.legacy_item_id),
    eventOrRound: String(attributes.event_or_round || '').trim(),
    date,
    featured: Number(attributes.featured) === 1,
    displayOrder: Number(attributes.display_order) || 0,
    credit: String(attributes.credit || 'FAO emergencies / Flickr').trim(),
  }
}

async function queryPublishedGalleries(): Promise<PhotoGallery[]> {
  const galleries: PhotoGallery[] = []
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      f: 'json',
      where: "publication_status = 'Published'",
      outFields: 'gallery_id,title,summary,flickr_url,thumbnail_url,thumbnail_alt,country_iso3,country_name,legacy_item_id,event_or_round,gallery_date,featured,display_order,credit',
      orderByFields: 'gallery_date DESC, display_order ASC',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    })
    const response = await fetch(`${serviceUrl()}/query?${params}`)
    if (!response.ok) throw new Error(`Photo gallery service request failed (${response.status})`)
    const data = await response.json() as GalleryQueryResponse
    if (data.error) throw new Error(data.error.message || 'Photo gallery service request failed')
    const page = (data.features || [])
      .map(({ attributes }) => normalizeGallery(attributes))
      .filter((gallery): gallery is PhotoGallery => Boolean(gallery))
    galleries.push(...page)
    hasMore = Boolean(data.exceededTransferLimit) && page.length > 0
    offset += PAGE_SIZE
  }

  return galleries
}

let cached: { at: number, galleries: PhotoGallery[] } | undefined
let inFlight: Promise<PhotoGallery[]> | undefined

/**
 * One load serves every gallery surface on the page.
 *
 * A country page now shows galleries beside the gallery page's own listing, and
 * both want the same rows. The shared load deliberately ignores the caller's
 * abort signal: one component unmounting must not cancel a request another
 * component is still waiting on. The signal is still honoured for the caller
 * that passed it, which is what its `AbortError` handling expects.
 */
export async function fetchPhotoGalleries(signal?: AbortSignal): Promise<PhotoGallery[]> {
  if (!cached || Date.now() - cached.at >= CACHE_TTL_MS) {
    if (!inFlight) {
      inFlight = queryPublishedGalleries()
        .then((galleries) => {
          cached = { at: Date.now(), galleries }
          return galleries
        })
        .finally(() => {
          inFlight = undefined
        })
    }
    await inFlight
  }
  if (signal?.aborted) throw new DOMException('Photo gallery request aborted', 'AbortError')
  return cached?.galleries || []
}

/** Discards the shared copy. Exposed for tests, which must not inherit one. */
export function resetPhotoGalleryCache() {
  cached = undefined
  inFlight = undefined
}

/**
 * Galleries assigned to one country, newest first.
 *
 * Assignment is the stored country codes and nothing else, so a gallery with no
 * code cannot reach a country page. That is the honest outcome: an unassigned
 * row states no country, and guessing one from its title would put photographs
 * on a page they were never reviewed for.
 */
export function galleriesForCountry(galleries: PhotoGallery[], iso3: string) {
  const code = iso3.trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(code)) return []
  return galleries
    .filter((gallery) => gallery.countryIso3List.includes(code))
    .sort((first, second) => (
      second.date.getTime() - first.date.getTime() || first.displayOrder - second.displayOrder
    ))
}

/**
 * The gallery that a legacy StoryMap wrapper's Hub address now stands for.
 *
 * Wrapper items were only ever a link to a Flickr album, so a Hub URL pointing
 * at one is a request for the gallery, not for the wrapper. Resolving it here
 * keeps those addresses working after the wrappers leave the content group, and
 * takes the StoryMap out of the path while they are still in it. A gallery
 * published without a wrapper records no legacy id and is unaffected.
 */
export function galleryForLegacyItem(galleries: PhotoGallery[], itemId: string) {
  const id = itemId.trim().toLowerCase()
  if (!/^[a-f0-9]{32}$/.test(id)) return undefined
  return galleries.find((gallery) => gallery.legacyItemIds.includes(id))
}

/** The Flickr album a gallery points at, used to match a wrapper to its row. */
function albumIdOf(flickrUrl: string) {
  return flickrUrl.match(/\/(?:albums|sets)\/(\d{6,})/)?.[1]
}

/**
 * The gallery published from one Flickr album.
 *
 * This is the fallback for a wrapper whose item ID has not been recorded on its
 * row yet: the album is what the two genuinely share. It is only ever a match
 * on a stored `flickr_url`, so a wrapper linking an album the catalogue does
 * not publish resolves to nothing rather than to an approximate row.
 */
export function galleryForFlickrAlbum(galleries: PhotoGallery[], albumId: string | undefined) {
  if (!albumId) return undefined
  return galleries.find((gallery) => albumIdOf(gallery.flickrUrl) === albumId)
}
