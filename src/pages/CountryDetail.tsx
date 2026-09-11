import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { HeroImage } from '../components/HeroImage'
import { CountryEditorial } from '../components/CountryEditorial'
import { CountryEveOverview } from '../components/CountryEveOverview'
import { CountryRoundTimeline } from '../components/CountryRoundTimeline'
import { CountryMonitoring } from '../components/CountryMonitoring'
import { CountryPhotoGalleries } from '../components/CountryPhotoGalleries'
import { CountryShape } from '../components/CountryMap'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { distinctSummary, formatDate, itemEdition, itemTypeLabel, itemYear } from '../lib/catalog'
import { buildCatalogSearchIndex, matchingFamilyIds } from '../lib/catalogSearch'
import {
  LEGACY_UNASSIGNED_PATHWAY,
  UNASSIGNED_PATHWAY,
  readFilters,
  stripUnsupportedFilters,
  unsupportedFilterKey,
  unsupportedFilterMessage,
  type FilterSpec,
  type UnsupportedFilter,
} from '../lib/catalogFilters'
import {
  UNRECORDED_LANGUAGE,
  groupProductFamilies,
  itemLanguage,
  type ProductFamily,
} from '../lib/productFamilies'
import { buildDistinctThumbnailIndex, distinctThumbnail, itemProductPath, itemThumbnail } from '../services/arcgis'
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
const SORT_VALUES = ['latest', 'oldest', 'title'] as const

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
      {/* One tab stop per card; see CatalogContentCard for why the image link is
          an overlay rather than a focusable duplicate of the title link. */}
      <div className="country-resource-image">
        {thumbnail
          ? <img src={thumbnail} alt="" loading="lazy" width={800} height={500} />
          : <span className="card-image-plate">{edition}</span>}
        {thumbnail && edition && <span className="card-edition">{edition}</span>}
        <span className="country-product-badge">{product}</span>
        <Link className="card-media-link" to={itemProductPath(item)} tabIndex={-1} aria-hidden="true" />
      </div>
      <div className="country-resource-body">
        <div className="country-resource-meta"><span>{itemTypeLabel(item)}</span><time dateTime={new Date(item.created).toISOString()}>Added {formatDate(item.created)}</time></div>
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
  const [editorial, setEditorial] = useState<CountryEditorialContent>()
  const [editorialError, setEditorialError] = useState(false)
  const [monitoringCoverage, setMonitoringCoverage] = useState<CountryMonitoringCoverage>()
  const [eveMonitoringActive, setEveMonitoringActive] = useState(false)

  const query = searchParams.get('q') || ''
  const page = Math.max(1, Number(searchParams.get('page')) || 1)

  const country = catalog
    ? iso3 === CROSS_COUNTRY_CODE
      ? catalog.crossCountry
      : catalog.countries.find((candidate) => candidate.iso3 === iso3)
    : undefined
  // Held back until the catalogue resolves, so the tab never flashes the ISO
  // code before the country name is known.
  // The route accepts any casing and the pseudo-country has its own slug, so
  // the canonical URL is built from the resolved country rather than from the
  // path the reader happened to type.
  const canonicalSlug = country && (country.iso3 === CROSS_COUNTRY_CODE ? 'cross-country' : country.iso3.toLowerCase())

  usePageMetadata({
    title: country?.name,
    canonicalPath: canonicalSlug ? `/countries/${canonicalSlug}` : undefined,
    description: country
      ? `${country.resourceCount} DIEM products for ${country.name}: monitoring rounds, hazard impact assessments and published evidence on food security and agricultural livelihoods.`
      : undefined,
    structuredData: country
      ? {
          '@type': 'CollectionPage',
          name: `DIEM evidence for ${country.name}`,
          url: `https://data-in-emergencies.fao.org/countries/${canonicalSlug}`,
          about: { '@type': 'Country', name: country.name, identifier: country.iso3 },
        }
      : undefined,
  })
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
  /**
   * Products carrying no pathway category at all. Without this the pathway tiles
   * summed to 32 against a stated 33 on `/countries/ner`, which reads as a
   * broken count rather than as missing metadata. `/catalog` already shows it.
   */
  const unassignedPathwayCount = useMemo(
    () => allResourceFamilies.filter((family) => !family.variants.some((item) => item.evidencePathways.length)).length,
    [allResourceFamilies],
  )

  /**
   * URL filter validation, on the same contract as `/catalog`: a value the
   * controls cannot produce is read as the default, named to the reader and
   * dropped, rather than applied behind a control that denies it exists.
   * Asserted only once the country's own resources are known.
   */
  const settled = Boolean(catalog && country)
  const filterSpecs = useMemo<FilterSpec[]>(() => [
    {
      key: 'pathway',
      defaultValue: 'All pathways',
      allowed: settled
        ? [
            ...EVIDENCE_PATHWAYS.filter((pathway) => pathwayCounts.has(pathway)),
            ...(unassignedPathwayCount > 0 ? [UNASSIGNED_PATHWAY] : []),
          ]
        : undefined,
      aliases: { [LEGACY_UNASSIGNED_PATHWAY]: UNASSIGNED_PATHWAY },
    },
    { key: 'type', defaultValue: 'All products', allowed: settled ? PRODUCT_TYPES.filter((type) => productCounts.has(type)) : undefined },
    { key: 'year', defaultValue: 'All years', allowed: settled ? years.map(String) : undefined },
    { key: 'sort', defaultValue: 'latest', allowed: [...SORT_VALUES] },
  ], [pathwayCounts, productCounts, settled, unassignedPathwayCount, years])

  const { values: filterValues, unsupported } = useMemo(
    () => readFilters(searchParams, filterSpecs),
    [filterSpecs, searchParams],
  )
  const selectedPathway = filterValues.pathway
  const selectedType = filterValues.type
  const selectedYear = filterValues.year
  const sort = filterValues.sort

  // Held in state because the notice outlives the parameters it describes.
  const [removedFilters, setRemovedFilters] = useState<UnsupportedFilter[]>([])
  // The route keeps this component mounted across countries, and a value
  // dropped for Niger says nothing about Chad.
  useEffect(() => setRemovedFilters((current) => (current.length ? [] : current)), [iso3])
  const unsupportedKey = unsupportedFilterKey(unsupported)
  useEffect(() => {
    if (!unsupported.length) return
    setRemovedFilters(unsupported)
    setSearchParams(stripUnsupportedFilters(searchParams, unsupported), { replace: true })
    // `unsupported` is rebuilt every render; its contents are the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupportedKey])
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
          (selectedPathway === 'All pathways' ||
            (selectedPathway === UNASSIGNED_PATHWAY
              ? !family.variants.some((item) => item.evidencePathways.length)
              : family.variants.some((item) => item.evidencePathways.includes(selectedPathway as EvidencePathway)))) &&
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

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // A filter change can leave the current page beyond the last one. The page is
  // corrected in the URL rather than only in the render, so what is shared is
  // what is shown; `replace`, because the reader did not ask to go there.
  useEffect(() => {
    // The filter validation writes the URL in this same commit and drops the
    // page with the values it removes; clamping here as well would write the
    // rejected values straight back.
    if (unsupported.length || page <= pageCount) return
    const next = new URLSearchParams(searchParams)
    next.set('page', String(pageCount))
    setSearchParams(next, { replace: true })
  }, [page, pageCount, searchParams, setSearchParams, unsupported.length])

  /**
   * Brings the results heading back into view; see Catalog.tsx for the reason.
   * The pathway tiles and the product tiles sit roughly 500 px above the
   * results, so a tile click changed a count the reader could not see. Keyed on
   * the page and both tile filters, and seeded with the first render's value so
   * arriving on a filtered link does not scroll.
   */
  const resultsRef = useRef<HTMLDivElement>(null)
  const scrollKey = `${safePage}|${selectedPathway}|${selectedType}`
  const previousScrollKey = useRef(scrollKey)
  useEffect(() => {
    if (previousScrollKey.current === scrollKey) return
    previousScrollKey.current = scrollKey
    const target = resultsRef.current
    if (!target) return
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' })
  }, [scrollKey])

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

  /**
   * `/catalog`'s history policy, applied here: typing in the search box replaces
   * the entry, because a keystroke is not a destination, while a select, a tile
   * and a page turn each create one. The country page previously replaced for
   * every key, so a reader who filtered three times and pressed Back left the
   * country instead of stepping back one filter.
   */
  function setFilter(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(searchParams)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    // Any filter but the page invalidates the page it was counted on.
    if (key !== 'page') next.delete('page')
    setSearchParams(next, { replace: key === 'q' })
  }

  const clearFilters = () => {
    setRemovedFilters([])
    setSearchParams({})
  }

  const definition = country || countryDefinition(iso3)
  const latestPublication = Math.max(
    country?.latestPublished || 0,
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
                  <HeroImage name="cyclone-freddy-madagascar-2023" className="country-profile-hero-image" />
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
                  <span className="country-code">
                    {definition.iso3 !== CROSS_COUNTRY_CODE && <i className={`flag flag-small flag-${definition.iso3.toLowerCase()}`} aria-hidden="true" />}
                    {definition.iso3 === CROSS_COUNTRY_CODE ? 'GLOBAL' : definition.iso3}
                  </span>
                  <h1>{definition.name}</h1>
                  <p>{definition.iso3 === CROSS_COUNTRY_CODE ? 'Evidence and analysis that connect findings across multiple countries and crisis contexts.' : `Monitoring, assessments and practical evidence concerning food security and agricultural livelihoods in ${definition.name}.`}</p>
                  <div className="country-profile-stats">
                    <div><strong>{country.resourceCount}</strong><span>products</span></div>
                    <div><strong>{Object.keys(country.typeCounts).filter((type) => type !== UNRECORDED_PRODUCT_TYPE).length}</strong><span>product types</span></div>
                    <div><strong>{formatDate(latestPublication)}</strong><span>latest publication</span></div>
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

            <CountryPhotoGalleries countryName={definition.name} iso3={definition.iso3} />

            <section className="country-products section-wrap" aria-labelledby="products-heading">
              <div className="country-section-heading">
                <div><span className="kicker">Evidence collection</span><h2 id="products-heading">Choose a product</h2></div>
              </div>
              {pathwayCounts.size > 0 && (
                <div className="country-pathway-filter" role="group" aria-label="Filter by evidence pathway">
                  <button type="button" aria-pressed={selectedPathway === 'All pathways'} onClick={() => setFilter('pathway', 'All pathways', 'All pathways')}>
                    <span>All pathways</span><strong>{allResourceFamilies.length}</strong>
                  </button>
                  {EVIDENCE_PATHWAYS.filter((pathway) => pathwayCounts.has(pathway)).map((pathway) => (
                    <button type="button" className={`country-pathway-filter--${pathway.toLowerCase().replace(/[^a-z]+/g, '-')}`} aria-pressed={selectedPathway === pathway} onClick={() => setFilter('pathway', pathway, 'All pathways')} key={pathway}>
                      <span>{pathwayLabel(pathway)}</span><strong>{pathwayCounts.get(pathway)}</strong>
                    </button>
                  ))}
                  {/* Closes the arithmetic: the pathway counts otherwise sum to
                      less than the total with no way to see the difference.
                      Absent when nothing is unassigned, so it never states a
                      gap that does not exist. */}
                  {unassignedPathwayCount > 0 && (
                    <button type="button" className="country-pathway-filter--unassigned" aria-pressed={selectedPathway === UNASSIGNED_PATHWAY} onClick={() => setFilter('pathway', UNASSIGNED_PATHWAY, 'All pathways')}>
                      <span>{UNASSIGNED_PATHWAY}</span><strong>{unassignedPathwayCount}</strong>
                    </button>
                  )}
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
                </div>
                <div className="country-filter-bar">
                  <label className="country-filter-search"><span>Search</span><input type="search" placeholder={`Search ${definition.name}`} value={query} onChange={(event) => setFilter('q', event.target.value, '')} /></label>
                  <label><span>Year added</span><select value={selectedYear} onChange={(event) => setFilter('year', event.target.value, 'All years')}><option>All years</option>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
                  <label><span>Sort</span><select value={sort} onChange={(event) => setFilter('sort', event.target.value, 'latest')}><option value="latest">Recently added</option><option value="oldest">Oldest first</option><option value="title">Title A–Z</option></select></label>
                  {(query || selectedPathway !== 'All pathways' || selectedType !== 'All products' || selectedYear !== 'All years' || sort !== 'latest') && <button type="button" onClick={clearFilters}>Clear filters</button>}
                </div>
                {removedFilters.length > 0 && (
                  <div className="filter-notice" role="status">
                    <p>{unsupportedFilterMessage(removedFilters)}</p>
                    <button type="button" onClick={() => setRemovedFilters([])}>Dismiss</button>
                  </div>
                )}
                {/* The pathway prints through pathwayLabel: the tiles say
                    "Agricultural calendar" and the stored value is
                    "Seasonal calendar", so the unlabelled form named a filter
                    the interface never shows. */}
                <div className="country-results-meta" aria-live="polite" ref={resultsRef}><p><strong>{filtered.length}</strong> {filtered.length === 1 ? 'product' : 'products'} found{selectedPathway !== 'All pathways' ? ` · ${selectedPathway === UNASSIGNED_PATHWAY ? selectedPathway : pathwayLabel(selectedPathway as EvidencePathway)}` : ''}{selectedType !== 'All products' ? ` · ${selectedType}` : ''}</p></div>
                {visible.length ? <div className="country-resource-grid">{visible.map((family) => <ResourceCard family={family} thumbnailIndex={thumbnailIndex} key={family.id} />)}</div> : <div className="empty-state"><strong>No matching evidence found</strong><p>Try a broader search or remove a pathway, product or year filter.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>}
                {pageCount > 1 && <nav className="pagination" aria-label="Country resource pages"><button disabled={safePage === 1} onClick={() => setFilter('page', String(safePage - 1), '1')}>Previous</button><span>Page <strong>{safePage}</strong> of {pageCount}</span><button disabled={safePage === pageCount} onClick={() => setFilter('page', String(safePage + 1), '1')}>Next</button></nav>}
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
