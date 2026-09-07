import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

/**
 * The vendored FAO theme opens with six `@import`s pulling five Google Fonts
 * families and the Bootstrap Icons stylesheet from jsDelivr. Every one of them
 * is removed here, and none is replaced by a network dependency.
 *
 * An `@import` at the top of a render-blocking stylesheet is the worst place a
 * dependency can sit: the browser cannot discover it until it has downloaded
 * and parsed the whole 295 kB bundle, and must then resolve a new origin, fetch
 * a second stylesheet and only then fetch the font. That is four to six serial
 * round trips before first paint on a high-latency link - the connection most
 * DIEM readers are on. It also sends the IP address of every visitor to Google
 * and to a commercial CDN, from a page that carries FAO's own data-protection
 * link, and it makes the site's typography and every icon depend on two
 * third-party origins staying reachable in contexts where they may not be.
 *
 * What replaces them:
 *   - Montserrat, Cairo and Noto Sans JP: nothing. Montserrat and Noto Sans JP
 *     have no `font-family` rule in the theme at all, and Cairo is reached only
 *     through `html[lang=ar|fa|sf]`, which this English-only Hub never sets.
 *   - Open Sans and Merriweather: `src/assets/fonts`, self-hosted and bundled.
 *   - Bootstrap Icons: `src/icons.css`, the seven glyphs actually used.
 *
 * Stripping here rather than in the file keeps `fao-theme.min.css` a byte-exact
 * vendor snapshot, so a theme upgrade drops in unchanged and is still trimmed.
 * If an upgrade starts using one of the dropped families, its `font-family`
 * rule survives and only the webfont is missing, which is a fallback, not a
 * break. If it starts using an eighth icon, add it to `src/icons.css`.
 */
function dropThemeNetworkImports(): Plugin {
  return {
    name: 'diem-drop-theme-network-imports',
    enforce: 'pre',
    transform(code, id) {
      if (id.indexOf('fao-theme.min.css') === -1) return null
      const trimmed = code.replace(
        /@import url\("https:\/\/(?:fonts\.googleapis\.com|cdn\.jsdelivr\.net)\/[^"]*"\);/g,
        '',
      )
      return trimmed === code ? null : { code: trimmed, map: null }
    },
  }
}

/**
 * Emits `sitemap.xml` listing every route a reader can be sent to.
 *
 * The Hub renders entirely on the client: `index.html` ships an empty root div,
 * so a crawler that does not execute JavaScript sees one page, and one that
 * does still has to guess 755 product URLs it has no way to discover. A sitemap
 * is the cheapest fix by a wide margin, and it needs no rendering change.
 *
 * This does not create a competing source of truth. The file holds URLs and
 * nothing else - no titles, no dates, no metadata - and it is rebuilt from the
 * live group on every deploy, so ArcGIS remains the only place a record lives.
 *
 * The group is read over the network at build time, which must never be able to
 * fail a build: on timeout, error, or an unexpected response the plugin warns
 * and emits the static routes alone, which is a smaller sitemap rather than a
 * broken one.
 */
const CANONICAL_ORIGIN = 'https://data-in-emergencies.fao.org'
const SITEMAP_TIMEOUT_MS = 20000
const STATIC_ROUTES = [
  '/', '/catalog', '/countries', '/hazard-impact-assessments', '/flood-services',
  '/monitoring-system', '/monitoring', '/data', '/data/guide',
  '/about', '/photo-galleries', '/contact',
]

interface SitemapRecord {
  id: string
  groupCategories?: string[]
}

async function discoverableRoutes(): Promise<string[]> {
  const group = 'ab8a43038b6347ac93507988f7e2a90b'
  const root = `https://www.arcgis.com/sharing/rest/content/groups/${group}/search`
  const page = async (start: number) => {
    const response = await fetch(
      `${root}?f=json&num=100&start=${start}&sortField=modified&sortOrder=desc`,
      { signal: AbortSignal.timeout(SITEMAP_TIMEOUT_MS) },
    )
    if (!response.ok) throw new Error(`group search failed (${response.status})`)
    return response.json() as Promise<{ total: number; results: SitemapRecord[] }>
  }

  const first = await page(1)
  const starts: number[] = []
  for (let start = 101; start <= first.total; start += 100) starts.push(start)
  const rest = await Promise.all(starts.map(page))
  const records = [first, ...rest].flatMap((response) => response.results)

  // The same gate the product page enforces. A URL that would answer "no longer
  // published" must not be advertised to a crawler.
  const discoverable = records.filter((record) => (record.groupCategories || []).some(
    (category) => category.toLowerCase() === '/categories/catalog role/discoverable product',
  ))
  const countries = new Set(discoverable.flatMap((record) => (record.groupCategories || [])
    .filter((category) => category.toLowerCase().startsWith('/categories/countries/'))
    .map((category) => category.slice('/categories/countries/'.length).toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code))))

  return [
    // Array.from, not spread: tsconfig.node.json targets below ES2015 and
    // cannot iterate a Set.
    ...Array.from(countries).sort().map((code) => `/countries/${code.toLowerCase()}`),
    ...discoverable.map((record) => `/catalog/${record.id}`),
  ]
}

function emitSitemap(): Plugin {
  return {
    name: 'diem-emit-sitemap',
    apply: 'build',
    async generateBundle() {
      let routes = STATIC_ROUTES
      try {
        routes = [...STATIC_ROUTES, ...await discoverableRoutes()]
      } catch (error) {
        this.warn(`sitemap: could not read the content group, emitting static routes only (${String(error)})`)
      }
      const today = new Date().toISOString().slice(0, 10)
      const urls = routes.map((route) => (
        `  <url><loc>${CANONICAL_ORIGIN}${route}</loc><lastmod>${today}</lastmod></url>`
      )).join('\n')
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
      })
      this.info?.(`sitemap: ${routes.length} routes`)
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), dropThemeNetworkImports(), emitSitemap(), ...(mode === 'http-test' ? [] : [basicSsl()])],
  server: {
    host: mode === 'http-test' ? '127.0.0.1' : 'localhost',
    port: mode === 'http-test' ? 4174 : 5173,
    strictPort: true,
  },
  build: {
    rollupOptions: {
      input: ['index.html', 'oauth-callback.html'],
    },
  },
}))
