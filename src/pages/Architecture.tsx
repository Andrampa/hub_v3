import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ArchitectureSystemMap } from '../components/ArchitectureSystemMap'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { usePageMetadata } from '../hooks/usePageMetadata'
import { buildDiagramDocument, loadDiagramFontFaceCss } from '../lib/diagramDocument'
import {
  ArchitectureManifestError,
  commitUrl,
  DiagramMissingError,
  loadArchitectureManifest,
  loadDiagramSource,
  sourceUrl,
  type ArchitectureDiagram,
  type ArchitectureManifest,
} from '../services/architectureDiagrams'
import '../architecture.css'

type ManifestState =
  | { status: 'loading' }
  | { status: 'ready'; manifest: ArchitectureManifest }
  | { status: 'error'; message: string }

type DiagramState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; source: string; srcdoc: string; fontFaceCss: string }
  | { status: 'error'; key: string; message: string; missing: boolean }

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const formatDate = (value: string) => dateFormat.format(new Date(value))

/**
 * Contributor-only presentation of the four DIEM architecture diagrams.
 *
 * This is a UI gate, not access control: the diagram files ship in the public
 * bundle. The gate decides what the Hub shows and links. Nothing about the
 * diagrams - not even the manifest - is downloaded until a Contributor is
 * signed in. See docs/architecture_diagrams.md.
 */
export default function Architecture({ fullPage = false }: { fullPage?: boolean }) {
  const auth = useAuth()
  const { key } = useParams()
  const isContributor = auth.status === 'authenticated' && Boolean(auth.user?.capabilities?.contributor)

  // The workspace sets its own, more specific title; child effects run first,
  // so this one would overwrite it.
  usePageMetadata({
    title: isContributor ? '' : 'System architecture',
    description: 'How the DIEM systems work and connect, for DIEM Contributors.',
    noindex: true,
  })

  if (isContributor && auth.user) {
    // Keyed by identity: a different account starts from empty state, so no
    // diagram, manifest or object URL outlives the session that loaded it.
    return <ArchitectureWorkspace key={auth.user.username} routeKey={key} fullPage={fullPage} />
  }

  const body = auth.status === 'loading' || auth.status === 'authenticating'
    ? (
      <main id="top" className="architecture-gate section-wrap" role="status">
        <span className="loader" />
        <p>Checking your DIEM session…</p>
      </main>
    )
    : auth.status === 'authenticated'
      ? (
        <main id="top" className="architecture-gate section-wrap">
          <span className="kicker">DIEM Contributors</span>
          <h1>This page is for DIEM Contributors.</h1>
          <p>Your account is signed in but is not a member of the DIEM Contributors group. If you work on DIEM systems and need these diagrams, ask the Hub team to review your access.</p>
          <Link className="architecture-gate-action" to="/contact">Contact the Hub team</Link>
          <Link to="/">Return to the Hub</Link>
        </main>
      )
      : (
        <main id="top" className="architecture-gate section-wrap">
          <span className="kicker">DIEM Contributors</span>
          <h1>Sign in to continue.</h1>
          <p>This page is available to signed-in DIEM Contributors.</p>
          <button className="architecture-gate-action" type="button" onClick={() => void auth.signIn()}>Sign in</button>
          <Link to="/">Return to the Hub</Link>
        </main>
      )

  return fullPage ? body : <><SiteHeader />{body}<SiteFooter /></>
}

function useManifest() {
  const [state, setState] = useState<ManifestState>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setState({ status: 'loading' })
    loadArchitectureManifest()
      .then((manifest) => { if (active) setState({ status: 'ready', manifest }) })
      .catch((reason) => {
        if (!active) return
        setState({
          status: 'error',
          message: reason instanceof ArchitectureManifestError
            ? reason.message
            : 'The diagram list could not be loaded. Check your connection; the Hub may also have been updated while this tab was open.',
        })
      })
    return () => { active = false }
  }, [attempt])
  return { state, retry: useCallback(() => setAttempt((value) => value + 1), []) }
}

function useDiagram(diagram: ArchitectureDiagram | undefined) {
  const [state, setState] = useState<DiagramState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = diagram?.key
  useEffect(() => {
    if (!key) {
      setState(null)
      return
    }
    // A late response for a diagram the reader has left is ignored.
    let active = true
    setState({ status: 'loading', key })
    Promise.all([loadDiagramSource(key), loadDiagramFontFaceCss()])
      .then(([source, fontFaceCss]) => {
        if (!active) return
        const srcdoc = buildDiagramDocument(source, { fontFaceCss, theme: 'light', hideStatus: true })
        setState({ status: 'ready', key, source, srcdoc, fontFaceCss })
      })
      .catch((reason) => {
        if (!active) return
        const missing = reason instanceof DiagramMissingError
        setState({
          status: 'error',
          key,
          missing,
          message: missing
            ? reason.message
            : 'This diagram could not be loaded. Check your connection and try again; the other diagrams are unaffected.',
        })
      })
    return () => { active = false }
  }, [key, attempt])
  return { state: state?.key === key ? state : null, retry: useCallback(() => setAttempt((value) => value + 1), []) }
}

function ArchitectureWorkspace({ routeKey, fullPage }: { routeKey?: string; fullPage: boolean }) {
  const { state: manifestState, retry: retryManifest } = useManifest()
  const manifest = manifestState.status === 'ready' ? manifestState.manifest : null
  const selected = manifest
    ? routeKey ? manifest.diagrams.find((diagram) => diagram.key === routeKey) : manifest.diagrams[0]
    : undefined
  const unknownKey = Boolean(manifest && routeKey && !selected)
  const { state: diagramState, retry: retryDiagram } = useDiagram(selected)
  const tabsRef = useRef<HTMLElement>(null)

  // On narrow screens the tabs scroll sideways: keep the selected one in view
  // without moving the page itself.
  useEffect(() => {
    const strip = tabsRef.current
    const current = strip?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!strip || !current || strip.scrollWidth <= strip.clientWidth) return
    strip.scrollLeft += current.getBoundingClientRect().left - strip.getBoundingClientRect().left - 8
  }, [selected?.key, manifestState.status])

  usePageMetadata({
    title: selected ? `${selected.title} architecture` : 'System architecture',
    description: 'How the DIEM systems work and connect, for DIEM Contributors.',
    noindex: true,
  })

  if (manifestState.status !== 'ready') {
    const content = manifestState.status === 'loading'
      ? <main id="top" className="architecture-gate section-wrap" role="status"><span className="loader" /><p>Loading the architecture diagrams…</p></main>
      : (
        <main id="top" className="architecture-gate section-wrap">
          <span className="kicker">System architecture</span>
          <h1>The diagrams are unavailable.</h1>
          <p role="alert">{manifestState.message}</p>
          <button className="architecture-gate-action" type="button" onClick={retryManifest}>Try again</button>
        </main>
      )
    return fullPage ? content : <><SiteHeader />{content}<SiteFooter /></>
  }

  if (fullPage) {
    return (
      <main id="top" className="architecture-fullpage">
        <header className="architecture-fullpage-bar">
          <Link to={selected ? `/architecture/${selected.key}` : '/architecture'}>← All architecture diagrams</Link>
          <strong>{selected ? selected.title : 'Diagram not found'}</strong>
          {selected && diagramState?.status === 'ready' && <DownloadButton diagram={selected} state={diagramState} />}
        </header>
        {selected && <DiagramStatus diagram={selected} />}
        {selected
          ? <DiagramFrame diagram={selected} state={diagramState} onRetry={retryDiagram} variant="full" />
          : <UnknownDiagram routeKey={routeKey || ''} diagrams={manifestState.manifest.diagrams} />}
      </main>
    )
  }

  const { diagrams, relationships, syncedAt } = manifestState.manifest
  return (
    <>
      <SiteHeader />
      <main id="top" className="architecture-page">
        <section className="architecture-hero">
          <div className="architecture-hero-inner section-wrap">
            <div className="architecture-hero-copy">
              <span className="kicker">For DIEM Contributors · System architecture</span>
              <h1>How DIEM works</h1>
              <p className="architecture-lede">
                {diagrams.length} systems turn household surveys and satellite observations into the evidence on this Hub.
                Each diagram is drawn from its own source repository; the map shows where one system hands off to the next.
              </p>
              <dl className="architecture-hero-facts">
                <div><dt>Systems</dt><dd>{diagrams.length}</dd></div>
                <div><dt>Handoffs</dt><dd>{relationships.length}</dd></div>
                <div><dt>Updated in the Hub</dt><dd><time dateTime={syncedAt}>{formatDate(syncedAt)}</time></dd></div>
              </dl>
            </div>
            <ArchitectureSystemMap diagrams={diagrams} relationships={relationships} selectedKey={selected?.key} />
          </div>
        </section>

        <div className="architecture-body section-wrap">
          <nav className="architecture-tabs" aria-label="Architecture diagrams" ref={tabsRef}>
            {diagrams.map((diagram) => (
              <Link
                key={diagram.key}
                to={`/architecture/${diagram.key}`}
                aria-current={diagram.key === selected?.key ? 'page' : undefined}
                className={diagram.key === selected?.key ? 'is-selected' : undefined}
              >
                <strong>{diagram.title}</strong>
                <small>{diagram.repository.split('/')[1]}</small>
              </Link>
            ))}
          </nav>

          {unknownKey || !selected
            ? <UnknownDiagram routeKey={routeKey || ''} diagrams={diagrams} />
            : (
              <div className="architecture-layout">
                <section className="architecture-viewer" aria-labelledby="architecture-diagram-title">
                  <header className="architecture-viewer-head">
                    <div>
                      {selected.system !== selected.title && <span className="kicker">{selected.system}</span>}
                      <h2 id="architecture-diagram-title">{selected.title}</h2>
                    </div>
                    <div className="architecture-actions">
                      <a href={`/architecture/${selected.key}/full`} target="_blank" rel="noopener noreferrer">
                        Open full page<span className="sr-only"> (opens in a new tab)</span>
                      </a>
                      {diagramState?.status === 'ready' && <DownloadButton diagram={selected} state={diagramState} />}
                    </div>
                  </header>
                  <p className="architecture-summary">{selected.summary}</p>
                  <DiagramStatus diagram={selected} />
                  <DiagramFrame diagram={selected} state={diagramState} onRetry={retryDiagram} variant="inline" />
                </section>
                <DiagramDetails diagram={selected} manifest={manifestState.manifest} />
              </div>
            )}

          <ReadingGuide />
        </div>
      </main>
      <SiteFooter />
    </>
  )
}

export function DiagramFrame({ diagram, state, onRetry, variant }: {
  diagram: ArchitectureDiagram
  state: DiagramState | null
  onRetry: () => void
  variant: 'inline' | 'full'
}) {
  const [expanded, setExpanded] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const expandRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!expanded) return
    const dialog = dialogRef.current!
    dialog.showModal()
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      dialog.close()
      expandRef.current?.focus()
    }
  }, [expanded])

  useEffect(() => { setExpanded(false) }, [diagram.key])

  const stage = (
      <div className="architecture-frame-stage">
        {state?.status === 'ready' && (
          <iframe
            key={diagram.key}
            className="architecture-iframe"
            title={`${diagram.title} architecture diagram`}
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={state.srcdoc}
          />
        )}
        {(!state || state.status === 'loading') && (
          <div className="architecture-frame-status" role="status">
            <span className="loader" />
            <span>Loading the {diagram.title} diagram…</span>
          </div>
        )}
        {state?.status === 'error' && (
          <div className="architecture-frame-status is-error" role="alert">
            <strong>{state.missing ? 'This diagram is not in this Hub build.' : 'The diagram did not load.'}</strong>
            <span>{state.message}</span>
            {!state.missing && <button type="button" onClick={onRetry}>Try again</button>}
          </div>
        )}
      </div>
  )
  return (
    <div className={`architecture-frame architecture-frame-${variant}`}>
      {variant === 'inline' && (
        <div className="architecture-frame-tools">
          <span>Scroll inside the diagram to read it all.</span>
          <button ref={expandRef} type="button" aria-label={`Expand the ${diagram.title} diagram`} onClick={() => setExpanded(true)}>Expand <span aria-hidden="true">⤢</span></button>
        </div>
      )}
      {/* An empty stage keeps the page height while the diagram is in the dialog. */}
      {expanded ? <div className="architecture-frame-stage" aria-hidden="true" /> : stage}
      {expanded && (
        <dialog ref={dialogRef} className="architecture-frame is-expanded" aria-label={`${diagram.title} expanded diagram`}
          onCancel={(event) => { event.preventDefault(); setExpanded(false) }}
          onClose={() => setExpanded(false)}>
          {/* The page's status panel sits behind the backdrop, and the
              embedded document drops its own status line, so the dialog
              carries it. One wrapper keeps the dialog's two grid rows. */}
          <div className="architecture-dialog-head">
            <DiagramStatus diagram={diagram} />
            <div className="architecture-frame-tools">
              <span>Use Close expanded view to exit when reading inside the diagram.</span>
              <button ref={closeRef} type="button" onClick={() => setExpanded(false)}>Close expanded view <span aria-hidden="true">×</span></button>
            </div>
          </div>
          {stage}
        </dialog>
      )}
    </div>
  )
}

function DiagramStatus({ diagram }: { diagram: ArchitectureDiagram }) {
  if (!diagram.status && !diagram.architectureAsOf) return null
  return <p className="architecture-status">
    {diagram.status && <strong>{diagram.status === 'target' ? 'Target architecture' : 'Current implementation'}</strong>}
    {diagram.architectureAsOf && <span>Architecture described as of <time dateTime={diagram.architectureAsOf}>{formatDate(diagram.architectureAsOf)}</time>.</span>}
  </p>
}

/**
 * A sanitized, self-contained copy: the same inert document the page shows,
 * with its provenance in a comment. Object URLs are revoked after the click
 * and on unmount.
 */
function DownloadButton({ diagram, state }: { diagram: ArchitectureDiagram; state: Extract<DiagramState, { status: 'ready' }> }) {
  const urls = useRef<string[]>([])
  useEffect(() => () => {
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current = []
  }, [])

  const download = () => {
    const html = buildDiagramDocument(state.source, {
      fontFaceCss: state.fontFaceCss,
      theme: 'light',
      provenance: `DIEM architecture diagram: ${diagram.title}. Source ${diagram.repository} ${diagram.path} at commit ${diagram.commit}${diagram.uncommittedChanges ? ' plus uncommitted changes' : ''}. Saved from the DIEM Hub on ${new Date().toISOString().slice(0, 10)}. This copy is not updated when the source changes.`,
    })
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }))
    urls.current.push(url)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `diem-architecture-${diagram.key}-${diagram.commit.slice(0, 7)}.html`
    anchor.rel = 'noopener'
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => {
      URL.revokeObjectURL(url)
      urls.current = urls.current.filter((entry) => entry !== url)
    }, 10_000)
  }

  return (
    <button type="button" className="architecture-download" onClick={download} title="A saved copy is yours to keep and cannot be withdrawn later.">
      Download HTML
    </button>
  )
}

function DiagramDetails({ diagram, manifest }: { diagram: ArchitectureDiagram; manifest: ArchitectureManifest }) {
  const titles = useMemo(() => new Map(manifest.diagrams.map((entry) => [entry.key, entry.title])), [manifest])
  const incoming = manifest.relationships.filter((relationship) => relationship.to === diagram.key)
  const outgoing = manifest.relationships.filter((relationship) => relationship.from === diagram.key)
  return (
    <aside className="architecture-details" aria-label={`${diagram.title} details`}>
      <h3>Source</h3>
      <dl>
        <div>
          <dt>Repository</dt>
          <dd>
            <a href={sourceUrl(diagram)} target="_blank" rel="noopener noreferrer">{diagram.repository}</a>
            <small>{diagram.repositoryVisibility === 'private' ? 'Private repository: GitHub access required.' : 'Public repository.'}</small>
          </dd>
        </div>
        <div>
          <dt>Commit</dt>
          <dd><a href={commitUrl(diagram)} target="_blank" rel="noopener noreferrer"><code>{diagram.commit.slice(0, 10)}</code></a></dd>
        </div>
        <div>
          <dt>Source last changed</dt>
          <dd><time dateTime={diagram.sourceChangedAt}>{formatDate(diagram.sourceChangedAt)}</time></dd>
        </div>
        <div>
          <dt>Updated in the Hub</dt>
          <dd><time dateTime={manifest.syncedAt}>{formatDate(manifest.syncedAt)}</time></dd>
        </div>
      </dl>
      {diagram.uncommittedChanges && (
        <p className="architecture-warning">This copy includes changes not yet committed to {diagram.repository}, so the commit above is only its starting point.</p>
      )}
      {(incoming.length > 0 || outgoing.length > 0) && (
        <>
          <h3>Connected systems</h3>
          <ul className="architecture-related">
            {incoming.map((relationship) => (
              <li key={`in-${relationship.from}`}>
                <span className="architecture-related-direction">From</span>
                <Link to={`/architecture/${relationship.from}`}>{titles.get(relationship.from)}</Link>
                <span>{relationship.detail}</span>
              </li>
            ))}
            {outgoing.map((relationship) => (
              <li key={`out-${relationship.to}`}>
                <span className="architecture-related-direction">To</span>
                <Link to={`/architecture/${relationship.to}`}>{titles.get(relationship.to)}</Link>
                <span>{relationship.detail}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="architecture-note">Downloaded copies are yours to keep: the Hub cannot update or withdraw them later.</p>
    </aside>
  )
}

function UnknownDiagram({ routeKey, diagrams }: { routeKey: string; diagrams: ArchitectureDiagram[] }) {
  return (
    <section className="architecture-unknown" role="alert">
      <h2>No diagram called “{routeKey}”.</h2>
      <p>It may have been renamed or removed. These diagrams are available:</p>
      <ul>
        {diagrams.map((diagram) => <li key={diagram.key}><Link to={`/architecture/${diagram.key}`}>{diagram.title}</Link></li>)}
      </ul>
    </section>
  )
}

/**
 * Only the notation the four diagrams share. Each diagram keeps its own
 * legend, and the exceptions are named rather than smoothed over.
 */
function ReadingGuide() {
  return (
    <section className="architecture-guide" aria-labelledby="architecture-guide-title">
      <h2 id="architecture-guide-title">Reading the diagrams</h2>
      <p>Each diagram has its own legend under the drawing. Three conventions hold across all four:</p>
      <ul className="architecture-guide-list">
        <li><i className="architecture-swatch is-flow" aria-hidden="true" /><span><strong>Solid blue arrow</strong> data moves.</span></li>
        <li><i className="architecture-swatch is-control" aria-hidden="true" /><span><strong>Dashed grey arrow</strong> a connection that moves no data: it defines, controls, configures or links.</span></li>
        <li><i className="architecture-swatch is-key" aria-hidden="true" /><span><strong>Blue-filled box</strong> the stores or boundaries the design turns on.</span></li>
      </ul>
      <p className="architecture-guide-exceptions">
        <strong>Not shared by all four:</strong> an orange “a person must approve or act” box appears in the monitoring, EVE and VISTA diagrams but not the Hub’s;
        a dark-outlined “runs on a server” box appears in the Hub, EVE and VISTA diagrams but not the monitoring one; and a dashed blue box marks
        something drawn in another diagram everywhere except the monitoring diagram. In the Hub diagram a two-headed arrow means data moves both ways.
      </p>
    </section>
  )
}
