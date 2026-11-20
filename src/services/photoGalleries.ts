import type { CountryResource } from './countries'

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
  /**
   * DIEM survey rounds the photographs come from (`survey_keys`, e.g.
   * `IRQ:8;LBN:3`). Empty when the gallery is not tied to a survey round.
   */
  surveyKeys: SurveyKey[]
  /** Field or event date: when the photographs were taken. */
  date: Date
  /**
   * First day the row was Published on the Hub (`published_on`), set by the
   * agent publication tool. Undefined for historical rows whose date is unknown;
   * those never enter the homepage Latest evidence strip.
   */
  publishedOn?: Date
  featured: boolean
  displayOrder: number
  credit: string
}

export interface SurveyKey {
  iso3: string
  round: number
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
  publication_status?: string | null
  published_on?: number | string | null
  survey_keys?: string | null
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

/**
 * `ISO3:round` pairs, separated by `;`. A malformed segment is dropped rather
 * than guessed: an unreadable key links the gallery to no survey.
 */
export function extractSurveyKeys(value: string | null | undefined): SurveyKey[] {
  const keys = String(value || '')
    .split(';')
    .map((segment) => segment.trim().toUpperCase().match(/^([A-Z]{3}):([1-9]\d{0,2})$/))
    .flatMap((match) => (match ? [{ iso3: match[1], round: Number(match[2]) }] : []))
  return keys.filter((key, index) => keys.findIndex((other) => other.iso3 === key.iso3 && other.round === key.round) === index)
}

function optionalDate(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return undefined
  const date = new Date(typeof value === 'number' ? value : String(value))
  return Number.isNaN(date.getTime()) ? undefined : date
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
    surveyKeys: extractSurveyKeys(attributes.survey_keys),
    date,
    publishedOn: optionalDate(attributes.published_on),
    featured: Number(attributes.featured) === 1,
    displayOrder: Number(attributes.display_order) || 0,
    credit: String(attributes.credit || 'FAO emergencies / Flickr').trim(),
  }
}

interface GalleryCatalogue {
  galleries: PhotoGallery[]
  /**
   * Wrapper item ids recorded on any row, Draft included. Withdrawing a gallery
   * must not bring the StoryMap it replaced back into the catalogue: the
   * mapping states that the wrapper is superseded, whatever the row's status.
   */
  replacedWrapperIds: Set<string>
}

/*
 * Every row is read, not only Published ones: the catalogue item is public, so
 * Draft rows are readable anyway, and their wrapper mappings are needed above.
 * Only Published rows become galleries.
 */
async function queryGalleryCatalogue(): Promise<GalleryCatalogue> {
  const galleries: PhotoGallery[] = []
  const replacedWrapperIds = new Set<string>()
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const params = new URLSearchParams({
      f: 'json',
      where: '1=1',
      outFields: 'gallery_id,title,summary,flickr_url,thumbnail_url,thumbnail_alt,country_iso3,country_name,legacy_item_id,event_or_round,survey_keys,gallery_date,published_on,featured,display_order,credit,publication_status',
      orderByFields: 'gallery_date DESC, display_order ASC',
      returnGeometry: 'false',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
    })
    const response = await fetch(`${serviceUrl()}/query?${params}`)
    if (!response.ok) throw new Error(`Photo gallery service request failed (${response.status})`)
    const data = await response.json() as GalleryQueryResponse
    if (data.error) throw new Error(data.error.message || 'Photo gallery service request failed')
    const rows = (data.features || []).map(({ attributes }) => attributes)
    rows.forEach((attributes) => extractLegacyItemIds(attributes.legacy_item_id).forEach((id) => replacedWrapperIds.add(id)))
    galleries.push(...rows
      .filter((attributes) => attributes.publication_status === 'Published')
      .map(normalizeGallery)
      .filter((gallery): gallery is PhotoGallery => Boolean(gallery)))
    hasMore = Boolean(data.exceededTransferLimit) && rows.length > 0
    offset += PAGE_SIZE
  }

  return { galleries, replacedWrapperIds }
}

let cached: { at: number } & GalleryCatalogue | undefined
let inFlight: Promise<GalleryCatalogue> | undefined

/**
 * One load serves every gallery surface on the page.
 *
 * A country page now shows galleries beside the gallery page's own listing, and
 * both want the same rows. The shared load deliberately ignores the caller's
 * abort signal: one component unmounting must not cancel a request another
 * component is still waiting on. The signal is still honoured for the caller
 * that passed it, which is what its `AbortError` handling expects.
 */
export async function fetchPhotoGalleryCatalogue(signal?: AbortSignal): Promise<GalleryCatalogue> {
  if (!cached || Date.now() - cached.at >= CACHE_TTL_MS) {
    if (!inFlight) {
      inFlight = queryGalleryCatalogue()
        .then((catalogue) => {
          cached = { at: Date.now(), ...catalogue }
          return catalogue
        })
        .finally(() => {
          inFlight = undefined
        })
    }
    await inFlight
  }
  if (signal?.aborted) throw new DOMException('Photo gallery request aborted', 'AbortError')
  return { galleries: cached?.galleries || [], replacedWrapperIds: cached?.replacedWrapperIds || new Set() }
}

/** Published galleries; see fetchPhotoGalleryCatalogue for the shared load. */
export async function fetchPhotoGalleries(signal?: AbortSignal): Promise<PhotoGallery[]> {
  return (await fetchPhotoGalleryCatalogue(signal)).galleries
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

/** The Hub address of one gallery: the gallery page, opened on that album. */
export function galleryPath(galleryId: string) {
  return `/photo-galleries?${new URLSearchParams({ gallery: galleryId })}`
}

/**
 * One gallery as a catalogue resource, so the catalogue's search, facets,
 * families and pagination treat it like any other product.
 *
 * The id is prefixed so it can never collide with an ArcGIS item id (which is
 * 32 hex characters). `created` is the first publication date when the
 * publication tool recorded one, else the field date: historical rows were
 * published before the date was kept, and the field date is the only honest
 * date they carry. A gallery tied to a DIEM survey round sits on the regular
 * monitoring pathway; any other gallery records no pathway, never a guessed one.
 */
export function galleryResource(gallery: PhotoGallery): CountryResource {
  const created = (gallery.publishedOn || gallery.date).getTime()
  return {
    id: `gallery-${gallery.id}`,
    galleryId: gallery.id,
    galleryThumbnailUrl: gallery.thumbnailUrl || undefined,
    galleryDate: gallery.date.getTime(),
    galleryPublishedOn: gallery.publishedOn?.getTime(),
    title: gallery.title,
    type: 'Photo gallery',
    owner: '',
    created,
    modified: created,
    snippet: gallery.summary,
    thumbnail: gallery.thumbnailUrl || undefined,
    url: gallery.flickrUrl,
    access: 'public',
    tags: ['photo gallery'],
    countries: gallery.countryIso3List,
    productTypes: ['Photo gallery'],
    evidencePathways: gallery.surveyKeys.length ? ['Regular monitoring'] : [],
  }
}

/**
 * Catalogue resources with every gallery added and every StoryMap wrapper that
 * a gallery has replaced removed, so one album is listed once.
 *
 * A wrapper is removed when any row, Published or Draft, records its item id in
 * `legacy_item_id` (pass `replacedWrapperIds` from the catalogue load): that
 * mapping was verified album by album, and withdrawing the gallery must not
 * resurrect the wrapper. A wrapper with no recorded mapping stays listed until
 * it is mapped or retired.
 */
export function mergeGalleryResources<T extends CountryResource>(
  items: T[],
  galleries: PhotoGallery[],
  replacedWrapperIds: Set<string> = new Set(galleries.flatMap((gallery) => gallery.legacyItemIds)),
): Array<T | CountryResource> {
  const replaced = replacedWrapperIds
  return [
    ...items.filter((item) => !replaced.has(item.id.toLowerCase())),
    ...galleries.map(galleryResource),
  ]
}

/** Galleries a DIEM survey round links to, newest field date first. */
export function galleriesForSurvey(galleries: PhotoGallery[], iso3: string, round: number) {
  const code = iso3.trim().toUpperCase()
  return galleries
    .filter((gallery) => gallery.surveyKeys.some((key) => key.iso3 === code && key.round === round))
    .sort((first, second) => second.date.getTime() - first.date.getTime())
}
