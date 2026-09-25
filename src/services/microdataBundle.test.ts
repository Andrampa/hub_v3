import { describe, expect, it, vi } from 'vitest'
import type { DatasetDefinition } from './dataExplorer'
import type { ProtectedRequester } from './protectedData'
import type { MicrodataSurvey, MicrodataSurveyComponent } from './microdataSurveyAccess'
import { buildMicrodataBundle, type MicrodataPackageBudget } from './microdataBundle'
import { canonicalDomain, domainDigest, type AuditedDomains } from './microdataLabels'

const budget: MicrodataPackageBudget = { records: 20, uncompressedBytes: 100_000, sourceTables: 10 }

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
        { name: 'value', alias: 'Value', type: 'esriFieldTypeInteger',
          domain: { type: 'codedValue', codedValues: [{ code: 4, name: 'Four' }, { code: 5, name: 'Five, or more' }] } },
      ],
    },
  }
}

function setup(rows: Array<Record<string, unknown>> = [{ OBJECTID: 1, adm0_iso3: 'NGA', round: 8, value: 4 }]) {
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

async function auditFor(entries: Array<[MicrodataSurvey['generation'], MicrodataSurveyComponent['component']]>): Promise<AuditedDomains> {
  const components: AuditedDomains['components'] = []
  for (const [generation, kind] of entries) {
    const fields: Record<string, string> = {}
    for (const field of definition(component(kind), generation).layer.fields) {
      const domain = canonicalDomain(field)
      if (domain) fields[field.name] = await domainDigest(domain)
    }
    components.push({ generation, component: kind, item_id: `${kind}-item`, layer_id: 0,
      audited_at: '2026-09-25', basis: generation === 'v3' ? 'consistency_only' : 'codebook_matched', fields })
  }
  return { schema_version: 1, generated: '2026-09-25', components }
}

const NO_AUDIT: AuditedDomains = { schema_version: 1, generated: null, components: [] }

describe('microdata bundle values', () => {
  const rows = [
    { OBJECTID: 1, adm0_iso3: 'NGA', round: 8, value: 4 },
    { OBJECTID: 2, adm0_iso3: 'NGA', round: 8, value: 9 },
    { OBJECTID: 3, adm0_iso3: 'NGA', round: 8, value: 5 },
    { OBJECTID: 4, adm0_iso3: 'NGA', round: 8, value: null },
  ]

  it('writes coded values with a verified value_labels.csv by default', async () => {
    const fixture = setup(rows)
    const selected = survey()
    await buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip, audit: await auditFor([['v2', 'household']]),
      resolve: async (part) => definition(part, selected.generation),
    })
    const manifest = JSON.parse(fixture.read('manifest.json'))
    expect(manifest.package_schema_version).toBe(2)
    expect(manifest.values).toBe('codes')
    expect(manifest.files).toHaveLength(1)
    expect(manifest.files[0]).toMatchObject({ values: 'coded' })
    expect(manifest.files[0].unlabelled_codes).toBeUndefined()
    expect(manifest.value_labels).toEqual([expect.objectContaining({ component: 'household', status: 'verified', basis: 'codebook_matched' })])
    expect(fixture.read('NGA_R08_v2/data/NGA_R08_v2_household.csv')).toContain('NGA,8,4')
    const labels = fixture.read('NGA_R08_v2/value_labels.csv')
    expect(labels).toContain('household,household-item,0,value,4,Four')
    expect(labels).toContain('household,household-item,0,value,5,"Five, or more"')
  })

  it('writes a header-only mapping file and says why when labels are unverified', async () => {
    const fixture = setup(rows)
    const selected = survey()
    await buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester: fixture.requester, budget, zip: fixture.zip, audit: NO_AUDIT,
      resolve: async (part) => definition(part, selected.generation),
    })
    expect(fixture.read('NGA_R08_v2/value_labels.csv')).toBe('component,item_id,layer_id,variable,code,label\r\n')
    expect(JSON.parse(fixture.read('manifest.json')).value_labels[0]).toMatchObject({ status: 'unverified', reason: 'not_audited' })
    expect(fixture.read('README.txt')).toContain('value_labels.csv omits tables whose labels could not be verified: v2:NGA:8 household (not_audited)')
  })

  it('writes coded and labelled files with identical rows and order for Both', async () => {
    const fixture = setup(rows)
    const selected = survey()
    const result = await buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true, values: 'both',
      requester: fixture.requester, budget, zip: fixture.zip, audit: await auditFor([['v2', 'household']]),
      resolve: async (part) => definition(part, selected.generation),
    })
    expect(result.fileCount).toBe(2)
    const coded = fixture.read('NGA_R08_v2/data/NGA_R08_v2_household.csv').split('\r\n')
    const labelled = fixture.read('NGA_R08_v2/data/NGA_R08_v2_household_labelled.csv').split('\r\n')
    expect(labelled).toHaveLength(coded.length)
    expect(labelled[0]).toBe(coded[0])
    expect(labelled.slice(1)).toEqual(['NGA,8,Four', 'NGA,8,9', 'NGA,8,"Five, or more"', 'NGA,8,'])
    expect(coded.slice(1)).toEqual(['NGA,8,4', 'NGA,8,9', 'NGA,8,5', 'NGA,8,'])
    const manifest = JSON.parse(fixture.read('manifest.json'))
    expect(manifest.files.map((file: { values: string }) => file.values)).toEqual(['coded', 'labelled'])
    expect(manifest.files[1]).toMatchObject({
      label_source: 'arcgis_domains', labelled_fields: ['value'],
      fields_without_domain: ['adm0_iso3', 'round'], ambiguous_domains: [],
      unlabelled_codes: { value: { count: 1, codes: ['9'] } }, record_count: 4,
    })
  })

  it('refuses labels before downloading rows when a table is unverified', async () => {
    const fixture = setup(rows)
    const selected = survey()
    await expect(buildMicrodataBundle({
      surveys: [selected], includeV3Optional: false, contributor: true, values: 'labels',
      requester: fixture.requester, budget, zip: fixture.zip, audit: NO_AUDIT,
      resolve: async (part) => definition(part, selected.generation),
    })).rejects.toThrow('Labels cannot be verified')
    expect(fixture.requester).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ outFields: '*' }), expect.anything())
    expect(fixture.zip).not.toHaveBeenCalled()
  })

  it('counts both outputs against the byte budget', async () => {
    const fixture = setup(rows)
    const selected = survey()
    const input = {
      surveys: [selected], includeV3Optional: false, contributor: true,
      requester: fixture.requester, zip: fixture.zip, audit: await auditFor([['v2', 'household']]),
      resolve: async (part: MicrodataSurveyComponent) => definition(part, selected.generation),
    }
    const single = await buildMicrodataBundle({ ...input, budget })
    await expect(buildMicrodataBundle({ ...input, values: 'both', budget: { ...budget, uncompressedBytes: single.uncompressedBytes + 10 } }))
      .rejects.toThrow('instead of both')
  })

  it('labels each V3 table from its own domains and qualifies mapping rows by component', async () => {
    const fixture = setup(rows)
    const selected = survey('v3', [component('mandatory'), component('optional')])
    await buildMicrodataBundle({
      surveys: [selected], includeV3Optional: true, contributor: true, values: 'labels',
      requester: fixture.requester, budget, zip: fixture.zip,
      audit: await auditFor([['v3', 'mandatory'], ['v3', 'optional']]),
      resolve: async (part) => definition(part, selected.generation),
    })
    const manifest = JSON.parse(fixture.read('manifest.json'))
    expect(manifest.files.map((file: { path: string }) => file.path)).toEqual([
      'TEST_DATA_NGA_R08_v3/data/TEST_DATA_NGA_R08_v3_household_mandatory_labelled.csv',
      'TEST_DATA_NGA_R08_v3/data/TEST_DATA_NGA_R08_v3_household_optional_labelled.csv',
    ])
    const labels = fixture.read('TEST_DATA_NGA_R08_v3/value_labels.csv')
    expect(labels).toContain('mandatory,mandatory-item,0,value,4,Four')
    expect(labels).toContain('optional,optional-item,0,value,4,Four')
  })

  it('limits source tables separately from output files', async () => {
    const fixture = setup(rows)
    const selected = survey('v3', [component('mandatory'), component('optional')])
    await expect(buildMicrodataBundle({
      surveys: [selected], includeV3Optional: true, contributor: true, values: 'both',
      requester: fixture.requester, budget: { ...budget, sourceTables: 1 }, zip: fixture.zip,
    })).rejects.toThrow('reads 2 tables; one package can read 1')
  })
})
