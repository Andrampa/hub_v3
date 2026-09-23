import { describe, expect, it, vi } from 'vitest'
import type { DatasetDefinition } from './dataExplorer'
import type { ProtectedRequester } from './protectedData'
import type { MicrodataSurvey, MicrodataSurveyComponent } from './microdataSurveyAccess'
import { buildMicrodataBundle, type MicrodataPackageBudget } from './microdataBundle'

const budget: MicrodataPackageBudget = { records: 20, uncompressedBytes: 100_000, dataFiles: 10 }

function component(kind: MicrodataSurveyComponent['component'] = 'household'): MicrodataSurveyComponent {
  return {
    component: kind, source: 'master', itemId: `${kind}-item`,
    layerUrl: `https://example.test/${kind}/0`, countryField: 'adm0_iso3',
    roundField: 'round', bulkExportEnabled: true,
  }
}

function survey(version: MicrodataSurvey['generation'] = 'v2', components = [component()]): MicrodataSurvey {
  return {
    key: `${version}:NGA:8`, generation: version, adm0Iso3: 'NGA',
    countryName: 'Nigeria', round: 8, testData: version === 'v3', components,
  }
}

function definition(part: MicrodataSurveyComponent, version: MicrodataSurvey['generation']): DatasetDefinition {
  return {
    resource: {
      id: part.itemId, version, fallbackTitle: 'Household', description: '',
      kind: 'microdata', access: 'available',
    },
    serviceUrl: `https://example.test/${part.component}`,
    layerUrl: `https://example.test/${part.component}/0`, isTable: true,
    layer: {
      id: 0, name: 'household', objectIdField: 'OBJECTID', maxRecordCount: 1000,
      fields: [
        { name: 'OBJECTID', alias: 'ID', type: 'esriFieldTypeOID' },
        { name: 'adm0_iso3', alias: 'ISO3', type: 'esriFieldTypeString' },
        { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
        { name: 'value', alias: 'Value', type: 'esriFieldTypeInteger' },
      ],
    },
  }
}

function setup(rows = [{ OBJECTID: 1, adm0_iso3: 'NGA', round: 8, value: 4 }]) {
  const requester = vi.fn(async (_url: string, params?: Record<string, unknown>) => (
    params?.returnCountOnly ? { count: rows.length } : { features: rows.map((attributes) => ({ attributes })) }
  )) as unknown as ProtectedRequester
  let files: Record<string, Uint8Array> = {}
  const zip = vi.fn(async (input: Record<string, Uint8Array>) => {
    files = input
    return new Uint8Array([0x50, 0x4b, 0x03, 0x04])
  })
  const read = (path: string) => new TextDecoder().decode(files[path])
  return { requester, zip, read }
}

describe('microdata bundle', () => {
  it('writes a version-matched, licensed per-survey package with exact counts', async () => {
    const fixture = setup()
    const selected = survey()
    const result = await buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip,
      resolve: async (part) => definition(part, selected.generation),
      now: () => new Date('2026-09-23T12:00:00Z'),
    })
    expect(result.fileName).toBe('DIEM_microdata_2026-09-23.zip')
    expect(result.recordCount).toBe(1)
    const manifest = JSON.parse(fixture.read('manifest.json'))
    expect(manifest.files[0]).toMatchObject({
      path: 'NGA_R08_v2/data/NGA_R08_v2_household.csv', record_count: 1,
      item_id: 'household-item', authorizing_source: 'master',
    })
    expect(manifest.files[0].query_parameters.where).toBe("adm0_iso3 = 'NGA' AND round = 8")
    expect(fixture.read(manifest.files[0].path)).toContain('adm0_iso3,round,value')
    expect(fixture.read('NGA_R08_v2/documentation_and_metadata.txt')).toContain('41fa55934d2f462f86cd381ee8dc1fda')
    expect(fixture.read('NGA_R08_v2/documentation_and_metadata.txt')).not.toContain('e59d08ded7c1440587493bf65236cf44')
    expect(fixture.read('LICENCE.txt')).toContain('not be redisseminated')
    expect(fixture.read('manifest.json')).not.toContain('token=')
  })

  it('keeps V3 test mandatory and optional tables separate, with no substituted codebook', async () => {
    const fixture = setup()
    const selected = survey('v3', [component('mandatory'), component('optional')])
    const result = await buildMicrodataBundle({
      surveys: [selected], includeV3Optional: true, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip,
      resolve: async (part) => definition(part, selected.generation),
    })
    expect(result.fileName).toMatch(/^TEST_DATA_DIEM_microdata_/)
    const manifest = JSON.parse(fixture.read('manifest.json'))
    expect(manifest.files.map((file: { component: string }) => file.component)).toEqual(['mandatory', 'optional'])
    expect(manifest.files.every((file: { path: string }) => file.path.startsWith('TEST_DATA_'))).toBe(true)
    expect(fixture.read('TEST_DATA_NGA_R08_v3/documentation_and_metadata.txt')).toContain('No field descriptions or codebook have been published for V3 yet.')
    expect(fixture.read('TEST_DATA_NGA_R08_v3/documentation_and_metadata.txt')).toContain('survey_id + hh_id')
  })

  it('returns no partial archive when rows change after preflight', async () => {
    const fixture = setup()
    const selected = survey()
    let counts = 0
    const requester = vi.fn(async (_url: string, params?: Record<string, unknown>) => {
      if (params?.returnCountOnly) return { count: ++counts }
      return { features: [{ attributes: { OBJECTID: 1, adm0_iso3: 'NGA', round: 8, value: 4 } }] }
    }) as unknown as ProtectedRequester
    await expect(buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester, budget, zip: fixture.zip,
      resolve: async (part) => definition(part, selected.generation),
    })).rejects.toThrow('changed while downloading')
    expect(fixture.zip).not.toHaveBeenCalled()
  })

  it('rechecks a grant export switch and never compresses when it was revoked', async () => {
    const fixture = setup()
    const part = { ...component(), source: 'grant' as const, grantId: 'grant-one' }
    const selected = survey('v2', [part])
    await expect(buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip,
      resolve: async () => ({ ...definition(part, 'v2'), grant: {
        schemaVersion: 1, grantId: 'grant-one', questionnaireVersion: 'v2',
        component: 'legacy', surveyScope: [{ adm0_iso3: 'NGA', round: 8 }],
        itemId: part.itemId, title: 'View', bulkExportEnabled: false,
      } }),
    })).rejects.toThrow('Bulk export is not enabled')
    expect(fixture.zip).not.toHaveBeenCalled()
  })

  it('enforces the ten-survey cap and the caller-supplied record budget', async () => {
    const fixture = setup()
    const selected = survey()
    const tooMany = Array.from({ length: 11 }, (_, index) => ({
      ...selected, key: `v2:NGA:${index + 1}`, round: index + 1,
    }))
    await expect(buildMicrodataBundle({
      surveys: tooMany, includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip,
    })).rejects.toThrow('no more than 10')
    await expect(buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget: { ...budget, records: 0 }, zip: fixture.zip,
      resolve: async (part) => definition(part, selected.generation),
    })).rejects.toThrow('record limit')
  })

  it('writes a header-only CSV for a confirmed zero-row component', async () => {
    const fixture = setup([])
    const selected = survey()
    const result = await buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip,
      resolve: async (part) => definition(part, selected.generation),
    })
    expect(result.recordCount).toBe(0)
    expect(fixture.read('NGA_R08_v2/data/NGA_R08_v2_household.csv')).toContain('adm0_iso3,round,value')
    expect(JSON.parse(fixture.read('manifest.json')).files[0].record_count).toBe(0)
  })

  it('pages household rows and stops when encoded bytes exceed the budget', async () => {
    const selected = survey()
    const rows = Array.from({ length: 205 }, (_, index) => ({
      OBJECTID: index + 1, adm0_iso3: 'NGA', round: 8, value: index,
    }))
    const requester = vi.fn(async (_url: string, params?: Record<string, unknown>) => (
      params?.returnCountOnly ? { count: rows.length } : {
        features: rows.slice(Number(params?.resultOffset), Number(params?.resultOffset) + Number(params?.resultRecordCount))
          .map((attributes) => ({ attributes })),
      }
    )) as unknown as ProtectedRequester
    const fixture = setup()
    const input = {
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester, budget: { ...budget, records: 205 }, zip: fixture.zip,
      resolve: async (part: MicrodataSurveyComponent) => definition(part, selected.generation),
    }
    const result = await buildMicrodataBundle(input)
    expect(result.recordCount).toBe(205)
    expect(requester).toHaveBeenCalledWith(expect.stringContaining('/query'),
      expect.objectContaining({ resultOffset: '200', resultRecordCount: '5' }), expect.anything())
    await expect(buildMicrodataBundle({ ...input, budget: { ...input.budget, uncompressedBytes: 100 } }))
      .rejects.toThrow('browser-memory budget')
  })

  it('refuses to mix production and simulated V3 data, or omit a requested optional table', async () => {
    const fixture = setup()
    const production = survey('v2')
    const test = survey('v3', [component('mandatory')])
    await expect(buildMicrodataBundle({
      surveys: [production, test], includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip,
    })).rejects.toThrow('cannot share one package')
    await expect(buildMicrodataBundle({
      surveys: [test], includeV3Optional: true, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip,
    })).rejects.toThrow('no accessible optional table')
    expect(fixture.zip).not.toHaveBeenCalled()
  })
})
