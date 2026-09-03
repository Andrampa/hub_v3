import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CatalogContentCard, pathwaySlug } from '../components/CatalogContentCard'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { itemYear } from '../lib/catalog'
import { groupProductFamilies } from '../lib/productFamilies'
import { buildCatalogSearchIndex, matchingFamilyIds } from '../lib/catalogSearch'
import { CONTENT_GROUP_ID } from '../services/arcgis'
import {
  CROSS_COUNTRY_CODE,
  EVIDENCE_PATHWAYS,
  PRODUCT_TYPES,
  countryDefinition,
  type CountryResource,
  type EvidencePathway,
  type ProductType,
} from '../services/countries'

const PAGE_SIZE = 16
const typeGroups: Record<string, string[]> = {
  Data: ['Microsoft Excel', 'CSV', 'Shapefile', 'Feature Service', 'Service Definition'],
  Documents: ['Document Link', 'PDF', 'Microsoft Powerpoint'],
  'Maps & apps': ['StoryMap', 'Web Map', 'Dashboard', 'Web Experience', 'Web Mapping Application', 'Form'],
  Media: ['Image'],
  Pages: ['Hub Page'],
}

function categoryFor(item: CountryResource) {
  return Object.entries(typeGroups).find(([, types]) => types.includes(item.type))?.[0] || 'Other'
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
}

export default function Catalog() {
  const { catalog, error, retry } = useCountryCatalog()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const category = params.get('content') || 'All content'
  const country = params.get('country') || 'All countries'
  const pathway = params.get('pathway') || 'All pathways'
  const product = params.get('product') || 'All products'
  const year = params.get('year') || 'All years'
  const requestedSort = params.get('sort') || 'newest'
  const sort = requestedSort === 'oldest' || requestedSort === 'title' ? requestedSort : 'newest'
  const page = Math.max(1, Number(params.get('page')) || 1)

  const families = useMemo(() => groupProductFamilies(catalog?.items || []), [catalog])
  const countries = useMemo(() => [...new Set(catalog?.items.flatMap((item) => item.countries) || [])]
    .map(countryDefinition)
    .sort((a, b) => {
      if (a.iso3 === CROSS_COUNTRY_CODE) return -1
      if (b.iso3 === CROSS_COUNTRY_CODE) return 1
      return a.name.localeCompare(b.name)
    }), [catalog])
  const years = useMemo(() => [...new Set(catalog?.items.map(itemYear) || [])].sort((a, b) => b - a), [catalog])
  // Only offer a pillar or product filter that some published product actually
  // carries, so an empty result is never reachable from the controls.
  const availablePathways = useMemo(() => EVIDENCE_PATHWAYS.filter((value) => (
    catalog?.items.some((item) => item.evidencePathways.includes(value))
  )), [catalog])
  const availableProducts = useMemo(() => PRODUCT_TYPES.filter((value) => (
    catalog?.items.some((item) => item.productTypes.includes(value))
  )), [catalog])

  const searchIndex = useMemo(() => buildCatalogSearchIndex(families), [families])
  const matchedIds = useMemo(() => matchingFamilyIds(searchIndex, query), [query, searchIndex])

  const filteredFamilies = useMemo(() => {
    return families.filter((family) => (
      (!matchedIds || matchedIds.has(family.id)) &&
      (category === 'All content' || family.variants.some((item) => categoryFor(item) === category)) &&
      (country === 'All countries' || family.variants.some((item) => item.countries.includes(country))) &&
      (pathway === 'All pathways' || family.variants.some((item) => item.evidencePathways.includes(pathway as EvidencePathway))) &&
      (product === 'All products' || family.variants.some((item) => item.productTypes.includes(product as ProductType))) &&
      (year === 'All years' || family.variants.some((item) => String(itemYear(item)) === year))
    )).sort((a, b) => {
      if (sort === 'title') return a.primary.title.localeCompare(b.primary.title)
      return sort === 'oldest' ? a.latestCreated - b.latestCreated : b.latestCreated - a.latestCreated
    })
  }, [category, country, families, matchedIds, pathway, product, sort, year])

  const pageCount = Math.max(1, Math.ceil(filteredFamilies.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleFamilies = filteredFamilies.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    if (page > pageCount) {
      const next = new URLSearchParams(params)
      next.set('page', String(pageCount))
      setParams(next, { replace: true })
    }
  }, [page, pageCount, params, setParams])

  const update = (key: string, value: string, defaultValue?: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const clearFilters = () => setParams({})
  const hasFilters = Boolean(query || category !== 'All content' || country !== 'All countries' || pathway !== 'All pathways' || product !== 'All products' || year !== 'All years' || sort !== 'newest')

  return (
    <>
      <SiteHeader active="catalog" />
      <main className="catalog-page" id="top">
        <section className="catalog-hero"><div className="section-wrap"><span className="kicker kicker--light">Public catalog</span><h1>Explore DIEM products</h1><p>Search the complete public collection of evidence, data, maps and analytical resources.</p></div></section>
        <section className="catalog-section" aria-labelledby="catalog-title">
          <div className="section-wrap">
            <div className="section-heading catalog-heading"><div><span className="kicker">Find evidence</span><h2 id="catalog-title">The complete collection</h2></div><p>Filter by the pillar a product belongs to and the kind of product it is, or search across titles, descriptions and tags.</p></div>
            <div className="filter-bar catalog-filter-bar">
              <label className="filter-search"><SearchIcon /><span className="sr-only">Search products</span><input type="search" placeholder="Search products" value={query} onChange={(event) => update('q', event.target.value)} /></label>
              <label><span>Pillar</span><select value={pathway} onChange={(event) => update('pathway', event.target.value, 'All pathways')}><option>All pathways</option>{availablePathways.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Product</span><select value={product} onChange={(event) => update('product', event.target.value, 'All products')}><option>All products</option>{availableProducts.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Country</span><select value={country} onChange={(event) => update('country', event.target.value, 'All countries')}><option>All countries</option>{countries.map((value) => <option value={value.iso3} key={value.iso3}>{value.name}</option>)}</select></label>
              <label><span>Format</span><select value={category} onChange={(event) => update('content', event.target.value, 'All content')}><option>All content</option>{Object.keys(typeGroups).map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Year added</span><select value={year} onChange={(event) => update('year', event.target.value, 'All years')}><option>All years</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Sort</span><select value={sort} onChange={(event) => update('sort', event.target.value, 'newest')}><option value="newest">Recently added</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label>
            </div>
            {error ? <div className="error-state" role="alert"><strong>The public catalog could not be reached.</strong><p>{error}. Check your connection and try again.</p><button type="button" onClick={retry}>Retry</button></div> : !catalog ? <div className="loading-state" role="status"><span className="loader" /><strong>Connecting to the public DIEM catalog</strong><p>Gathering the latest resources from the DIEM content platform…</p></div> : <>
              {availablePathways.length > 0 && (
                <div className="catalog-pathway-filter" role="group" aria-label="Filter by pillar">
                  <button type="button" aria-pressed={pathway === 'All pathways'} onClick={() => update('pathway', 'All pathways', 'All pathways')}>
                    <span>All pathways</span><strong>{families.length}</strong>
                  </button>
                  {availablePathways.map((value) => (
                    <button
                      type="button"
                      className={`catalog-pathway-filter--${pathwaySlug(value)}`}
                      aria-pressed={pathway === value}
                      onClick={() => update('pathway', value, 'All pathways')}
                      key={value}
                    >
                      <span>{value}</span>
                      <strong>{families.filter((family) => family.variants.some((item) => item.evidencePathways.includes(value))).length}</strong>
                    </button>
                  ))}
                </div>
              )}
              <div className="results-meta" aria-live="polite"><p><strong>{filteredFamilies.length.toLocaleString()}</strong> {filteredFamilies.length === 1 ? 'product' : 'products'} found{pathway !== 'All pathways' ? ` · ${pathway}` : ''}{product !== 'All products' ? ` · ${product}` : ''}</p><div>{hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}<a href={`https://hqfao.maps.arcgis.com/home/group.html?id=${CONTENT_GROUP_ID}`} target="_blank" rel="noreferrer">View source group <span aria-hidden="true">↗</span></a></div></div>
              <div className="card-grid">{visibleFamilies.map((family) => <CatalogContentCard family={family} key={family.id} />)}</div>
              {!visibleFamilies.length && <div className="empty-state"><strong>No matching evidence found</strong><p>Try removing a filter or using a broader search term.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>}
              {pageCount > 1 && <nav className="pagination" aria-label="Catalog pages"><button disabled={safePage === 1} onClick={() => update('page', String(safePage - 1))}>Previous</button><span>Page <strong>{safePage}</strong> of {pageCount}</span><button disabled={safePage === pageCount} onClick={() => update('page', String(safePage + 1))}>Next</button></nav>}
            </>}
            <p className="catalog-back"><Link to="/">← Back to DIEM Hub</Link></p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
