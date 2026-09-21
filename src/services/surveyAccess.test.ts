import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProtectedDataResource, ProtectedRequester } from './protectedData'
import {
  clearSurveyAccessCache,
  discoverAggregatedSurveys,
  discoverSurveyAvailability,
  surveyKey,
  surveySliceWhere,
} from './surveyAccess'

function resource(
  id: string,
  version: 'v1' | 'v2' | 'v3',
  theme: string,
  preview = false,
): ProtectedDataResource {
  return {
    id,
    version,
    fallbackTitle: theme,
    description: '',
    kind: 'aggregate',
    thematicLayer: theme,
    admFamily: 'ADM1 / ADM2',
    preview,
  }
}

function requesterFor(rows: Record<string, Array<Record<string, unknown>>>, restricted = new Set<string>()) {
  const calls: Array<{ url: string; params?: Record<string, unknown> }> = []
  const request = vi.fn(async (url: string, params?: Record<string, unknown>) => {
    calls.push({ url, params })
    const itemId = /\/content\/items\/([^/]+)$/.exec(url)?.[1]
    if (itemId) {
      if (restricted.has(itemId)) throw { code: 403, message: 'Forbidden' }
      return { id: itemId, title: itemId, type: 'Feature Service', owner: 'DIEM', modified: 10, access: 'shared', url: `https://example.test/${itemId}/FeatureServer` }
    }
    const serviceId = /example\.test\/([^/]+)\/FeatureServer$/.exec(url)?.[1]
    if (serviceId) return { layers: [{ id: 0, name: `${serviceId}-layer` }] }
    const layerId = /example\.test\/([^/]+)\/FeatureServer\/0$/.exec(url)?.[1]
    if (layerId) {
      return {
        id: 0,
        name: `${layerId}-layer`,
        maxRecordCount: 2,
        fields: [
          { name: 'adm0_iso3', alias: 'Country code', type: 'esriFieldTypeString' },
          { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
          { name: 'opendata', alias: 'Released', type: 'esriFieldTypeSmallInteger' },
        ],
      }
    }
    const queryId = /example\.test\/([^/]+)\/FeatureServer\/0\/query$/.exec(url)?.[1]
    if (queryId) {
      const offset = Number(params?.resultOffset || 0)
      const pageSize = Number(params?.resultRecordCount || 2)
      const allRows = rows[queryId] || []
      return {
        features: allRows.slice(offset, offset + pageSize).map((attributes) => ({ attributes })),
        exceededTransferLimit: offset + pageSize < allRows.length,
      }
    }
    throw new Error(`Unexpected request: ${url}`)
  })
  const requester: ProtectedRequester = <T,>(url: string, params?: Record<string, unknown>) => (
    request(url, params) as Promise<T>
  )
  return { requester, calls }
}

describe('survey availability', () => {
  beforeEach(() => clearSurveyAccessCache())

  it('keys surveys by generation, ISO3 and round and merges available themes', async () => {
    const sources = [
      resource('income-v2', 'v2', 'Income and shocks'),
      resource('food-v2', 'v2', 'Food security'),
      resource('income-v1', 'v1', 'Income and shocks'),
    ]
    const { requester } = requesterFor({
      'income-v2': [{ adm0_iso3: 'nga', round: 8 }, { adm0_iso3: 'TCD', round: 2 }],
      'food-v2': [{ adm0_iso3: 'NGA', round: 8 }],
      'income-v1': [{ adm0_iso3: 'NGA', round: 8 }],
    })

    const result = await discoverSurveyAvailability(sources, requester)

    expect(result.status).toBe('complete')
    expect(result.surveys.map((survey) => survey.key)).toEqual([
      'v2:TCD:2',
      'v1:NGA:8',
      'v2:NGA:8',
    ])
    expect(result.surveys.find((survey) => survey.key === 'v2:NGA:8')?.themes).toHaveLength(2)
    expect(result.surveys.find((survey) => survey.key === 'v1:NGA:8')?.themes).toHaveLength(1)
  })

  it('continues ordered discovery when a full page omits exceededTransferLimit', async () => {
    const source = resource('paged', 'v2', 'Crop production')
    const rows = {
      paged: [
        { adm0_iso3: 'AFG', round: 1 },
        { adm0_iso3: 'AFG', round: 2 },
        { adm0_iso3: 'AFG', round: 3 },
      ],
    }
    const { requester, calls } = requesterFor(rows)

    await discoverSurveyAvailability([source], requester)

    const queryOffsets = calls
      .filter((call) => call.url.endsWith('/query'))
      .map((call) => call.params?.resultOffset)
    expect(queryOffsets).toEqual(['0', '2'])
  })

  it('keeps confirmed surveys and names inaccessible sources as a partial result', async () => {
    const sources = [
      resource('available', 'v2', 'Food security'),
      resource('restricted', 'v2', 'Crop production'),
    ]
    const { requester } = requesterFor(
      { available: [{ adm0_iso3: 'NGA', round: 8 }] },
      new Set(['restricted']),
    )

    const result = await discoverSurveyAvailability(sources, requester)

    expect(result.status).toBe('partial')
    expect(result.surveys).toHaveLength(1)
    expect(result.sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ resourceId: 'available', status: 'confirmed', surveyCount: 1 }),
      expect.objectContaining({ resourceId: 'restricted', status: 'restricted' }),
    ]))
  })

  it('excludes preview surveys unless test-data mode is explicit', async () => {
    const testSource = resource('test-v3', 'v3', 'Optional indicators', true)
    const { requester } = requesterFor({ 'test-v3': [{ adm0_iso3: 'COD', round: 99 }] })

    const production = await discoverSurveyAvailability([testSource], requester)
    const testMode = await discoverSurveyAvailability([testSource], requester, { includeTestData: true })

    expect(production.surveys).toEqual([])
    expect(production.status).toBe('unavailable')
    expect(production.sources[0]).toMatchObject({ status: 'excluded-test' })
    expect(testMode.surveys[0]).toMatchObject({ key: 'v3:COD:99', testData: true })
  })

  it('warns about malformed identities without demoting overall access status', async () => {
    const { requester } = requesterFor({ invalid: [
      { adm0_iso3: 'NGA', round: 8 },
      { adm0_iso3: 'Nigeria', round: 8 },
    ] })

    const result = await discoverSurveyAvailability(
      [resource('invalid', 'v2', 'Food security')],
      requester,
    )

    // Access was complete: every source that should have been read was read.
    expect(result.status).toBe('complete')
    expect(result.warningSourceCount).toBe(1)
    expect(result.unavailableSourceCount).toBe(0)
    expect(result.surveys).toEqual([expect.objectContaining({ key: 'v2:NGA:8' })])
    expect(result.sources[0]).toMatchObject({
      status: 'confirmed-with-warnings',
      surveyCount: 1,
      malformedIdentityCount: 1,
      message: expect.stringMatching(/1 source row/i),
    })
  })

  it('drops rows with no country code silently, counting them without a warning', async () => {
    const { requester } = requesterFor({ totals: [
      { adm0_iso3: 'NGA', round: 8 },
      { adm0_iso3: null, round: 9 },
      { adm0_iso3: '   ', round: 9 },
    ] })

    const result = await discoverSurveyAvailability(
      [resource('totals', 'v2', 'Food security')],
      requester,
    )

    expect(result.status).toBe('complete')
    expect(result.warningSourceCount).toBe(0)
    expect(result.sources[0]).toMatchObject({
      status: 'confirmed',
      surveyCount: 1,
      blankIdentityCount: 2,
    })
    expect(result.sources[0].message).toBeUndefined()
  })

  it('counts unavailable sources separately from row warnings', async () => {
    const { requester } = requesterFor(
      { available: [{ adm0_iso3: 'NGA', round: 8 }, { adm0_iso3: 'Nigeria', round: 8 }] },
      new Set(['restricted']),
    )

    const result = await discoverSurveyAvailability(
      [resource('available', 'v2', 'Food security'), resource('restricted', 'v2', 'Crop production')],
      requester,
    )

    expect(result.status).toBe('partial')
    expect(result.warningSourceCount).toBe(1)
    expect(result.unavailableSourceCount).toBe(1)
  })

  it('reports confirmed surveys progressively while slower sources remain pending', async () => {
    const resolvers = new Map<string, () => void>()
    const requester: ProtectedRequester = async <T,>(url: string) => {
      const itemId = /\/content\/items\/([^/]+)$/.exec(url)?.[1]
      if (itemId) {
        if (itemId === 'slow') await new Promise<void>((resolve) => resolvers.set('slow', resolve))
        return { id: itemId, title: itemId, type: 'Feature Service', owner: 'DIEM', modified: 10, access: 'shared', url: `https://progress.test/${itemId}/FeatureServer` } as T
      }
      const serviceId = /progress\.test\/([^/]+)\/FeatureServer$/.exec(url)?.[1]
      if (serviceId) return { layers: [{ id: 0, name: serviceId }] } as T
      const layerId = /progress\.test\/([^/]+)\/FeatureServer\/0$/.exec(url)?.[1]
      if (layerId) return {
        id: 0,
        name: layerId,
        maxRecordCount: 100,
        fields: [
          { name: 'adm0_iso3', alias: 'Country code', type: 'esriFieldTypeString' },
          { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
          { name: 'opendata', alias: 'Released', type: 'esriFieldTypeSmallInteger' },
        ],
      } as T
      const queryId = /progress\.test\/([^/]+)\/FeatureServer\/0\/query$/.exec(url)?.[1]
      if (queryId) return { features: [{ attributes: { adm0_iso3: queryId === 'fast' ? 'NGA' : 'TCD', round: 1 } }] } as T
      throw new Error(`Unexpected request: ${url}`)
    }
    const progress: Array<{ surveys: number; pending: number }> = []

    const complete = discoverSurveyAvailability(
      [resource('fast', 'v2', 'Food security'), resource('slow', 'v2', 'Crop production')],
      requester,
      { onProgress: (result) => progress.push({ surveys: result.surveys.length, pending: result.pendingSourceCount }) },
    )
    await vi.waitFor(() => expect(progress).toContainEqual({ surveys: 1, pending: 1 }))
    resolvers.get('slow')?.()
    await complete

    expect(progress[0]).toEqual({ surveys: 0, pending: 2 })
    expect(progress.at(-1)).toEqual({ surveys: 2, pending: 0 })
  })

  it('throws instead of truncating when every page claims more results', async () => {
    const source = resource('endless', 'v2', 'Food security')
    let queryCalls = 0
    const requester: ProtectedRequester = async <T,>(url: string) => {
      if (url.includes('/content/items/')) return { id: source.id, title: source.id, type: 'Feature Service', owner: 'DIEM', modified: 10, access: 'shared', url: 'https://endless.test/FeatureServer' } as T
      if (url.endsWith('/FeatureServer')) return { layers: [{ id: 0, name: 'endless' }] } as T
      if (url.endsWith('/FeatureServer/0')) return {
        id: 0,
        name: 'endless',
        maxRecordCount: 2,
        fields: [
          { name: 'adm0_iso3', alias: 'Country code', type: 'esriFieldTypeString' },
          { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
          { name: 'opendata', alias: 'Released', type: 'esriFieldTypeSmallInteger' },
        ],
      } as T
      if (url.endsWith('/query')) {
        queryCalls += 1
        return {
          features: [
            { attributes: { adm0_iso3: 'NGA', round: queryCalls * 2 - 1 } },
            { attributes: { adm0_iso3: 'NGA', round: queryCalls * 2 } },
          ],
          exceededTransferLimit: true,
        } as T
      }
      throw new Error(`Unexpected request: ${url}`)
    }

    const result = await discoverSurveyAvailability([source], requester)

    expect(queryCalls).toBe(100)
    expect(result.status).toBe('failed')
    expect(result.sources[0].message).toMatch(/pagination safety limit/i)
  })
})

describe('survey access helpers', () => {
  beforeEach(() => clearSurveyAccessCache())

  it('normalizes the stable survey key', () => {
    expect(surveyKey('v2', 'nga', 8)).toBe('v2:NGA:8')
  })

  it('reuses aggregate discovery until an explicit refresh', async () => {
    const request = vi.fn(async (_url: string, _params?: Record<string, unknown>) => {
      throw { code: 403, message: 'Forbidden' }
    })
    const requester: ProtectedRequester = <T,>(url: string, params?: Record<string, unknown>) => (
      request(url, params) as Promise<T>
    )

    const first = discoverAggregatedSurveys(requester)
    const second = discoverAggregatedSurveys(requester)
    expect(second).toBe(first)
    await first

    const initialCalls = request.mock.calls.length
    await discoverAggregatedSurveys(requester, { refresh: true })
    expect(request.mock.calls.length).toBeGreaterThan(initialCalls)
  })

  it('stops reporting to an aborted subscriber so an unmounted page leaks nothing', async () => {
    const requester: ProtectedRequester = async <T,>() => {
      throw { code: 403, message: 'Forbidden' }
    }
    const controller = new AbortController()
    const updates: number[] = []

    const running = discoverAggregatedSurveys(requester, {
      onProgress: (result) => updates.push(result.pendingSourceCount),
    })
    // A second page subscribes to the same in-flight discovery, then unmounts.
    const abandoned: number[] = []
    discoverAggregatedSurveys(requester, {
      onProgress: (result) => abandoned.push(result.pendingSourceCount),
      signal: controller.signal,
    })
    // The replay of the current state reaches it while it is still subscribed;
    // what must stop is everything after the abort.
    const receivedBeforeAbort = abandoned.length
    controller.abort()
    await running

    expect(updates.length).toBeGreaterThan(1)
    expect(abandoned).toHaveLength(receivedBeforeAbort)
  })
})

describe('content visibility in discovery', () => {
  /** A layer that carries `opendata`, recording the `where` of every query sent to it. */
  function flaggedLayer(rows: Array<{ adm0_iso3: string; round: number; opendata: number }>, withFlag = true) {
    const wheres: string[] = []
    const requester = (async (url: string, params?: Record<string, unknown>) => {
      const itemId = /\/content\/items\/([^/]+)$/.exec(url)?.[1]
      if (itemId) return { id: itemId, title: itemId, type: 'Feature Service', owner: 'DIEM', modified: 1, access: 'shared', url: `https://vis.test/${itemId}/FeatureServer` }
      if (url.endsWith('/FeatureServer')) return { layers: [{ id: 0, name: 'layer' }] }
      if (url.endsWith('/FeatureServer/0')) return {
        id: 0, name: 'layer', maxRecordCount: 100,
        fields: [
          { name: 'adm0_iso3', alias: '', type: 'esriFieldTypeString' },
          { name: 'round', alias: '', type: 'esriFieldTypeInteger' },
          ...(withFlag ? [{ name: 'opendata', alias: '', type: 'esriFieldTypeSmallInteger' }] : []),
        ],
      }
      const where = String(params?.where)
      wheres.push(where)
      // Serve what the clause would let through, as ArcGIS would.
      const visible = where.includes('opendata = 1') ? rows.filter((row) => row.opendata === 1) : rows
      return { features: visible.map(({ adm0_iso3, round }) => ({ attributes: { adm0_iso3, round } })) }
    }) as ProtectedRequester
    return { requester, wheres }
  }

  const ROWS = [
    { adm0_iso3: 'NGA', round: 8, opendata: 1 },
    { adm0_iso3: 'NGA', round: 9, opendata: 0 },
  ]

  it('offers a non-Contributor only surveys with released rows', async () => {
    const { requester, wheres } = flaggedLayer(ROWS)

    const result = await discoverSurveyAvailability([resource('flagged', 'v3', 'Food security')], requester)

    expect(wheres[0]).toBe('opendata = 1')
    expect(result.surveys.map((survey) => survey.key)).toEqual(['v3:NGA:8'])
  })

  it('offers a Contributor unreleased surveys too', async () => {
    const { requester, wheres } = flaggedLayer(ROWS)

    const result = await discoverSurveyAvailability([resource('flagged', 'v3', 'Food security')], requester, { contributor: true })

    expect(wheres[0]).toBe('1=1')
    expect(result.surveys.map((survey) => survey.key)).toEqual(['v3:NGA:8', 'v3:NGA:9'])
  })

  it('carries the clause into every survey slice, so counts and downloads apply it too', async () => {
    const { requester } = flaggedLayer(ROWS)

    const result = await discoverSurveyAvailability([resource('flagged', 'v3', 'Food security')], requester)
    const survey = result.surveys[0]

    expect(surveySliceWhere(survey, survey.themes[0])).toBe("(adm0_iso3 = 'NGA' AND round = 8) AND opendata = 1")
  })

  it('withholds a layer without the flag from a non-Contributor, without querying it', async () => {
    const { requester, wheres } = flaggedLayer(ROWS, false)

    const result = await discoverSurveyAvailability([resource('legacy', 'v1', 'Food security')], requester)

    expect(wheres).toHaveLength(0)
    expect(result.surveys).toEqual([])
    expect(result.sources[0]).toMatchObject({ status: 'withheld', message: expect.stringContaining('no opendata flag') })
  })

  it('does not call a withheld source a failure or the total incomplete', async () => {
    const flagged = flaggedLayer(ROWS)
    const unflagged = flaggedLayer(ROWS, false)
    const requester = (async (url: string, params?: Record<string, unknown>) => (
      url.includes('legacy') ? unflagged.requester(url, params) : flagged.requester(url, params)
    )) as ProtectedRequester

    const result = await discoverSurveyAvailability(
      [resource('flagged', 'v3', 'Food security'), resource('legacy', 'v1', 'Crop production')],
      requester,
    )

    // What this viewer may see was read in full: the withheld source is outside it.
    expect(result.status).toBe('complete')
    expect(result.unavailableSourceCount).toBe(0)
  })

  it('shows a Contributor a layer without the flag, unfiltered', async () => {
    const { requester, wheres } = flaggedLayer(ROWS, false)

    const result = await discoverSurveyAvailability([resource('legacy', 'v1', 'Food security')], requester, { contributor: true })

    expect(wheres[0]).toBe('1=1')
    // Unreleased round 9 included, and no clause on the slice.
    expect(result.surveys.map((survey) => survey.key)).toEqual(['v1:NGA:8', 'v1:NGA:9'])
    expect(surveySliceWhere(result.surveys[0], result.surveys[0].themes[0])).toBe("adm0_iso3 = 'NGA' AND round = 8")
  })

  it('never serves one visibility scope\'s cached discovery to the other', async () => {
    const { requester } = flaggedLayer(ROWS)

    const asMember = await discoverAggregatedSurveys(requester, { contributor: false })
    const asContributor = await discoverAggregatedSurveys(requester, { contributor: true })

    expect(asContributor).not.toBe(asMember)
  })
})
