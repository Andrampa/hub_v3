import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import spotlightExport from '../data/briefSpotlight.json'
import spotlightShapes from '../data/briefSpotlightShapes.json'
import { useMediaQuery } from '../hooks/useMediaQuery'
import {
  attribution,
  callToAction,
  eligibleEntries,
  mentionsAghin,
  monthsInWindow,
  previousRound,
  readHistory,
  rememberCard,
  roundLabel,
  spotlightCycle,
  trackSpotlight,
  type SpotlightCard,
  type SpotlightData,
  type SpotlightEntry,
} from '../lib/briefSpotlight'
import { countryDefinition } from '../services/countries'
import { monitoringCountryPath } from '../services/monitoringEmbed'
import type { ArcGISItem } from '../types'
import { CountryFlag } from './CountryFlag'
import '../brief-spotlight.css'

const DATA = spotlightExport as unknown as SpotlightData
const COUNTRY_GLOBES: Readonly<Partial<Record<string, { land: string; grid: string; country: string }>>> = spotlightShapes
/** Long enough to read the headline and reach the link before the card changes. */
export const CARD_SECONDS = 12
const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const RING_RADIUS = 52
const RING_LENGTH = 2 * Math.PI * RING_RADIUS

function storage() {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

/**
 * The figure exactly as the brief prints it. Each character rises into place,
 * so no intermediate number is ever on screen; assistive technology reads the
 * literal once, as text.
 */
function PrintedFigure({ text, lang, className }: { text: string; lang?: string; className: string }) {
  return (
    <strong className={className} lang={lang || undefined}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {[...text].map((character, index) => (
          <span className="bs-char" style={{ '--i': index } as CSSProperties} key={index}>
            {character === ' ' ? ' ' : character}
          </span>
        ))}
      </span>
    </strong>
  )
}

function QuoteReveal({ card }: { card: SpotlightCard }) {
  const words = card.quote.text.split(/\s+/).filter(Boolean)
  return (
    <figure className="bs-quote">
      <blockquote lang={card.quote.lang || undefined}>
        <span className="sr-only">{card.quote.text}</span>
        <span aria-hidden="true">
          {words.map((word, index) => (
            <span className="bs-word" style={{ '--i': Math.min(index, 40) } as CSSProperties} key={index}>{word} </span>
          ))}
        </span>
      </blockquote>
      <figcaption>Page {card.quote.page} of the brief</figcaption>
    </figure>
  )
}

function Stage({ card }: { card: SpotlightCard }) {
  if (card.treatment === 'count' && card.figure) {
    return (
      <div className="bs-graphic bs-graphic--count">
        <PrintedFigure text={card.figure} lang={card.figure_lang} className={`bs-figure${card.figure.length > 11 ? ' bs-figure--long' : ''}`} />
        {card.context.population && <p className="bs-figure-label">{card.context.population}</p>}
      </div>
    )
  }
  if (card.treatment === 'ring' && card.figure && card.fraction !== undefined) {
    return (
      <div className="bs-graphic bs-graphic--ring">
        <svg className="bs-ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
          <circle className="bs-ring-track" cx="60" cy="60" r={RING_RADIUS} />
          <circle
            className="bs-ring-value"
            cx="60"
            cy="60"
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            style={{ '--ring-length': RING_LENGTH, '--ring-offset': RING_LENGTH * (1 - card.fraction) } as CSSProperties}
          />
        </svg>
        <PrintedFigure text={card.figure} lang={card.figure_lang} className={`bs-figure bs-figure--ring${card.figure.length > 11 ? ' bs-figure--long' : ''}`} />
      </div>
    )
  }
  if (card.treatment === 'bars' && card.bars) {
    return (
      <dl className="bs-graphic bs-graphic--bars">
        {card.bars.map((bar, index) => (
          <div className={`bs-bar${bar.current ? ' bs-bar--current' : ''}`} key={index}>
            <dt>{bar.label}</dt>
            <dd>
              <span className="bs-bar-track" aria-hidden="true">
                <span className="bs-bar-fill" style={{ '--ratio': bar.ratio, '--i': index } as CSSProperties} />
              </span>
              <strong lang={card.quote.lang || undefined}>{bar.literal}</strong>
            </dd>
          </div>
        ))}
      </dl>
    )
  }
  if (card.treatment === 'timeline' && card.months) {
    const lit = monthsInWindow(card.months.start, card.months.end)
    return (
      <div className="bs-graphic bs-graphic--timeline">
        <p className="bs-window">{card.months.label}</p>
        <ol className="bs-months" aria-label={`Months of the year; assistance window ${MONTH_NAMES[card.months.start - 1]} to ${MONTH_NAMES[card.months.end - 1]}`}>
          {MONTH_INITIALS.map((initial, index) => {
            const order = lit.indexOf(index + 1)
            return (
              <li
                className={order >= 0 ? 'is-lit' : undefined}
                style={{ '--i': Math.max(order, 0) } as CSSProperties}
                aria-label={`${MONTH_NAMES[index]}${order >= 0 ? ', in the window' : ''}`}
                key={index}
              >
                <span aria-hidden="true">{initial}</span>
              </li>
            )
          })}
        </ol>
      </div>
    )
  }
  return <QuoteReveal card={card} />
}

/**
 * One finding from a recent DIEM country brief at a time, with the brief's own
 * words as proof and a link to read it.
 *
 * Default export so the homepage can load it, its stylesheet and its data as a
 * single lazy chunk (see `BriefSpotlightSlot`).
 */
export default function BriefSpotlight({ items, iso3 }: { items: ArcGISItem[]; iso3?: string }) {
  const cardElement = useRef<HTMLElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const completedTimer = useRef<HTMLSpanElement>(null)
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const pool = useMemo(
    () => eligibleEntries(DATA, new Set(items.map((item) => item.id)), iso3),
    [items, iso3],
  )
  const [selectedId, setSelectedId] = useState<string>()
  const entry = pool.find(({ card }) => card.id === selectedId)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [visible, setVisible] = useState(false)
  const [documentHidden, setDocumentHidden] = useState(() => document.hidden)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [cycle, setCycle] = useState<SpotlightEntry[]>([])
  const [timerRestart, setTimerRestart] = useState(0)
  const [announcement, setAnnouncement] = useState('')

  const show = useCallback((next: SpotlightEntry | undefined, announce: boolean) => {
    if (!next) return
    rememberCard(storage(), next.card.id)
    setEvidenceOpen(false)
    setSelectedId(next.card.id)
    setAnnouncement(announce ? `${next.card.headline} ${attribution(next.brief, countryDefinition(next.brief.iso3).name)}.` : '')
  }, [])

  // Preserve the cycle until the eligible catalogue changes.
  useEffect(() => {
    const nextCycle = spotlightCycle(pool, readHistory(storage()), entry)
    setCycle(nextCycle)
    if (entry) return
    setVisible(false)
    setHovered(false)
    setFocused(false)
    if (!pool.length) {
      setSelectedId(undefined)
      return
    }
    show(nextCycle[0], false)
  }, [pool, show])

  useEffect(() => {
    const element = cardElement.current
    if (!element) return
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      setVisible(entries.some((observed) => observed.isIntersecting && observed.intersectionRatio >= 0.35))
    }, { threshold: 0.35 })
    observer.observe(element)
    return () => observer.disconnect()
  }, [entry !== undefined])

  useEffect(() => {
    const update = () => setDocumentHidden(document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  // An impression is a card the visitor could actually see.
  const cardId = entry?.card.id
  useEffect(() => {
    if (entry && visible && !documentHidden) trackSpotlight('brief_spotlight_impression', entry)
  }, [cardId, visible && !documentHidden])

  if (!entry) return null

  const { card, brief } = entry
  const globe = COUNTRY_GLOBES[brief.iso3]
  const country = countryDefinition(brief.iso3)
  const canRotate = cycle.length > 1
  const autoplay = canRotate && !reducedMotion
  const motionAllowed = !userPaused && visible && !documentHidden && !hovered && !focused && !evidenceOpen
  const running = autoplay && motionAllowed
  const earlier = previousRound(cycle, brief)
  const next = (announce: boolean) => {
    const index = cycle.findIndex(({ card: candidate }) => candidate.id === card.id)
    show(cycle[(index + 1) % cycle.length], announce)
  }
  const dashboardRound = Math.max(...brief.rounds)

  return (
    <section className="brief-spotlight section-wrap" aria-labelledby="brief-spotlight-title">
      <div className="section-heading bs-heading">
        <div>
          <span className="kicker">Brief spotlight</span>
          <h2 id="brief-spotlight-title">What the latest country briefs found</h2>
        </div>
        <p>One finding at a time from DIEM household surveys in food-crisis countries, each with the brief’s own words as proof.</p>
      </div>

      <article
        ref={cardElement}
        className={`bs-card bs-card--${card.treatment}${running ? ' is-running' : ''}${visible ? ' is-visible' : ''}`}
        onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovered(true) }}
        onPointerLeave={(event) => { if (event.pointerType === 'mouse') setHovered(false) }}
        onFocus={() => setFocused(true)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
      >
        <div className="bs-stage" key={`stage-${card.id}`}>
          {globe && (
            <svg className={`country-shape bs-globe${motionAllowed ? ' bs-globe--moving' : ''}`}
              viewBox="0 0 200 200" aria-hidden="true" focusable="false">
              <circle className="bs-globe-sphere" cx="100" cy="100" r="96" />
              <path className="bs-globe-land" d={globe.land} />
              <path className="bs-globe-grid" d={globe.grid} />
              <path className="bs-globe-country" d={globe.country} />
            </svg>
          )}
          <Stage card={card} />
          {autoplay && (
            <span
              key={timerRestart}
              className="bs-progress"
              style={{ '--seconds': `${CARD_SECONDS}s` } as CSSProperties}
              onAnimationEnd={(event) => {
                if (event.target !== event.currentTarget || completedTimer.current === event.currentTarget) return
                completedTimer.current = event.currentTarget
                if (!running) {
                  // An end event queued before pausing would otherwise leave the timer exhausted.
                  setTimerRestart((restart) => restart + 1)
                  return
                }
                next(false)
              }}
              aria-hidden="true"
            />
          )}
        </div>

        <div className="bs-body" key={`body-${card.id}`}>
          <p className="bs-origin">
            <CountryFlag iso2={country.iso2?.toLowerCase()} name={country.name} decorative />
            <strong>{country.name}</strong>
            <span>{roundLabel(brief)}</span>
          </p>
          <p className="bs-chapter">{DATA.chapters[card.chapter] || 'Key highlights'}</p>
          <h3 className="bs-headline">{card.headline}</h3>

          {(card.context.geography || card.context.period || (card.treatment !== 'count' && card.context.population)) && (
            <dl className="bs-context">
              {card.treatment !== 'count' && card.context.population && <div><dt>Who</dt><dd>{card.context.population}</dd></div>}
              {card.context.geography && <div><dt>Where</dt><dd>{card.context.geography}</dd></div>}
              {card.context.period && <div><dt>When</dt><dd>{card.context.period}</dd></div>}
            </dl>
          )}

          {card.treatment !== 'headline' && (
            <details className="bs-evidence" open={evidenceOpen} onToggle={(event) => setEvidenceOpen(event.currentTarget.open)}>
              <summary>In the brief’s words</summary>
              <blockquote lang={card.quote.lang || undefined}>{card.quote.text}</blockquote>
              <p>Page {card.quote.page} of the brief</p>
            </details>
          )}

          <div className="bs-actions">
            <a
              className="bs-cta"
              href={brief.record_url}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackSpotlight('brief_spotlight_click', entry)}
            >
              {callToAction(brief, country.name)} <span aria-hidden="true">→</span>
              <span className="sr-only"> (opens FAO Open Knowledge in a new tab)</span>
            </a>
            {Number.isFinite(dashboardRound) && (
              <a className="bs-control" href={monitoringCountryPath(brief.iso3, String(dashboardRound))}>
                {brief.rounds.length > 1 ? `Dashboard · Round ${dashboardRound}` : 'Open DIEM dashboard'}
                <span aria-hidden="true">→</span>
              </a>
            )}
            <p className="bs-attribution">{attribution(brief, country.name)}</p>
          </div>
        </div>

        {canRotate && (
          <div className="bs-controls">
            {!reducedMotion && (
              <button type="button" className="bs-control" onClick={() => setUserPaused((paused) => !paused)} aria-pressed={userPaused}>
                <span aria-hidden="true">{userPaused ? '▶' : '❚❚'}</span> {userPaused ? 'Play' : 'Pause'}
                <span className="sr-only"> automatic rotation</span>
              </button>
            )}
            {earlier && (
              <button type="button" className="bs-control" onClick={(event) => {
                if (document.activeElement === event.currentTarget && !previousRound(cycle, earlier.brief)) {
                  nextButton.current?.focus()
                }
                show(earlier, true)
              }}>
                <span aria-hidden="true">←</span> {country.name}, {roundLabel(earlier.brief).toLowerCase()}
                <span className="sr-only"> (same country, previous round)</span>
              </button>
            )}
            <button ref={nextButton} type="button" className="bs-control bs-control--next" onClick={() => next(true)}>
              Next finding <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </article>

      <p className="bs-footnote">
        {mentionsAghin(card) && <>AgHiN: agricultural households in need of assistance. </>}
        Findings and quotations are taken from DIEM country briefs, © FAO, available under{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a>.
      </p>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </section>
  )
}
