'use strict'

/**
 * Per-route link previews.
 *
 * Teams, Outlook, Slack, LinkedIn and search crawlers read the HTML a URL
 * returns and never run JavaScript. Firebase Hosting answers every Hub route
 * with the same index.html, so every shared link previewed as the homepage even
 * though `usePageMetadata` sets the right title in the browser. This handler
 * serves that same index.html with the route's title, description, canonical
 * URL and image already in the head. The React app then loads and behaves
 * exactly as before.
 *
 * It must never break a page: any failure serves the unmodified template.
 */

const fs = require('node:fs')
const path = require('node:path')
const {
  COUNTRY_IMAGES, CROSS_COUNTRY_IMAGE, DEFAULT_IMAGE, EXPLORER_IMAGE, EXPLORER_THEMES, SITE_NAME, STATIC_ROUTES,
} = require('./link-preview-routes')

const CANONICAL_ORIGIN = 'https://data-in-emergencies.fao.org'
/** Hosts whose own /link-previews/ photos may be referenced; anything else uses production. */
const IMAGE_HOSTS = /^(data-in-emergencies\.fao\.org|[a-z0-9-]+\.web\.app|[a-z0-9-]+\.firebaseapp\.com)$/i
const REST_ROOT = 'https://www.arcgis.com/sharing/rest'
const ROUND = /^\d{1,3}$/
const ITEM_ID = /^[0-9a-f]{32}$/i
const ISO3 = /^[a-z]{3}$/i
const CROSS_COUNTRY = 'cross-country'
const LOOKUP_TIMEOUT_MS = 2500
const ITEM_CACHE_MS = 10 * 60 * 1000
const ITEM_CACHE_LIMIT = 500
const GENERATED_DIR = path.join(__dirname, 'link-preview-generated')

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fullTitle(title) {
  return title === SITE_NAME ? `${title} | FAO` : `${title} | ${SITE_NAME} | FAO`
}

/** Collapses whitespace and trims a description to what previews display. */
function clip(text, limit = 300) {
  const clean = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return clean.length > limit ? `${clean.slice(0, limit - 1).trimEnd()}…` : clean
}

/** Drops a trailing slash so `/about/` and `/about` describe the same page. */
function normalisePath(rawPath) {
  const pathname = String(rawPath || '/').split('?')[0]
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname
}

/** Absolute URL of a preview photo on the site that served the request. */
function photoUrl(name, origin = CANONICAL_ORIGIN) {
  return `${origin}/link-previews/${name}.jpg`
}

/** The origin of the request when it is a known Hub host, so review links use review photos. */
function requestOrigin(req) {
  const host = String(req.get?.('x-forwarded-host') || req.headers?.['x-forwarded-host'] || req.get?.('host') || '')
    .split(',')[0].trim()
  return IMAGE_HOSTS.test(host) ? `https://${host}` : CANONICAL_ORIGIN
}

/**
 * Writes the route's metadata into the template head. Existing tags are
 * replaced in place; tags index.html does not declare are added before
 * `</head>`.
 */
function applyMetadata(template, { title, description, url, image, noindex }) {
  let html = template
  const tags = []
  const setTag = (pattern, tag) => {
    if (pattern.test(html)) html = html.replace(pattern, tag)
    else tags.push(tag)
  }
  const metaPattern = (attribute, name) => new RegExp(`<meta\\s+${attribute}="${name}"[^>]*>`, 'i')
  const metaName = (name, content) => setTag(metaPattern('name', name), `<meta name="${name}" content="${escapeHtml(content)}" />`)
  const metaProperty = (name, content) => setTag(metaPattern('property', name), `<meta property="${name}" content="${escapeHtml(content)}" />`)

  // The description tag in index.html spans several lines.
  html = html.replace(/<meta\s+name="description"[\s\S]*?\/>/i, `<meta name="description" content="${escapeHtml(description)}" />`)
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`)
  setTag(/<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${escapeHtml(url)}" />`)
  metaProperty('og:title', title)
  metaProperty('og:description', description)
  metaProperty('og:url', url)
  metaProperty('og:image', image)
  metaName('twitter:title', title)
  metaName('twitter:description', description)
  metaName('twitter:image', image)
  if (noindex) metaName('robots', 'noindex, follow')

  return tags.length ? html.replace(/\s*<\/head>/i, `\n    ${tags.join('\n    ')}\n  </head>`) : html
}

function loadJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(GENERATED_DIR, file), 'utf8'))
  } catch {
    return fallback
  }
}

/** Fetches public ArcGIS item details anonymously, so only public items can preview. */
async function fetchPublicItem(itemId, fetchImpl = fetch) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS)
  try {
    const response = await fetchImpl(`${REST_ROOT}/content/items/${itemId}?f=json`, { signal: controller.signal })
    if (!response.ok) return null
    const item = await response.json()
    if (!item || item.error || item.access !== 'public' || !item.title) return null
    return item
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * A Household Survey Explorer link names its view in the query string
 * (`?theme=shocks&iso=MMR&round=14&field=...`). The title names the country,
 * round and theme so two shared views do not preview identically. Unknown or
 * malformed values are left out rather than echoed into the page.
 */
function explorerView(rawUrl, countries) {
  const query = String(rawUrl || '').split('?')[1]
  if (!query) return null
  const params = new URLSearchParams(query)
  const iso = String(params.get('iso') || '').toUpperCase()
  const country = ISO3.test(iso) ? countries[iso] : undefined
  const roundValue = String(params.get('round') || '')
  const round = ROUND.test(roundValue) ? `Round ${Number(roundValue)}` : undefined
  const theme = EXPLORER_THEMES[String(params.get('theme') || '')]
  const parts = [country, round, theme].filter(Boolean)
  if (!parts.length) return null

  const scope = [country, round && round.toLowerCase()].filter(Boolean).join(', ')
  const description = `DIEM household survey results${scope ? ` for ${scope}` : ''}${theme ? `: ${theme.toLowerCase()}` : ''}, in the interactive Household Survey Explorer.`
  return {
    title: `${parts.join(' · ')} | Household Survey Explorer`,
    description,
    path: `/monitoring?${params.toString()}`,
    photo: (country && COUNTRY_IMAGES[iso]) || EXPLORER_IMAGE,
  }
}

function createResolver({ countries = {}, fetchItem = fetchPublicItem, now = () => Date.now() } = {}) {
  const itemCache = new Map()

  async function cachedItem(itemId) {
    const key = itemId.toLowerCase()
    const hit = itemCache.get(key)
    if (hit && hit.expires > now()) return hit.item
    const item = await fetchItem(key)
    if (itemCache.size >= ITEM_CACHE_LIMIT) itemCache.delete(itemCache.keys().next().value)
    itemCache.set(key, { item, expires: now() + ITEM_CACHE_MS })
    return item
  }

  /**
   * Returns the metadata for a URL (path and query), or null when the defaults
   * should stand. `photo` names a public/link-previews image; `image` is an
   * absolute URL.
   */
  return async function resolve(rawUrl) {
    const pathname = normalisePath(rawUrl)

    if (pathname === '/monitoring') {
      const explorer = explorerView(rawUrl, countries)
      if (explorer) return explorer
    }

    const known = STATIC_ROUTES[pathname]
    if (known) {
      return { title: known.title, description: known.description, path: known.canonical || pathname, photo: known.image || DEFAULT_IMAGE }
    }

    const segments = pathname.split('/').filter(Boolean)

    if (segments.length === 2 && segments[0] === 'catalog' && ITEM_ID.test(segments[1])) {
      const item = await cachedItem(segments[1])
      if (!item) return null
      return {
        title: item.title,
        description: clip(item.snippet || item.description) || STATIC_ROUTES['/catalog'].description,
        path: `/catalog/${item.id}`,
        image: item.thumbnail ? `${REST_ROOT}/content/items/${item.id}/info/${item.thumbnail}?w=800` : undefined,
      }
    }

    if (segments.length === 2 && segments[0] === 'countries') {
      const slug = segments[1].toLowerCase()
      if (slug === CROSS_COUNTRY) {
        return {
          title: 'Cross-country analysis',
          description: 'DIEM multi-country and global products: cross-country monitoring, hazard impact assessments and published evidence on food security and agricultural livelihoods.',
          path: `/countries/${CROSS_COUNTRY}`,
          photo: CROSS_COUNTRY_IMAGE,
        }
      }
      const name = ISO3.test(slug) ? countries[slug.toUpperCase()] : undefined
      if (!name) return null
      return {
        title: name,
        description: `DIEM products for ${name}: monitoring rounds, hazard impact assessments and published evidence on food security and agricultural livelihoods.`,
        path: `/countries/${slug}`,
        photo: COUNTRY_IMAGES[slug.toUpperCase()] || DEFAULT_IMAGE,
      }
    }

    return null
  }
}

/**
 * Builds the HTTP handler. `loadTemplate` returns the built index.html;
 * `resolve` maps a path to metadata.
 */
function createHandler({ loadTemplate, resolve, log = console }) {
  return async function linkPreview(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.set('Allow', 'GET, HEAD').status(405).send('Method not allowed')
      return
    }

    let template
    try {
      template = await loadTemplate()
    } catch (error) {
      log.error('link-preview: template unavailable', error)
      res.status(503).set('Cache-Control', 'no-store').send('Service temporarily unavailable')
      return
    }

    let html = template
    try {
      const metadata = await resolve(req.originalUrl || req.url || req.path)
      if (metadata) {
        html = applyMetadata(template, {
          title: fullTitle(metadata.title),
          description: metadata.description,
          url: `${CANONICAL_ORIGIN}${metadata.path}`,
          image: metadata.image || photoUrl(metadata.photo || DEFAULT_IMAGE, requestOrigin(req)),
          noindex: metadata.noindex,
        })
      }
    } catch (error) {
      log.error('link-preview: metadata failed', error)
    }

    // Short shared-cache lifetime: Firebase purges its CDN on every release, and
    // a product retitled in ArcGIS reaches previews within minutes.
    res.set('Content-Type', 'text/html; charset=utf-8')
    res.set('Cache-Control', 'public, max-age=0, s-maxage=300')
    res.status(200).send(req.method === 'HEAD' ? '' : html)
  }
}

/** The template and country names the build copies next to this file. */
function bundledTemplateLoader() {
  let template
  return async () => {
    if (template === undefined) template = fs.readFileSync(path.join(GENERATED_DIR, 'index.html'), 'utf8')
    return template
  }
}

function createDefaultHandler() {
  return createHandler({
    loadTemplate: bundledTemplateLoader(),
    resolve: createResolver({ countries: loadJson('countries.json', {}) }),
  })
}

module.exports = {
  applyMetadata,
  clip,
  createDefaultHandler,
  createHandler,
  createResolver,
  escapeHtml,
  fetchPublicItem,
  fullTitle,
  normalisePath,
  photoUrl,
  requestOrigin,
}
