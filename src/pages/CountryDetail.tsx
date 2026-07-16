import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { CountryShape } from '../components/CountryMap'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { cleanText, formatDate } from '../lib/catalog'
import { itemDestination, itemThumbnail } from '../services/arcgis'
import {
  COUNTRY_GROUP_ID,
  CROSS_COUNTRY_CODE,
  PRODUCT_TYPES,
  countryDefinition,
  resourcesForCountry,
  type CountryResource,
} from '../services/countries'

const PAGE_SIZE = 12

function ResourceCard({ item }: { item: CountryResource }) {
  const summary = cleanText(item.snippet || item.description)
  const thumbnail = itemThumbnail(item)
  const product = item.productTypes[0] || 'Unclassified'
  return (
    <article className="country-resource-card">
      <a className="country-resource-image" href={itemDestination(item)} target="_blank" rel="noreferrer" aria-label={`Open ${item.title}`}>
        {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span>DIEM</span>}
        <span className="country-product-badge">{product}</span>
      </a>
      <div className="country-resource-body">
        <div className="country-resource-meta"><span>{item.type}</span><time dateTime={new Date(item.modified).toISOString()}>{formatDate(item.modified)}</time></div>
        <h3>{item.title.trim()}</h3>
        <p>{summary || 'Open this resource to view its complete description and metadata.'}</p>
        <div className="country-resource-footer">
          <span>{item.productTypes.slice(1).join(' · ') || 'DIEM resource'}</span>
          <a href={itemDestination(item)} target="_blank" rel="noreferrer">Open resource <span aria-hidden="true">↗</span></a>
        </div>
      </div>
    </article>
  )
}

export default function CountryDetail() {
  const { iso3: routeIso = '' } = useParams()
  const iso3 = routeIso.toLowerCase() === 'cross-country' ? CROSS_COUNTRY_CODE : routeIso.toUpperCase()
  const { catalog, error, retry } = useCountryCatalog()
  const [searchParams, setSearchParams] = useSearchParams()
  const [page, setPage] = useState(1)

  const query = searchParams.get('q') || ''
  const selectedType = searchParams.get('type') || 'All products'
  const selectedYear = searchParams.get('year') || 'All years'
  const sort = searchParams.get('sort') || 'latest'

  const country = catalog
    ? iso3 === CROSS_COUNTRY_CODE
      ? catalog.crossCountry
      : catalog.countries.find((candidate) => candidate.iso3 === iso3)
    : undefined
  const allResources = useMemo(
    () => catalog ? resourcesForCountry(catalog, iso3) : [],
    [catalog, iso3],
  )
  const productCounts = useMemo(() => {
    const counts = new Map<string, number>()
    allResources.forEach((item) => item.productTypes.forEach((type) => counts.set(type, (counts.get(type) || 0) + 1)))
    return counts
  }, [allResources])
  const years = useMemo(
    () => [...new Set(allResources.map((item) => new Date(item.modified).getUTCFullYear()))].sort((a, b) => b - a),
    [allResources],
  )
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return allResources
      .filter((item) => {
        const haystack = [item.title, item.snippet, item.type, ...item.productTypes, ...(item.tags || [])].join(' ').toLowerCase()
        return (
          (!normalized || haystack.includes(normalized)) &&
          (selectedType === 'All products' || item.productTypes.some((type) => type === selectedType)) &&
          (selectedYear === 'All years' || String(new Date(item.modified).getUTCFullYear()) === selectedYear)
        )
      })
      .sort((a, b) => {
        if (sort === 'title') return a.title.localeCompare(b.title)
        if (sort === 'oldest') return a.modified - b.modified
        return b.modified - a.modified
      })
  }, [allResources, query, selectedType, selectedYear, sort])

  useEffect(() => setPage(1), [iso3, query, selectedType, selectedYear, sort])

  function setFilter(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(searchParams)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const definition = country || countryDefinition(iso3)

  return (
    <>
      <SiteHeader active="countries" />
      <main id="top" className="country-detail-main">
        {!catalog && !error && (
          <section className="country-loading section-wrap" role="status">
            <span className="loader" /><strong>Opening the country evidence page</strong><p>Loading curated resources from ArcGIS Online…</p>
          </section>
        )}
        {error && (
          <section className="error-state section-wrap" role="alert"><strong>Country evidence could not be loaded.</strong><p>{error}</p><button type="button" onClick={retry}>Try again</button></section>
        )}
        {catalog && !country && (
          <section className="country-not-found section-wrap">
            <span className="kicker">Country not found</span><h1>No DIEM country page exists for “{routeIso}”.</h1><p>The code may not have assigned resources in the current country catalog.</p><Link to="/countries">Return to the country directory</Link>
          </section>
        )}
        {catalog && country && (
          <>
            <section className="country-profile-hero">
              <div className="country-profile-inner section-wrap">
                <div className="country-profile-copy">
                  <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/countries">Countries</Link><span>/</span><span>{definition.name}</span></nav>
                  <span className="country-code">{definition.iso3 === CROSS_COUNTRY_CODE ? 'GLOBAL' : definition.iso3}</span>
                  <h1>{definition.name}</h1>
                  <p>{definition.iso3 === CROSS_COUNTRY_CODE ? 'Evidence and analysis that connect findings across multiple countries and crisis contexts.' : `Monitoring, assessments and practical evidence concerning food security and agricultural livelihoods in ${definition.name}.`}</p>
                  <div className="country-profile-stats">
                    <div><strong>{country.resourceCount}</strong><span>resources</span></div>
                    <div><strong>{Object.keys(country.typeCounts).filter((type) => type !== 'Unclassified').length}</strong><span>product types</span></div>
                    <div><strong>{formatDate(country.latestModified)}</strong><span>latest update</span></div>
                  </div>
                </div>
                <div className="country-profile-map">
                  {definition.iso3 === CROSS_COUNTRY_CODE ? <div className="global-mark" aria-hidden="true"><span>DIEM</span><strong>GLOBAL</strong></div> : <CountryShape iso3={definition.iso3} name={definition.name} />}
                  <span>{definition.region}</span>
                </div>
              </div>
            </section>

            <section className="country-products section-wrap" aria-labelledby="products-heading">
              <div className="country-section-heading">
                <div><span className="kicker">Evidence collection</span><h2 id="products-heading">Choose a product</h2></div>
                <p>Product classifications are maintained in the DIEM ArcGIS country group.</p>
              </div>
              <div className="product-filter-grid">
                <button type="button" aria-pressed={selectedType === 'All products'} onClick={() => setFilter('type', 'All products', 'All products')}><strong>{allResources.length}</strong><span>All products</span></button>
                {PRODUCT_TYPES.filter((type) => productCounts.has(type)).map((type) => (
                  <button type="button" key={type} aria-pressed={selectedType === type} onClick={() => setFilter('type', type, 'All products')}><strong>{productCounts.get(type)}</strong><span>{type}</span></button>
                ))}
              </div>
            </section>

            <section className="country-library">
              <div className="section-wrap">
                <div className="country-section-heading country-section-heading--library">
                  <div><span className="kicker">Resource library</span><h2>Find country evidence</h2></div>
                  <a href={`https://hqfao.maps.arcgis.com/home/group.html?id=${COUNTRY_GROUP_ID}#content`} target="_blank" rel="noreferrer">View source group ↗</a>
                </div>
                <div className="country-filter-bar">
                  <label className="country-filter-search"><span>Search</span><input type="search" placeholder={`Search ${definition.name}`} value={query} onChange={(event) => setFilter('q', event.target.value, '')} /></label>
                  <label><span>Year</span><select value={selectedYear} onChange={(event) => setFilter('year', event.target.value, 'All years')}><option>All years</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
                  <label><span>Sort</span><select value={sort} onChange={(event) => setFilter('sort', event.target.value, 'latest')}><option value="latest">Recently updated</option><option value="oldest">Oldest updated</option><option value="title">Title A–Z</option></select></label>
                  {(query || selectedType !== 'All products' || selectedYear !== 'All years' || sort !== 'latest') && <button type="button" onClick={() => setSearchParams({}, { replace: true })}>Clear filters</button>}
                </div>
                <div className="country-results-meta"><p><strong>{filtered.length}</strong> resources found{selectedType !== 'All products' ? ` · ${selectedType}` : ''}</p></div>
                {visible.length ? <div className="country-resource-grid">{visible.map((item) => <ResourceCard item={item} key={item.id} />)}</div> : <div className="empty-state"><strong>No matching evidence found</strong><p>Try a broader search or remove a product or year filter.</p></div>}
                {pageCount > 1 && <nav className="pagination" aria-label="Country resource pages"><button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page <strong>{page}</strong> of {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}>Next</button></nav>}
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
