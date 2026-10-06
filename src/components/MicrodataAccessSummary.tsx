import { GENERATIONS } from '../services/protectedData'
import { Link } from 'react-router-dom'
import { describeSurveyScope, describeExportPolicy, type GrantDiscovery } from '../services/microdataGrants'

export function MicrodataAccessSummary({ discovery, checking, householdData, recheck }: {
  discovery?: GrantDiscovery; checking: boolean; householdData: boolean; recheck: () => void
}) {
  const bundles = discovery?.bundles.filter((bundle) => bundle.status === 'active') || []
  const grants = new Set(bundles.map((bundle) => bundle.grantId)).size
  const access = [householdData ? 'household collections' : '', grants ? grants + ' temporary grant' + (grants === 1 ? '' : 's') : ''].filter(Boolean).join(' · ')
  const status = discovery?.error ? 'Access could not be fully checked.' : access || (checking ? 'Checking access…' : 'Request access to household microdata')
  return <div id="step-microdata" className="microdata-access-summary">
    <div className="package-actions"><span>{status}</span>
      <button type="button" disabled={checking} onClick={recheck}>{checking ? 'Re-checking access…' : 'Re-check access'}</button></div>
    {bundles.length > 0 && <details className="microdata-help"><summary>Access details and table exploration</summary><ul className="microdata-access-list">{bundles.map((bundle) => <li key={bundle.key}>
      <strong>{GENERATIONS[bundle.questionnaireVersion].label} · {describeSurveyScope(bundle.surveyScope)}</strong>
      <p>{describeExportPolicy(bundle)}</p>
      {bundle.views.map((view) => <Link key={view.itemId} to={'/data/grants/' + view.itemId}>Explore {view.component === 'legacy' ? 'household table' : view.component === 'core' ? 'mandatory table' : 'optional table'} </Link>)}
    </li>)}</ul></details>}
  </div>
}
