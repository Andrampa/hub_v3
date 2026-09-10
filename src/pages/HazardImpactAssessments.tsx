import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImpactAtlasMap } from '../components/ImpactAtlasMap'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { HeroImage } from '../components/HeroImage'
import { cleanText, formatDate } from '../lib/catalog'
import { countryDefinition, itemHubLink } from '../services/countries'
import {
  fetchImpactAssessmentCatalog,
  type ImpactAssessmentCatalog,
  type ImpactAssessmentResource,
} from '../services/impactAssessments'
import { itemThumbnail } from '../services/arcgis'
import { usePageMetadata } from '../hooks/usePageMetadata'

type ResultsView = 'details' | 'timeline'
const RESULTS_STEP = 18
const TIMELINE_PREVIEW_PER_YEAR = 3
const FEATURED_TAG = 'featured impact assessment'

function ExternalIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M14 4h6v6" /><path d="m20 4-9 9" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" />
    </svg>
  )
}

function countryLabel(item: ImpactAssessmentResource) {
  if (!item.countries.length) return item.geographicScopes[0] || 'Cross-country'
  const names = item.countries.map((iso3) => countryDefinition(iso3).name)
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`
}

function DossierCard({ item, compact = false }: { item: ImpactAssessmentResource, compact?: boolean }) {
  const thumbnail = itemThumbnail(item)
  const summary = cleanText(item.snippet || item.description)
  const shock = item.shockTypes[0] || 'Hazard impact'
  // An assessment is a product, so a dossier opens the Hub product page and its
  // citation, licence and preview, rather than leaving for ArcGIS on the first
  // click. The three assessments published as ArcGIS applications carry no
  // catalog role and keep their direct link; see itemHubLink.
  const link = itemHubLink(item)
  const image = thumbnail
    ? <img src={thumbnail} alt="" loading="lazy" />
    : <span aria-hidden="true">DIEM</span>

  return (
    <article className={`impact-dossier${compact ? ' impact-dossier--compact' : ''}`}>
      {/* One tab stop per card: the image was a second focusable link to the
          destination "Open assessment" already reaches. It is now an empty
          overlay, out of the tab order and out of the accessibility tree, and
          still clickable with a pointer. The shock badge sits outside it, so it
          stays in the accessibility tree, and the assessment's title moves onto
          the accessible name of the link that remains. */}
      <div className="impact-dossier-image">
        {image}
        <span className="impact-dossier-shock">{shock}</span>
        {link.kind === 'product' ? (
          <Link className="card-media-link" to={link.to} tabIndex={-1} aria-hidden="true" />
        ) : (
          <a className="card-media-link" href={link.href} target="_blank" rel="noreferrer" tabIndex={-1} aria-hidden="true" />
        )}
      </div>
      <div className="impact-dossier-body">
        <div className="impact-dossier-meta">
          <span>{countryLabel(item)}</span>
          <time dateTime={`${item.assessmentYear}`}>{item.assessmentYear}</time>
        </div>
        <h3>{item.title.trim()}</h3>
        {!compact && <p>{summary || 'Open the assessment to view its complete evidence and methodology.'}</p>}
        {!compact && (
          <dl className="impact-dossier-details">
            <div><dt>Assessment type</dt><dd>{item.contentRoles.join(', ') || item.type}</dd></div>
            <div><dt>Geographic scope</dt><dd>{item.geographicScopes.join(', ') || countryLabel(item)}</dd></div>
            <div><dt>Language</dt><dd>{item.languages.join(', ') || 'Not specified'}</dd></div>
            <div><dt>DIEM pillar</dt><dd>{item.pillars.join(', ') || 'Not specified'}</dd></div>
            <div><dt>Format</dt><dd>{item.type}</dd></div>
            <div><dt>Updated</dt><dd>{formatDate(item.modified)}</dd></div>
          </dl>
        )}
        <div className="impact-dossier-tags" aria-label="Assessment metadata">
          {(item.contentRoles.length ? item.contentRoles : [item.type]).slice(0, 2).map((role) => (
            <span key={role}>{role}</span>
          ))}
          {item.languages[0] && item.languages[0] !== 'English' && <span>{item.languages[0]}</span>}
        </div>
        {/* The accessible name leads with the visible words and then names the
            assessment, so a list of links read out of context is not sixteen
            identical "Open assessment" entries. */}
        {link.kind === 'product' ? (
          <Link className="impact-dossier-link" to={link.to} aria-label={`Open assessment: ${item.title.trim()}`}>Open assessment</Link>
        ) : (
          <a className="impact-dossier-link" href={link.href} target="_blank" rel="noreferrer" aria-label={`Open assessment: ${item.title.trim()}`}>
            Open assessment <ExternalIcon />
          </a>
        )}
      </div>
    </article>
  )
}

function latestAssessments(items: ImpactAssessmentResource[]) {
  const editorial = items.filter((item) => item.tags?.some(
    (tag) => tag.trim().toLowerCase() === FEATURED_TAG,
  ))
  const candidates = editorial.length ? editorial : items.filter((item) => (
    item.contentRoles.some((role) => ['Primary assessment', 'StoryMap', 'Interactive application'].includes(role))
  ))
  return candidates.slice(0, 4)
}

export default function HazardImpactAssessments() {
  usePageMetadata({
    title: 'Hazard impact assessments',
    description: 'DIEM rapid assessments of how floods, droughts, conflict and other hazards affect agriculture, food security and rural livelihoods, with a shock atlas, per-assessment dossiers and an evidence timeline.',
  })
  const [catalog, setCatalog] = useState<ImpactAssessmentCatalog>()
  const [error, setError] = useState<string>()
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('All countries')
  const [shock, setShock] = useState('All shocks')
  const [year, setYear] = useState('All years')
  const [language, setLanguage] = useState('All languages')
  const [view, setView] = useState<ResultsView>('timeline')
  const [visibleCount, setVisibleCount] = useState(RESULTS_STEP)
  const [expandedTimelineYears, setExpandedTimelineYears] = useState<Set<number>>(() => new Set())

  useEffect(() => {
    const controller = new AbortController()
    setError(undefined)
    fetchImpactAssessmentCatalog(controller.signal)
      .then(setCatalog)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message)
      })
    return () => controller.abort()
  }, [reloadKey])

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return (catalog?.items || []).filter((item) => {
      const haystack = [
        item.title,
        item.snippet,
        item.description,
        item.type,
        ...(item.tags || []),
        ...item.countries,
        ...item.shockTypes,
      ].join(' ').toLowerCase()
      return (
        (!normalizedQuery || haystack.includes(normalizedQuery))
        && (country === 'All countries' || item.countries.includes(country))
        && (shock === 'All shocks' || item.shockTypes.includes(shock))
        && (year === 'All years' || item.assessmentYear === Number(year))
        && (language === 'All languages' || item.languages.includes(language))
      )
    })
  }, [catalog, country, language, query, shock, year])

  useEffect(() => {
    setVisibleCount(RESULTS_STEP)
    setExpandedTimelineYears(new Set())
  }, [country, language, query, shock, year, view])

  const visible = filtered.slice(0, visibleCount)
  const timeline = useMemo(() => {
    const grouped = new Map<number, ImpactAssessmentResource[]>()
    filtered.forEach((item) => grouped.set(
      item.assessmentYear,
      [...grouped.get(item.assessmentYear) || [], item],
    ))
    return [...grouped.entries()].sort((a, b) => b[0] - a[0])
  }, [filtered])
  const latest = useMemo(() => latestAssessments(catalog?.items || []), [catalog])
  const latestModified = Math.max(...(catalog?.items.map((item) => item.modified) || [0]))

  const clearFilters = () => {
    setQuery('')
    setCountry('All countries')
    setShock('All shocks')
    setYear('All years')
    setLanguage('All languages')
  }

  return (
    <>
      <SiteHeader />
      <main id="top" className="impact-page">
        <section className="impact-hero">
          <HeroImage name="zambia-drought-2024" className="impact-hero-image" />
          <div className="impact-hero-overlay" />
          <a
            className="impact-hero-credit"
            href="https://commons.wikimedia.org/wiki/File:Dry_fields_in_Lusaka_03.jpg"
            target="_blank"
            rel="noreferrer"
          >
            Photo: Icem4k / CC BY 4.0
          </a>
          <div className="impact-hero-content section-wrap">
            <span className="eyebrow">DIEM pillar · Hazard impact assessment</span>
            <h1>Measuring the impact of <em>shocks and crises</em></h1>
            <p>
              Explore how floods, droughts, conflict and other hazards impact
              agriculture, food security and rural livelihoods.
            </p>
            <a href="#shock-atlas">Open the Living Shock Atlas <span aria-hidden="true">↓</span></a>
          </div>
        </section>

        {!catalog && !error && (
          <section className="impact-loading section-wrap" role="status">
            <span className="loader" />
            <strong>Building the hazard impact collection</strong>
            <p>Reading current assessments and their group categories from ArcGIS.</p>
          </section>
        )}

        {error && (
          <section className="error-state section-wrap impact-error" role="alert">
            <strong>Hazard impact assessments could not be loaded.</strong>
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Try again</button>
          </section>
        )}

        {catalog && (
          <>
            <section className="impact-facts" aria-label="Hazard impact assessment summary">
              <div><strong>{catalog.items.length}</strong><span>published assessments</span></div>
              <div><strong>{catalog.countries.length}</strong><span>countries represented</span></div>
              <div><strong>{catalog.shockTypes.length}</strong><span>shock types</span></div>
              <div><strong>{latestModified ? formatDate(latestModified) : '—'}</strong><span>latest update</span></div>
            </section>

            <section className="impact-latest section-wrap" aria-labelledby="impact-latest-title">
              <div className="impact-section-heading">
                <div><span className="kicker">Latest assessments</span><h2 id="impact-latest-title">New evidence for current decisions</h2></div>
              </div>
              <div className="impact-latest-grid">
                {latest.map((item) => <DossierCard item={item} compact key={item.id} />)}
              </div>
            </section>

            <section className="impact-atlas" id="shock-atlas" aria-labelledby="shock-atlas-title">
              <div className="section-wrap">
                <div className="impact-section-heading impact-section-heading--light">
                  <div><span className="kicker">Living Shock Atlas</span><h2 id="shock-atlas-title">Where shocks have been assessed</h2></div>
                  <p>Select a highlighted country to view available products.</p>
                </div>
                <ImpactAtlasMap
                  countries={catalog.countries}
                  selectedIso={country === 'All countries' ? undefined : country}
                  onSelect={setCountry}
                />
              </div>
            </section>

            <section className="impact-library" id="impact-results" aria-labelledby="impact-library-title">
              <div className="section-wrap">
                <div className="impact-section-heading">
                  <div><span className="kicker">Assessment library</span><h2 id="impact-library-title">Explore the evidence</h2></div>
                  <div className="impact-view-switch" aria-label="Results view">
                    <button type="button" aria-pressed={view === 'timeline'} onClick={() => setView('timeline')}>Timeline</button>
                    <button type="button" aria-pressed={view === 'details'} onClick={() => setView('details')}>Details</button>
                  </div>
                </div>

                <div className="impact-filters">
                  <label className="impact-filter-search">
                    <span>Search</span>
                    <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Country, event or topic…" />
                  </label>
                  <label><span>Country</span><select value={country} onChange={(event) => setCountry(event.target.value)}><option>All countries</option>{catalog.countries.map((entry) => <option value={entry.iso3} key={entry.iso3}>{entry.name}</option>)}</select></label>
                  <label><span>Shock</span><select value={shock} onChange={(event) => setShock(event.target.value)}><option>All shocks</option>{catalog.shockTypes.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label><span>Year</span><select value={year} onChange={(event) => setYear(event.target.value)}><option>All years</option>{catalog.years.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <label><span>Language</span><select value={language} onChange={(event) => setLanguage(event.target.value)}><option>All languages</option>{catalog.languages.map((value) => <option key={value}>{value}</option>)}</select></label>
                  <button type="button" onClick={clearFilters}>Clear</button>
                </div>

                <div className="impact-results-meta" aria-live="polite">
                  <p><strong>{filtered.length}</strong> assessments match the current view.</p>
                </div>

                {!filtered.length ? (
                  <div className="empty-state"><strong>No assessments match these filters.</strong><p>Clear one or more filters to broaden the evidence view.</p><button type="button" onClick={clearFilters}>Clear filters</button></div>
                ) : view === 'details' ? (
                  <div className="impact-dossier-grid">
                    {visible.map((item) => <DossierCard item={item} key={item.id} />)}
                  </div>
                ) : (
                  <div className="impact-timeline">
                    {timeline.map(([timelineYear, items]) => (
                      (() => {
                        const expanded = expandedTimelineYears.has(timelineYear)
                        const shownItems = expanded ? items : items.slice(0, TIMELINE_PREVIEW_PER_YEAR)
                        const remaining = items.length - shownItems.length
                        return (
                          <section className="impact-timeline-year" key={timelineYear} aria-labelledby={`impact-year-${timelineYear}`}>
                            <div className="impact-timeline-marker"><span /><h3 id={`impact-year-${timelineYear}`}>{timelineYear}</h3><small>{shownItems.length} of {items.length} shown</small></div>
                            <div className="impact-timeline-items">
                              {shownItems.map((item) => <DossierCard item={item} compact key={item.id} />)}
                              {remaining > 0 && (
                                <div className="impact-timeline-year-action">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedTimelineYears((current) => new Set([...current, timelineYear]))}
                                  >
                                    Show all {items.length} assessments from {timelineYear}
                                  </button>
                                  <span>{remaining} more {remaining === 1 ? 'assessment' : 'assessments'} in this year</span>
                                </div>
                              )}
                              {expanded && items.length > TIMELINE_PREVIEW_PER_YEAR && (
                                <div className="impact-timeline-year-action is-expanded">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedTimelineYears((current) => {
                                      const next = new Set(current)
                                      next.delete(timelineYear)
                                      return next
                                    })}
                                  >
                                    Show fewer assessments from {timelineYear}
                                  </button>
                                </div>
                              )}
                            </div>
                          </section>
                        )
                      })()
                    ))}
                  </div>
                )}

                {view === 'details' && visibleCount < filtered.length && (
                  <div className="impact-load-more">
                    <button type="button" onClick={() => setVisibleCount((value) => value + RESULTS_STEP)}>
                      Show more assessments
                    </button>
                    <span>Showing {visible.length} of {filtered.length}</span>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  )
}
