import { useEffect } from 'react'

const SITE_NAME = 'DIEM Hub'
/**
 * The canonical public origin. Taken from a constant rather than
 * `location.origin` so a link shared from a preview deployment, a dev server or
 * an alternate host still points readers and crawlers at the published site.
 */
const CANONICAL_ORIGIN = 'https://data-in-emergencies.fao.org'
/**
 * Social preview image: a field photograph already used on the homepage, not
 * the generated illustration, which is exactly the asset a shared link should
 * not lead with.
 */
const SOCIAL_IMAGE = 'https://hqfao.maps.arcgis.com/sharing/rest/content/items/9103febede744492ae43ebae1c5e3826/data'

/** Marks the tags this hook owns, so cleanup never removes a static one. */
const OWNED = 'data-page-meta'

export interface PageMetadata {
  /** Undefined while a page is still resolving its subject. */
  title?: string
  description?: string
  /** JSON-LD describing the page's subject, emitted as structured data. */
  structuredData?: Record<string, unknown>
  /** Overrides the canonical path, for a route whose URL carries filter state. */
  canonicalPath?: string
}

function upsert(selector: string, create: () => HTMLElement, apply: (element: HTMLElement) => void) {
  let element = document.head.querySelector<HTMLElement>(selector)
  if (!element) {
    element = create()
    element.setAttribute(OWNED, '')
    document.head.appendChild(element)
  }
  apply(element)
}

function meta(name: string, value: string, attribute: 'name' | 'property' = 'name') {
  upsert(`meta[${attribute}="${name}"]`, () => {
    const element = document.createElement('meta')
    element.setAttribute(attribute, name)
    return element
  }, (element) => element.setAttribute('content', value))
}

/**
 * Sets everything a shared link, a search result and a browser tab need for one
 * route.
 *
 * A single-page application keeps whatever `index.html` declared unless a route
 * says otherwise. Every page therefore carried one title, one description and
 * no canonical, so fourteen routes looked like a single page to a crawler and
 * every shared link previewed identically - on a site whose whole purpose is
 * making evidence findable.
 *
 * Canonical URLs drop the query string by default: `?country=NER&page=3` is a
 * view of the catalogue, not a separate page, and indexing each combination
 * would bury the catalogue under thousands of near-duplicates.
 */
export function usePageMetadata({ title, description, structuredData, canonicalPath }: PageMetadata) {
  const path = canonicalPath ?? (typeof window === 'undefined' ? '/' : window.location.pathname)

  useEffect(() => {
    if (!title) return
    const previousTitle = document.title
    const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`
    const canonical = `${CANONICAL_ORIGIN}${path}`
    document.title = fullTitle

    upsert('link[rel="canonical"]', () => {
      const element = document.createElement('link')
      element.setAttribute('rel', 'canonical')
      return element
    }, (element) => element.setAttribute('href', canonical))

    if (description) {
      meta('description', description)
      meta('og:description', description, 'property')
      meta('twitter:description', description)
    }
    meta('og:title', fullTitle, 'property')
    meta('og:url', canonical, 'property')
    meta('og:type', 'website', 'property')
    meta('og:site_name', SITE_NAME, 'property')
    meta('og:image', SOCIAL_IMAGE, 'property')
    meta('twitter:card', 'summary_large_image')
    meta('twitter:title', fullTitle)

    let script: HTMLScriptElement | undefined
    if (structuredData) {
      script = document.createElement('script')
      script.type = 'application/ld+json'
      script.setAttribute(OWNED, '')
      script.textContent = JSON.stringify({ '@context': 'https://schema.org', ...structuredData })
      document.head.appendChild(script)
    }

    return () => {
      document.title = previousTitle
      script?.remove()
    }
    // Structured data is an object literal at every call site, so it is compared
    // by value here rather than by identity, which would re-run on every render.
  }, [title, description, path, JSON.stringify(structuredData)])
}
