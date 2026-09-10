import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CountryMap } from '../components/CountryMap'
import { CountryCoverageMatrix } from '../components/CountryCoverageMatrix'
import { CountryFlag } from '../components/CountryFlag'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { HeroImage } from '../components/HeroImage'
import { HeroCredit } from '../components/HeroCredit'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { formatDate } from '../lib/catalog'
import { groupProductFamilies } from '../lib/productFamilies'
import { usePageMetadata } from '../hooks/usePageMetadata'
import {
  DIRECTORY_REVEAL_STEP,
  countryMatchesQuery,
  directoryCountLabel,
  directoryReveal,
} from '../lib/countryDirectory'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  readFilters,
  stripUnsupportedFilters,
  unsupportedFilterKey,
  unsupportedFilterMessage,
  type FilterSpec,
  type UnsupportedFilter,
} from '../lib/catalogFilters'
import { UNRECORDED_PRODUCT_TYPE } from '../services/countries'
import { formatNumber } from '../lib/format'

const ALL_REGIONS = 'All regions'
const REGIONS = [ALL_REGIONS, 'Asia & Pacific', 'Africa', 'Latin America & Caribbean', 'Near East & North Africa', 'Europe']

function topTypes(typeCounts: Record<string, number>) {
  return Object.entries(typeCounts)
    .filter(([type]) => type !== UNRECORDED_PRODUCT_TYPE)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
}

export default function CountryExplorer() {
  const { catalog, error, retry } = useCountryCatalog()
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || ''

  const regions = REGIONS

  /**
   * The region is in the URL, so a filtered atlas can be shared and Back
   * restores it, and it is validated on the same contract as `/catalog`: a
   * region no country carries is read as "All regions", named to the reader and
   * dropped, rather than applied behind buttons that all show unpressed.
   */
  const filterSpecs = useMemo<FilterSpec[]>(() => [
    { key: 'region', defaultValue: ALL_REGIONS, allowed: catalog ? regions : undefined },
  ], [catalog, regions])
  const { values: filterValues, unsupported } = useMemo(() => readFilters(params, filterSpecs), [filterSpecs, params])
  const region = filterValues.region

  const [removedFilters, setRemovedFilters] = useState<UnsupportedFilter[]>([])
  const unsupportedKey = unsupportedFilterKey(unsupported)
  useEffect(() => {
    if (!unsupported.length) return
    setRemovedFilters(unsupported)
    setParams(stripUnsupportedFilters(params, unsupported), { replace: true })
    // `unsupported` is rebuilt every render; its contents are the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unsupportedKey])

  /**
   * The region drives the atlas and the publication matrix, which are statements
   * about coverage; the text filter narrows the directory list underneath them.
   * Searching does not blank the map, because "which countries does DIEM work
   * in" is not the question the search box is answering.
   */
  const visibleCountries = useMemo(() => {
    return (catalog?.countries || []).filter((country) => (
      region === ALL_REGIONS || country.region === region
    ))
  }, [catalog, region])
  const directoryCountries = useMemo(
    () => visibleCountries.filter((country) => countryMatchesQuery(country, query)),
    [query, visibleCountries],
  )
  const families = useMemo(() => groupProductFamilies(catalog?.items || []), [catalog])

  /**
   * The directory is 54 cards and about 17,600 px tall at 375 px — some 21
   * screen-heights below the atlas. On a narrow screen it opens at one batch and
   * grows on request.
   *
   * Filtering always runs against every country, never against the revealed
   * slice, so a search reaches a country the reader has not scrolled to; a set
   * small enough to fit the first batch is shown whole, so an exact match is
   * never behind a press. Reveal state is deliberately not in the URL: how much
   * of a list someone has scrolled through is not part of what they share.
   */
  const isCompact = useMediaQuery('(max-width: 720px)')
  const [revealed, setRevealed] = useState(DIRECTORY_REVEAL_STEP)
  useEffect(() => setRevealed(DIRECTORY_REVEAL_STEP), [region, query])
  const reveal = directoryReveal(directoryCountries.length, isCompact ? revealed : directoryCountries.length)
  const shownCountries = directoryCountries.slice(0, reveal.visibleCount)

  /**
   * A region is a destination and gets a history entry; a keystroke is not, and
   * replaces. Same policy as `/catalog` and the country pages.
   */
  const update = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === defaultValue) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: key === 'q' })
  }

  const clearDirectoryFilters = () => {
    setRemovedFilters([])
    setParams({})
  }

  usePageMetadata({
    title: 'Countries',
    description: catalog
      ? `DIEM evidence for ${catalog.countries.length} countries: an atlas, a country directory and a publication matrix showing which products exist where.`
      : 'DIEM evidence by country: an atlas, a country directory and a publication matrix showing which products exist where.',
  })

  const visibleIso = useMemo(() => new Set(visibleCountries.map((country) => country.iso3)), [visibleCountries])
  const latestPublication = Math.max(...(catalog?.countries.map((country) => country.latestPublished) || [0]))

  return (
    <>
      <SiteHeader />
      <main id="top" className="countries-main">
        {/* The page's outline began at "H2 Where DIEM works", so neither a
            screen reader nor a search result had a title for the document. The
            heading is outside the loading branch so it exists immediately. */}
        <section className="countries-hero">
          <HeroImage name="drc-ndjili-market-gardens-2025" className="countries-hero-image" alt="Two DIEM field team members wearing Data in Emergencies shirts in market gardens" />
          <HeroCredit name="drc-ndjili-market-gardens-2025" />
          <div className="countries-hero-inner">
            <span className="kicker kicker--light">Country evidence</span>
            <h1>DIEM evidence, <em>country by country.</em></h1>
            <p>
              {catalog
                ? `Monitoring rounds, hazard impact assessments and published evidence for ${catalog.countries.length} countries. Filter the atlas by region, or search the directory by country name or ISO3 code.`
                : 'Monitoring rounds, hazard impact assessments and published evidence, country by country. Filter the atlas by region, or search the directory by country name or ISO3 code.'}
            </p>
          </div>
        </section>

        {!catalog && !error && (
          <section className="country-loading section-wrap" role="status">
            <span className="loader" />
            <strong>Building the country evidence index</strong>
            <p>Reading the latest country and product classifications…</p>
          </section>
        )}

        {error && (
          <section className="error-state section-wrap" role="alert">
            <strong>Country evidence could not be loaded.</strong>
            <p>{error}</p>
            <button type="button" onClick={retry}>Try again</button>
          </section>
        )}

        {catalog && (
          <>
            <section className="country-atlas section-wrap" aria-labelledby="atlas-heading">
              <div className="country-section-heading">
                <div><span className="kicker">Evidence atlas</span><h2 id="atlas-heading">Where DIEM works</h2></div>
                <p>Highlighted countries have discoverable products categorized in the DIEM Hub content group. Select a country to open its evidence page.</p>
              </div>
              {removedFilters.length > 0 && (
                <div className="filter-notice" role="status">
                  <p>{unsupportedFilterMessage(removedFilters)}</p>
                  <button type="button" onClick={() => setRemovedFilters([])}>Dismiss</button>
                </div>
              )}
              <div className="region-filters" role="group" aria-label="Filter countries by region">
                {regions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={region === value}
                    onClick={() => update('region', value, ALL_REGIONS)}
                  >{value}</button>
                ))}
              </div>
              <CountryMap countries={catalog.countries} visibleIso={region === ALL_REGIONS ? undefined : visibleIso} />
            </section>

            <section className="country-facts" aria-label="Country catalog summary">
              <div><strong>{catalog.countries.length}</strong><span>countries with evidence</span></div>
              <div><strong>{formatNumber(families.length)}</strong><span>curated products</span></div>
              <div><strong>{latestPublication ? formatDate(latestPublication) : '—'}</strong><span>latest publication</span></div>
            </section>

            {catalog.crossCountry && (
              <section className="cross-country-strip section-wrap">
                <div><span className="kicker">Beyond borders</span><h2>Cross-country analysis</h2><p>Research and analytical products that compare experiences across multiple contexts.</p></div>
                <div><strong>{catalog.crossCountry.resourceCount}</strong><span>{catalog.crossCountry.resourceCount === 1 ? 'product' : 'products'}</span></div>
                <Link to="/countries/cross-country">Explore analysis <span aria-hidden="true">→</span></Link>
              </section>
            )}

            <CountryCoverageMatrix countries={visibleCountries} families={families} region={region === ALL_REGIONS ? undefined : region} />

            <section className="country-directory section-wrap" aria-labelledby="directory-heading">
              <div className="country-section-heading country-section-heading--directory">
                <div><span className="kicker">Country directory</span><h2 id="directory-heading">{region === ALL_REGIONS ? 'Browse the collection' : `Browse the collection in ${region} region`}</h2></div>
                <label className="country-directory-search">
                  <span>Search countries</span>
                  <input
                    type="search"
                    value={query}
                    placeholder="Country name or ISO3 code"
                    aria-describedby="directory-count"
                    onChange={(event) => update('q', event.target.value, '')}
                  />
                </label>
              </div>
              {/* The count is the search's feedback, so it announces — and it
                  distinguishes what matches from what is on screen, because a
                  reader who cannot see the rest has no way to tell a short list
                  from a truncated one. */}
              <p className="country-directory-count" id="directory-count" aria-live="polite">
                {directoryCountLabel(directoryCountries.length, reveal.visibleCount)}
              </p>
              {directoryCountries.length ? (
                <div className="country-grid">
                  {shownCountries.map((country) => (
                    <Link className="country-card" to={`/countries/${country.iso3.toLowerCase()}`} key={country.iso3}>
                      <div className="country-card-top"><span>{country.iso3}</span><span>{country.region}</span></div>
                      <h3><CountryFlag iso2={country.iso2} name={country.name} className="country-flag" />{country.name}</h3>
                      <div className="country-card-count"><strong>{country.resourceCount}</strong><span>{country.resourceCount === 1 ? 'product' : 'products'}</span></div>
                      <div className="country-card-types">
                        {topTypes(country.typeCounts).map(([type, count]) => <span key={type}>{type} <b>{count}</b></span>)}
                      </div>
                      <div className="country-card-footer"><span>Latest publication {formatDate(country.latestPublished)}</span><span aria-hidden="true">→</span></div>
                    </Link>
                  ))}
                </div>
              ) : null}
              {reveal.hasMore && (
                <button
                  type="button"
                  className="country-directory-more"
                  onClick={() => setRevealed((current) => current + DIRECTORY_REVEAL_STEP)}
                >
                  Show {reveal.nextBatch} more {reveal.nextBatch === 1 ? 'country' : 'countries'}
                </button>
              )}
              {!directoryCountries.length && (
                <div className="empty-state">
                  {/* Says which of the two filters produced nothing, because
                      "no countries in this region" is wrong and unhelpful when
                      it was the search term that missed. */}
                  <strong>
                    {query
                      ? `No country matches “${query.trim()}”${region !== ALL_REGIONS ? ` in ${region}` : ''}`
                      : 'No countries are available for this region'}
                  </strong>
                  <p>
                    {query
                      ? 'Search by country name or ISO3 code, for example “Niger” or “NER”.'
                      : 'Select another region to see its country evidence.'}
                  </p>
                  <button type="button" onClick={clearDirectoryFilters}>Clear filters</button>
                </div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
