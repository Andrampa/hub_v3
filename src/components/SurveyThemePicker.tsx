import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SurveyRelease } from '../services/monitoring'
import { monitoringCountryPath } from '../services/monitoringEmbed'
import { fetchSurveyThemes, type ThemeOption } from '../services/monitoringThemes'

export function SurveyThemePicker({
  release,
  onClose,
}: {
  release: SurveyRelease
  onClose: () => void
}) {
  const navigate = useNavigate()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [themes, setThemes] = useState<ThemeOption[]>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    setError(undefined)
    setThemes(undefined)
    fetchSurveyThemes(release, controller.signal)
      .then(setThemes)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message)
      })
    return () => controller.abort()
  }, [release])

  useEffect(() => {
    closeRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      // Keep focus inside the dialog while it is open.
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button, a[href]')
      if (!focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const open = (theme: string) => {
    navigate(monitoringCountryPath(release.iso3, release.roundValue, 'explore', theme))
  }

  return (
    <div className="theme-picker-backdrop" onClick={onClose}>
      <div
        className="theme-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="theme-picker-heading"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="theme-picker-close"
          onClick={onClose}
          aria-label="Close thematic area chooser"
          ref={closeRef}
        >
          <span aria-hidden="true">×</span>
        </button>

        <span className="kicker">{release.country} · Round {release.roundValue}</span>
        <h2 id="theme-picker-heading">Choose a thematic area</h2>
        <p>
          Each area opens this survey in the DIEM monitoring system. Only the
          areas this round actually collected are listed.
        </p>

        {error ? (
          <div className="theme-picker-state" role="alert">
            <strong>Thematic areas could not be read.</strong>
            <p>{error}</p>
            <button type="button" onClick={() => open('')}>Open the survey anyway</button>
          </div>
        ) : !themes ? (
          <div className="theme-picker-state" role="status">
            <span className="loader" />
            <p>Checking which areas this round collected…</p>
          </div>
        ) : themes.length ? (
          <ul className="theme-picker-options">
            {themes.map((theme) => (
              <li key={theme.id}>
                <button type="button" onClick={() => open(theme.id)}>
                  <strong>{theme.label}</strong>
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="theme-picker-state">
            <strong>No thematic area is published for this round.</strong>
            <p>The survey opens in the monitoring system on its default view.</p>
            <button type="button" onClick={() => open('')}>Open the survey</button>
          </div>
        )}
      </div>
    </div>
  )
}
