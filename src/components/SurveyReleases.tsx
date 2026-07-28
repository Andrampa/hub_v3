import { useEffect, useMemo, useState } from 'react'
import { formatDate } from '../lib/catalog'
import { fetchSurveyReleases, type SurveyRelease, type SurveyReleaseStatus } from '../services/monitoring'
import { SurveyThemePicker } from './SurveyThemePicker'
import '../survey-releases.css'

const INITIAL_ROWS = 8
const ROW_STEP = 12

type BoardFilter = 'all' | SurveyReleaseStatus

// Arrivals are rounds still inbound; departures are rounds already released to
// the public. The board vocabulary is the framing, the status column keeps the
// literal DIEM wording.
const boards: Array<[BoardFilter, string]> = [
  ['all', 'Full board'],
  ['upcoming', 'Arrivals'],
  ['published', 'Departures'],
]

function boardTime(value: number) {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  }).format(value)
}

function BoardClock() {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="board-clock">
      <span className="board-live" aria-hidden="true" />
      <span className="sr-only">Board time, coordinated universal time: </span>
      <time dateTime={new Date(now).toISOString()}>{boardTime(now)}</time>
      <small>UTC</small>
    </div>
  )
}

// The board shows the bare round number: "Round 12" becomes 12.
function roundNumber(round: string) {
  const digits = round.match(/\d+/)?.[0]
  return digits ? String(Number(digits)) : round
}

function collectionWindow(release: SurveyRelease) {
  const { collectionStart: start, collectionEnd: end } = release
  if (start && end) return `${formatDate(start)} — ${formatDate(end)}`
  return start ? formatDate(start) : end ? formatDate(end) : '—'
}

function BoardRow({
  release,
  index,
  onExplore,
}: {
  release: SurveyRelease
  index: number
  onExplore: (release: SurveyRelease) => void
}) {
  const incoming = release.status === 'upcoming'
  const date = incoming ? release.expectedPublicationDate : release.publicationDate

  return (
    // The stagger is capped: on the full board an uncapped delay would leave
    // rows far down the list blank for several seconds before their flap turns.
    <tr className="board-row" style={{ '--row': Math.min(index, 12) } as React.CSSProperties}>
      <td className="board-time">
        {date ? (
          <time dateTime={new Date(date).toISOString()}>{formatDate(date)}</time>
        ) : (
          <time className="is-pending">— — —</time>
        )}
        {incoming && date && <small>estimated</small>}
      </td>
      <td className="board-destination">
        <strong>{release.country}</strong>
        <span>{release.iso3}</span>
      </td>
      <td className="board-flight">{roundNumber(release.round)}</td>
      <td className="board-window">{collectionWindow(release)}</td>
      <td className="board-status">
        <span className={`board-flap is-${release.status}`}>
          {incoming ? 'Incoming' : 'Published'}
        </span>
      </td>
      <td className="board-products">
        {incoming ? <span>on publication</span> : (
          <>
            <button type="button" className="is-explore" onClick={() => onExplore(release)}>
              Explore survey
            </button>
            {release.products.map((product) => (
              <a key={product.url} href={product.url} target="_blank" rel="noreferrer">{product.label}</a>
            ))}
          </>
        )}
      </td>
    </tr>
  )
}

export function SurveyReleases() {
  const [releases, setReleases] = useState<SurveyRelease[]>()
  const [error, setError] = useState<string>()
  const [board, setBoard] = useState<BoardFilter>('all')
  const [visible, setVisible] = useState(INITIAL_ROWS)
  const [attempt, setAttempt] = useState(0)
  const [exploring, setExploring] = useState<SurveyRelease>()
  const [fullBoard, setFullBoard] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setError(undefined)
    fetchSurveyReleases(controller.signal)
      .then(setReleases)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message)
      })
    return () => controller.abort()
  }, [attempt])

  const counts = useMemo(() => ({
    all: releases?.length || 0,
    upcoming: releases?.filter((release) => release.status === 'upcoming').length || 0,
    published: releases?.filter((release) => release.status === 'published').length || 0,
  }), [releases])

  // fetchSurveyReleases already orders by arrival: inbound rounds first by
  // expected publication, then released rounds most recent first. Filtering
  // preserves that order.
  const filtered = useMemo(
    () => (releases || []).filter((release) => board === 'all' || release.status === board),
    [releases, board],
  )

  useEffect(() => setVisible(INITIAL_ROWS), [board])

  // The full board holds the page behind it still, so the page must not scroll
  // underneath the overlay.
  useEffect(() => {
    if (!fullBoard) return
    const restore = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = restore }
  }, [fullBoard])

  useEffect(() => {
    if (!fullBoard) return
    const onKeyDown = (event: KeyboardEvent) => {
      // The chooser sits above the full board and owns Escape while it is open.
      if (event.key === 'Escape' && !exploring) setFullBoard(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [fullBoard, exploring])

  const rows = fullBoard ? filtered : filtered.slice(0, visible)

  const boardPanel = (
    <div className={`board${fullBoard ? ' is-full' : ''}`}>
        <header className="board-bezel">
          <div className="board-mark"><span aria-hidden="true">DIEM</span> Survey status board</div>
          <div className="board-bezel-end">
            <BoardClock />
            {fullBoard && (
              <button type="button" className="board-exit" onClick={() => setFullBoard(false)}>
                <span aria-hidden="true">←</span> Back to home
              </button>
            )}
          </div>
        </header>

        {error ? (
          <div className="board-message" role="alert">
            <strong>Board offline</strong>
            <p>{error}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>Reconnect</button>
          </div>
        ) : !releases ? (
          <div className="board-message" role="status">
            <span className="board-loader" aria-hidden="true"><i /><i /><i /></span>
            <strong>Reading the schedule</strong>
            <p>Calling the monitoring service for inbound and released rounds…</p>
          </div>
        ) : (
          <>
            <div className="board-tabs" role="group" aria-label="Choose a board">
              {boards.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={board === value ? 'is-active' : ''}
                  aria-pressed={board === value}
                  onClick={() => setBoard(value)}
                >
                  {label} <span>{String(counts[value]).padStart(2, '0')}</span>
                </button>
              ))}
            </div>

            {filtered.length ? (
              <>
                <div className="board-scroll">
                  <table>
                    <caption className="sr-only">
                      Household monitoring rounds in order of arrival
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Country</th>
                        <th scope="col">Round</th>
                        <th scope="col">Collection window</th>
                        <th scope="col">Status</th>
                        <th scope="col">Products</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((release, index) => (
                        <BoardRow
                          release={release}
                          index={index}
                          onExplore={setExploring}
                          key={release.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                <footer className="board-footer">
                  <p aria-live="polite">
                    Showing <strong>{String(rows.length).padStart(2, '0')}</strong> of {filtered.length} rounds
                  </p>
                  <div className="board-footer-actions">
                    {!fullBoard && visible < filtered.length && (
                      <button type="button" onClick={() => setVisible((value) => value + ROW_STEP)}>
                        Show more rounds
                      </button>
                    )}
                    {fullBoard ? (
                      <button type="button" className="is-primary" onClick={() => setFullBoard(false)}>
                        <span aria-hidden="true">←</span> Back to home
                      </button>
                    ) : (
                      <button type="button" className="is-primary" onClick={() => setFullBoard(true)}>
                        Show all rounds
                      </button>
                    )}
                  </div>
                </footer>
              </>
            ) : (
              <div className="board-message board-message--empty">
                <strong>No {board === 'upcoming' ? 'incoming' : 'released'} rounds on the board</strong>
                <p>
                  {board === 'upcoming'
                    ? 'Every round currently in the monitoring service has already been published.'
                    : 'Switch board to see the rounds still inbound.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
  )

  return (
    <section className="survey-board section-wrap" aria-labelledby="survey-board-heading">
      <div className="section-heading">
        <div>
          <span className="kicker">Survey pipeline</span>
          <h2 id="survey-board-heading">Arrival &amp; departure board</h2>
        </div>
        <p>
          Every household monitoring round in order of arrival. Country briefs and
          survey products light up the moment a round is released.
        </p>
      </div>

      {fullBoard ? (
        <div
          className="board-fullscreen"
          role="dialog"
          aria-modal="true"
          aria-label="Arrival and departure board, every round"
        >
          {boardPanel}
        </div>
      ) : boardPanel}

      {exploring && (
        <SurveyThemePicker release={exploring} onClose={() => setExploring(undefined)} />
      )}
    </section>
  )
}
