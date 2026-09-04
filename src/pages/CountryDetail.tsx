import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import crossCountryHeroImage from '../assets/heroes/cyclone-freddy-madagascar-2023.jpg'
import { CountryEditorial } from '../components/CountryEditorial'
import { CountryEveOverview } from '../components/CountryEveOverview'
import { CountryRoundTimeline } from '../components/CountryRoundTimeline'
import { CountryMonitoring } from '../components/CountryMonitoring'
import { CountryShape } from '../components/CountryMap'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { distinctSummary, formatDate, itemEdition, itemYear } from '../lib/catalog'
import { buildCatalogSearchIndex, matchingFamilyIds } from '../lib/catalogSearch'
import {
  UNRECORDED_LANGUAGE,
  groupProductFamilies,
  itemLanguage,
  type ProductFamily,
} from '../lib/productFamilies'
import { CONTENT_GROUP_ID, buildDistinctThumbnailIndex, distinctThumbnail, itemProductPath, itemThumbnail } from '../services/arcgis'
import {
  fetchCountryEditorial,
  type CountryEditorialContent,
} from '../services/countryEditorial'
import {
  CROSS_COUNTRY_CODE,
  EVIDENCE_PATHWAYS,
  PRODUCT_TYPES,
  UNRECORDED_PRODUCT_TYPE,
  UNRECORDED_PRODUCT_TYPE_LABEL,
  countryDefinition,
  pathwayLabel,
  resourcesForCountry,
  type CountryResource,
  type EvidencePathway,
  type ProductType,
} from '../services/countries'
import {
  fetchCountryMonitoringCoverage,
  type CountryMonitoringCoverage,
} from '../services/monitoring'
import { isEveRegularMonitoringActive } from '../services/eve'

const PAGE_SIZE = 16

function ResourceCard({ family, thumbnailIndex }: { family: ProductFamily<CountryResource>, thumbnailIndex: Set<string> }) {
  const item = family.primary
  const summary = distinctSummary(item)
  const thumbnail = itemThumbnail(item)
  // Marked only where the image is a shared basemap or an ArcGIS default and so
  // cannot separate one product in a series from the next.
  const edition = distinctThumbnail(item, thumbnailIndex) ? undefined : itemEdition(item)
  const soleLanguage = itemLanguage(item)
  const product = item.productTypes.find((type) => type !== UNRECORDED_PRODUCT_TYPE) || UNRECORDED_PRODUCT_TYPE_LABEL
  const countryCodes = [...new Set(family.variants.flatMap((variant) => variant.countries))]
    .filter((code) => code !== CROSS_COUNTRY_CODE)
  const assignedCountries = countryCodes
    .map((code) => countryDefinition(code))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
  const countryLabel = assignedCountries.length
    ? assignedCountries.map((entry) => entry.name).join(', ')
    : family.variants.some((variant) => variant.countries.includes(CROSS_COUNTRY_CODE))
      ? 'Cross-country'
      : 'Country not assigned'
  const pathways = EVIDENCE_PATHWAYS.filter((pathway) => (
    family.variants.some((variant) => variant.evidencePathways.includes(pathway))
  ))
  const pathwayIcons: Record<EvidencePathway, string> = {
    'Regular monitoring': 'bi-activity',
    'Hazard impact': 'bi-bullseye',
    'Research & analysis': 'bi-journal-richtext',
    'Seasonal calendar': 'bi-calendar3',
  }
  return (
    <article className="country-resource-card">
      <Link className="country-resource-image" to={itemProductPath(item)} aria-label={`Open ${item.title}`}>
        {thumbnail
          ? <img src={thumbnail} alt="" loading="lazy" width={800} height={500} />
          : <span className="card-image-plate">{edition}</span>}
        {thumbnail && edition && <span className="card-edition">{edition}</span>}
        <span className="country-product-badge">{product}</span>
      </Link>
      <div className="country-resource-body">
        <div className="country-resource-meta"><span>{item.type}</span><time dateTime={new Date(item.created).toISOString()}>Added {formatDate(item.created)}</time></div>
        {pathways.length > 0 && (
          <ul className="country-resource-pathways" aria-label="Evidence pathways">
            {pathways.map((pathway) => (
              <li className={`country-pathway country-pathway--${pathway.toLowerCase().replace(/[^a-z]+/g, '-')}`} key={pathway}>
                <i className={`bi ${pathwayIcons[pathway]}`} aria-hidden="true" />
                {pathwayLabel(pathway)}
              </li>
            ))}
          </ul>
        )}
        <h3><Link to={itemProductPath(item)}>{item.title.trim()}</Link></h3>
        {summary && <p>{summary}</p>}
        <div className="country-resource-footer">
          <span className="country-resource-country-flags" aria-hidden="true">
            {assignedCountries.slice(0, 2).map((entry) => <i className={`flag flag-small flag-${entry.iso3.toLowerCase()}`} key={entry.iso3} />)}
          </span>
          <span title={countryLabel}>{countryLabel}</span>
        </div>
        {/* A list, not a <nav>; see CatalogContentCard for why, and for why the
            row is shown even when a product has a single edition. */}
        {(family.variants.length > 1 || soleLanguage !== UNRECORDED_LANGUAGE) && (
        <div className="country-resource-languages">
          <span id={`country-languages-${item.id}`}>Available in</span>
          {family.variants.length > 1 ? (
            <ul aria-labelledby={`country-languages-${item.id}`}>
              {family.languages.map(({ language, item: variant }) => (
                <li key={variant.id}>
                  <Link to={itemProductPath(variant)}>{language}</Link>
                </li>
              ))}
            </ul>
          ) : (
            <span className="card-language-only">{soleLanguage}</span>
          )}
        </div>
        )}
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
  const [editorial, setEditorial] = useState<CountryEditorialContent>()
  const [editorialError, setEditorialError] = useState(false)
  const [monitoringCoverage, setMonitoringCoverage] = useState<CountryMonitoringCoverage>()
  const [eveMonitoringActive, setEveMonitoringActive] = useState(false)

  const query = searchParams.get('q') || ''
  const selectedType = searchParams.get('type') || 'All products'
  const selectedPathway = searchParams.get('pathway') || 'All pathways'
  const selectedYear = searchParams.get('year') || 'All years'
  const sort = searchParams.get('sort') || 'latest'

  const country = catalog
    ? iso3 === CROSS_COUNTRY_CODE
      ? catalog.crossCountry
      : catalog.countries.find((candidate) => candidate.iso3 === iso3)
    : undefined
  // Held back until the catalogue resolves, so the tab never flashes the ISO
  // code before the country name is known.
  useDocumentTitle(country?.name)
  const allResources = useMemo(
    () => catalog ? resourcesForCountry(catalog, iso3) : [],
    [catalog, iso3],
  )
  const allResourceFamilies = useMemo(
    () => groupProductFamilies(allResources),
    [allResources],
  )
  const productCounts = useMemo(() => {
    const counts = new Map<string, number>()
    allResourceFamilies.forEach((family) => {
      const types = new Set(family.variants.flatMap((item) => item.productTypes))
      types.forEach((type) => counts.set(type, (counts.get(type) || 0) + 1))
    })
    return counts
  }, [allResourceFamilies])
  const pathwayCounts = useMemo(() => {
    const counts = new Map<EvidencePathway, number>()
    allResourceFamilies.forEach((family) => {
      const pathways = new Set(family.variants.flatMap((item) => item.evidencePathways))
      pathways.forEach((pathway) => counts.set(pathway, (counts.get(pathway) || 0) + 1))
    })
    return counts
  }, [allResourceFamilies])
  const years = useMemo(
    () => [...new Set(allResourceFamilies.flatMap((family) => family.variants.map(itemYear)))].sort((a, b) => b - a),
    [allResourceFamilies],
  )
  // Built from the whole catalogue, not just this country, so an image counts as
  // distinguishing only if no other product anywhere reuses the same file.
  const thumbnailIndex = useMemo(() => buildDistinctThumbnailIndex(catalog?.items || []), [catalog])
  const searchIndex = useMemo(() => buildCatalogSearchIndex(allResourceFamilies), [allResourceFamilies])
  const matchedIds = useMemo(() => matchingFamilyIds(searchIndex, query), [query, searchIndex])
  const filtered = useMemo(() => {
    return allResourceFamilies
      .filter((family) => {
        const productTypes = new Set(family.variants.flatMap((item) => item.productTypes))
        return (
          (!matchedIds || matchedIds.has(family.id)) &&
          (selectedPathway === 'All pathways' || family.variants.some((item) => item.evidencePathways.includes(selectedPathway as EvidencePathway))) &&
          (selectedType === 'All products' || productTypes.has(selectedType as ProductType)) &&
          (selectedYear === 'All years' || family.variants.some((item) => String(itemYear(item)) === selectedYear))
        )
      })
      .sort((a, b) => {
        if (sort === 'title') return a.primary.title.localeCompare(b.primary.title)
        if (sort === 'oldest') return a.latestCreated - b.latestCreated
        return b.latestCreated - a.latestCreated
      })
  }, [allResourceFamilies, matchedIds, selectedPathway, selectedType, selectedYear, sort])

  useEffect(() => setPage(1), [iso3, query, selectedPathway, selectedType, selectedYear, sort])

  /** Brings the results heading back into view; see Catalog.tsx for the reason. */
  const resultsRef = useRef<HTMLDivElement>(null)
  const previousPage = useRef(page)
  useEffect(() => {
    if (previousPage.current === page) return
    previousPage.current = page
    const target = resultsRef.current
    if (!target) return
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' })
  }, [page])

  useEffect(() => {
    if (!catalog || !country) return
    const controller = new AbortController()
    setEditorial(undefined)
    setEditorialError(false)
    fetchCountryEditorial(iso3, allResources, controller.signal)
      .then(setEditorial)
      .catch((requestError) => {
        if ((requestError as Error).name !== 'AbortError') setEditorialError(true)
      })
    return () => controller.abort()
  }, [allResources, catalog, country, iso3])

  useEffect(() => {
    if (!catalog || !country || iso3 === CROSS_COUNTRY_CODE) {
      setMonitoringCoverage(undefined)
      return
    }
    const controller = new AbortController()
    setMonitoringCoverage(undefined)
    fetchCountryMonitoringCoverage(iso3, controller.signal)
      .then(setMonitoringCoverage)
      .catch((requestError) => {
        if ((requestError as Error).name !== 'AbortError') setMonitoringCoverage(undefined)
      })
    return () => controller.abort()
  }, [catalog, country, iso3])

  useEffect(() => {
    setEveMonitoringActive(false)
    if (!catalog || !country || iso3 === CROSS_COUNTRY_CODE) return

    let cancelled = false
    isEveRegularMonitoringActive(iso3)
      .then((active) => {
        if (!cancelled) setEveMonitoringActive(active)
      })
      .catch(() => {
        if (!cancelled) setEveMonitoringActive(false)
      })
    return () => { cancelled = true }
  }, [catalog, country, iso3])

  function setFilter(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(searchParams)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const definition = country || countryDefinition(iso3)
  const latestUpdate = Math.max(
    country?.latestModified || 0,
    editorial?.updatedAt || 0,
    monitoringCoverage?.latest.publicationDate || 0,
  )

  return (
    <>
      <SiteHeader />
      <main id="top" className="country-detail-main">
        {!catalog && !error && (
          <section className="country-loading section-wrap" role="status">
            <span className="loader" /><strong>Opening the country evidence page</strong><p>Loading curated resources from the DIEM content platform…</p>
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
            <section className={`country-profile-hero${iso3 === CROSS_COUNTRY_CODE ? ' country-profile-hero--cross-country' : ''}`}>
              {iso3 === CROSS_COUNTRY_CODE && (
                <>
                  <img className="country-profile-hero-image" src={crossCountryHeroImage} alt="" />
                  <div className="country-profile-hero-overlay" />
                  <a
                    className="country-profile-hero-credit"
                    href="https://commons.wikimedia.org/wiki/File:Tropical_Cyclone_Freddy_Slams_Madagascar_(MODIS).jpg"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Image: NASA MODIS / Public domain
                  </a>
                </>
              )}
              <div className="country-profile-inner section-wrap">
                <div className="country-profile-copy">
                  <nav className="breadcrumbs" aria-label="Breadcrumb"><Link to="/countries">Countries</Link><span>/</span><span>{definition.name}</span></nav>
                  <span className="country-code">{definition.iso3 === CROSS_COUNTRY_CODE ? 'GLOBAL' : definition.iso3}</span>
                  <h1>{definition.name}</h1>
                  <p>{definition.iso3 === CROSS_COUNTRY_CODE ? 'Evidence and analysis that connect findings across multiple countries and crisis contexts.' : `Monitoring, assessments and practical evidence concerning food security and agricultural livelihoods in ${definition.name}.`}</p>
                  <div className="country-profile-stats">
                    <div><strong>{country.resourceCount}</strong><span>products</span></div>
                    <div><strong>{Object.keys(country.typeCounts).filter((type) => type !== UNRECORDED_PRODUCT_TYPE).length}</strong><span>product types</span></div>
                    <div><strong>{formatDate(latestUpdate)}</strong><span>latest update</span></div>
                  </div>
                </div>
                {definition.iso3 !== CROSS_COUNTRY_CODE && (
                  <div className="country-profile-map">
                    <CountryShape iso3={definition.iso3} name={definition.name} />
                    <span>{definition.region}</span>
                  </div>
                )}
              </div>
            </section>

            {editorial && <CountryEditorial countryName={definition.name} content={editorial} />}
            {editorialError && (
              <aside className="country-editorial-status section-wrap" role="status">
                <strong>Country introduction is temporarily unavailable.</strong>
                <span>The evidence collection remains available below.</span>
              </aside>
            )}

            {eveMonitoringActive && (
              <CountryEveOverview countryName={definition.name} iso3={definition.iso3} />
            )}

            {monitoringCoverage && (
              <CountryMonitoring countryName={definition.name} coverage={monitoringCoverage} />
            )}

            <CountryRoundTimeline families={allResourceFamilies} countryName={definition.name} />

            <section className="country-products section-wrap" aria-labelledby="products-heading">
              <div className="country-section-heading">
                <div><span className="kicker">Evidence collection</span><h2 id="products-heading">Choose a product</h2></div>
                <p>Product classifications are maintained in the DIEM Hub content group.</p>
              </div>
              {pathwayCounts.size > 0 && (
                <div className="country-pathway-filter" role="group" aria-label="Filter by evidence pathway">
                  <button type="button" aria-pressed={selectedPathway === 'All pathways'} onClick={() => setFilter('pathway', 'All pathways', 'All pathways')}>
                    <span>All pathways</span><strong>{allResourceFamilies.length}</strong>
                  </button>
                  {EVIDENCE_PATHWAYS.filter((pathway) => pathwayCounts.has(pathway)).map((pathway) => (
                    <button type="button" className={`country-pathway-filter--${pathway.toLowerCase().replace(/[^a-z]+/g, '-')}`} aria-pressed={selectedPathway === pathway} onClick={() => setFilter('pathway', pathway, 'All pathways')} key={pathway}>
                      <span>{pathway}</span><strong>{pathwayCounts.get(pathway)}</strong>
                    </button>
                  ))}
                </div>
              )}
              <div className="product-filter-grid">
                <button type="button" aria-pressed={selectedType === 'All products'} onClick={() => setFilter('type', 'All products', 'All products')}><strong>{allResourceFamilies.length}</strong><span>All products</span></button>
                {PRODUCT_TYPES.filter((type) => productCounts.has(type)).map((type) => (
                  <button type="button" key={type} aria-pressed={selectedType === type} onClick={() => setFilter('type', type, 'All products')}><strong>{productCounts.get(type)}</strong><span>{type}</span></button>
                ))}
              </div>
            </section>

            <section className="country-library">
              <div className="section-wrap">
                <div className="country-section-heading country-section-heading--library">
                  <div><span className="kicker">Resource library</span><h2>Find country evidence</h2></div>
                  <a href={`https://hqfao.maps.arcgis.com/home/group.html?id=${CONTENT_GROUP_ID}#content`} target="_blank" rel="noreferrer">View source group ↗</a>
                </div>
                <div className="country-filter-bar">
                  <label className="country-filter-search"><span>Search</span><input type="search" placeholder={`Search ${definition.name}`} value={query} onChange={(event) => setFilter('q', event.target.value, '')} /></label>
                  <label><span>Year added</span><select value={selectedYear} onChange={(event) => setFilter('year', event.target.value, 'All years')}><option>All years</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
                  <label><span>Sort</span><select value={sort} onChange={(event) => setFilter('sort', event.target.value, 'latest')}><option value="latest">Recently added</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label>
                  {(query || selectedPathway !== 'All pathways' || selectedType !== 'All products' || selectedYear !== 'All years' || sort !== 'latest') && <button type="button" onClick={() => setSearchParams({}, { replace: true })}>Clear filters</button>}
                </div>
                <div className="country-results-meta" ref={resultsRef}><p><strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'} found{selectedPathway !== 'All pathways' ? ` · ${selectedPathway}` : ''}{selectedType !== 'All products' ? ` · ${selectedType}` : ''}</p></div>
                {visible.length ? <div className="country-resource-grid">{visible.map((family) => <ResourceCard family={family} thumbnailIndex={thumbnailIndex} key={family.id} />)}</div> : <div className="empty-state"><strong>No matching evidence found</strong><p>Try a broader search or remove a product or year filter.</p></div>}
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
