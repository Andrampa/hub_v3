import { type GrantDiscovery } from '../services/microdataGrants'

/**
 * One line naming the microdata access held, with a re-check. Scope, export
 * policy and table links are not repeated here: the survey list states each
 * survey's export status and carries the Explore links an explore-only grant
 * needs (see MicrodataPackagePicker).
 */
export function MicrodataAccessSummary({ discovery, checking, householdData, recheck }: {
  discovery?: GrantDiscovery; checking: boolean; householdData: boolean; recheck: () => void
}) {
  const bundles = discovery?.bundles.filter((bundle) => bundle.status === 'active') || []
  const grants = new Set(bundles.map((bundle) => bundle.grantId)).size
  // Names the paths held, never "all": group membership does not prove that
  // every collection behind it opens, which the survey list itself shows.
  const access = [householdData ? 'household-data group' : '', grants ? grants + ' temporary grant' + (grants === 1 ? '' : 's') : ''].filter(Boolean).join(' and ')
  const status = discovery?.error ? 'Access could not be fully checked.' : access ? `Your microdata access: ${access}` : (checking ? 'Checking access…' : 'Request access to household microdata')
  return <div id="step-microdata" className="microdata-access-summary">
    <div className="package-actions"><span>{status}</span>
      <button type="button" disabled={checking} onClick={recheck}>{checking ? 'Re-checking access…' : 'Re-check access'}</button></div>
  </div>
}
