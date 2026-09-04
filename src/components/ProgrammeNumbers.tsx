import { useEffect, useRef, useState } from 'react'
import {
  MONITORING_COUNTRIES_COVERED,
  MONITORING_COUNTRIES_VERIFIED_LABEL,
  MONITORING_SINCE_LABEL,
  MONITORING_STATISTICS_SOURCE_URL,
  type MonitoringStatistics,
} from '../services/monitoring'

interface ProgrammeNumbersProps {
  statistics: MonitoringStatistics | null
  statisticsFailed: boolean
  hazardImpactAssessments: number
  publicResources: number
  /** Live count of countries with discoverable products in the content group. */
  countriesWithEvidence: number
  catalogReady: boolean
}

const COUNT_UP_DURATION_MS = 1100
/**
 * The figures must never stay at zero because an observer did not fire, so the
 * reveal is forced after this delay whatever the observer reports.
 */
const REVEAL_FALLBACK_MS = 2500

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Reveals the card once, the first time it scrolls into view. The numbers are
 * the page's factual anchor, so the animation must never replay or leave a
 * figure mid-count if the observer is unsupported.
 */
function useRevealed<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element || revealed) return
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setRevealed(true)
        observer.disconnect()
      }
    }, { threshold: 0.25 })
    observer.observe(element)

    // A hidden tab, a prerender or a viewport the observer never reports on
    // would otherwise leave the card invisible and every figure reading zero.
    const fallback = window.setTimeout(() => setRevealed(true), REVEAL_FALLBACK_MS)
    return () => {
      observer.disconnect()
      window.clearTimeout(fallback)
    }
  }, [revealed])

  return { ref, revealed }
}

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(active ? target : 0)

  useEffect(() => {
    if (!active) return
    // A hidden document does not run animation frames, so the count would sit
    // at zero until the tab is focused. Show the real figure instead.
    if (!target || prefersReducedMotion() || document.hidden) {
      setValue(target)
      return
    }

    let frame = 0
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min((now - start) / COUNT_UP_DURATION_MS, 1)
      // Ease-out cubic: the figure decelerates into its final value instead of
      // stopping abruptly, which reads as a settled number rather than a ticker.
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(Math.round(target * eased))
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [active, target])

  return value
}

function Figure({
  value,
  label,
  lead,
  active,
  pending,
}: {
  value: number
  label: string
  lead?: boolean
  active: boolean
  pending?: boolean
}) {
  const counted = useCountUp(value, active && !pending)

  return (
    <div className={`pn-figure${lead ? ' pn-figure--lead' : ''}`}>
      {pending ? (
        <strong className="pn-pending" aria-hidden="true" />
      ) : (
        <strong aria-label={value.toLocaleString('en')}>{counted.toLocaleString('en')}</strong>
      )}
      <span>{label}</span>
    </div>
  )
}

export function ProgrammeNumbers({
  statistics,
  statisticsFailed,
  hazardImpactAssessments,
  publicResources,
  countriesWithEvidence,
  catalogReady,
}: ProgrammeNumbersProps) {
  const { ref, revealed } = useRevealed<HTMLElement>()
  // Each tier draws from a different source, so a failure in one must not blank
  // the other. Missing monitoring figures collapse to their tier only.
  const monitoringPending = !statistics && !statisticsFailed

  return (
    <section
      className={`programme-numbers${revealed ? ' is-revealed' : ''}`}
      id="promotion-trigger"
      aria-labelledby="programme-numbers-title"
      ref={ref}
    >
      <div className="pn-heading">
        <h2 className="kicker" id="programme-numbers-title">DIEM in numbers</h2>
        <span>{MONITORING_SINCE_LABEL}</span>
      </div>

      <div className="pn-tier">
        <p className="pn-tier-label">The monitoring<br />operation</p>
        <div className="pn-figures">
          {statisticsFailed ? (
            <p className="pn-unavailable">
              Live monitoring figures are temporarily unavailable.
            </p>
          ) : (
            <>
              <Figure
                lead
                value={statistics?.householdsInterviewed || 0}
                label="Surveyed households"
                active={revealed}
                pending={monitoringPending}
              />
              <Figure
                value={statistics?.surveys || 0}
                label="Surveys"
                active={revealed}
                pending={monitoringPending}
              />
              {/* "Countries surveyed" is the monitoring population and is a
                  fixed figure; "Countries with evidence" below is the live
                  catalogue population. The labels keep the two distinguishable. */}
              <Figure
                value={MONITORING_COUNTRIES_COVERED}
                label="Countries surveyed"
                active={revealed}
              />
            </>
          )}
        </div>
      </div>

      <div className="pn-tier">
        <p className="pn-tier-label">Evidence<br />published</p>
        <div className="pn-figures">
          <Figure
            value={hazardImpactAssessments}
            label="Hazard impact assessments"
            active={revealed}
            pending={!catalogReady}
          />
          <Figure
            value={publicResources}
            label="Public resources"
            active={revealed}
            pending={!catalogReady}
          />
          <Figure
            value={countriesWithEvidence}
            label="Countries with evidence"
            active={revealed}
            pending={!catalogReady}
          />
        </div>
      </div>

      <p className="pn-footnote">
        Monitoring figures are the running totals for DIEM survey rounds
        {' '}{MONITORING_SINCE_LABEL.replace('Since', 'since')}, read from the{' '}
        <a href={MONITORING_STATISTICS_SOURCE_URL} target="_blank" rel="noreferrer">
          DIEM monitoring statistics service <span aria-hidden="true">↗</span>
        </a>.
        {statistics?.lastPublicationDate && <> Latest survey published {statistics.lastPublicationDate}.</>}
        {' '}{MONITORING_COUNTRIES_VERIFIED_LABEL}. Evidence figures are read live from the DIEM Hub content group.
      </p>
    </section>
  )
}
