/**
 * Addresses the previous ArcGIS Hub site served on this domain.
 *
 * The Hub inherited the domain, so it also inherited every link ever written to
 * it: bookmarks, published reports, emails, and the country page introductions
 * held in the editorial table, which still carry `/documents/<id>/about` links.
 * Those paths mean nothing to this application, so without a translation they
 * land on the 404 page of the very site that holds the content.
 *
 * Each one named a single catalogue item, which is what `/catalog/:itemId`
 * shows, so the address can be translated rather than merely forgiven.
 */

/**
 * The previous site's item viewers. Each took an item id or a Hub slug.
 *
 * `/pages` is deliberately absent. Those were the previous site's own authored
 * pages, not items, so no catalogue product answers for one and the 404 page is
 * the honest reply.
 */
const ITEM_ROUTES = ['documents', 'maps', 'apps']

const ITEM_ID = /^[a-f0-9]{32}$/i

/**
 * `org::title-of-the-item`, the previous site's readable alternative to an item
 * id. Only ArcGIS can say which item one names, so resolving it needs a request.
 */
const SLUG = /^[a-z0-9]+(?:\.[a-z0-9]+)*::[^/]+$/i

export type LegacyHubAddress =
  | { kind: 'item'; itemId: string }
  | { kind: 'slug'; slug: string }

/**
 * What a previous-site address pointed at, or undefined when the path is not
 * one of those addresses and belongs on the 404 page.
 *
 * The trailing `/about`, `/explore` or `/view` the previous site appended is
 * dropped: those chose a tab within its item viewer, and the Hub's product page
 * has no equivalent to preserve.
 */
export function readLegacyHubAddress(pathname: string): LegacyHubAddress | undefined {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2 || !ITEM_ROUTES.includes(segments[0].toLowerCase())) return undefined

  // A malformed escape - `/documents/%ZZ` - throws rather than decoding. It
  // cannot name an item, so it belongs on the 404 page, not in an error.
  let identifier: string
  try {
    identifier = decodeURIComponent(segments[1])
  } catch {
    return undefined
  }

  if (ITEM_ID.test(identifier)) return { kind: 'item', itemId: identifier.toLowerCase() }
  if (SLUG.test(identifier)) return { kind: 'slug', slug: identifier }
  return undefined
}

const SLUG_LOOKUP = 'https://hub.arcgis.com/api/v3/datasets'

/**
 * The item a Hub slug names, read from ArcGIS's own Hub API rather than from the
 * previous site, which no longer answers.
 *
 * Returns undefined rather than throwing: a slug that cannot be resolved - the
 * item was withdrawn, renamed, or the lookup is unreachable - leaves the reader
 * at the catalogue, which is a better answer than an error page.
 */
export async function resolveLegacyHubSlug(slug: string, signal?: AbortSignal) {
  try {
    const url = `${SLUG_LOOKUP}?filter%5Bslug%5D=${encodeURIComponent(slug)}`
    const response = await fetch(url, { signal })
    if (!response.ok) return undefined
    const payload = await response.json() as { data?: Array<{ id?: unknown }> }
    const id = payload.data?.[0]?.id
    if (typeof id !== 'string') return undefined
    // The API answers with the dataset id, which carries a layer suffix for a
    // feature layer: "<itemId>_0". The catalogue is keyed by the item.
    const itemId = id.split('_')[0]
    return ITEM_ID.test(itemId) ? itemId.toLowerCase() : undefined
  } catch {
    return undefined
  }
}
