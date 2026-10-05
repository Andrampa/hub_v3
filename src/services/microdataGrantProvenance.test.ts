import { describe, expect, it, vi } from 'vitest'
import { fetchGrantDatasetDefinition } from './dataExplorer'
import { buildGrantBundles, parseGrantMetadata, resolveGrantView, type GrantArcGISItem } from './microdataGrants'
import { confirmGrantSurveyComponents } from './microdataSurveyAccess'
import { MICRODATA_RESOURCES, type ProtectedRequester } from './protectedData'
import { visibilityClause } from './visibility'
import { preflightMicrodataPackage } from './microdataBundle'

vi.mock('./monitoring', () => ({ fetchValidatedSurveyKeys: async () => new Set(['YEM:4']) }))

function copy(version: 'v1' | 'v2'): GrantArcGISItem {
  const source = MICRODATA_RESOURCES.find((resource) => resource.version === version)!
  return {
    id: 'grant-copy', title: 'Approved copy', type: 'Feature Service', owner: 'operator',
    url: 'https://example.test/FeatureServer',
    tags: ['DIEM restricted microdata', 'diem-microdata-artifact-copy', `diem-microdata-source-${source.id}`],
    properties: { diemRestrictedMicrodata: {
      schemaVersion: 2, artifact: 'copy', grantId: 'test-grant', questionnaireVersion: version,
      component: 'legacy', surveyScope: [{ adm0_iso3: 'YEM', round: 4 }],
    } },
  }
}

describe('release-filtered grant provenance', () => {
  it('handles non-string tags without granting an exemption', () => {
    const item = copy('v2')
    item.tags = ['DIEM restricted microdata', 42, null] as unknown as string[]
    expect(parseGrantMetadata(item)?.releaseFiltered).not.toBe(true)
    // Search candidates use tag fallback, so those reads must also be defensive.
    item.properties = undefined
    expect(parseGrantMetadata(item)).toBeNull()
  })

  it.each(['v1', 'v2'] as const)('recognizes the declared infrastructure %s source', (version) => {
    expect(parseGrantMetadata(copy(version))).toMatchObject({ releaseFiltered: true,
      sourceItemId: MICRODATA_RESOURCES.find((resource) => resource.version === version)!.id })
  })

  it.each(['missing', 'duplicate', 'unknown', 'legacy-master', 'mismatched-version', 'schema-1', 'missing-copy-tag', 'missing-artifact'])
    ('does not exempt %s provenance', (scenario) => {
      const item = copy('v2')
      const managed = (item.properties as { diemRestrictedMicrodata: Record<string, unknown> }).diemRestrictedMicrodata
      if (scenario === 'missing') item.tags = item.tags!.slice(0, 2)
      if (scenario === 'duplicate') item.tags!.push(item.tags![2])
      if (scenario === 'unknown') item.tags![2] = `diem-microdata-source-${'a'.repeat(32)}`
      if (scenario === 'legacy-master') item.tags![2] = 'diem-microdata-source-ba78c8ed0f5d42a09ed53ca0567c8aab'
      if (scenario === 'mismatched-version') managed.questionnaireVersion = 'v1'
      if (scenario === 'schema-1') managed.schemaVersion = 1
      if (scenario === 'missing-copy-tag') item.tags!.splice(1, 1)
      if (scenario === 'missing-artifact') delete managed.artifact
      const metadata = parseGrantMetadata(item)!
      expect(metadata).not.toBeNull()
      expect(metadata.releaseFiltered).not.toBe(true)
      expect(visibilityClause({ fields: [] }, false, 'microdata', metadata.releaseFiltered)).toBe('1=0')
      expect(visibilityClause({ fields: [] }, true, 'microdata', metadata.releaseFiltered)).toBeUndefined()
    })

  it.each(['v1', 'v2'] as const)('passes infrastructure %s provenance through real resolution into survey selection', async (version) => {
    const item = copy(version)
    const requester = vi.fn(async (url: string, params?: Record<string, unknown>) => {
      if (url.includes('/content/items/')) return item
      if (url.endsWith('/FeatureServer')) return { capabilities: 'Query,Extract', tables: [{ id: 0 }] }
      if (url.endsWith('/0')) return { id: 0, name: 'household', fields: [
        { name: 'adm0_iso3', alias: 'Country', type: 'esriFieldTypeString' },
        { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
      ] }
      if (url.endsWith('/query')) return params?.returnCountOnly ? { count: 2 }
        : { features: [{ attributes: { adm0_iso3: 'YEM' } }] }
      throw new Error(`Unexpected request: ${url}`)
    }) as unknown as ProtectedRequester
    const grant = (await resolveGrantView(item.id, requester))!
    const definition = await fetchGrantDatasetDefinition(item.id, requester)
    expect(definition.resource.releaseFiltered).toBe(true)
    expect(visibilityClause(definition.layer, false, 'microdata', definition.resource.releaseFiltered)).toBeUndefined()
    expect(visibilityClause({ fields: [{ name: 'opendata', alias: '', type: '' }] }, false,
      'microdata', definition.resource.releaseFiltered)).toBe('opendata = 1')
    const result = await confirmGrantSurveyComponents(buildGrantBundles([grant]), requester,
      { contributor: false, includeTestData: false, validatedSurveys: new Set(['YEM:4']) })
    expect(result.failed).toBe(false)
    expect(result.surveys.map((survey) => survey.key)).toEqual([`${version}:YEM:4`])
    expect(result.surveys[0].components[0].bulkExportEnabled).toBe(true)
    const options = { surveys: result.surveys, requester, contributor: false, includeV3Optional: false }
    expect(await preflightMicrodataPackage(options)).toMatchObject({ recordCount: 2 })
    // The download must re-read provenance rather than trusting picker state.
    item.tags = item.tags!.slice(0, 2)
    await expect(preflightMicrodataPackage(options)).rejects.toThrow('no release flag')
  })
})
