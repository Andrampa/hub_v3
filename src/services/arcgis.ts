import type { ArcGISGroup, ArcGISItem, CatalogData } from '../types'

export const ARCGIS_PORTAL = 'https://www.arcgis.com'
export const CONTENT_GROUP_ID = 'ab8a43038b6347ac93507988f7e2a90b'
const REST_ROOT = `${ARCGIS_PORTAL}/sharing/rest`
const PAGE_SIZE = 100

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
  if (!response.ok) throw new Error(`ArcGIS request failed (${response.status})`)
  const data = (await response.json()) as T & { error?: { message: string } }
  if (data.error) throw new Error(data.error.message)
  return data
}

function searchUrl(start: number) {
  const params = new URLSearchParams({
    f: 'json',
    q: `group:${CONTENT_GROUP_ID}`,
    num: String(PAGE_SIZE),
    start: String(start),
    sortField: 'modified',
    sortOrder: 'desc',
  })
  return `${REST_ROOT}/search?${params}`
}

export async function fetchCatalog(signal?: AbortSignal): Promise<CatalogData> {
  const groupUrl = `${REST_ROOT}/community/groups/${CONTENT_GROUP_ID}?f=json`
  const [group, firstPage] = await Promise.all([
    getJson<ArcGISGroup>(groupUrl, signal),
    getJson<SearchResponse>(searchUrl(1), signal),
  ])

  const starts: number[] = []
  for (let start = PAGE_SIZE + 1; start <= firstPage.total; start += PAGE_SIZE) {
    starts.push(start)
  }

  const remainingPages = await Promise.all(
    starts.map((start) => getJson<SearchResponse>(searchUrl(start), signal)),
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

export function itemDestination(item: ArcGISItem) {
  return item.url || `${ARCGIS_PORTAL}/home/item.html?id=${item.id}`
}

