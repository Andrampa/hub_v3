import { countryDefinition } from './countries'
import { deepLinkFields, fetchGrantDatasetDefinition } from './dataExplorer'
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
  options: { contributor: boolean; includeTestData: boolean; validatedSurveys?: Set<string> | null; signal?: AbortSignal },
  loadDefinition = fetchGrantDatasetDefinition,
): Promise<{ surveys: MicrodataSurvey[]; failed: boolean; issues: GrantDiscoveryIssue[] }> {
  const results = new Map<string, MicrodataSurvey>()
  const issues: GrantDiscoveryIssue[] = []
  const validated = options.contributor ? undefined : options.validatedSurveys
  const request: ProtectedRequester = (url, params, requestOptions) => requester(url, params, {
    ...requestOptions, signal: options.signal || requestOptions?.signal,
  })

  for (const bundle of bundles) {
    options.signal?.throwIfAborted()
    if (bundle.status !== 'active') continue
    const testData = MICRODATA_RESOURCES.some((resource) => (
      resource.version === bundle.questionnaireVersion && resource.preview
    ))
    if (testData && (!options.contributor || !options.includeTestData)) continue
    if (!options.contributor && validated === null) {
      for (const view of bundle.views) issues.push({ itemId: view.itemId, reason: 'register-unavailable' })
      continue
    }

    for (const view of bundle.views) {
      options.signal?.throwIfAborted()
      let definition: Awaited<ReturnType<typeof fetchGrantDatasetDefinition>>
      try {
        definition = await loadDefinition(view.itemId, request)
      } catch {
        options.signal?.throwIfAborted()
        issues.push({ itemId: view.itemId, reason: 'unreadable' })
        continue
      }
      // Discovery can outlive a grant change. Never use its old scope after a
      // re-resolution has returned different metadata or removed export rights.
      if (!definition.grant || definition.grant.grantId !== bundle.grantId
        || definition.grant.questionnaireVersion !== bundle.questionnaireVersion
        || definition.grant.component !== view.component) {
        issues.push({ itemId: view.itemId, reason: 'changed' })
        continue
      }
      const fields = deepLinkFields(definition.layer.fields)
      if (!fields.country || !/iso3/i.test(fields.country.name) || !fields.round) {
        issues.push({ itemId: view.itemId, reason: 'missing-fields' })
        continue
      }
      const visibilityWhere = visibilityClause(definition.layer, options.contributor, 'microdata', definition.resource.releaseFiltered)
      if (isWithheld(visibilityWhere)) continue

      for (const scope of definition.grant.surveyScope) {
        options.signal?.throwIfAborted()
        if (validated && !validated.has(`${scope.adm0_iso3}:${scope.round}`)) continue
        const where = withVisibility(
          `${fields.country.name} = '${scope.adm0_iso3.replaceAll("'", "''")}' AND ${fields.round.name} = ${scope.round}`,
          visibilityWhere,
        )
        try {
          const response = await request<{ features?: unknown[] }>(`${definition.layerUrl}/query`, {
            where, outFields: fields.country.name, resultRecordCount: '1', returnGeometry: 'false',
          })
          if (!response.features?.length) continue
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
            grantId: definition.grant.grantId,
            layerUrl: definition.layerUrl, countryField: fields.country.name,
            roundField: fields.round.name, visibilityWhere,
            bulkExportEnabled: definition.grant.bulkExportEnabled,
          })
        } catch {
          options.signal?.throwIfAborted()
          issues.push({ itemId: view.itemId,
            surveyKey: surveyKey(bundle.questionnaireVersion, scope.adm0_iso3, scope.round),
            reason: 'query-failed' })
        }
      }
    }
  }

  return { surveys: [...results.values()], failed: issues.length > 0, issues }
}

/** Prefer an export-enabled grant component; otherwise use an independently accessible master component. */
export function mergeMicrodataSurveys(master: SurveyDiscoveryResult, grants: MicrodataSurvey[]): MicrodataSurvey[] {
  const merged = new Map<string, MicrodataSurvey>()
  for (const survey of master.surveys) {
    merged.set(survey.key, {
      key: survey.key, generation: survey.generation, adm0Iso3: survey.adm0Iso3,
      countryName: survey.countryName, round: survey.round, testData: survey.testData,
      components: survey.themes.map((theme) => ({
        component: componentForMaster(theme.resourceId, survey.generation),
        source: 'master', itemId: theme.resourceId, layerUrl: theme.layerUrl,
        countryField: theme.countryField, roundField: theme.roundField,
        visibilityWhere: theme.visibilityWhere, bulkExportEnabled: true,
      })),
    })
  }
  for (const grantSurvey of grants) {
    const current = merged.get(grantSurvey.key)
    if (!current) {
      merged.set(grantSurvey.key, grantSurvey)
      continue
    }
    for (const component of grantSurvey.components) {
      const index = current.components.findIndex((entry) => entry.component === component.component)
      if (index < 0) current.components.push(component)
      else if (component.bulkExportEnabled) current.components[index] = component
    }
  }
  return [...merged.values()].filter((survey) => survey.components.some((component) => (
    component.component === 'household' || component.component === 'mandatory'
  ))).sort((a, b) => a.countryName.localeCompare(b.countryName)
    || a.round - b.round || a.generation.localeCompare(b.generation))
}

export async function discoverMicrodataAccess(
  requester: ProtectedRequester,
  bundles: GrantBundle[],
  options: { contributor: boolean; householdData: boolean; includeTestData: boolean; signal?: AbortSignal },
): Promise<MicrodataAccessResult> {
  const request: ProtectedRequester = <T,>(url: string, params?: Record<string, unknown>, requestOptions?: Parameters<ProtectedRequester>[2]) => (
    requester<T>(url, params, { ...requestOptions, signal: options.signal || requestOptions?.signal })
  )
  const validated = options.contributor ? undefined : await fetchValidatedSurveyKeys().catch(() => null)
  options.signal?.throwIfAborted()
  const master = options.householdData
    ? await discoverMicrodataMasterSurveys(request, { ...options, validatedSurveys: validated })
    : { status: 'unavailable', surveys: [], sources: [], pendingSourceCount: 0,
      warningSourceCount: 0, unavailableSourceCount: 0, checkedAt: Date.now() } as SurveyDiscoveryResult
  options.signal?.throwIfAborted()
  const grantResult = await confirmGrantSurveyComponents(bundles, request, {
    contributor: options.contributor, includeTestData: options.includeTestData,
    validatedSurveys: validated, signal: options.signal,
  })
  options.signal?.throwIfAborted()
  return {
    surveys: mergeMicrodataSurveys(master, grantResult.surveys), master,
    grantCheckFailed: grantResult.failed,
    grantIssues: grantResult.issues,
  }
}
