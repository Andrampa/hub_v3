import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CountryMap } from '../components/CountryMap'
import { CountryFlag } from '../components/CountryFlag'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { useCountryCatalog } from '../hooks/useCountryCatalog'
import { formatDate } from '../lib/catalog'

function topTypes(typeCounts: Record<string, number>) {
  return Object.entries(typeCounts)
    .filter(([type]) => type !== 'Unclassified')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
}

export default function CountryExplorer() {
  const { catalog, error, retry } = useCountryCatalog()
  const [query, setQuery] = useState('')
  const [region, setRegion] = useState('All regions')

  const regions = useMemo(
    () => ['All regions', ...new Set(catalog?.countries.map((country) => country.region) || [])],
    [catalog],
  )
  const visibleCountries = useMemo(() => {
    return (catalog?.countries || []).filter((country) => (
      region === 'All regions' || country.region === region
    ))
  }, [catalog, region])
  const visibleIso = useMemo(() => new Set(visibleCountries.map((country) => country.iso3)), [visibleCountries])
  const matchingProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized || !catalog) return []
    const countryByIso = new Map(catalog.countries.map((country) => [country.iso3, country]))
    return catalog.items
      .filter((item) => item.title.toLowerCase().includes(normalized))
      .flatMap((item) => item.countries
        .filter((iso3) => countryByIso.has(iso3))
        .map((iso3) => ({ item, country: countryByIso.get(iso3)! })))
      .slice(0, 8)
  }, [catalog, query])
  const latestUpdate = Math.max(...(catalog?.countries.map((country) => country.latestModified) || [0]))

  return (
    <>
      <SiteHeader active="countries" />
      <main id="top" className="countries-main">
        <section className="countries-hero">
          <div className="countries-hero-inner">
            <div className="eyebrow"><span /> Country evidence</div>
            <h1>Start with a place.<br /><em>Find the evidence.</em></h1>
            <p>Explore DIEM monitoring, assessments, survey materials and analysis organized around the countries they describe.</p>
            <label className="country-search">
              <svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
              <span className="sr-only">Find a product by name</span>
              <input
                type="search"
                placeholder="Search product names…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                role="combobox"
                aria-autocomplete="list"
                aria-controls="product-search-results"
                aria-expanded={Boolean(query.trim())}
              />
              <span>{query.trim() ? `${matchingProducts.length} matches` : 'Search resources'}</span>
              {query.trim() && (
                <div className="country-search-results" id="product-search-results" role="listbox" aria-label="Matching products">
                  {matchingProducts.length ? matchingProducts.map(({ item, country }) => (
                    <Link
                      key={`${item.id}-${country.iso3}`}
                      to={`/countries/${country.iso3.toLowerCase()}?q=${encodeURIComponent(item.title.trim())}`}
                      role="option"
                    >
                      <span>{item.title.trim()}</span>
                      <small><CountryFlag iso2={country.iso2} name={country.name} decorative />{country.name} · {item.productTypes[0] || 'DIEM resource'}</small>
                    </Link>
                  )) : <p>No products match “{query.trim()}”.</p>}
                </div>
              )}
            </label>
          </div>
        </section>

        {!catalog && !error && (
          <section className="country-loading section-wrap" role="status">
            <span className="loader" />
            <strong>Building the country evidence index</strong>
            <p>Reading the latest country and product classifications from ArcGIS Online…</p>
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
            <section className="country-facts" aria-label="Country catalog summary">
              <div><strong>{catalog.countries.length}</strong><span>countries with evidence</span></div>
              <div><strong>{catalog.items.length.toLocaleString()}</strong><span>curated resources</span></div>
              <div><strong>{latestUpdate ? formatDate(latestUpdate) : '—'}</strong><span>latest update</span></div>
            </section>

            <section className="country-atlas section-wrap" aria-labelledby="atlas-heading">
              <div className="country-section-heading">
                <div><span className="kicker">Evidence atlas</span><h2 id="atlas-heading">Where DIEM works</h2></div>
                <p>Highlighted countries have material in the curated DIEM country group. Select a country to open its evidence page.</p>
              </div>
              <div className="region-filters" aria-label="Filter countries by region">
                {regions.map((value) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={region === value}
                    onClick={() => setRegion(value)}
                  >{value}</button>
                ))}
              </div>
              <CountryMap countries={catalog.countries} visibleIso={visibleIso} />
            </section>

            {catalog.crossCountry && (
              <section className="cross-country-strip section-wrap">
                <div><span className="kicker">Beyond borders</span><h2>Cross-country analysis</h2><p>Research and analytical products that compare experiences across multiple contexts.</p></div>
                <div><strong>{catalog.crossCountry.resourceCount}</strong><span>resources</span></div>
                <Link to="/countries/cross-country">Explore analysis <span aria-hidden="true">→</span></Link>
              </section>
            )}

            <section className="country-directory section-wrap" aria-labelledby="directory-heading">
              <div className="country-section-heading country-section-heading--directory">
                <div><span className="kicker">Country directory</span><h2 id="directory-heading">Browse the collection</h2></div>
                <p><strong>{visibleCountries.length}</strong> countries match your current view.</p>
              </div>
              {visibleCountries.length ? (
                <div className="country-grid">
                  {visibleCountries.map((country) => (
                    <Link className="country-card" to={`/countries/${country.iso3.toLowerCase()}`} key={country.iso3}>
                      <div className="country-card-top"><span>{country.iso3}</span><span>{country.region}</span></div>
                      <h3><CountryFlag iso2={country.iso2} name={country.name} className="country-flag" />{country.name}</h3>
                      <div className="country-card-count"><strong>{country.resourceCount}</strong><span>resources</span></div>
                      <div className="country-card-types">
                        {topTypes(country.typeCounts).map(([type, count]) => <span key={type}>{type} <b>{count}</b></span>)}
                      </div>
                      <div className="country-card-footer"><span>Updated {formatDate(country.latestModified)}</span><span aria-hidden="true">→</span></div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="empty-state"><strong>No countries are available for this region</strong><p>Select another region to see its country evidence.</p></div>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
