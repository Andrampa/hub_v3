import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatDate } from '../lib/format'
import {
  fetchSurveyRoundCatalog,
  type MonitoringProductType,
  type RoundProduct,
  type SurveyRound,
  type SurveyRoundCatalog,
} from '../services/monitoringProducts'
import { SurveyThemePicker } from './SurveyThemePicker'
import '../survey-catalogue.css'

const PAGE_SIZE = 15

const TYPE_LABELS: Record<MonitoringProductType, string> = {
  'Country brief': 'Brief',
  'Findings presentation': 'Findings',
  Report: 'Report',
  Questionnaire: 'Questionnaire',
  'Public dataset': 'Dataset',
  'Methodology or guidance': 'Guidance',
  'Supporting material': 'Material',
}

const LANGUAGE_CODES: Record<string, string> = { English: 'EN', French: 'FR', Spanish: 'ES', Arabic: 'AR', Portuguese: 'PT', Russian: 'RU', Chinese: 'ZH' }

type SortKey = 'published' | 'country' | 'round'
type Status = 'all' | 'published' | 'upcoming'

const MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' })
const MONTH_YEAR = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

// "July – August 2026", or "December 2025 – January 2026" across a year end.
function fieldwork(round: SurveyRound) {
  const { collectionStart: start, collectionEnd: end } = round
  if (!start || !end) return start || end ? MONTH_YEAR.format(start || end!) : '—'
  const from = new Date(start)
  const to = new Date(end)
  if (from.getUTCFullYear() !== to.getUTCFullYear()) return `${MONTH_YEAR.format(from)} – ${MONTH_YEAR.format(to)}`
  if (from.getUTCMonth() === to.getUTCMonth()) return MONTH_YEAR.format(to)
  return `${MONTH.format(from)} – ${MONTH_YEAR.format(to)}`
}

function releaseDate(round: SurveyRound) {
  return round.status === 'upcoming' ? round.expectedPublicationDate : round.publicationDate
}

function releaseYear(round: SurveyRound) {
  const date = releaseDate(round)
  return date ? new Date(date).getUTCFullYear() : undefined
}

function ProductChip({ product }: { product: RoundProduct }) {
  const languages = product.languages.map((language) => LANGUAGE_CODES[language] || language).join(' ')
  const label = (
    <>
      {TYPE_LABELS[product.type]}
      {languages && <small>{languages}</small>}
    </>
  )
  return product.link.kind === 'product' ? (
    <Link className="round-chip" to={product.link.to} title={product.title}>{label}</Link>
  ) : (
    <a className="round-chip" href={product.link.href} target="_blank" rel="noreferrer" title={product.title}>
      {label}<span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

export function SurveyCatalogue() {
  const { status: authStatus, user, requestProtected } = useAuth()
  const contributor = authStatus === 'authenticated' && Boolean(user?.capabilities.contributor)
  const audience = contributor ? 'contributor' : 'public'
  const [catalog, setCatalog] = useState<SurveyRoundCatalog>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [visible, setVisible] = useState(PAGE_SIZE)
  const [exploring, setExploring] = useState<SurveyRound>()
  const [params, setParams] = useSearchParams()

  const query = params.get('q') || ''
  const status = (params.get('status') || 'all') as Status
  const year = params.get('year') || ''
  const language = params.get('lang') || ''
  const productType = params.get('type') || ''
  const sort = (params.get('sort') || 'published') as SortKey
  // Country and round read naturally A→Z and 1→n; release dates newest first.
  const naturalAscending = (key: SortKey) => key !== 'published'
  const ascending = params.has('dir') ? params.get('dir') === 'asc' : naturalAscending(sort)

  // Filters live in the address so a filtered table can be shared; replace
  // keeps them out of the back-button history.
  const update = (changes: Record<string, string | undefined>) => {
    setParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => {
        if (value) next.set(key, value)
        else next.delete(key)
      })
      return next
    }, { replace: true })
  }

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setError(undefined)
    fetchSurveyRoundCatalog({
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

  const rounds = catalog?.audience === audience ? catalog.rounds : undefined

  const options = useMemo(() => {
    const all = rounds || []
    return {
      years: [...new Set(all.flatMap((round) => releaseYear(round) || []))].sort((a, b) => b - a),
      languages: [...new Set(all.flatMap((round) => round.roundProducts.flatMap((product) => product.languages)))].sort(),
      types: [...new Set(all.flatMap((round) => round.roundProducts.map((product) => product.type)))]
        .sort((a, b) => TYPE_LABELS[a].localeCompare(TYPE_LABELS[b])),
      upcoming: all.filter((round) => round.status === 'upcoming').length,
    }
  }, [rounds])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matches = (rounds || []).filter((round) => (
      (!needle || round.country.toLowerCase().includes(needle) || round.iso3.toLowerCase() === needle)
      && (status === 'all' || round.status === status)
      && (!year || releaseYear(round) === Number(year))
      && (!language || round.roundProducts.some((product) => product.languages.includes(language)))
      && (!productType || round.roundProducts.some((product) => product.type === productType))
    ))
    // The service orders rounds by release (upcoming first, then the most
    // recently published); that order also breaks ties in the other sorts.
    const order = new Map(matches.map((round, index) => [round.id, index]))
    const compareAscending = (left: SurveyRound, right: SurveyRound) => {
      if (sort === 'country') return left.country.localeCompare(right.country)
      if (sort === 'round') return Number(left.roundValue) - Number(right.roundValue)
      return order.get(right.id)! - order.get(left.id)!
    }
    return [...matches].sort((left, right) => (
      (ascending ? 1 : -1) * compareAscending(left, right) || order.get(left.id)! - order.get(right.id)!
    ))
  }, [rounds, query, status, year, language, productType, sort, ascending])

  useEffect(() => setVisible(PAGE_SIZE), [query, status, year, language, productType, sort, ascending])

  const filtering = Boolean(query || status !== 'all' || year || language || productType)
  const countries = new Set(filtered.map((round) => round.iso3)).size

  const sortButton = (key: SortKey, label: string) => {
    const active = sort === key
    const nextAscending = active ? !ascending : naturalAscending(key)
    const onClick = () => update({
      sort: key === 'published' ? undefined : key,
      dir: nextAscending === naturalAscending(key) ? undefined : nextAscending ? 'asc' : 'desc',
    })
    return (
      <button type="button" className={active ? 'is-active' : ''} onClick={onClick}>
        {label}
        <span aria-hidden="true">{active ? (ascending ? '↑' : '↓') : '↕'}</span>
      </button>
    )
  }
  const ariaSort = (key: SortKey) => sort === key ? (ascending ? 'ascending' : 'descending') : undefined

  return (
    <section className="survey-catalogue section-wrap" aria-labelledby="survey-catalogue-heading">
      <div className="section-heading">
        <div>
          <span className="kicker">Household surveys</span>
          <h2 id="survey-catalogue-heading">Survey rounds</h2>
        </div>
        <p>Every DIEM household survey round, with its published products.</p>
      </div>

      {error ? (
        <div className="rounds-message" role="alert">
          <strong>Survey rounds could not be loaded.</strong>
          <p>{error}</p>
          <button type="button" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
        </div>
      ) : !rounds ? (
        <div className="rounds-skeleton" role="status" aria-label="Loading survey rounds">
          {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
        </div>
      ) : (
        <>
          <div className="rounds-toolbar">
            <label className="rounds-search">
              <span className="sr-only">Search by country</span>
              <input type="search" value={query} placeholder="Search a country" onChange={(event) => update({ q: event.target.value || undefined })} />
            </label>
            {options.upcoming > 0 && (
              <div className="rounds-status" role="group" aria-label="Status">
                {(['all', 'published', 'upcoming'] as Status[]).map((value) => (
                  <button key={value} type="button" aria-pressed={status === value} onClick={() => update({ status: value === 'all' ? undefined : value })}>
                    {value === 'all' ? 'All' : value === 'published' ? 'Published' : 'Upcoming'}
                  </button>
                ))}
              </div>
            )}
            <label>
              <span className="sr-only">Year</span>
              <select value={year} onChange={(event) => update({ year: event.target.value || undefined })}>
                <option value="">Any year</option>
                {options.years.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Product</span>
              <select value={productType} onChange={(event) => update({ type: event.target.value || undefined })}>
                <option value="">Any product</option>
                {options.types.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label>
              <span className="sr-only">Language</span>
              <select value={language} onChange={(event) => update({ lang: event.target.value || undefined })}>
                <option value="">Any language</option>
                {options.languages.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
          </div>

          <p className="rounds-summary" aria-live="polite">
            <span>
              <strong>{filtered.length}</strong> {filtered.length === 1 ? 'round' : 'rounds'} in{' '}
              <strong>{countries}</strong> {countries === 1 ? 'country' : 'countries'}
            </span>
            {filtering && (
              <button type="button" onClick={() => update({ q: undefined, status: undefined, year: undefined, lang: undefined, type: undefined })}>
                Clear filters
              </button>
            )}
          </p>

          {catalog?.catalogError && (
            <p className="rounds-notice" role="status">
              Product details are temporarily unavailable, so products link to their source.{' '}
              <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
            </p>
          )}

          {filtered.length ? (
            <>
              <table className="rounds-table">
                <caption className="sr-only">DIEM household survey rounds and their products</caption>
                <thead>
                  <tr>
                    <th scope="col" aria-sort={ariaSort('country')}>{sortButton('country', 'Country')}</th>
                    <th scope="col" aria-sort={ariaSort('round')}>{sortButton('round', 'Round')}</th>
                    <th scope="col">Fieldwork</th>
                    <th scope="col" aria-sort={ariaSort('published')}>{sortButton('published', 'Published')}</th>
                    <th scope="col">Products</th>
                    <th scope="col"><span className="sr-only">Explore</span></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((round) => {
                    const date = releaseDate(round)
                    const upcoming = round.status === 'upcoming'
                    return (
                      <tr key={round.id} className={upcoming ? 'is-upcoming' : undefined}>
                        <th scope="row" className="rounds-country">
                          <span>
                            <i className={`flag flag-small flag-${round.iso3.toLowerCase()}`} aria-hidden="true" />
                            {round.country}
                          </span>
                        </th>
                        <td className="rounds-round" data-label="Round">{round.roundValue}</td>
                        <td className="rounds-fieldwork" data-label="Fieldwork">{fieldwork(round)}</td>
                        <td className="rounds-date" data-label={upcoming ? 'Expected' : 'Published'}>
                          {upcoming && <span className="rounds-badge">Upcoming</span>}
                          {date ? <time dateTime={new Date(date).toISOString()}>{formatDate(date)}</time> : '—'}
                        </td>
                        <td className="rounds-products">
                          {round.roundProducts.length
                            ? round.roundProducts.map((product) => <ProductChip product={product} key={product.key} />)
                            : <span className="rounds-none">{upcoming ? 'On publication' : '—'}</span>}
                        </td>
                        <td className="rounds-action">
                          {!upcoming && (
                            <button type="button" onClick={() => setExploring(round)} aria-label={`Explore ${round.country} round ${round.roundValue}`}>
                              Explore <span aria-hidden="true">→</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {visible < filtered.length && (
                <div className="rounds-more">
                  <button type="button" onClick={() => setVisible((value) => value + PAGE_SIZE)}>Show more rounds</button>
                  <span>{Math.min(visible, filtered.length)} of {filtered.length}</span>
                </div>
              )}
            </>
          ) : (
            <div className="rounds-message">
              <strong>No survey round matches these filters.</strong>
              <button type="button" onClick={() => update({ q: undefined, status: undefined, year: undefined, lang: undefined, type: undefined })}>Clear filters</button>
            </div>
          )}
        </>
      )}

      {exploring && <SurveyThemePicker release={exploring} onClose={() => setExploring(undefined)} />}
    </section>
  )
}
