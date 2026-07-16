import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './auth/AuthContext'
import { SiteFooter } from './components/SiteFooter'
import { SiteHeader } from './components/SiteHeader'
import { cleanText, formatDate, itemCountry, itemTheme, itemYear } from './lib/catalog'
import {
  CONTENT_GROUP_ID,
  fetchCatalog,
  itemDestination,
  itemThumbnail,
} from './services/arcgis'
import type { ArcGISItem, CatalogData, SortOption } from './types'

const PAGE_SIZE = 12

const typeGroups: Record<string, string[]> = {
  Data: ['Microsoft Excel', 'CSV', 'Shapefile', 'Feature Service', 'Service Definition'],
  Documents: ['Document Link', 'PDF', 'Microsoft Powerpoint'],
  'Maps & apps': [
    'StoryMap',
    'Web Map',
    'Dashboard',
    'Web Experience',
    'Web Mapping Application',
    'Form',
  ],
  Media: ['Image'],
  Pages: ['Hub Page'],
}

function Icon({ name }: { name: 'search' | 'arrow' | 'refresh' | 'external' }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
    arrow: <><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></>,
    refresh: <><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></>,
    external: <><path d="M14 4h6v6"/><path d="m20 4-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24">{paths[name]}</svg>
}

function categoryFor(item: ArcGISItem) {
  return Object.entries(typeGroups).find(([, types]) => types.includes(item.type))?.[0] || 'Other'
}

function ContentCard({ item }: { item: ArcGISItem }) {
  const thumbnail = itemThumbnail(item)
  const summary = cleanText(item.snippet || item.description)
  const theme = itemTheme(item)

  return (
    <article className="content-card">
      <a
        className={`card-image card-image--${theme.toLowerCase().replaceAll(' ', '-')}`}
        href={itemDestination(item)}
        target="_blank"
        rel="noreferrer"
        aria-label={`Open ${item.title}`}
      >
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span>DIEM</span>}
        <span className="type-badge">{item.type}</span>
      </a>
      <div className="card-body">
        <div className="card-context">
          <span>{theme}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={new Date(item.modified).toISOString()}>{formatDate(item.modified)}</time>
        </div>
        <h3>{item.title.trim()}</h3>
        <p>{summary || 'Open this resource to view its complete description and metadata.'}</p>
        <div className="card-footer">
          <span>{itemCountry(item) || 'Cross-country'}</span>
          <a href={itemDestination(item)} target="_blank" rel="noreferrer">
            View resource <Icon name="external" />
          </a>
        </div>
      </div>
    </article>
  )
}

function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <span className="loader" />
      <strong>Connecting to the public DIEM catalog</strong>
      <p>Gathering the latest resources from ArcGIS Online…</p>
    </div>
  )
}

export default function App() {
  const auth = useAuth()
  const [catalog, setCatalog] = useState<CatalogData>()
  const [error, setError] = useState<string>()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All content')
  const [theme, setTheme] = useState('All themes')
  const [year, setYear] = useState('All years')
  const [sort, setSort] = useState<SortOption>('newest')
  const [page, setPage] = useState(1)

  const loadCatalog = () => {
    setError(undefined)
    const controller = new AbortController()
    fetchCatalog(controller.signal)
      .then(setCatalog)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message)
      })
    return () => controller.abort()
  }

  useEffect(loadCatalog, [])

  const stats = useMemo(() => {
    const items = catalog?.items || []
    const latestYear = Math.max(...items.map(itemYear), new Date().getUTCFullYear())
    return {
      total: items.length,
      formats: new Set(items.map((item) => item.type)).size,
      latestYear,
      recent: items.filter((item) => itemYear(item) === latestYear).length,
      services: items.filter((item) => item.type === 'Feature Service').length,
    }
  }, [catalog])

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    catalog?.items.forEach((item) => counts.set(item.type, (counts.get(item.type) || 0) + 1))
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [catalog])

  const themes = useMemo(
    () => [...new Set(catalog?.items.map(itemTheme) || [])].sort(),
    [catalog],
  )
  const years = useMemo(
    () => [...new Set(catalog?.items.map(itemYear) || [])].sort((a, b) => b - a),
    [catalog],
  )

  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const items = (catalog?.items || []).filter((item) => {
      const haystack = [item.title, item.snippet, item.type, ...(item.tags || [])]
        .join(' ')
        .toLowerCase()
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery)) &&
        (category === 'All content' || categoryFor(item) === category) &&
        (theme === 'All themes' || itemTheme(item) === theme) &&
        (year === 'All years' || String(itemYear(item)) === year)
      )
    })
    return items.sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      return sort === 'oldest' ? a.modified - b.modified : b.modified - a.modified
    })
  }, [catalog, category, query, sort, theme, year])

  useEffect(() => setPage(1), [category, query, sort, theme, year])

  const pageCount = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE))
  const visibleItems = filteredItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <SiteHeader active="home" />

      <main id="top">
        <section className="hero">
          <div className="hero-grid" aria-hidden="true" />
          <div className="hero-content">
            <div className="eyebrow"><span /> Live public evidence catalog</div>
            <h1>Evidence where<br />decisions <em>can’t wait.</em></h1>
            <p>
              Timely data and analysis for food-security decisions in fragile and
              crisis-affected contexts.
            </p>
            <label className="hero-search">
              <Icon name="search" />
              <span className="sr-only">Search the catalog</span>
              <input
                type="search"
                placeholder="Search by country, theme or resource…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <a href="#catalog" aria-label="Go to catalog results"><Icon name="arrow" /></a>
            </label>
            <div className="hero-meta">
              <span><i className="status-dot" /> {auth.status === 'authenticated' ? 'Signed in to the DIEM community' : 'Sourced live from ArcGIS Online'}</span>
              <span>Updated {catalog ? formatDate(catalog.fetchedAt.getTime()) : 'on every visit'}</span>
            </div>
          </div>
          <aside className="hero-callout">
            <span>Data in Emergencies</span>
            <p>Monitoring shocks. Understanding impacts. Anticipating risks.</p>
            <a href="#about">Discover the programme <Icon name="arrow" /></a>
          </aside>
        </section>

        <section className="stats-strip" aria-label="Catalog summary">
          <div><strong>{stats.total.toLocaleString()}</strong><span>public resources</span></div>
          <div><strong>{stats.formats}</strong><span>content formats</span></div>
          <div><strong>{stats.recent}</strong><span>updated in {stats.latestYear}</span></div>
          <div><strong>{stats.services}</strong><span>data services</span></div>
        </section>

        <section className="overview section-wrap" id="overview">
          <div className="section-heading">
            <div><span className="kicker">At a glance</span><h2>A living evidence base</h2></div>
            <p>Explore survey instruments, briefs, analytical products, maps and applications shared through the DIEM public catalog.</p>
          </div>
          <div className="overview-grid">
            <article className="chart-panel">
              <div className="panel-heading"><h3>Resources by format</h3><span>Top six formats</span></div>
              <div className="bar-chart">
                {typeCounts.map(([type, count]) => (
                  <div className="bar-row" key={type}>
                    <span>{type}</span>
                    <div><i style={{ width: `${(count / (typeCounts[0]?.[1] || 1)) * 100}%` }} /></div>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </article>
            <article className="principles-panel" id="about">
              <span className="kicker kicker--light">Why DIEM</span>
              <h3>From field evidence to informed action.</h3>
              <p>DIEM brings together regularly updated evidence on food security, agricultural livelihoods and shocks in fragile environments.</p>
              <ul>
                <li><span>01</span>Monitor changing conditions</li>
                <li><span>02</span>Assess impacts on livelihoods</li>
                <li><span>03</span>Anticipate emerging risks</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="catalog-section" id="catalog">
          <div className="section-wrap">
            <div className="section-heading catalog-heading">
              <div><span className="kicker">Public catalog</span><h2>Explore the evidence</h2></div>
              <p>Filter the complete public collection. Thematic sections will provide more focused pathways in future releases.</p>
            </div>

            <div className="filter-bar">
              <label className="filter-search"><Icon name="search" /><span className="sr-only">Search</span><input type="search" placeholder="Search resources" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
              <label><span>Content</span><select value={category} onChange={(e) => setCategory(e.target.value)}><option>All content</option>{Object.keys(typeGroups).map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Theme</span><select value={theme} onChange={(e) => setTheme(e.target.value)}><option>All themes</option>{themes.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Year</span><select value={year} onChange={(e) => setYear(e.target.value)}><option>All years</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Sort</span><select value={sort} onChange={(e) => setSort(e.target.value as SortOption)}><option value="newest">Recently updated</option><option value="oldest">Oldest updated</option><option value="title">Title A–Z</option></select></label>
            </div>

            {error ? (
              <div className="error-state" role="alert">
                <strong>The public catalog could not be reached.</strong>
                <p>{error}. Check your connection and try again.</p>
                <button type="button" onClick={loadCatalog}><Icon name="refresh" /> Retry</button>
              </div>
            ) : !catalog ? <LoadingState /> : (
              <>
                <div className="results-meta">
                  <p><strong>{filteredItems.length.toLocaleString()}</strong> resources found</p>
                  <a href={`https://hqfao.maps.arcgis.com/home/group.html?id=${CONTENT_GROUP_ID}`} target="_blank" rel="noreferrer">View source group <Icon name="external" /></a>
                </div>
                <div className="card-grid">
                  {visibleItems.map((item) => <ContentCard item={item} key={item.id} />)}
                </div>
                {!visibleItems.length && <div className="empty-state"><strong>No matching evidence found</strong><p>Try removing a filter or using a broader search term.</p></div>}
                {pageCount > 1 && (
                  <nav className="pagination" aria-label="Catalog pages">
                    <button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                    <span>Page <strong>{page}</strong> of {pageCount}</span>
                    <button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button>
                  </nav>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
