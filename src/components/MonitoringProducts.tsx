import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { cleanText, formatDate } from '../lib/catalog'
import { itemDestination } from '../services/arcgis'
import {
  fetchMonitoringProductCatalog,
  type MonitoringProduct,
  type MonitoringProductCatalog,
} from '../services/monitoringProducts'
import { monitoringCountryPath } from '../services/monitoringEmbed'
import '../monitoring-products.css'

const INITIAL_GROUPS = 12
const GROUP_STEP = 12

function countryName(item: MonitoringProduct, countries: MonitoringProductCatalog['countries']) {
  if (!item.countries.length) return 'Other monitoring resources'
  return item.countries.map((iso3) => countries.find((country) => country.iso3 === iso3)?.name || iso3).join(', ')
}

function ProductRow({ item }: { item: MonitoringProduct }) {
  const summary = cleanText(item.snippet || item.description)
  return (
    <article className="monitoring-product-row">
      <div className="monitoring-product-main">
        <div className="monitoring-product-meta">
          <span>{item.productType}</span>
          <span>{item.languages.join(', ') || 'Language not specified'}</span>
          <time dateTime={`${item.year}`}>{item.year}</time>
        </div>
        <h4>{item.title.trim()}</h4>
        {summary && <p>{summary}</p>}
      </div>
      <a href={itemDestination(item)} target="_blank" rel="noreferrer">
        Open product <span aria-hidden="true">↗</span>
      </a>
    </article>
  )
}

export function MonitoringProducts() {
  const { status, user, requestProtected } = useAuth()
  const contributor = status === 'authenticated' && Boolean(user?.capabilities.contributor)
  const audience = contributor ? 'contributor' : 'public'
  const [catalog, setCatalog] = useState<MonitoringProductCatalog>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('All countries')
  const [productType, setProductType] = useState('All product types')
  const [year, setYear] = useState('All years')
  const [language, setLanguage] = useState('All languages')
  const [visibleGroups, setVisibleGroups] = useState(INITIAL_GROUPS)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(undefined)
    fetchMonitoringProductCatalog({
      signal: controller.signal,
      contributor,
      authenticatedRequest: contributor ? requestProtected : undefined,
    })
      .then((result) => { if (active) setCatalog(result) })
      .catch((reason: Error) => {
        if (active && reason.name !== 'AbortError') setError(reason.message)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [attempt, contributor, requestProtected])

  const visibleCatalog = catalog?.audience === audience ? catalog : undefined

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (visibleCatalog?.items || []).filter((item) => {
      const haystack = [
        item.title,
        item.snippet,
        item.description,
        item.productType,
        item.round,
        ...(item.tags || []),
      ].join(' ').toLowerCase()
      return (!normalizedQuery || haystack.includes(normalizedQuery))
        && (country === 'All countries' || item.countries.includes(country))
        && (productType === 'All product types' || item.productType === productType)
        && (year === 'All years' || item.year === Number(year))
        && (language === 'All languages' || item.languages.includes(language))
    })
  }, [visibleCatalog, country, language, productType, query, year])

  const groups = useMemo(() => {
    if (!visibleCatalog) return []
    const grouped = new Map<string, {
      country: string
      iso3?: string
      round?: string
      roundValue?: string
      date?: number
      status?: MonitoringProduct['releaseStatus']
      items: MonitoringProduct[]
    }>()
    filtered.forEach((item) => {
      const label = countryName(item, visibleCatalog.countries)
      const key = `${label}|${item.roundValue || 'other'}`
      const current = grouped.get(key)
      if (current) current.items.push(item)
      else grouped.set(key, {
        country: label,
        iso3: item.countries.length === 1 ? item.countries[0] : undefined,
        round: item.round,
        roundValue: item.roundValue,
        date: item.publicationDate || item.expectedPublicationDate,
        status: item.releaseStatus,
        items: [item],
      })
    })
    return [...grouped.values()].sort((left, right) => (
      (right.date || Math.max(...right.items.map((item) => item.modified)))
      - (left.date || Math.max(...left.items.map((item) => item.modified)))
    ))
  }, [visibleCatalog, filtered])

  useEffect(() => setVisibleGroups(INITIAL_GROUPS), [country, language, productType, query, year])

  const clearFilters = () => {
    setQuery('')
    setCountry('All countries')
    setProductType('All product types')
    setYear('All years')
    setLanguage('All languages')
  }

  return (
    <section className="monitoring-library" aria-labelledby="monitoring-library-heading">
      <div className="section-wrap">
        <div className="section-heading monitoring-library-heading">
          <div>
            <span className="kicker">Survey library</span>
            <h2 id="monitoring-library-heading">Household monitoring products</h2>
          </div>
          <p>
            {contributor
              ? 'Contributor view: published and current incoming survey products, plus supporting monitoring resources.'
              : 'Find products linked to published household monitoring surveys by country and survey round.'}
          </p>
        </div>

        {!visibleCatalog && !error && (
          <div className="monitoring-library-message" role="status">
            <span className="loader" aria-hidden="true" />
            <strong>Building the survey product library</strong>
            <p>{contributor ? 'Reading the complete Contributor collection.' : 'Matching Hub content to published monitoring rounds.'}</p>
          </div>
        )}

        {error && (
          <div className="monitoring-library-message is-error" role="alert">
            <strong>Survey products could not be loaded.</strong>
            <p>{error}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          </div>
        )}

        {visibleCatalog && (
          <>
            <div className="monitoring-filters">
              <label className="monitoring-filter-search"><span>Search</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Country, round or product…" /></label>
              <label><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option>All countries</option>{visibleCatalog.countries.map((entry) => <option value={entry.iso3} key={entry.iso3}>{entry.name}</option>)}</select></label>
              <label><span>Product type</span><select value={productType} onChange={(event) => setProductType(event.target.value)}><option>All product types</option>{visibleCatalog.productTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Year</span><select value={year} onChange={(event) => setYear(event.target.value)}><option>All years</option>{visibleCatalog.years.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>All languages</option>{visibleCatalog.languages.map((value) => <option key={value}>{value}</option>)}</select></label>
              <button type="button" onClick={clearFilters}>Clear</button>
            </div>

            <div className="monitoring-results-meta" aria-live="polite">
              <p><strong>{filtered.length}</strong> products across <strong>{groups.length}</strong> country and round groups.</p>
            </div>

            {!groups.length ? (
              <div className="monitoring-library-message">
                <strong>No survey products match these filters.</strong>
                <p>Clear one or more filters to broaden the library.</p>
                <button type="button" onClick={clearFilters}>Clear filters</button>
              </div>
            ) : (
              <div className="monitoring-product-groups">
                {groups.slice(0, visibleGroups).map((group) => {
                  const groupKey = `${group.country}-${group.round || 'other'}`
                  return (
                    <section className="monitoring-product-group" key={groupKey} aria-labelledby={`monitoring-group-${groupKey.replace(/[^a-z0-9]+/gi, '-')}`}>
                      <header>
                        <div>
                          <span className="monitoring-group-country">
                            {group.iso3 && <i className={`flag flag-small flag-${group.iso3.toLowerCase()}`} aria-hidden="true" />}
                            <span>{group.country}</span>
                          </span>
                          <h3 id={`monitoring-group-${groupKey.replace(/[^a-z0-9]+/gi, '-')}`}>{group.round || 'Other resources'}</h3>
                        </div>
                        <div className="monitoring-group-actions">
                          {group.iso3 && group.roundValue && (
                            <Link className="monitoring-survey-explorer-link" to={monitoringCountryPath(group.iso3, group.roundValue)}>
                              Explore in Household Survey Explorer <span aria-hidden="true">→</span>
                            </Link>
                          )}
                          <div className="monitoring-group-count">
                            <strong>{group.items.length}</strong>
                            <span>{group.items.length === 1 ? 'product' : 'products'}</span>
                            {group.date && (
                              <time dateTime={new Date(group.date).toISOString()}>
                                {group.status === 'upcoming' ? 'Expected' : 'Published'} {formatDate(group.date)}
                              </time>
                            )}
                          </div>
                        </div>
                      </header>
                      <div>{group.items.map((item) => <ProductRow item={item} key={item.key} />)}</div>
                    </section>
                  )
                })}
              </div>
            )}

            {visibleGroups < groups.length && (
              <div className="monitoring-load-more">
                <button type="button" onClick={() => setVisibleGroups((value) => value + GROUP_STEP)}>Show more survey rounds</button>
                <span>Showing {Math.min(visibleGroups, groups.length)} of {groups.length} groups</span>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}
