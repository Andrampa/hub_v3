/**
 * The address of this Hub, for links that must be absolute: the files inside a
 * downloaded package, the citation and the documentation links, which are read
 * outside the running site.
 *
 * The production address, which the Hub has served since it replaced the
 * previous site. A deployment at another origin - the review server, a preview,
 * a dev server - still writes this address into the files it produces, because a
 * package or a citation outlives the deployment that produced it and must point
 * a reader at the published Hub.
 *
 * Because `hubPath` reads this constant, no link built here may name a path the
 * Hub does not route: an address on this origin is treated as an in-app route,
 * so a leftover path from the previous site would navigate to the 404 page
 * rather than opening anything.
 *
 * Not used for canonical URLs and structured data (usePageMetadata, App,
 * Catalog, CatalogProduct, CountryDetail): those name the same address
 * independently, because they must survive a deployment at another origin.
 */
export const HUB_ORIGIN = 'https://data-in-emergencies.fao.org'

/** An absolute link to a Hub route, e.g. hubUrl('/catalog/abc'). */
export function hubUrl(path: string) {
  return `${HUB_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

/** The in-app path of an absolute Hub link, so the running site can route it without a reload. */
export function hubPath(url: string) {
  return url.startsWith(`${HUB_ORIGIN}/`) ? url.slice(HUB_ORIGIN.length) : undefined
}
