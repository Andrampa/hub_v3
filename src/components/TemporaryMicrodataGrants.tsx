import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  describeExportPolicy,
  describeSurveyScope,
  fetchCurrentUserMicrodataGrants,
  type GrantBundle,
  type GrantDiscovery,
  type ResolvedGrantView,
} from '../services/microdataGrants'
import { GENERATIONS, authoritativeResourceUrl, type ProtectedDataResource } from '../services/protectedData'

const COMPONENT_LABELS: Record<ResolvedGrantView['component'], string> = {
  legacy: 'Household microdata',
  core: 'Mandatory indicators (core)',
  optional: 'Optional indicators',
}

/**
 * Temporary grants are re-discovered, never remembered.
 *
 * Grants expire and are revoked outside the Hub, so anything kept across a
 * reload would be a claim about access the Hub is not entitled to make. The
 * list is refreshed on mount, when the tab regains focus, and on demand, and it
 * is dropped the moment the session ends.
 */
function useMicrodataGrants() {
  const auth = useAuth()
  const [discovery, setDiscovery] = useState<GrantDiscovery>()
  const [checking, setChecking] = useState(false)
  const runId = useRef(0)

  const check = useCallback(async () => {
    if (auth.status !== 'authenticated') {
      setDiscovery(undefined)
      return
    }
    const run = ++runId.current
    setChecking(true)
    try {
      const result = await fetchCurrentUserMicrodataGrants(auth.requestProtected)
      if (runId.current === run) setDiscovery(result)
    } catch (error) {
      if (runId.current === run) {
        setDiscovery({ bundles: [], source: 'none', error: (error as Error)?.message || 'Access could not be checked.' })
      }
    } finally {
      if (runId.current === run) setChecking(false)
    }
  }, [auth.requestProtected, auth.status])

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      runId.current += 1
      setDiscovery(undefined)
      setChecking(false)
      return
    }
    void check()
  }, [auth.status, check])

  // A grant can be revoked while the tab sits in the background. Re-checking on
  // focus means the workspace does not keep offering something that has gone.
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const onFocus = () => { void check() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [auth.status, check])

  return { discovery, checking, check }
}

function SupportingDocument({ resource }: { resource: ProtectedDataResource }) {
  return (
    <a className="grant-doc" href={authoritativeResourceUrl({ ...resource, access: 'available' })} target="_blank" rel="noreferrer">
      <strong>{resource.fallbackTitle}</strong>
      <span>{resource.description}</span>
    </a>
  )
}

function GrantBundleCard({ bundle }: { bundle: GrantBundle }) {
  const generation = GENERATIONS[bundle.questionnaireVersion]
  return (
    <article className="grant-bundle">
      <header>
        <span className="generation-badge">{generation.label}</span>
        <div>
          <h3>{generation.name}</h3>
          <span className="grant-bundle-scope">{describeSurveyScope(bundle.surveyScope)}</span>
        </div>
        <span className={bundle.status === 'active' ? 'grant-status grant-status--active' : 'grant-status'}>
          {bundle.status === 'active' ? 'Active' : 'No longer available'}
        </span>
      </header>

      <ul className="grant-views">
        {bundle.views.map((view) => (
          <li key={view.itemId}>
            <div>
              <strong>{COMPONENT_LABELS[view.component]}</strong>
              <span>{view.title}</span>
            </div>
            <Link className="data-resource-action" to={`/data/grants/${view.itemId}`}>Explore data</Link>
          </li>
        ))}
      </ul>

      {bundle.joinKeys.length > 0 && (
        <p className="grant-note">
          The two {generation.label} components describe the same households and join on{' '}
          <code>{bundle.joinKeys.join(' + ')}</code>.
        </p>
      )}

      <p className="grant-note grant-note--policy">{describeExportPolicy(bundle)}</p>

      <div className="grant-docs">
        <h4>Documentation for {generation.label}</h4>
        {bundle.documentation.length
          ? bundle.documentation.map((resource) => <SupportingDocument resource={resource} key={resource.id} />)
          : (
            <p className="grant-doc-pending">
              {generation.label} documentation is not yet published on the Hub. Field descriptions, the codebook and the
              detailed metadata are produced alongside the questionnaire and released with the first {generation.label}{' '}
              survey. Documentation for earlier generations does not describe this field set and is not a substitute.
            </p>
          )}
      </div>
    </article>
  )
}

export function TemporaryMicrodataGrants() {
  const { discovery, checking, check } = useMicrodataGrants()

  // Most signed-in users have no temporary grant and never will: the ordinary
  // route to microdata is FAM or a request. Telling them they have no access
  // invents a lack where there was no expectation, so the section is simply
  // absent until there is something of theirs to show. That also means a
  // revoked or expired grant leaves nothing behind rather than a notice.
  if (!discovery?.bundles.length) return null

  return (
    <section className="grant-section" aria-labelledby="temporary-microdata-heading">
      <div className="grant-section-head">
        <div>
          <span className="kicker">Approved for your account</span>
          <h3 id="temporary-microdata-heading">Your temporary microdata access</h3>
          <p>
            Microdata views approved for your account for a limited period, restricted to the exact surveys in your
            request. Access is granted and withdrawn in ArcGIS, so this list is checked again every time you open the
            page.
          </p>
        </div>
        <button type="button" onClick={() => void check()} disabled={checking}>
          {checking ? 'Checking...' : 'Check access again'}
        </button>
      </div>

      <div className="grant-bundles">
        {discovery.bundles.map((bundle) => <GrantBundleCard bundle={bundle} key={bundle.key} />)}
      </div>
    </section>
  )
}
