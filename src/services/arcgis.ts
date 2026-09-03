import type { ArcGISGroup, ArcGISItem, CatalogData } from '../types'

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
    items: [firstPage, ...remainingPages].flatMap((page) => page.results),
    fetchedAt: new Date(),
  }
}

export function itemThumbnail(item: ArcGISItem) {
  if (!item.thumbnail) return undefined
  return `${REST_ROOT}/content/items/${item.id}/info/${item.thumbnail}?w=800`
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
