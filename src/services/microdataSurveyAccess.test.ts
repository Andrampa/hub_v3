import { describe, expect, it, vi } from 'vitest'
import type { DatasetDefinition } from './dataExplorer'
import type { GrantBundle, ResolvedGrantView } from './microdataGrants'
import type { ProtectedRequester } from './protectedData'
import type { SurveyDiscoveryResult } from './surveyAccess'
import { confirmGrantSurveyComponents, mergeMicrodataSurveys, microdataSourceFingerprint } from './microdataSurveyAccess'

function view(component: ResolvedGrantView['component'] = 'legacy', version: ResolvedGrantView['questionnaireVersion'] = 'v2'): ResolvedGrantView {
  return {
    schemaVersion: 1, grantId: 'grant-private', questionnaireVersion: version,
    component, surveyScope: [{ adm0_iso3: 'NGA', round: 8 }, { adm0_iso3: 'COD', round: 12 }],
    itemId: `${component}-item`, title: 'Approved view', bulkExportEnabled: true,
  }
}

function bundle(grantView = view()): GrantBundle {
  return {
    key: `grant-private::${grantView.questionnaireVersion}`, grantId: 'grant-private',
    questionnaireVersion: grantView.questionnaireVersion, surveyScope: grantView.surveyScope,
    views: [grantView], documentation: [], status: 'active',
    bulkExportEnabled: true, joinKeys: [],
  }
}

function definition(grantView: ResolvedGrantView, withFlag = true): DatasetDefinition {
  return {
    resource: {
      id: grantView.itemId, version: grantView.questionnaireVersion,
      fallbackTitle: 'Household', description: '', kind: 'microdata', access: 'available',
    },
    serviceUrl: 'https://example.test/FeatureServer',
    layerUrl: 'https://example.test/FeatureServer/0', isTable: true,
    layer: {
      id: 0, name: 'household', fields: [
        { name: 'adm0_iso3', alias: 'ISO3', type: 'esriFieldTypeString' },
        { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
        ...(withFlag ? [{ name: 'opendata', alias: 'Released', type: 'esriFieldTypeSmallInteger' }] : []),
      ],
    },
    grant: grantView,
  }
}

const emptyMaster: SurveyDiscoveryResult = {
  status: 'unavailable', surveys: [], sources: [], pendingSourceCount: 0,
  warningSourceCount: 0, unavailableSourceCount: 0, checkedAt: 0,
}

describe('microdata grant survey confirmation', () => {
  it('does not turn approved scope into a survey when an unflagged view is withheld', async () => {
    const grantView = view()
    const query = vi.fn().mockResolvedValue({ features: [{ attributes: {} }] })
    const result = await confirmGrantSurveyComponents(
      [bundle(grantView)], query as ProtectedRequester,
      { contributor: false, includeTestData: false, validatedSurveys: new Set(['NGA:8']) },
      async () => definition(grantView, false),
    )
    expect(result.surveys).toEqual([])
    expect(query).not.toHaveBeenCalled()
  })

  it('confirms only validated, visible rows and carries the exact row-level clause', async () => {
    const grantView = view()
    const query = vi.fn().mockResolvedValue({ features: [{ attributes: {} }] })
    const result = await confirmGrantSurveyComponents(
      [bundle(grantView)], query as ProtectedRequester,
      { contributor: false, includeTestData: false, validatedSurveys: new Set(['NGA:8']) },
      async () => definition(grantView),
    )
    expect(result.surveys.map((survey) => survey.key)).toEqual(['v2:NGA:8'])
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][1].where).toBe("(adm0_iso3 = 'NGA' AND round = 8) AND opendata = 1")
    expect(query.mock.calls[0][1].resultRecordCount).toBe('1')
  })

  it('requires Contributor test mode for V3 and a mandatory component', async () => {
    const optionalView = view('optional', 'v3')
    const query = vi.fn().mockResolvedValue({ features: [{ attributes: {} }] })
    const load = async () => definition(optionalView, false)
    const hidden = await confirmGrantSurveyComponents(
      [bundle(optionalView)], query as ProtectedRequester,
      { contributor: false, includeTestData: true, validatedSurveys: new Set(['NGA:8']) }, load,
    )
    expect(hidden.surveys).toEqual([])
    const test = await confirmGrantSurveyComponents(
      [bundle(optionalView)], query as ProtectedRequester,
      { contributor: true, includeTestData: true }, load,
    )
    expect(test.surveys).toHaveLength(2)
    expect(mergeMicrodataSurveys(emptyMaster, test.surveys)).toEqual([])
  })

  it('prefers an export-enabled grant over an independently accessible master component', () => {
    const master: SurveyDiscoveryResult = {
      ...emptyMaster, status: 'complete', surveys: [{
        key: 'v2:NGA:8', generation: 'v2', adm0Iso3: 'NGA', countryName: 'Nigeria',
        round: 8, testData: false, themes: [{
          id: 'household', label: 'Household', resourceId: '2d15e5b7768949b4905e452fcc5e0440', generation: 'v2',
          layerId: 0, layerName: 'table', layerUrl: 'https://example.test/master/0',
          countryField: 'adm0_iso3', roundField: 'round', testData: false,
        }],
      }],
    }
    const grantComponent = {
      component: 'household' as const, source: 'grant' as const, itemId: 'grant-item',
      layerUrl: 'https://example.test/grant/0', countryField: 'adm0_iso3',
      roundField: 'round', bulkExportEnabled: true,
    }
    const grantSurvey = {
      key: 'v2:NGA:8', generation: 'v2' as const, adm0Iso3: 'NGA',
      countryName: 'Nigeria', round: 8, testData: false, components: [grantComponent],
    }
    expect(mergeMicrodataSurveys(master, [grantSurvey])[0].components[0].source).toBe('grant')
    grantComponent.bulkExportEnabled = false
    expect(mergeMicrodataSurveys(master, [grantSurvey])[0].components[0].source).toBe('master')
  })

  it('reports a changed grant separately from a failed scope query', async () => {
    const grantView = view()
    const changed = await confirmGrantSurveyComponents([bundle(grantView)], vi.fn() as ProtectedRequester,
      { contributor: true, includeTestData: false },
      async () => ({ ...definition(grantView), grant: { ...grantView, grantId: 'another-grant' } }))
    expect(changed.issues).toEqual([{ itemId: grantView.itemId, reason: 'changed' }])

    const query = vi.fn().mockRejectedValue(new Error('offline'))
    const failed = await confirmGrantSurveyComponents([bundle(grantView)], query as ProtectedRequester,
      { contributor: true, includeTestData: false }, async () => definition(grantView))
    expect(failed.issues.map((issue) => issue.reason)).toEqual(['query-failed', 'query-failed'])
  })

  it('propagates cancellation instead of reporting a grant failure', async () => {
    const grantView = view()
    const controller = new AbortController()
    const query = vi.fn().mockImplementation(async () => {
      controller.abort()
      throw new Error('aborted')
    })
    await expect(confirmGrantSurveyComponents([bundle(grantView)], query as ProtectedRequester,
      { contributor: true, includeTestData: false, signal: controller.signal },
      async () => definition(grantView))).rejects.toThrow()
  })
})

it('bounds concurrent survey checks to six and checks every scope once', async () => {
  const grantView = view()
  grantView.surveyScope = Array.from({ length: 20 }, (_, index) => ({ adm0_iso3: 'NGA', round: index + 1 }))
  let active = 0
  let peak = 0
  const query = vi.fn(async () => {
    active += 1; peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 2))
    active -= 1
    return { features: [{}] }
  })
  const result = await confirmGrantSurveyComponents([bundle(grantView)], query as ProtectedRequester,
    { contributor: true, includeTestData: false }, async () => definition(grantView))
  expect(peak).toBe(6)
  expect(query).toHaveBeenCalledTimes(20)
  expect(result.surveys).toHaveLength(20)
})

it('reuses current discovery item and service definitions while querying the layer with the active requester', async () => {
  const grantView = view()
  grantView.serviceUrl = 'https://example.test/FeatureServer'
  grantView.serviceDefinition = { tables: [{ id: 0, name: 'household' }] }
  const layer = definition(grantView).layer
  const request = vi.fn(async (url: string) => url.endsWith('/query') ? { features: [{}] } : layer)
  const result = await confirmGrantSurveyComponents([bundle(grantView)], request as ProtectedRequester, { contributor: true, includeTestData: false, reuseDiscoveryDefinitions: true })
  expect(result.surveys).toHaveLength(2)
  expect(request).toHaveBeenCalledTimes(3)
  expect(request.mock.calls.every(([url]) => url.startsWith(grantView.serviceUrl + '/0'))).toBe(true)
})

it('deduplicates overlapping grant components and keeps the export-enabled source without a master', () => {
  const survey = { key: 'v2:NGA:8', generation: 'v2' as const, adm0Iso3: 'NGA', countryName: 'Nigeria', round: 8, testData: false,
    components: [{ component: 'household' as const, source: 'grant' as const, itemId: 'read-only', layerUrl: 'https://example.test/0', countryField: 'adm0_iso3', roundField: 'round', bulkExportEnabled: false },
      { component: 'household' as const, source: 'grant' as const, itemId: 'export', layerUrl: 'https://example.test/1', countryField: 'adm0_iso3', roundField: 'round', bulkExportEnabled: true }] }
  const result = mergeMicrodataSurveys(emptyMaster, [survey])
  expect(result).toHaveLength(1)
  expect(result[0].components).toHaveLength(1)
  expect(result[0].components[0].itemId).toBe('export')
})

it('selects stable sources and compatible V3 pairs independent of completion order', () => {
  const base = { key: 'v3:NGA:8', generation: 'v3' as const, adm0Iso3: 'NGA', countryName: 'Nigeria', round: 8, testData: true }
  const part = (component: 'mandatory' | 'optional', grantId: string) => ({ component, grantId, source: 'grant' as const, itemId: grantId + '-' + component, layerUrl: 'https://example.test/0', countryField: 'adm0_iso3', roundField: 'round', bulkExportEnabled: true })
  const candidates = [part('mandatory', 'a-core-only'), part('optional', 'b-pair'), part('mandatory', 'b-pair')]
  const first = mergeMicrodataSurveys(emptyMaster, [{ ...base, components: candidates }])
  const reversed = mergeMicrodataSurveys(emptyMaster, [{ ...base, components: [...candidates].reverse() }])
  expect(first[0].components.map((entry) => entry.grantId)).toEqual(['b-pair', 'b-pair'])
  expect(microdataSourceFingerprint(first)).toBe(microdataSourceFingerprint(reversed))
  expect(microdataSourceFingerprint([{ ...base, components: candidates }])).toBe(microdataSourceFingerprint([{ ...base, components: [...candidates].reverse() }]))
})

it('shares the six-request limit across grants instead of checking them sequentially', async () => {
  const views = [view(), { ...view(), grantId: 'second', itemId: 'second-item' }]
  let active = 0; let peak = 0
  const visited = new Set<string>()
  const request = vi.fn(async (url: string) => {
    active += 1; peak = Math.max(peak, active); visited.add(url)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active -= 1
    return { features: [{}] }
  })
  const bundles = views.map((entry) => ({ ...bundle(entry), grantId: entry.grantId }))
  await confirmGrantSurveyComponents(bundles, request as ProtectedRequester, { contributor: true, includeTestData: false }, async (id) => {
    const entry = views.find((candidate) => candidate.itemId === id)!
    return { ...definition(entry), layerUrl: 'https://example.test/' + id }
  })
  expect(peak).toBe(4) // two surveys from each grant overlap; sequential grants peak at two
  expect(visited.size).toBe(2)
})
