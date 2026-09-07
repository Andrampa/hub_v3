/**
 * Temporary, user-specific microdata grants.
 *
 * A grant is provisioned entirely outside the Hub by
 * `management/data_sharing/create_microdata_access_view.py` in the FAO
 * organization (`sjP4Ugu5s0dZWLjd`): a private single-recipient group, and one
 * server-filtered hosted view per questionnaire component. The recipient's
 * Community account is invited to that private FAO group as an external member.
 *
 * The Hub therefore never authorizes anything. It signs the user in against the
 * Community portal and then asks ArcGIS, with that identity, which restricted
 * items it can see. Every item this module returns has already been resolved by
 * ArcGIS under the user's own token; an item that stops resolving after
 * revocation or expiry simply stops appearing. Knowing a grant item ID is
 * worthless, because the same ArcGIS check runs on every subsequent query.
 *
 * Nothing here is cached beyond the caller's React state, and no grant metadata
 * is ever written to storage: a revoked grant must not survive a reload.
 */
import { DOCUMENTATION_RESOURCES, resourcesForGeneration, type DataGeneration, type ProtectedDataResource, type ProtectedRequester } from './protectedData'

/**
 * Grants live in the FAO organization while the user signs in to the Community
 * organization, so discovery cannot go through the Community portal's own
 * search. The global AGOL endpoint honours the same token and returns whatever
 * that identity can actually see, across organizations.
 */
export const GLOBAL_REST = 'https://www.arcgis.com/sharing/rest'

/** Written to every managed grant view by the provisioning script. */
export const ACCESS_TAG = 'DIEM restricted microdata'
/** Written to the private single-recipient group, not to the views. */
export const GRANT_GROUP_TAG = 'DIEM restricted microdata grant'

const COMPONENT_TAG_PREFIX = 'diem-microdata-component-'
const GRANT_ID_TAG_PREFIX = 'diem-microdata-grant-'

export type GrantComponent = 'legacy' | 'core' | 'optional'

export interface SurveyScopeEntry {
  adm0_iso3: string
  round: number
}

export interface GrantItemMetadata {
  schemaVersion: number
  grantId: string
  questionnaireVersion: DataGeneration
  component: GrantComponent
  surveyScope: SurveyScopeEntry[]
}

export interface GrantArcGISItem {
  id: string
  title: string
  type: string
  owner: string
  url?: string
  modified?: number
  tags?: string[]
  description?: string
  properties?: unknown
}

export interface ResolvedGrantView extends GrantItemMetadata {
  itemId: string
  title: string
  serviceUrl?: string
  /**
   * True only when ArcGIS reports the `Extract` capability on the view. This is
   * the bulk-export switch the provisioning script sets from `--allow-export`;
   * it is not, and must never be described as, a guarantee that an authorized
   * technical user cannot read the rows.
   */
  bulkExportEnabled: boolean
}

export type GrantBundleStatus = 'active' | 'unavailable'

export interface GrantBundle {
  /** Stable per (grant, questionnaire version) — one request may span versions. */
  key: string
  grantId: string
  questionnaireVersion: DataGeneration
  surveyScope: SurveyScopeEntry[]
  views: ResolvedGrantView[]
  documentation: ProtectedDataResource[]
  status: GrantBundleStatus
  bulkExportEnabled: boolean
  /** V3 core and optional views join on these fields. Empty for V1/V2. */
  joinKeys: string[]
}

export interface GrantDiscovery {
  bundles: GrantBundle[]
  /** How the items were found, so live cross-org acceptance can be verified. */
  source: GrantDiscoverySource
  /** Set when discovery itself failed, as distinct from finding no grants. */
  error?: string
}

/**
 * Which path produced the candidates, recorded for live acceptance testing.
 *
 * `groups` is the designed path. `search` alone means group membership did not
 * surface the grant, which is worth knowing during the cross-organization test.
 */
export type GrantDiscoverySource = 'groups' | 'search' | 'groups+search' | 'none'

const KNOWN_COMPONENTS: GrantComponent[] = ['legacy', 'core', 'optional']
const KNOWN_VERSIONS: DataGeneration[] = ['v1', 'v2', 'v3']

/**
 * Schema versions of `properties.diemRestrictedMicrodata` this Hub understands.
 *
 * A future provisioning release may change what the fields mean. Reading an
 * unknown schema as though it were this one could show the wrong survey scope
 * beside real microdata, so an unrecognised version is dropped rather than
 * interpreted.
 */
export const SUPPORTED_METADATA_SCHEMA_VERSIONS = [1]

/**
 * Which components a questionnaire generation is allowed to produce.
 *
 * V1 and V2 are one filtered view over the legacy master; V3 is a matched
 * core/optional pair joined on `survey_id + hh_id`. An item claiming a
 * combination the provisioning script never creates is not a grant this Hub
 * knows how to present.
 */
const COMPONENTS_BY_VERSION: Record<DataGeneration, GrantComponent[]> = {
  v1: ['legacy'],
  v2: ['legacy'],
  v3: ['core', 'optional'],
}

function tagValue(tags: string[] | undefined, prefix: string) {
  const match = (tags || []).find((tag) => tag.toLowerCase().startsWith(prefix))
  return match ? match.slice(prefix.length) : undefined
}

export function hasRestrictedMicrodataTag(tags: string[] | undefined) {
  const wanted = ACCESS_TAG.toLowerCase()
  return (tags || []).some((tag) => String(tag).trim().toLowerCase() === wanted)
}

function readSurveyScope(value: unknown): SurveyScopeEntry[] {
  if (!Array.isArray(value)) return []
  const scope: SurveyScopeEntry[] = []
  for (const entry of value) {
    const record = entry as { adm0_iso3?: unknown; round?: unknown }
    const iso = String(record?.adm0_iso3 ?? '').trim().toUpperCase()
    const round = Number(record?.round)
    if (iso && Number.isFinite(round)) scope.push({ adm0_iso3: iso, round })
  }
  return scope
}

/**
 * Item `properties` is the contract; tags are the fallback.
 *
 * The provisioning script writes both, but `properties` is only returned by a
 * full item fetch, while a search result may carry tags alone. Reading either
 * keeps discovery candidates cheap, and every candidate is re-fetched — with
 * its `properties` block — before it is shown or queried.
 *
 * Validation is deliberately strict. An item that cannot be read confidently is
 * dropped rather than guessed at: presenting the wrong questionnaire
 * generation, the wrong component or the wrong survey scope beside real
 * microdata is worse than not listing it at all.
 */
export function parseGrantMetadata(item: GrantArcGISItem): GrantItemMetadata | null {
  if (!hasRestrictedMicrodataTag(item.tags)) return null

  const container = item.properties as { diemRestrictedMicrodata?: Record<string, unknown> } | undefined
  const managed = container?.diemRestrictedMicrodata

  // Absent only on a tag-only search candidate, where the default is this
  // module's own contract version; present, it has to be one this Hub reads.
  const schemaVersion = managed ? Number(managed.schemaVersion) : SUPPORTED_METADATA_SCHEMA_VERSIONS[0]
  if (!SUPPORTED_METADATA_SCHEMA_VERSIONS.includes(schemaVersion)) return null

  const grantId = String(managed?.grantId ?? tagValue(item.tags, GRANT_ID_TAG_PREFIX) ?? '').trim()
  const rawComponent = String(managed?.component ?? tagValue(item.tags, COMPONENT_TAG_PREFIX) ?? '').trim().toLowerCase()
  const rawVersion = String(managed?.questionnaireVersion ?? '').trim().toLowerCase()
    || (item.tags || []).map((tag) => tag.trim().toLowerCase()).find((tag) => /^diem v[123]$/.test(tag))?.slice(5)
    || ''

  const component = KNOWN_COMPONENTS.find((known) => known === rawComponent)
  const questionnaireVersion = KNOWN_VERSIONS.find((known) => known === rawVersion)

  if (!grantId || !component || !questionnaireVersion) return null
  if (!COMPONENTS_BY_VERSION[questionnaireVersion].includes(component)) return null

  // The scope is what the user is told they were approved for, so a managed
  // block that carries none is incomplete rather than unrestricted. A tag-only
  // candidate has no scope to carry and is allowed through; it is re-read from
  // the full item, which does carry the block, before anything is shown.
  const surveyScope = readSurveyScope(managed?.surveyScope)
  if (managed && !surveyScope.length) return null

  return { schemaVersion, grantId, questionnaireVersion, component, surveyScope }
}

interface SearchResponse {
  results?: GrantArcGISItem[]
  total?: number
}

interface SelfGroups {
  groups?: Array<{ id?: string; tags?: string[] }>
}

/**
 * Supplementary sweep: ask ArcGIS globally, with the user's own token, for
 * managed grant views.
 *
 * The search is deliberately unfiltered by organization, because the items are
 * FAO property and the signed-in identity is a Community account. It is second,
 * not first: a cross-organization search over an externally shared, freshly
 * created private item depends on index timing and on how ArcGIS scopes the
 * query, neither of which the Hub controls. It runs anyway so that a grant
 * reachable only through the index is still found.
 */
async function searchGrantItems(requester: ProtectedRequester): Promise<GrantArcGISItem[]> {
  const response = await requester<SearchResponse>(`${GLOBAL_REST}/search`, {
    q: `tags:"${ACCESS_TAG}"`,
    num: 100,
    sortField: 'modified',
    sortOrder: 'desc',
  })
  return (response.results || []).filter((item) => hasRestrictedMicrodataTag(item.tags))
}

/** Exact-tag match on a group the provisioning script created. */
export function isGrantGroup(tags: string[] | undefined) {
  const wanted = GRANT_GROUP_TAG.toLowerCase()
  return (tags || []).some((tag) => String(tag).trim().toLowerCase() === wanted)
}

/**
 * The primary discovery path: the memberships this identity actually holds.
 *
 * A grant is only reachable once its recipient has accepted the invitation to
 * the private FAO group, so membership in a group carrying the exact
 * `DIEM restricted microdata grant` tag is the fact the whole feature turns on.
 * Reading that group's content asks ArcGIS directly rather than through a
 * search index, which is what makes it reliable for externally shared,
 * FAO-owned items that a Community identity reaches across an organization
 * boundary.
 *
 * Only script-managed groups are walked. A group without the exact tag is
 * skipped entirely, so an ordinary DIEM group the user belongs to is never
 * scanned for microdata.
 */
async function enumerateGrantItems(requester: ProtectedRequester): Promise<GrantArcGISItem[]> {
  const self = await requester<SelfGroups>(`${GLOBAL_REST}/community/self`)
  const grantGroups = (self.groups || []).filter((group) => isGrantGroup(group.tags))

  const pages = await Promise.all(grantGroups.map(async (group) => {
    if (!group.id) return []
    try {
      const page = await requester<SearchResponse>(`${GLOBAL_REST}/content/groups/${group.id}/search`, { num: 100 })
      return page.results || []
    } catch {
      // A group that cannot be read is a group whose grant is gone. Silence is
      // the correct presentation; the item simply never appears.
      return []
    }
  }))

  return pages.flat().filter((item) => hasRestrictedMicrodataTag(item.tags))
}

interface ServiceDefinition {
  capabilities?: string
}

/**
 * Re-resolve one item against ArcGIS immediately before it is shown or used.
 *
 * This is the authorization check. Discovery may be stale — an index entry, a
 * value in React state — but this call is not: after the expiry worker deletes
 * the view, or a suspension unshares it, this throws and the grant disappears
 * from the workspace.
 */
export async function resolveGrantView(
  itemId: string,
  requester: ProtectedRequester,
): Promise<ResolvedGrantView | null> {
  let item: GrantArcGISItem
  try {
    item = await requester<GrantArcGISItem>(`${GLOBAL_REST}/content/items/${itemId}`)
  } catch {
    return null
  }

  const metadata = parseGrantMetadata(item)
  if (!metadata) return null

  // `Extract` is the ArcGIS capability the provisioning script adds for
  // `--allow-export`. Absent, or unreadable, means bulk export is off.
  let bulkExportEnabled = false
  if (item.url) {
    try {
      const definition = await requester<ServiceDefinition>(item.url, {})
      bulkExportEnabled = /extract/i.test(String(definition.capabilities || ''))
    } catch {
      bulkExportEnabled = false
    }
  }

  return {
    ...metadata,
    itemId: item.id,
    title: item.title,
    serviceUrl: item.url,
    bulkExportEnabled,
  }
}

const COMPONENT_ORDER: Record<GrantComponent, number> = { legacy: 0, core: 1, optional: 2 }

/**
 * One bundle per (grant, questionnaire version).
 *
 * V1 and V2 both produce a single `legacy` view over the same legacy master, so
 * the component cannot separate them — the questionnaire version does. A
 * request approved across two generations is two complete bundles, each with
 * its own views and its own version's documentation, because their field sets
 * and codebooks are not interchangeable.
 */
export function buildGrantBundles(views: ResolvedGrantView[]): GrantBundle[] {
  const groups = new Map<string, ResolvedGrantView[]>()
  for (const view of views) {
    const key = `${view.grantId}::${view.questionnaireVersion}`
    const existing = groups.get(key)
    if (existing) existing.push(view)
    else groups.set(key, [view])
  }

  return [...groups.entries()]
    .map(([key, bundleViews]) => {
      const sorted = [...bundleViews].sort((a, b) => COMPONENT_ORDER[a.component] - COMPONENT_ORDER[b.component])
      const first = sorted[0]
      const version = first.questionnaireVersion

      // The scope is identical across a grant's views by construction, but read
      // the richest one rather than assuming, so a partially-written item never
      // silently narrows what the user is told they were approved for.
      const surveyScope = sorted.reduce<SurveyScopeEntry[]>(
        (widest, view) => (view.surveyScope.length > widest.length ? view.surveyScope : widest),
        [],
      )

      return {
        key,
        grantId: first.grantId,
        questionnaireVersion: version,
        surveyScope,
        views: sorted,
        documentation: resourcesForGeneration(DOCUMENTATION_RESOURCES, version),
        status: 'active' as GrantBundleStatus,
        // Export is a per-grant approval, so a bundle offers it only when every
        // one of its views carries it.
        bulkExportEnabled: sorted.every((view) => view.bulkExportEnabled),
        joinKeys: version === 'v3' ? ['survey_id', 'hh_id'] : [],
      }
    })
    .sort((a, b) => a.grantId.localeCompare(b.grantId) || a.questionnaireVersion.localeCompare(b.questionnaireVersion))
}

/**
 * Discover and resolve every temporary grant the signed-in identity holds.
 *
 * Group membership is the primary path and the index search is a supplement;
 * the two run together and their candidates are merged. Neither is an
 * authorization decision — both converge on the same per-item re-resolution,
 * which is where ArcGIS decides. Discovery only ever narrows what is asked
 * about, so a broader sweep cannot reveal anything the token could not already
 * reach.
 *
 * The group path failing is a real failure to report; the search path failing
 * is not, because it was never expected to carry the feature on its own.
 */
export async function fetchCurrentUserMicrodataGrants(
  requester: ProtectedRequester,
): Promise<GrantDiscovery> {
  const [grouped, searched] = await Promise.all([
    enumerateGrantItems(requester).then(
      (items) => ({ items, error: undefined as Error | undefined }),
      (error: Error) => ({ items: [] as GrantArcGISItem[], error }),
    ),
    searchGrantItems(requester).then(
      (items) => ({ items, error: undefined as Error | undefined }),
      (error: Error) => ({ items: [] as GrantArcGISItem[], error }),
    ),
  ])

  if (grouped.error && searched.error) {
    return {
      bundles: [],
      source: 'none',
      error: grouped.error.message || 'Access could not be checked.',
    }
  }

  const groupedIds = new Set(grouped.items.map((item) => item.id))
  const searchOnly = searched.items.filter((item) => !groupedIds.has(item.id))
  const source: GrantDiscoverySource = grouped.items.length && searchOnly.length ? 'groups+search'
    : grouped.items.length ? 'groups'
    : searchOnly.length ? 'search'
    : 'none'

  const candidates = [...grouped.items, ...searchOnly]
  const uniqueIds = [...new Set(candidates.map((item) => item.id).filter(Boolean))]
  const resolved = await Promise.all(uniqueIds.map((id) => resolveGrantView(id, requester)))
  const views = resolved.filter((view): view is ResolvedGrantView => view !== null)

  return { bundles: buildGrantBundles(views), source }
}

/**
 * Confirm one grant item is still live before opening or exporting it.
 *
 * The explorer calls this on entry and again before any download. It is not a
 * security boundary — ArcGIS rejects the underlying query regardless — but it
 * keeps the Hub from presenting a dead grant as though it still worked.
 */
export async function confirmGrantStillActive(
  itemId: string,
  requester: ProtectedRequester,
): Promise<ResolvedGrantView | null> {
  return resolveGrantView(itemId, requester)
}

export function describeSurveyScope(scope: SurveyScopeEntry[]) {
  if (!scope.length) return 'Survey scope is recorded on the view definition.'
  return scope.map((entry) => `${entry.adm0_iso3} round ${entry.round}`).join(', ')
}

/**
 * Deliberately worded as a statement about bulk export, not about retrieval.
 *
 * A Query-enabled view can still be read record by record by an authorized
 * technical user, so claiming the data "cannot be downloaded" would be false.
 */
export function describeExportPolicy(bundle: GrantBundle) {
  return bundle.bulkExportEnabled
    ? 'Bulk export is enabled for this grant.'
    : 'Bulk export is not enabled for this grant.'
}

/**
 * Grant access changing inside this page, rather than between page loads.
 *
 * Accepting an invitation makes a grant discoverable seconds later, and asking
 * the user to restart the browser to see it would be a poor answer to an act
 * they just performed in the Hub. Listeners re-run discovery; the module holds
 * no grant state of its own, so there is nothing to invalidate.
 */
const accessChangeListeners = new Set<() => void>()

export function onGrantAccessChanged(listener: () => void) {
  accessChangeListeners.add(listener)
  return () => { accessChangeListeners.delete(listener) }
}

export function notifyGrantAccessChanged() {
  for (const listener of [...accessChangeListeners]) listener()
}
