import { HUB_ORIGIN } from '../lib/hubOrigin'
import { describe, expect, it, vi } from 'vitest'
import {
  buildSurveyBundle,
  isBundleCancelled,
  packageBudgetProblem,
  PACKAGE_BUDGETS,
  surveyFolderName,
  type BundleProgress,
} from './surveyBundle'
import type { AvailableSurvey, SurveyThemeSource } from './surveyAccess'
import type { ProtectedRequester } from './protectedData'

function theme(id: string, label: string, testData = false): SurveyThemeSource {
  return {
    id,
    label,
    resourceId: `item-${id}`,
    generation: 'v2',
    itemModified: Date.UTC(2026, 5, 1),
    layerId: 0,
    layerName: `${id}_mview`,
    layerUrl: `https://example.test/${id}/FeatureServer/0`,
    countryField: 'adm0_iso3',
    roundField: 'round',
    testData,
  }
}

function survey(iso3: string, round: number, testData = false): AvailableSurvey {
  return {
    key: `v2:${iso3}:${round}`,
    generation: 'v2',
    adm0Iso3: iso3,
    countryName: iso3 === 'NGA' ? 'Nigeria' : 'Chad',
    round,
    themes: [],
    testData,
  }
}

const LAYER = {
  id: 0,
  name: 'diem_adm_repr_1_mview',
  objectIdField: 'OBJECTID',
  maxRecordCount: 1000,
  fields: [
    { name: 'OBJECTID', alias: 'Object ID', type: 'esriFieldTypeOID' },
    { name: 'adm0_iso3', alias: 'Country code', type: 'esriFieldTypeString' },
    { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
    { name: 'fcs_mean', alias: 'Food consumption score', type: 'esriFieldTypeDouble' },
  ],
}

/** Captures the archive instead of compressing it, so contents can be asserted. */
function capturingZip() {
  const captured: Record<string, string> = {}
  const bytes: Record<string, Uint8Array> = {}
  const zip = vi.fn(async (files: Record<string, Uint8Array>) => {
    for (const [path, content] of Object.entries(files)) {
      bytes[path] = content
      // ignoreBOM, or the decoder silently eats the mark the assertions are about.
      captured[path] = new TextDecoder('utf-8', { ignoreBOM: true }).decode(content)
    }
    return new Uint8Array([80, 75, 3, 4])
  })
  return { captured, bytes, zip }
}

function requesterFor(count = 2, rows?: Record<string, unknown>[]): ProtectedRequester {
  const page = rows || Array.from({ length: count }, (_, index) => ({
    OBJECTID: index + 1,
    adm0_iso3: 'NGA',
    round: 8,
    fcs_mean: 42.5 + index,
  }))
  return (async (url: string, params?: Record<string, unknown>) => {
    if (url.endsWith('/query') && params?.returnCountOnly === 'true') return { count }
    if (url.endsWith('/query')) return { features: page.map((attributes) => ({ attributes })) }
    return LAYER
  }) as ProtectedRequester
}

const NOW = () => new Date(Date.UTC(2026, 8, 21, 10, 30))

// Never the live register: tests must not depend on the network.
const NO_PERIODS = async () => new Map()

describe('survey bundle', () => {
  it('lays a single survey out exactly as it lays ten out', async () => {
    const { captured, zip } = capturingZip()

    const result = await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    expect(Object.keys(captured).sort()).toEqual([
      'LICENCE.txt',
      'NGA_R08_v2/data/NGA_R08_v2_food-security.csv',
      'NGA_R08_v2/documentation_and_metadata.txt',
      'NGA_R08_v2/survey.txt',
      'README.txt',
      'manifest.json',
    ])
    expect(result.fileName).toBe('DIEM_aggregated_2026-09-21.zip')
    expect(result.recordCount).toBe(2)
  })

  it('writes the generation into every folder name', () => {
    expect(surveyFolderName(survey('NGA', 8))).toBe('NGA_R08_v2')
    expect(surveyFolderName(survey('TCD', 12))).toBe('TCD_R12_v2')
  })

  it('filters each CSV to its own survey and keeps the field columns', async () => {
    const { captured, bytes, zip } = capturingZip()

    await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    const csv = captured['NGA_R08_v2/data/NGA_R08_v2_food-security.csv']
    // The byte-order mark is what makes Excel read accented text correctly.
    expect(Array.from(bytes['NGA_R08_v2/data/NGA_R08_v2_food-security.csv'].slice(0, 3))).toEqual([0xef, 0xbb, 0xbf])
    expect(csv).toContain('adm0_iso3,round,fcs_mean')
    expect(csv).toContain('NGA,8,42.5')

    const manifest = JSON.parse(captured['manifest.json'])
    expect(manifest.files[0].query_parameters.where).toBe("adm0_iso3 = 'NGA' AND round = 8")
    expect(manifest.files[0].record_count).toBe(2)
  })

  it('records the query without a token and without the account name', async () => {
    const { captured, zip } = capturingZip()

    await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    const serialized = captured['manifest.json']
    expect(serialized).not.toMatch(/token/i)
    expect(serialized).not.toMatch(/username|account/i)
    const manifest = JSON.parse(serialized)
    // Endpoint and parameters are stored apart, so no ready-made URL carries a filter.
    expect(manifest.files[0].query_endpoint).toBe('https://example.test/food-security/FeatureServer/0/query')
    expect(manifest.files[0].item_id).toBe('item-food-security')
    expect(manifest.files[0].layer_id).toBe(0)
    expect(manifest.accessed).toBe('2026-09-21')
  })

  it('names what was left out, and why, in both the manifest and the README', async () => {
    const { captured, zip } = capturingZip()

    await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      omitted: [
        { surveyKey: 'v2:TCD:3', themeLabel: 'Crop production', reason: 'Not collected for this survey' },
        { surveyKey: 'v1:AFG:4', themeLabel: 'Crop production', reason: 'Could not be retrieved' },
      ],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    expect(JSON.parse(captured['manifest.json']).not_included).toHaveLength(2)
    const readme = captured['README.txt']
    expect(readme).toContain('Not included')
    expect(readme).toContain('v2:TCD:3 - Crop production: Not collected for this survey')
    expect(readme).toContain('v1:AFG:4 - Crop production: Could not be retrieved')
    expect(readme).toContain('describes how that survey was run')
  })

  it('says so plainly when nothing was omitted', async () => {
    const { captured, zip } = capturingZip()

    await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    expect(captured['README.txt']).toContain('Nothing was omitted')
  })

  it('replaces raw field lists with one documentation file of links', async () => {
    const { captured, zip } = capturingZip()

    await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    expect(Object.keys(captured).some((path) => /fields\.csv$|layer-schema\.json$/.test(path))).toBe(false)
    const text = captured['NGA_R08_v2/documentation_and_metadata.txt']
    expect(text).toContain(`${HUB_ORIGIN}/data/guide#generations`)
    expect(text).toContain('Administrative reference boundaries')
    expect(text).toContain('3596c3ad318849068eda21517ade30be')
    expect(text).toContain('https://github.com/Andrampa/DIEM_API/tree/main')
    expect(text).toContain('https://example.test/food-security/FeatureServer/0')
  })

  it('links the generation\'s published documentation, and admits when there is none', async () => {
    const { captured, zip } = capturingZip()
    const v3Survey = { ...survey('COD', 12), key: 'v3:COD:12', generation: 'v3' as const }

    await buildSurveyBundle({
      slices: [
        { survey: survey('NGA', 8), theme: theme('food-security', 'Food security') },
        { survey: v3Survey, theme: { ...theme('food-security', 'Food security'), generation: 'v3' } },
      ],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    const v2Resources = captured['NGA_R08_v2/documentation_and_metadata.txt']
    expect(v2Resources).toContain('Field descriptions:')
    expect(v2Resources).toContain('04287fcadb994341b0b70d19c8a02035')
    const v3Resources = captured['COD_R12_v3/documentation_and_metadata.txt']
    expect(v3Resources).toContain('No field descriptions or codebook have been published for V3 yet')
    // An earlier generation's codebook must never stand in for the missing one.
    expect(v3Resources).not.toContain('04287fcadb994341b0b70d19c8a02035')
  })

  it('refuses a package over its total budget before fetching any rows', async () => {
    const { zip } = capturingZip()
    const request = vi.fn(requesterFor(40))
    const requester = request as unknown as ProtectedRequester

    await expect(buildSurveyBundle({
      slices: [
        { survey: survey('NGA', 8), theme: theme('food-security', 'Food security') },
        { survey: survey('TCD', 3), theme: theme('food-security', 'Food security') },
      ],
      requester,
      zip,
      collectionPeriods: NO_PERIODS,
      budget: { records: 50, dataFiles: 60 },
      now: NOW,
    })).rejects.toThrow(/one package can hold 50/)

    const rowFetches = request.mock.calls.filter(([url, params]) => (
      String(url).endsWith('/query') && (params as Record<string, unknown>)?.returnCountOnly !== 'true'
    ))
    expect(rowFetches).toHaveLength(0)
    expect(zip).not.toHaveBeenCalled()
  })

  it('states the budget in terms a user can act on', () => {
    expect(packageBudgetProblem(10, 5, PACKAGE_BUDGETS.member)).toBeUndefined()
    expect(packageBudgetProblem(10, 61, PACKAGE_BUDGETS.member)).toMatch(/61 data files; one package can hold 60/)
    expect(packageBudgetProblem(50_001, 5, PACKAGE_BUDGETS.member)).toMatch(/generated Python or R script/)
    // Contributors get more room, never an unbounded operation.
    expect(packageBudgetProblem(50_001, 5, PACKAGE_BUDGETS.contributor)).toBeUndefined()
    expect(packageBudgetProblem(200_001, 5, PACKAGE_BUDGETS.contributor)).toBeDefined()
  })

  it('passes the cancellation signal to compression so it can stop part-way', async () => {
    const controller = new AbortController()
    const zip = vi.fn(async (_files: Record<string, Uint8Array>, signal?: AbortSignal) => {
      expect(signal).toBe(controller.signal)
      controller.abort()
      return new Uint8Array([80, 75])
    })

    const error = await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      signal: controller.signal,
      now: NOW,
    }).catch((reason) => reason)

    // Aborted during compression: nothing is handed back as a finished package.
    expect(isBundleCancelled(error)).toBe(true)
  })

  it('marks a test-data package in the filename, the folders and the warnings', async () => {
    const { captured, zip } = capturingZip()

    const result = await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 99, true), theme: theme('food-security', 'Food security', true) }],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    expect(result.fileName).toBe('TEST_DATA_DIEM_aggregated_2026-09-21.zip')
    expect(Object.keys(captured)).toContain('TEST_DATA_NGA_R99_v2/data/TEST_DATA_NGA_R99_v2_food-security.csv')
    expect(captured['TEST_DATA_NGA_R99_v2/survey.txt']).toContain('TEST DATA - NOT SURVEY RESULTS')
    expect(captured['README.txt']).toContain('WARNING - THIS PACKAGE CONTAINS TEST DATA')
    expect(JSON.parse(captured['manifest.json']).test_data).toBe(true)
  })

  it('refuses a slice past the browser export limit instead of truncating it', async () => {
    const { zip } = capturingZip()

    await expect(buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(25_000),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })).rejects.toThrow(/more than the 20\s000 a browser download can build/)

    expect(zip).not.toHaveBeenCalled()
  })

  it('produces no archive at all when one file fails', async () => {
    const { zip } = capturingZip()
    const failing: ProtectedRequester = (async (url: string, params?: Record<string, unknown>) => {
      if (url.includes('crop-production') && params?.returnCountOnly !== 'true' && url.endsWith('/query')) {
        throw new Error('Service unavailable')
      }
      if (url.endsWith('/query') && params?.returnCountOnly === 'true') return { count: 2 }
      if (url.endsWith('/query')) return { features: [{ attributes: { adm0_iso3: 'NGA', round: 8 } }, { attributes: { adm0_iso3: 'NGA', round: 8 } }] }
      return LAYER
    }) as ProtectedRequester

    await expect(buildSurveyBundle({
      slices: [
        { survey: survey('NGA', 8), theme: theme('food-security', 'Food security') },
        { survey: survey('NGA', 8), theme: theme('crop-production', 'Crop production') },
      ],
      requester: failing,
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })).rejects.toThrow(/Service unavailable/)

    // Half a package presented as whole is the one outcome this must not have.
    expect(zip).not.toHaveBeenCalled()
  })

  it('stops when cancelled and reports it as a cancellation, not a failure', async () => {
    const { zip } = capturingZip()
    const controller = new AbortController()
    const requester: ProtectedRequester = (async (url: string, params?: Record<string, unknown>) => {
      controller.abort()
      if (url.endsWith('/query') && params?.returnCountOnly === 'true') return { count: 1 }
      if (url.endsWith('/query')) return { features: [] }
      return LAYER
    }) as ProtectedRequester

    const error = await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester,
      signal: controller.signal,
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    }).catch((reason) => reason)

    expect(isBundleCancelled(error)).toBe(true)
    expect(zip).not.toHaveBeenCalled()
  })

  it('reports the stages a progress display needs', async () => {
    const { zip } = capturingZip()
    const stages: BundleProgress[] = []

    await buildSurveyBundle({
      slices: [
        { survey: survey('NGA', 8), theme: theme('food-security', 'Food security') },
        { survey: survey('TCD', 3), theme: theme('food-security', 'Food security') },
      ],
      requester: requesterFor(),
      onProgress: (progress) => stages.push(progress),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    const seen = stages.map((entry) => entry.stage)
    expect(seen[0]).toBe('preparing')
    expect(seen).toContain('reading-schema')
    expect(seen).toContain('downloading')
    expect(seen).toContain('metadata')
    expect(seen).toContain('compressing')
    expect(seen.at(-1)).toBe('ready')
    expect(stages.find((entry) => entry.stage === 'downloading')?.label).toContain('Nigeria')
  })

  it('reads each distinct layer schema once, however many surveys use it', async () => {
    const { zip } = capturingZip()
    const request = vi.fn(requesterFor())
    const requester = request as unknown as ProtectedRequester

    await buildSurveyBundle({
      slices: [
        { survey: survey('NGA', 8), theme: theme('food-security', 'Food security') },
        { survey: survey('TCD', 3), theme: theme('food-security', 'Food security') },
      ],
      requester,
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    const schemaReads = request.mock.calls.filter(([url]) => !String(url).endsWith('/query'))
    expect(schemaReads).toHaveLength(1)
  })

  it('records each survey\'s collection period from the survey register', async () => {
    const { captured, zip } = capturingZip()

    await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: async () => new Map([['NGA:8', { start: Date.UTC(2025, 8, 9), end: Date.UTC(2025, 8, 25) }]]),
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    const manifest = JSON.parse(captured['manifest.json'])
    expect(manifest.surveys[0]).toMatchObject({
      collection_start: '2025-09-09',
      collection_end: '2025-09-25',
      collection_period_source: expect.stringContaining('survey register'),
    })
    expect(manifest.files[0].collection_end).toBe('2025-09-25')
    expect(captured['NGA_R08_v2/survey.txt']).toContain('Data collection: 2025-09-09 to 2025-09-25')
  })

  it('still builds when the register is down, and says why the dates are missing', async () => {
    const { captured, zip } = capturingZip()

    const result = await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester: requesterFor(),
      zip,
      collectionPeriods: async () => { throw new Error('Survey register request failed (503)') },
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    expect(result.recordCount).toBe(2)
    const entry = JSON.parse(captured['manifest.json']).surveys[0]
    expect(entry.collection_start).toBe(null)
    // A blank date must never read as though the survey had none.
    expect(entry.collection_period_source).toContain('could not be read when this package was built')
    expect(captured['NGA_R08_v2/survey.txt']).toContain('dates unavailable')
  })

  it('never points an aggregated package at microdata documentation', async () => {
    const { captured, zip } = capturingZip()
    const v1Survey = { ...survey('AFG', 2), key: 'v1:AFG:2', generation: 'v1' as const }

    await buildSurveyBundle({
      slices: [
        { survey: survey('NGA', 8), theme: theme('food-security', 'Food security') },
        { survey: v1Survey, theme: { ...theme('food-security', 'Food security'), generation: 'v1' } },
      ],
      requester: requesterFor(),
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      now: NOW,
    })

    const v2 = captured['NGA_R08_v2/documentation_and_metadata.txt']
    expect(v2).toContain('04287fcadb994341b0b70d19c8a02035') // field descriptions: both
    expect(v2).toContain('01595314154948719aca7325d88c782a') // SDMX: aggregated
    expect(v2).not.toContain('41fa55934d2f462f86cd381ee8dc1fda') // microdata codebook

    const v1 = captured['AFG_R02_v1/documentation_and_metadata.txt']
    expect(v1).toContain('9d0ec676be324584b257315be2fe0d17') // aggregated field descriptions
    expect(v1).not.toContain('e256f41d26ae4dc9b5906270a1116d33') // microdata field descriptions
    expect(v1).not.toContain('e59d08ded7c1440587493bf65236cf44') // microdata codebooks
  })

  it('hands the cancellation signal to every request, so one in flight can be aborted', async () => {
    const { zip } = capturingZip()
    const controller = new AbortController()
    const signals: Array<AbortSignal | undefined> = []
    const requester = (async (url: string, params?: Record<string, unknown>, options?: { signal?: AbortSignal }) => {
      signals.push(options?.signal)
      if (url.endsWith('/query') && params?.returnCountOnly === 'true') return { count: 1 }
      if (url.endsWith('/query')) return { features: [{ attributes: { adm0_iso3: 'NGA', round: 8 } }] }
      return LAYER
    }) as ProtectedRequester

    await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester,
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      signal: controller.signal,
      now: NOW,
    })

    // Schema read, count and row page: each must be abortable while in flight.
    expect(signals.length).toBeGreaterThanOrEqual(3)
    expect(signals.every((signal) => signal === controller.signal)).toBe(true)
  })

  it('reports an abort thrown by the network layer as a cancellation', async () => {
    const { zip } = capturingZip()
    const controller = new AbortController()
    const requester = (async () => {
      controller.abort()
      // What fetch throws when its signal fires mid-request.
      throw new DOMException('The operation was aborted.', 'AbortError')
    }) as ProtectedRequester

    const error = await buildSurveyBundle({
      slices: [{ survey: survey('NGA', 8), theme: theme('food-security', 'Food security') }],
      requester,
      zip,
      collectionPeriods: NO_PERIODS,
      budget: PACKAGE_BUDGETS.member,
      signal: controller.signal,
      now: NOW,
    }).catch((reason) => reason)

    expect(isBundleCancelled(error)).toBe(true)
  })
})
