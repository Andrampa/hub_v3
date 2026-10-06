import { countryDefinition } from './countries'
import { deepLinkFields, definitionForGrantView, fetchGrantDatasetDefinition } from './dataExplorer'
import { fetchValidatedSurveyKeys } from './monitoring'
import { type GrantBundle, type ResolvedGrantView } from './microdataGrants'
import { MICRODATA_RESOURCES, type ProtectedRequester } from './protectedData'
import { discoverMicrodataMasterSurveys, surveyKey, type AvailableSurvey, type SurveyDiscoveryResult } from './surveyAccess'
import { isWithheld, visibilityClause, withVisibility } from './visibility'

export type MicrodataComponent = 'household' | 'mandatory' | 'optional'

export interface MicrodataSurveyComponent {
  component: MicrodataComponent
  source: 'master' | 'grant'
  grantId?: string
  itemId: string
  layerUrl: string
  countryField: string
  roundField: string
  visibilityWhere?: string
  bulkExportEnabled: boolean
}

export interface MicrodataSurvey {
  key: string
  generation: AvailableSurvey['generation']
  adm0Iso3: string
  countryName: string
  round: number
  testData: boolean
  components: MicrodataSurveyComponent[]
}

export interface MicrodataAccessResult {
  surveys: MicrodataSurvey[]
  master: SurveyDiscoveryResult
  grantCheckFailed: boolean
  grantIssues: GrantDiscoveryIssue[]
}

export interface GrantDiscoveryIssue {
  itemId: string
  surveyKey?: string
  reason: 'register-unavailable' | 'unreadable' | 'changed' | 'missing-fields' | 'query-failed'
}

function componentForMaster(itemId: string, generation: AvailableSurvey['generation']): MicrodataComponent {
  const resource = MICRODATA_RESOURCES.find((entry) => entry.id === itemId && entry.version === generation)
  if (!resource?.microdataComponent) throw new Error('The microdata resource has no configured component.')
  return resource.microdataComponent
}

function componentForGrant(view: ResolvedGrantView): MicrodataComponent {
  return view.component === 'legacy' ? 'household' : view.component === 'core' ? 'mandatory' : 'optional'
}

/** A metadata scope is only a candidate. Confirm rows using the same visibility clause as the explorer. */
export async function confirmGrantSurveyComponents(
  bundles: GrantBundle[],
  requester: ProtectedRequester,
  options: { contributor: boolean; includeTestData: boolean; validatedSurveys?: Set<string> | null; signal?: AbortSignal; reuseDiscoveryDefinitions?: boolean },
  loadDefinition = fetchGrantDatasetDefinition,
): Promise<{ surveys: MicrodataSurvey[]; failed: boolean; issues: GrantDiscoveryIssue[] }> {
  const results = new Map<string, MicrodataSurvey>()
  const issues: GrantDiscoveryIssue[] = []
  const validated = options.contributor ? undefined : options.validatedSurveys
  // Bound all layer and row checks across the discovery run.
  let active = 0
  const waiting: Array<() => void> = []
  const request: ProtectedRequester = async (url, params, requestOptions) => {
    if (active >= 6) await new Promise<void>((resolve) => waiting.push(resolve))
    else active += 1
    try {
      options.signal?.throwIfAborted()
      return await requester(url, params, { ...requestOptions, signal: options.signal || requestOptions?.signal })
    } finally {
      const next = waiting.shift()
      if (next) next()
      else active -= 1
    }
  }

  await Promise.all(bundles.map(async (bundle) => {
    options.signal?.throwIfAborted()
    if (bundle.status !== 'active') return
    const testData = MICRODATA_RESOURCES.some((resource) => (
      resource.version === bundle.questionnaireVersion && resource.preview
    ))
    if (testData && (!options.contributor || !options.includeTestData)) return
    if (!options.contributor && validated === null) {
      for (const view of bundle.views) issues.push({ itemId: view.itemId, reason: 'register-unavailable' })
      return
    }

    await Promise.all(bundle.views.map(async (view) => {
      options.signal?.throwIfAborted()
      let definition: Awaited<ReturnType<typeof fetchGrantDatasetDefinition>>
      try {
        definition = options.reuseDiscoveryDefinitions && view.serviceDefinition
          ? await definitionForGrantView(view, request)
          : await loadDefinition(view.itemId, request)
      } catch {
        options.signal?.throwIfAborted()
        issues.push({ itemId: view.itemId, reason: 'unreadable' })
        return
      }
      // Discovery can outlive a grant change. Never use its old scope after a
      // re-resolution has returned different metadata or removed export rights.
      if (!definition.grant || definition.grant.grantId !== bundle.grantId
        || definition.grant.questionnaireVersion !== bundle.questionnaireVersion
        || definition.grant.component !== view.component) {
        issues.push({ itemId: view.itemId, reason: 'changed' })
        return
      }
      const fields = deepLinkFields(definition.layer.fields)
      if (!fields.country || !/iso3/i.test(fields.country.name) || !fields.round) {
        issues.push({ itemId: view.itemId, reason: 'missing-fields' })
        return
      }
      const visibilityWhere = visibilityClause(definition.layer, options.contributor, 'microdata', definition.resource.releaseFiltered)
      if (isWithheld(visibilityWhere)) return

      const grant = definition.grant
      const countryField = fields.country.name
      const roundField = fields.round.name
      await Promise.all(grant.surveyScope.map(async (scope) => {
        options.signal?.throwIfAborted()
        if (validated && !validated.has(`${scope.adm0_iso3}:${scope.round}`)) return
        const where = withVisibility(
          `${countryField} = '${scope.adm0_iso3.replaceAll("'", "''")}' AND ${roundField} = ${scope.round}`,
          visibilityWhere,
        )
        try {
          const response = await request<{ features?: unknown[] }>(`${definition.layerUrl}/query`, {
            where, outFields: countryField, resultRecordCount: '1', returnGeometry: 'false',
          })
          if (!response.features?.length) return
          const key = surveyKey(bundle.questionnaireVersion, scope.adm0_iso3, scope.round)
          let survey = results.get(key)
          if (!survey) {
            survey = {
              key, generation: bundle.questionnaireVersion, adm0Iso3: scope.adm0_iso3,
              countryName: countryDefinition(scope.adm0_iso3).name, round: scope.round,
              testData, components: [],
            }
            results.set(key, survey)
          }
          survey.components.push({
            component: componentForGrant(view), source: 'grant', itemId: view.itemId,
            grantId: grant.grantId,
            layerUrl: definition.layerUrl, countryField: countryField,
            roundField: roundField, visibilityWhere,
            bulkExportEnabled: grant.bulkExportEnabled,
          })
        } catch {
          options.signal?.throwIfAborted()
          issues.push({ itemId: view.itemId,
            surveyKey: surveyKey(bundle.questionnaireVersion, scope.adm0_iso3, scope.round),
            reason: 'query-failed' })
        }
      }))
    }))
  }))

  return { surveys: [...results.values()], failed: issues.length > 0, issues }
}

const COMPONENT_ORDER: Record<MicrodataComponent, number> = { household: 0, mandatory: 1, optional: 2 }

function compareComponents(a: MicrodataSurveyComponent, b: MicrodataSurveyComponent) {
  return Number(b.bulkExportEnabled) - Number(a.bulkExportEnabled)
    || Number(b.source === 'grant') - Number(a.source === 'grant')
    || (a.grantId || '').localeCompare(b.grantId || '') || a.itemId.localeCompare(b.itemId)
}
function sameSource(a: MicrodataSurveyComponent, b: MicrodataSurveyComponent) {
  return a.source === b.source && (a.source === 'master' || Boolean(a.grantId && a.grantId === b.grantId))
}

/** Stable across response and component order; includes the full selected-source contract. */
export function microdataSourceFingerprint(surveys: MicrodataSurvey[]) {
  return JSON.stringify(surveys.flatMap((survey) => survey.components.map((part) => JSON.stringify([
    survey.key, part.component, part.source, part.grantId || '', part.itemId, part.layerUrl,
    part.countryField, part.roundField, part.visibilityWhere || '', part.bulkExportEnabled,
  ]))).sort())
}

/** Prefer exportable grants by stable IDs, and keep V3 mandatory/optional sources compatible. */
export function mergeMicrodataSurveys(master: SurveyDiscoveryResult, grants: MicrodataSurvey[]): MicrodataSurvey[] {
  const merged = new Map<string, MicrodataSurvey>()
  for (const survey of master.surveys) {
    merged.set(survey.key, {
      key: survey.key, generation: survey.generation, adm0Iso3: survey.adm0Iso3,
      countryName: survey.countryName, round: survey.round, testData: survey.testData,
      components: survey.themes.map((theme) => ({
        component: componentForMaster(theme.resourceId, survey.generation), source: 'master',
        itemId: theme.resourceId, layerUrl: theme.layerUrl, countryField: theme.countryField,
        roundField: theme.roundField, visibilityWhere: theme.visibilityWhere, bulkExportEnabled: true,
      })),
    })
  }
  for (const survey of grants) {
    const existing = merged.get(survey.key)
    if (existing) existing.components.push(...survey.components)
    else merged.set(survey.key, { ...survey, components: [...survey.components] })
  }
  for (const survey of merged.values()) {
    const candidates = [...survey.components].sort(compareComponents)
    if (survey.generation === 'v3') {
      const mandatory = candidates.filter((part) => part.component === 'mandatory')
      const optional = candidates.filter((part) => part.component === 'optional')
      const paired = mandatory.find((core) => core.bulkExportEnabled && optional.some((part) => part.bulkExportEnabled && sameSource(core, part)))
      const core = paired || mandatory[0]
      const extra = core && optional.find((part) => sameSource(core, part))
      survey.components = core ? [core, ...(extra ? [extra] : [])] : []
    } else {
      const household = candidates.find((part) => part.component === 'household')
      survey.components = household ? [household] : []
    }
    survey.components.sort((a, b) => COMPONENT_ORDER[a.component] - COMPONENT_ORDER[b.component])
  }
  return [...merged.values()].filter((survey) => survey.components.length > 0)
    .sort((a, b) => a.countryName.localeCompare(b.countryName) || a.round - b.round || a.generation.localeCompare(b.generation))
}

export async function discoverMicrodataAccess(
  requester: ProtectedRequester,
  bundles: GrantBundle[] | Promise<GrantBundle[]>,
  options: { contributor: boolean; householdData: boolean; includeTestData: boolean; signal?: AbortSignal; reuseDiscoveryDefinitions?: boolean },
): Promise<MicrodataAccessResult> {
  const request: ProtectedRequester = <T,>(url: string, params?: Record<string, unknown>, requestOptions?: Parameters<ProtectedRequester>[2]) => (
    requester<T>(url, params, { ...requestOptions, signal: options.signal || requestOptions?.signal })
  )
  const validated = options.contributor ? undefined : await fetchValidatedSurveyKeys().catch(() => null)
  options.signal?.throwIfAborted()
  const master = options.householdData
    ? discoverMicrodataMasterSurveys(request, { ...options, validatedSurveys: validated })
    : { status: 'unavailable', surveys: [], sources: [], pendingSourceCount: 0,
      warningSourceCount: 0, unavailableSourceCount: 0, checkedAt: Date.now() } as SurveyDiscoveryResult
  const grantResult = Promise.resolve(bundles).then((resolved) => confirmGrantSurveyComponents(resolved, request, {
    contributor: options.contributor, includeTestData: options.includeTestData,
    validatedSurveys: validated, signal: options.signal, reuseDiscoveryDefinitions: options.reuseDiscoveryDefinitions,
  }))
  const [resolvedMaster, resolvedGrants] = await Promise.all([master, grantResult])
  options.signal?.throwIfAborted()
  return {
    surveys: mergeMicrodataSurveys(resolvedMaster, resolvedGrants.surveys), master: resolvedMaster,
    grantCheckFailed: resolvedGrants.failed,
    grantIssues: resolvedGrants.issues,
  }
}
