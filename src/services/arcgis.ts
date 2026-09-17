import type { ArcGISGroup, ArcGISItem, CatalogData } from '../types'
import { hasRestrictedMicrodataTag } from './microdataGrants'

export const ARCGIS_PORTAL = 'https://www.arcgis.com'
export const CONTENT_GROUP_ID = 'ab8a43038b6347ac93507988f7e2a90b'
const REST_ROOT = `${ARCGIS_PORTAL}/sharing/rest`
const PAGE_SIZE = 100

export type AuthenticatedCatalogRequest = <T>(
  url: string,
  params?: Record<string, unknown>,
) => Promise<T>

interface SearchResponse {
  total: number
  start: number
  num: number
  nextStart: number
  results: ArcGISItem[]
  error?: { message: string }
}

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error(`Content service request failed (${response.status})`)
  const data = (await response.json()) as T & { error?: { message: string } }
  if (data.error) throw new Error(data.error.message)
  return data
}

function searchParams(start: number) {
  return {
    f: 'json',
    num: String(PAGE_SIZE),
    start: String(start),
    sortField: 'modified',
    sortOrder: 'desc',
  }
}

function searchUrl(start: number) {
  return `${REST_ROOT}/content/groups/${CONTENT_GROUP_ID}/search?${new URLSearchParams(searchParams(start))}`
}

export async function fetchCatalog(
  signal?: AbortSignal,
  authenticatedRequest?: AuthenticatedCatalogRequest,
): Promise<CatalogData> {
  const groupEndpoint = `${REST_ROOT}/community/groups/${CONTENT_GROUP_ID}`
  const searchEndpoint = `${REST_ROOT}/content/groups/${CONTENT_GROUP_ID}/search`
  const requestGroup = authenticatedRequest
    ? authenticatedRequest<ArcGISGroup>(groupEndpoint)
    : getJson<ArcGISGroup>(`${groupEndpoint}?f=json`, signal)
  const requestPage = (start: number) => authenticatedRequest
    ? authenticatedRequest<SearchResponse>(searchEndpoint, searchParams(start))
    : getJson<SearchResponse>(searchUrl(start), signal)
  const [group, firstPage] = await Promise.all([
    requestGroup,
    requestPage(1),
  ])

  const starts: number[] = []
  for (let start = PAGE_SIZE + 1; start <= firstPage.total; start += PAGE_SIZE) {
    starts.push(start)
  }

  const remainingPages = await Promise.all(
    starts.map(requestPage),
  )

  return {
    group,
    items: [firstPage, ...remainingPages].flatMap((page) => page.results).filter(catalogueVisible),
    fetchedAt: new Date(),
  }
}

/**
 * Temporary microdata grant views never belong in the ordinary catalogue.
 *
 * Provisioning already keeps them out by refusing to share them with this
 * content group, so in a correct deployment this filter matches nothing. It
 * stays because it is the check that survives a provisioning mistake: a view
 * shared here by accident would otherwise become a public-facing catalogue card
 * for one recipient's approved surveys.
 */
export function catalogueVisible(item: ArcGISItem) {
  return !hasRestrictedMicrodataTag(item.tags)
}

/**
 * Cards render the thumbnail in a 285 x 138 box, so 400 px covers a 1.4x
 * display and most of a 2x one.
 *
 * It used to ask for 800. ArcGIS honours the width by upscaling, and the group's
 * thumbnails are 500 x 500 source images, so `?w=800` bought no detail that
 * exists: measured on the live group, the same file is 6,943 bytes unsized,
 * 26,524 at `?w=400` and 66,582 at `?w=800`. Across a sixteen-card page that
 * was about 0.95 MB of upscaling, on the slow connections this catalogue is
 * most often read over.
 */
const THUMBNAIL_WIDTH = 400

export function itemThumbnail(item: ArcGISItem) {
  if (!item.thumbnail) return undefined
  return `${REST_ROOT}/content/items/${item.id}/info/${item.thumbnail}?w=${THUMBNAIL_WIDTH}`
}

/**
 * Thumbnail file names that identify exactly one product.
 *
 * Most of the group shares a handful of thumbnails: a per-country basemap tile
 * (`thumbnail/thumb_NER.jpg` covers 41 Niger products) or an ArcGIS default
 * (`thumbnail/ago_downloaded.png`, `thumbnail/thumbnail.jpeg`). Every item still
 * gets its own URL because the URL carries the item id, so the duplication is
 * only visible once the images render, as a wall of identical maps that defeats
 * scanning. Measured on the live group, 862 of 991 items share a name and 108
 * are unique.
 *
 * Callers build this from the whole catalogue and use it to decide whether an
 * image is worth showing at all.
 */
export function buildDistinctThumbnailIndex(items: ArcGISItem[]) {
  const counts = new Map<string, number>()
  items.forEach((item) => {
    if (!item.thumbnail) return
    counts.set(item.thumbnail, (counts.get(item.thumbnail) || 0) + 1)
  })
  return new Set([...counts].flatMap(([name, count]) => (count === 1 ? [name] : [])))
}

/** The thumbnail URL only when the image distinguishes this product from others. */
export function distinctThumbnail(item: ArcGISItem, index: Set<string>) {
  return item.thumbnail && index.has(item.thumbnail) ? itemThumbnail(item) : undefined
}

export function itemDestination(item: ArcGISItem) {
  return item.url || `${ARCGIS_PORTAL}/home/item.html?id=${item.id}`
}

const DIRECT_FILE_TYPES = new Set([
  'CSV',
  'Image',
  'Microsoft Excel',
  'Microsoft Powerpoint',
  'PDF',
  'Shapefile',
])

/** Stable Hub URL for every product discovery surface. */
export function itemProductPath(item: Pick<ArcGISItem, 'id'>) {
  return `/catalog/${item.id}`
}

/**
 * A catalogue product the public dataset explorer can open: a public, queryable
 * feature service. Everything else keeps its ordinary resource action.
 */
export function isExplorableProduct(item: Pick<ArcGISItem, 'type' | 'access' | 'url'>) {
  return item.type === 'Feature Service' && item.access === 'public' && !!item.url
}

/** The authoritative resource action exposed from a membership-checked page. */
export function itemResourceAction(item: ArcGISItem) {
  if (item.url) {
    return {
      href: item.url,
      label: /^https?:\/\/(?:www\.)?arcgis\.com\//i.test(item.url)
        ? 'Open ArcGIS application'
        : 'Open resource',
    }
  }
  if (DIRECT_FILE_TYPES.has(item.type)) {
    return {
      href: `${REST_ROOT}/content/items/${item.id}/data`,
      label: item.type === 'Image'
        ? 'View Image'
        : `Download ${item.type}`,
      direct: true,
      fallbackHref: itemPortalPage(item.id),
    }
  }
  return {
    href: itemPortalPage(item.id),
    label: 'View in ArcGIS',
  }
}

/** The ArcGIS item page, the fallback when a direct file link fails. */
export function itemPortalPage(itemId: string) {
  return `${ARCGIS_PORTAL}/home/item.html?id=${encodeURIComponent(itemId)}`
}

/** Tokenless, per-call cache-busted `/data` URL for a public file item. */
export function publicItemDataUrl(itemId: string, now = Date.now()) {
  return `${REST_ROOT}/content/items/${encodeURIComponent(itemId)}/data?_=${now}`
}

/** Whether a catalogue item takes the session-independent download path. */
export function usesAnonymousDownload(item: Pick<ArcGISItem, 'type' | 'access' | 'url'>) {
  return !item.url && item.access === 'public' && DIRECT_FILE_TYPES.has(item.type) && item.type !== 'Image'
}

export type AnonymousDownloadResult = 'saved' | 'fallback'

type DownloadDeps = {
  fetch: typeof fetch
  save: (blob: Blob, filename: string) => void
  openFallback: (url: string) => void
}

const browserDownloadDeps: DownloadDeps = {
  fetch: (...args) => fetch(...args),
  save: (blob, filename) => {
    const href = URL.createObjectURL(blob)
    const link = Object.assign(document.createElement('a'), { href, download: filename, rel: 'noopener' })
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(href), 60_000)
  },
  openFallback: (url) => {
    if (!window.open(url, '_blank', 'noopener,noreferrer')) window.location.assign(url)
  },
}

/**
 * Download a public file item without any of the viewer's ArcGIS state.
 *
 * A browser navigation to arcgis.com always sends the esri_auth cookie and can
 * reuse a cached 302 to a ten-minute signed itemdata URL; signed-in viewers have
 * received a 404 either way. Here the file is fetched at click time with
 * `credentials: 'omit'`, `cache: 'no-store'` and no referrer, following the
 * redirect to a freshly signed URL, and saved from a blob. No navigation to
 * arcgis.com happens on this path, so cookies never apply. On any failure the
 * ArcGIS item page opens, never `/data`, so the fallback cannot hit the same fault.
 */
export async function downloadPublicItem(
  item: Pick<ArcGISItem, 'id' | 'title' | 'type'> & { name?: string },
  deps: DownloadDeps = browserDownloadDeps,
): Promise<AnonymousDownloadResult> {
  try {
    const response = await deps.fetch(publicItemDataUrl(item.id), {
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok || /[?&]token=/i.test(response.url)) throw new Error(`HTTP ${response.status}`)
    deps.save(await response.blob(), downloadFilename(item, response.headers.get('content-disposition')))
    return 'saved'
  } catch {
    deps.openFallback(itemPortalPage(item.id))
    return 'fallback'
  }
}

export function downloadFilename(
  item: Pick<ArcGISItem, 'id' | 'title'> & { name?: string },
  contentDisposition?: string | null,
) {
  const encoded = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const plain = contentDisposition?.match(/filename="?([^";]+)"?/i)?.[1]
  let name = item.name?.trim() || plain?.trim()
  if (encoded) {
    try { name = decodeURIComponent(encoded) } catch { /* keep the plain name */ }
  }
  return (name || item.title.trim() || item.id).replace(/[\\/:*?"<>|]+/g, '_')
}

/**
 * The Flickr album a photo-gallery StoryMap wrapper links to, if any.
 *
 * The wrappers are a single sentence around one album link, and that album is
 * the only thing they and the gallery catalogue have in common until an editor
 * records the item ID against the row. Reading it here lets a wrapper's Hub
 * address reach its gallery before that backfill happens, from the wrapper
 * itself rather than from a mapping kept in this repository.
 *
 * Album IDs appear in two shapes: a link to the album, and a link to one photo
 * within it. Any failure returns undefined, which leaves the wrapper resolving
 * as an ordinary product.
 */
export async function fetchStoryMapFlickrAlbum(itemId: string, signal?: AbortSignal) {
  if (!/^[a-f0-9]{32}$/i.test(itemId)) return undefined
  try {
    const response = await fetch(`${REST_ROOT}/content/items/${itemId}/data?f=json`, { signal })
    if (!response.ok) return undefined
    const text = await response.text()
    const match = text.match(/(?:faoemergencies\/(?:albums|sets)\/|\/in\/album-)(\d{6,})/)
    return match?.[1]
  } catch {
    return undefined
  }
}
