/**
 * The address of this Hub, for links that must be absolute: the files inside a
 * downloaded package, the citation and the documentation links, which are read
 * outside the running site.
 *
 * The review server until the Hub goes live. At go-live, switch this to
 * https://data-in-emergencies.fao.org and update the other production-only
 * addresses listed in docs/development_workflow.md, "Going live".
 *
 * Not used for canonical URLs and structured data (usePageMetadata, App,
 * Catalog, CatalogProduct, CountryDetail): those already name the production
 * address, which is where search engines should index the Hub.
 */
export const HUB_ORIGIN = 'https://diem.review.fao.org'

/** An absolute link to a Hub route, e.g. hubUrl('/catalog/abc'). */
export function hubUrl(path: string) {
  return `${HUB_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`
}

/** The in-app path of an absolute Hub link, so the running site can route it without a reload. */
export function hubPath(url: string) {
  return url.startsWith(`${HUB_ORIGIN}/`) ? url.slice(HUB_ORIGIN.length) : undefined
}
