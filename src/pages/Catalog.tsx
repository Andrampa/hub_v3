import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CatalogContentCard, pathwaySlug } from '../components/CatalogContentCard'
import { CatalogSearchBox } from '../components/CatalogSearchBox'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { HeroImage } from '../components/HeroImage'
import { HeroCredit } from '../components/HeroCredit'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { itemYear } from '../lib/catalog'
import { groupProductFamilies } from '../lib/productFamilies'
import { buildCatalogSearchIndex, matchingFamilyIds } from '../lib/catalogSearch'
import {
  LEGACY_UNASSIGNED_PATHWAY,
  UNASSIGNED_PATHWAY,
  activeFilters,
  readFilters,
  stripUnsupportedFilters,
  unsupportedFilterKey,
  unsupportedFilterMessage,
  type FilterSpec,
  type UnsupportedFilter,
} from '../lib/catalogFilters'
import { CONTENT_GROUP_ID, buildDistinctThumbnailIndex } from '../services/arcgis'
import {
  CROSS_COUNTRY_CODE,
  EVIDENCE_PATHWAYS,
  PRODUCT_TYPES,
  countryDefinition,
  pathwayLabel,
  type CountryResource,
  type EvidencePathway,
  type ProductType,
} from '../services/countries'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { formatDate, formatNumber } from '../lib/format'

const PAGE_SIZE = 16
const SORT_VALUES = ['newest', 'oldest', 'title'] as const
/** The words the sort control uses, so a chip never prints the stored token. */
const SORT_LABELS: Record<string, string> = {
  newest: 'Recently added',
  oldest: 'Oldest first',
  title: 'Title A–Z',
}
const typeGroups: Record<string, string[]> = {
  Data: ['Microsoft Excel', 'CSV', 'Shapefile', 'Feature Service', 'Service Definition'],
  Documents: ['Document Link', 'PDF', 'Microsoft Powerpoint'],
  'Maps & apps': ['StoryMap', 'Web Map', 'Dashboard', 'Web Experience', 'Web Mapping Application', 'Form'],
  Media: ['Image'],
  Pages: ['Hub Page'],
}

/**
 * The catalogue sits over a group that changes daily and is held in
 * sessionStorage for fifteen minutes, so a count can differ between two visits
 * for reasons the reader cannot see. Stating when the group was actually read
 * explains that, and UTC because the reader may be anywhere.
 */
function formatReadTime(fetchedAt: Date) {
  const stamp = fetchedAt.toISOString()
  const time = `at ${stamp.slice(11, 16)} UTC`
  return stamp.slice(0, 10) === new Date().toISOString().slice(0, 10) ? time : `${formatDate(fetchedAt)} ${time}`
}

function categoryFor(item: CountryResource) {
  return Object.entries(typeGroups).find(([, types]) => types.includes(item.type))?.[0] || 'Other'
}

export default function Catalog() {
  // The catalogue is the one surface whose reader is waiting on the grid rather
  // than on a headline figure, so it renders each page of the content group as
  // it arrives instead of holding a skeleton for all nine. Counts move while
  // that happens, and say so.
  const { catalog, error, retry } = useCountryCatalog({ progressive: true })
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''
  const page = Math.max(1, Number(params.get('page')) || 1)

  const families = useMemo(() => groupProductFamilies(catalog?.items || []), [catalog])

  usePageMetadata({
    title: 'Catalogue',
    description: catalog
      ? `${formatNumber(families.length)} published DIEM products from ${catalog.countries.length} countries: monitoring briefs, assessment reports, questionnaires, presentations and maps, filterable by evidence pathway, product type, country and year.`
      : 'Published DIEM products: monitoring briefs, assessment reports, questionnaires, presentations and maps, filterable by evidence pathway, product type, country and year.',
    // The query string carries filter state, so every combination would
    // otherwise be indexed as a separate page over the same collection.
    canonicalPath: '/catalog',
    structuredData: {
      '@type': 'DataCatalog',
      name: 'DIEM Hub catalogue',
      url: 'https://data-in-emergencies.fao.org/catalog',
      publisher: {
        '@type': 'Organization',
        name: 'Food and Agriculture Organization of the United Nations',
        alternateName: 'FAO',
        url: 'https://www.fao.org',
      },
    },
  })

  const countries = useMemo(() => [...new Set(catalog?.items.flatMap((item) => item.countries) || [])]
    .map(countryDefinition)
    .sort((a, b) => {
      if (a.iso3 === CROSS_COUNTRY_CODE) return -1
      if (b.iso3 === CROSS_COUNTRY_CODE) return 1
      return a.name.localeCompare(b.name)
    }), [catalog])
  const years = useMemo(() => [...new Set(catalog?.items.map(itemYear) || [])].sort((a, b) => b - a), [catalog])
  // Only offer a pathway or product filter that some published product actually
  // carries, so an empty result is never reachable from the controls.
  const availablePathways = useMemo(() => EVIDENCE_PATHWAYS.filter((value) => (
    catalog?.items.some((item) => item.evidencePathways.includes(value))
  )), [catalog])
  const availableProducts = useMemo(() => PRODUCT_TYPES.filter((value) => (
    catalog?.items.some((item) => item.productTypes.includes(value))
  )), [catalog])
  const hasUnassignedProducts = useMemo(
    () => families.some((family) => !family.variants.some((item) => item.evidencePathways.length)),
    [families],
  )

  /**
   * The values the controls can currently produce. Only asserted once the whole
   * content group has been read: the catalogue pages in, so a value missing from
   * the first page is not yet evidence that it is gone from the group.
   */
  const settled = Boolean(catalog?.complete)
  const filterSpecs = useMemo<FilterSpec[]>(() => [
    { key: 'content', defaultValue: 'All content', allowed: settled ? Object.keys(typeGroups) : undefined },
    { key: 'country', defaultValue: 'All countries', allowed: settled ? countries.map((entry) => entry.iso3) : undefined },
    {
      key: 'pathway',
      defaultValue: 'All pathways',
      allowed: settled ? [...availablePathways, ...(hasUnassignedProducts ? [UNASSIGNED_PATHWAY] : [])] : undefined,
      aliases: { [LEGACY_UNASSIGNED_PATHWAY]: UNASSIGNED_PATHWAY },
    },
    { key: 'product', defaultValue: 'All products', allowed: settled ? [...availableProducts] : undefined },
    { key: 'year', defaultValue: 'All years', allowed: settled ? years.map(String) : undefined },
    { key: 'sort', defaultValue: 'newest', allowed: [...SORT_VALUES] },
  ], [availablePathways, availableProducts, countries, hasUnassignedProducts, settled, years])

  const { values: filterValues, unsupported } = useMemo(() => readFilters(params, filterSpecs), [filterSpecs, params])
  const category = filterValues.content
  const country = filterValues.country
  const pathway = filterValues.pathway
  const product = filterValues.product
  const year = filterValues.year
  const sort = filterValues.sort

  // Dropped filters are held in state because the notice has to outlive the
  // parameters it describes: they are removed from the URL on the next tick.
  const [removedFilters, setRemovedFilters] = useState<UnsupportedFilter[]>([])
  const unsupportedKey = unsupportedFilterKey(unsupported)
  useEffect(() => {
    if (!unsupported.length) return
    setRemovedFilters(unsupported)
    setParams(stripUnsupportedFilters(params, unsupported), { replace: true })
    // `unsupported` is rebuilt every render; its contents are the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupportedKey])

  const resultsRef = useRef<HTMLDivElement>(null)
  const thumbnailIndex = useMemo(() => buildDistinctThumbnailIndex(catalog?.items || []), [catalog])
  const searchIndex = useMemo(() => buildCatalogSearchIndex(families), [families])
  const matchedIds = useMemo(() => matchingFamilyIds(searchIndex, query), [query, searchIndex])

  // Every filter except the pathway. The pathway tab counts are taken from this
  // set so each tab states how many results choosing it would actually give,
  // rather than repeating a catalogue-wide total that ignores the other filters.
  const familiesBeforePathway = useMemo(() => families.filter((family) => (
    (!matchedIds || matchedIds.has(family.id)) &&
    (category === 'All content' || family.variants.some((item) => categoryFor(item) === category)) &&
    (country === 'All countries' || family.variants.some((item) => item.countries.includes(country))) &&
    (product === 'All products' || family.variants.some((item) => item.productTypes.includes(product as ProductType))) &&
    (year === 'All years' || family.variants.some((item) => String(itemYear(item)) === year))
  )), [category, country, families, matchedIds, product, year])

  const filteredFamilies = useMemo(() => {
    return familiesBeforePathway.filter((family) => (
      pathway === 'All pathways' ||
      (pathway === UNASSIGNED_PATHWAY
        ? !family.variants.some((item) => item.evidencePathways.length)
        : family.variants.some((item) => item.evidencePathways.includes(pathway as EvidencePathway)))
    )).sort((a, b) => {
      if (sort === 'title') return a.primary.title.localeCompare(b.primary.title)
      return sort === 'oldest' ? a.latestCreated - b.latestCreated : b.latestCreated - a.latestCreated
    })
  }, [familiesBeforePathway, pathway, sort])

  const unassignedCount = useMemo(
    () => familiesBeforePathway.filter((family) => !family.variants.some((item) => item.evidencePathways.length)).length,
    [familiesBeforePathway],
  )

  const pageCount = Math.max(1, Math.ceil(filteredFamilies.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visibleFamilies = filteredFamilies.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  useEffect(() => {
    // The filter validation writes the URL in this same commit and drops the
    // page along with the values it removes; clamping here as well would write
    // the rejected values straight back.
    if (unsupported.length) return
    if (page > pageCount) {
      const next = new URLSearchParams(params)
      next.set('page', String(pageCount))
      setParams(next, { replace: true })
    }
  }, [page, pageCount, params, setParams, unsupported.length])

  /**
   * Turning a page replaced the sixteen cards under the reader without moving
   * the viewport, so Next landed them in the middle of a fresh page with no
   * indication anything had changed. The results heading is brought back into
   * view rather than the top of the document, so the filters stay put.
   *
   * This has to run after the new cards are painted: scrolling in the click
   * handler is undone by the browser's scroll anchoring when the grid content
   * changes underneath. "instant" rather than "auto" because "auto" defers to
   * the CSS scroll-behavior, which is "smooth" on html, and animating six
   * thousand pixels past the reader is worse than arriving.
   *
   * scrollTo with an explicit offset rather than scrollIntoView, because the
   * header scrolls away with the page: there is no sticky offset to fight, and
   * the explicit form is not subject to the element-visibility heuristics.
   */
  const previousPage = useRef(safePage)
  useEffect(() => {
    if (previousPage.current === safePage) return
    previousPage.current = safePage
    const target = resultsRef.current
    if (!target) return
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' })
  }, [safePage])

  const update = (key: string, value: string, defaultValue?: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: key === 'q' })
  }

  const clearFilters = () => {
    setRemovedFilters([])
    setParams({})
  }
  const hasFilters = Boolean(query || category !== 'All content' || country !== 'All countries' || pathway !== 'All pathways' || product !== 'All products' || year !== 'All years' || sort !== 'newest')

  /**
   * The mobile filter disclosure.
   *
   * Six stacked controls occupied 522 px of an 812 px screen and pushed the
   * first product card to y=1397 — about 1.7 screens of controls before any
   * evidence. Below the breakpoint the structured controls move behind a
   * "Filters" button that states how many are applied, while the search box
   * stays where it is: it is the one control a reader arrives intending to use.
   *
   * Structure follows the breakpoint rather than CSS alone, because a collapsed
   * `aria-expanded="false"` around six permanently visible desktop controls
   * would be a lie to assistive technology.
   */
  const isCompact = useMediaQuery('(max-width: 620px)')
  const [filtersOpen, setFiltersOpen] = useState(false)
  // Deliberately not in the URL: whether a panel is open is a property of this
  // visit, not of the result set being shared.
  const countryName = (iso3: string) => countries.find((entry) => entry.iso3 === iso3)?.name || iso3
  const chips = activeFilters([
    { key: 'pathway', label: 'Evidence pathway', value: pathway, defaultValue: 'All pathways', display: pathway === UNASSIGNED_PATHWAY ? pathway : pathwayLabel(pathway as EvidencePathway) },
    { key: 'product', label: 'Product', value: product, defaultValue: 'All products' },
    { key: 'country', label: 'Country', value: country, defaultValue: 'All countries', display: countryName(country) },
    { key: 'content', label: 'Format', value: category, defaultValue: 'All content' },
    { key: 'year', label: 'Year added', value: year, defaultValue: 'All years' },
    // Sorting is part of what the collapsed panel hides, so it is stated with
    // the filters rather than left to be inferred from the order of the cards.
    { key: 'sort', label: 'Sort', value: sort, defaultValue: 'newest', display: SORT_LABELS[sort], resets: true },
  ])

  const filterControls = (
    <>
      <label><span>Evidence pathway</span><select value={pathway} onChange={(event) => update('pathway', event.target.value, 'All pathways')}><option>All pathways</option>{availablePathways.map((value) => <option key={value} value={value}>{pathwayLabel(value)}</option>)}{unassignedCount > 0 && <option>{UNASSIGNED_PATHWAY}</option>}</select></label>
      <label><span>Product</span><select value={product} onChange={(event) => update('product', event.target.value, 'All products')}><option>All products</option>{availableProducts.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Country</span><select value={country} onChange={(event) => update('country', event.target.value, 'All countries')}><option>All countries</option>{countries.map((value) => <option value={value.iso3} key={value.iso3}>{value.name}</option>)}</select></label>
      <label><span>Format</span><select value={category} onChange={(event) => update('content', event.target.value, 'All content')}><option>All content</option>{Object.keys(typeGroups).map((value) => <option key={value}>{value}</option>)}</select></label>
      <label><span>Year added</span><select value={year} onChange={(event) => update('year', event.target.value, 'All years')}><option>All years</option>{years.map((value) => <option key={value}>{value}</option>)}</select></label>
      {/* Options come from SORT_LABELS, so the chip and the control cannot drift. */}
      <label><span>Sort</span><select value={sort} onChange={(event) => update('sort', event.target.value, 'newest')}>{SORT_VALUES.map((value) => <option key={value} value={value}>{SORT_LABELS[value]}</option>)}</select></label>
    </>
  )

  return (
    <>
      <SiteHeader />
      <main className="catalog-page" id="top">
        {/* One heading, not two. The page previously announced itself four
            times over before a product appeared: eyebrow, title, second
            eyebrow, second title. The subtitle now states what is in the
            catalogue and where it comes from instead of restating the title. */}
        <section className="catalog-hero"><HeroImage name="drc-ndjili-field-team-2025" className="catalog-hero-image" /><HeroCredit name="drc-ndjili-field-team-2025" /><div className="section-wrap"><span className="kicker kicker--light">Public catalog</span><h1 id="catalog-title">DIEM catalogue</h1><p>{catalog ? `${formatNumber(families.length)} published products from ${catalog.countries.length} countries, read from the DIEM Hub content group. Filter by evidence pathway, product type, country or year.` : 'Published DIEM products, read from the DIEM Hub content group. Filter by evidence pathway, product type, country or year.'}</p></div></section>
        <section className="catalog-section" aria-labelledby="catalog-title">
          <div className="section-wrap">
            <div className={`filter-bar catalog-filter-bar${isCompact ? ' catalog-filter-bar--compact' : ''}`}>
              {/* Same component as the homepage, so a query means the same thing
                  on both surfaces. Inline it drives the q parameter as you type,
                  so the grid narrows underneath while the suggestions offer the
                  jump to a country or straight to a product. Never behind the
                  disclosure: searching is why most readers arrive. */}
              <CatalogSearchBox
                families={families}
                countries={catalog?.countries || []}
                variant="inline"
                value={query}
                onValueChange={(next) => update('q', next)}
                onCountrySelect={(iso3) => update('country', iso3, 'All countries')}
              />
              {isCompact ? (
                <div className="catalog-filter-disclosure">
                  <button
                    type="button"
                    className="catalog-filter-toggle"
                    aria-expanded={filtersOpen}
                    aria-controls="catalog-filter-panel"
                    onClick={() => setFiltersOpen((open) => !open)}
                  >
                    <i className="bi bi-sliders" aria-hidden="true" />
                    <span>Filters</span>
                    {chips.length > 0 && <span className="catalog-filter-count" aria-hidden="true">{chips.length}</span>}
                    {/* "applied" rather than "filters applied": the count also
                        covers the sort, which is not a filter. */}
                    <span className="sr-only">{chips.length === 1 ? ', 1 applied' : `, ${chips.length} applied`}</span>
                  </button>
                  {filtersOpen && <div className="catalog-filter-panel" id="catalog-filter-panel">{filterControls}</div>}
                </div>
              ) : filterControls}
            </div>
            {/* What is applied, in the words the controls use, for the state
                where the controls themselves are behind the disclosure. */}
            {isCompact && !filtersOpen && hasFilters && (
              <div className="catalog-active-filters">
                {chips.length > 0 && (
                  <ul aria-label="Applied filters and sorting">
                    {chips.map((chip) => (
                      <li key={chip.key}>
                        <span>{chip.display}</span>
                        <button type="button" aria-label={chip.removeLabel} onClick={() => update(chip.key, chip.defaultValue, chip.defaultValue)}>
                          <span aria-hidden="true">×</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button type="button" className="catalog-clear-all" onClick={clearFilters}>Clear all filters</button>
              </div>
            )}
            {removedFilters.length > 0 && (
              <div className="filter-notice" role="status">
                <p>{unsupportedFilterMessage(removedFilters)}</p>
                <button type="button" onClick={() => setRemovedFilters([])}>Dismiss</button>
              </div>
            )}
            {/* The document outline ran H1 catalogue title straight to H3 card
                titles. The results are their own section with their own
                heading, visually hidden because the results line beneath it
                already says the same thing in numbers. It is rendered in every
                state - loading, populated, filtered and empty - so the outline
                does not change shape while the group is being read. */}
            <section className="catalog-results" aria-labelledby="catalog-results-heading">
              <h2 className="sr-only" id="catalog-results-heading">Catalogue results</h2>
            {error ? <div className="error-state" role="alert"><strong>The public catalog could not be reached.</strong><p>{error}. Check your connection and try again.</p><button type="button" onClick={retry}>Retry</button></div> : !catalog ? <>
              {/* The page shape is drawn immediately rather than behind a
                  spinner, so the reader sees where results will land while the
                  content group is still being paged. */}
              <p className="results-meta results-meta--pending" role="status">Reading the DIEM Hub content group…</p>
              <div className="card-grid" aria-hidden="true">
                {Array.from({ length: PAGE_SIZE }, (_, index) => (
                  <div className="content-card content-card--skeleton" key={index}>
                    <span className="skeleton-block skeleton-block--image" />
                    <div className="card-body">
                      <span className="skeleton-block skeleton-block--meta" />
                      <span className="skeleton-block skeleton-block--title" />
                      <span className="skeleton-block skeleton-block--title skeleton-block--short" />
                      <span className="skeleton-block skeleton-block--meta skeleton-block--short" />
                    </div>
                  </div>
                ))}
              </div>
            </> : <>
              {availablePathways.length > 0 && (
                <div className="catalog-pathway-filter" role="group" aria-label="Filter by evidence pathway">
                  <button type="button" aria-pressed={pathway === 'All pathways'} onClick={() => update('pathway', 'All pathways', 'All pathways')}>
                    <span>All pathways</span><strong>{familiesBeforePathway.length}</strong>
                  </button>
                  {availablePathways.map((value) => {
                    const count = familiesBeforePathway.filter((family) => family.variants.some((item) => item.evidencePathways.includes(value))).length
                    return (
                      <button
                        type="button"
                        className={`catalog-pathway-filter--${pathwaySlug(value)}`}
                        aria-pressed={pathway === value}
                        // A count of zero is still shown, because hiding the tab
                        // would silently change the arithmetic the reader checks.
                        // It is disabled instead, so it is never a dead click.
                        disabled={count === 0 && pathway !== value}
                        onClick={() => update('pathway', value, 'All pathways')}
                        key={value}
                      >
                        <span>{pathwayLabel(value)}</span>
                        <strong>{count}</strong>
                      </button>
                    )
                  })}
                  {unassignedCount > 0 && (
                    <button
                      type="button"
                      className="catalog-pathway-filter--unassigned"
                      aria-pressed={pathway === UNASSIGNED_PATHWAY}
                      onClick={() => update('pathway', UNASSIGNED_PATHWAY, 'All pathways')}
                    >
                      <span>{UNASSIGNED_PATHWAY}</span><strong>{unassignedCount}</strong>
                    </button>
                  )}
                </div>
              )}
              <div className="results-meta" aria-live="polite" ref={resultsRef}><p><strong>{formatNumber(filteredFamilies.length)}</strong> {filteredFamilies.length === 1 ? 'product' : 'products'} found{pathway !== 'All pathways' ? ` · ${pathway === UNASSIGNED_PATHWAY ? pathway : pathwayLabel(pathway as EvidencePathway)}` : ''}{product !== 'All products' ? ` · ${product}` : ''}</p><div>{hasFilters && <button type="button" className="clear-filters" onClick={clearFilters}>Clear filters</button>}{catalog && (catalog.complete
  ? <span className="results-read-at" title={catalog.fetchedAt.toString()}>Read {formatReadTime(catalog.fetchedAt)}</span>
  // Counts, facet options and page total are all a floor until the last page
  // lands. Saying so is cheaper than freezing the controls, and it is the only
  // honest way to show a number that is about to change.
  : <span className="results-read-at results-read-at--loading">Still reading the content group — counts will rise</span>)}<a href={`https://hqfao.maps.arcgis.com/home/group.html?id=${CONTENT_GROUP_ID}`} target="_blank" rel="noreferrer">View source group <span aria-hidden="true">↗</span></a></div></div>
              <div className="card-grid">{visibleFamilies.map((family) => <CatalogContentCard family={family} thumbnailIndex={thumbnailIndex} key={family.id} />)}</div>
              {!visibleFamilies.length && <div className="empty-state"><strong>No matching evidence found</strong><p>Try removing a filter or using a broader search term.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>}
              {pageCount > 1 && <nav className="pagination" aria-label="Catalog pages"><button disabled={safePage === 1} onClick={() => update('page', String(safePage - 1))}>Previous</button><span>Page <strong>{safePage}</strong> of {pageCount}</span><button disabled={safePage === pageCount} onClick={() => update('page', String(safePage + 1))}>Next</button></nav>}
            </>}
            </section>
            <p className="catalog-back"><Link to="/">← Back to DIEM Hub</Link></p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
