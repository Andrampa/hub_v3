import { describe, expect, it, vi } from 'vitest'
import { buildMicrodataBundle, buildMicrodataParts, preflightMicrodataPackage, type MicrodataBundleOptions, type MicrodataPart } from './microdataBundle'
import type { MicrodataSurvey } from './microdataSurveyAccess'
import type { DatasetDefinition } from './dataExplorer'
import type { ProtectedRequester } from './protectedData'

function fixture() {
  const surveys = [1, 2, 3].map((round): MicrodataSurvey => ({
    key: `v2:YEM:${round}`, generation: 'v2', adm0Iso3: 'YEM', countryName: 'Yemen', round,
    testData: false, components: [{ component: 'household', source: 'master', itemId: 'master',
      layerUrl: 'https://example.test/0', countryField: 'adm0_iso3', roundField: 'round', bulkExportEnabled: true }],
  }))
  const definition: DatasetDefinition = { resource: { id: 'master', version: 'v2', kind: 'microdata',
    fallbackTitle: 'Household', description: '', access: 'available' }, serviceUrl: 'https://example.test',
    layerUrl: 'https://example.test/0', isTable: true, layer: { id: 0, name: 'household', fields: [
      { name: 'adm0_iso3', alias: '', type: 'esriFieldTypeString' },
      { name: 'round', alias: '', type: 'esriFieldTypeInteger' },
      { name: 'value', alias: '', type: 'esriFieldTypeString' },
    ] } }
  const requester = vi.fn(async (_url: string, params?: Record<string, unknown>) => params?.returnCountOnly ? { count: 1 }
    : { features: [{ attributes: { adm0_iso3: 'YEM', round: Number(String(params?.where).match(/round = (\d+)/)?.[1]), value: 'abc' } }] })
  const archives: Record<string, Uint8Array>[] = []
  const zip = vi.fn(async (files: Record<string, Uint8Array>) => { archives.push({ ...files }); return new Uint8Array([80, 75, 3, 4]) })
  const input: MicrodataBundleOptions = { surveys, contributor: true, includeV3Optional: false,
    requester: requester as unknown as ProtectedRequester, budget: { records: 10, sourceTables: 20, uncompressedBytes: 10000 },
    resolve: async () => definition, zip }
  const parts: MicrodataPart[] = []
  const text = (files: Record<string, Uint8Array>, path: string) => new TextDecoder().decode(files[path])
  return { input, parts, archives, requester, zip, text }
}

describe('whole-survey microdata parts', () => {
  it('fills a part exactly, then splits the overflow without rereading rows', async () => {
    const f = fixture()
    const single = await buildMicrodataBundle({ ...f.input, surveys: [f.input.surveys[0]] })
    f.archives.length = 0; f.requester.mockClear()
    await buildMicrodataParts({ ...f.input, budget: { ...f.input.budget, uncompressedBytes: single.uncompressedBytes * 2 }, onPart: (part) => f.parts.push(part) })
    expect(f.parts.map((part) => part.surveyKeys)).toEqual([['v2:YEM:1', 'v2:YEM:2'], ['v2:YEM:3']])
    expect(f.parts[0].uncompressedBytes).toBe(single.uncompressedBytes * 2)
    expect(f.requester.mock.calls.filter(([, params]) => params?.outFields === '*')).toHaveLength(3)
    for (const [index, archive] of f.archives.entries()) {
      const manifest = JSON.parse(f.text(archive, 'manifest.json'))
      expect(manifest.part_number).toBe(index + 1)
      expect(manifest.files.every((file: { survey_key: string }) => f.parts[index].surveyKeys.includes(file.survey_key))).toBe(true)
      expect(archive['LICENCE.txt']).toBeDefined()
      expect(archive['README.txt']).toBeDefined()
      expect(f.text(archive, 'README.txt')).toContain('Generated:')
      expect(f.text(archive, 'README.txt')).toContain('Use is subject to LICENCE.txt')
      for (const survey of manifest.surveys) {
        expect(archive[`${survey.folder}/documentation_and_metadata.txt`]).toBeDefined()
        expect(archive[`${survey.folder}/value_labels.csv`]).toBeDefined()
      }
    }
  })

  it('splits at the record limit and refuses a single oversized survey', async () => {
    const f = fixture()
    await buildMicrodataParts({ ...f.input, budget: { ...f.input.budget, records: 1 }, onPart: (part) => f.parts.push(part) })
    expect(f.parts.map((part) => part.recordCount)).toEqual([1, 1, 1])
    await expect(buildMicrodataParts({ ...f.input, budget: { ...f.input.budget, records: 0 }, onPart: vi.fn() })).rejects.toThrow('alone exceeds')
    await expect(buildMicrodataParts({ ...f.input, budget: { ...f.input.budget, uncompressedBytes: 1 }, onPart: vi.fn() })).rejects.toThrow('CSV byte limit')
  })

  it('keeps completed parts on cancellation without publishing a partial survey', async () => {
    const f = fixture(), controller = new AbortController()
    await expect(buildMicrodataParts({ ...f.input, signal: controller.signal,
      budget: { ...f.input.budget, records: 1 }, onPart: (part) => { f.parts.push(part); controller.abort() } })).rejects.toThrow('cancelled')
    expect(f.parts).toHaveLength(1)
    expect(f.parts[0].surveyKeys).toEqual(['v2:YEM:1'])
  })

  it('keeps completed parts when compression fails or retained ZIP capacity is exhausted', async () => {
    const f = fixture()
    f.zip.mockImplementationOnce(async (files) => { f.archives.push(files); return new Uint8Array(4) })
      .mockRejectedValueOnce(new Error('Worker failed'))
    await expect(buildMicrodataParts({ ...f.input, budget: { ...f.input.budget, records: 1 }, onPart: (part) => f.parts.push(part) })).rejects.toThrow('Worker failed')
    expect(f.parts).toHaveLength(1)
    const g = fixture()
    await expect(buildMicrodataParts({ ...g.input, retainedZipLimit: 4,
      budget: { ...g.input.budget, records: 1 }, onPart: (part) => g.parts.push(part) })).rejects.toThrow('Not prepared: Yemen round 2 (V2); Yemen round 3 (V2)')
    expect(g.parts).toHaveLength(1)
  })

  it('keeps the ordinary filename when the complete selection fits one part', async () => {
    const f = fixture()
    await buildMicrodataParts({ ...f.input, now: () => new Date('2026-10-05T12:00:00Z'), onPart: (part) => f.parts.push(part) })
    expect(f.parts).toHaveLength(1)
    expect(f.parts[0].fileName).toBe('DIEM_microdata_2026-10-05.zip')
    const readme = f.text(f.archives[0], 'README.txt')
    expect(readme).toContain('Generated: 2026-10-05T12:00:00.000Z')
    expect(readme).toContain('All requested surveys and components are included')
  })

  it('shows the sample estimate without rejecting the selection or retaining sample rows', async () => {
    const f = fixture()
    const result = await preflightMicrodataPackage({ ...f.input, budget: { ...f.input.budget, uncompressedBytes: 1, records: 1 }, splitParts: true, estimateSize: true })
    expect(result.estimatedBytes).toBeGreaterThan(1)
    expect(result.recordCount).toBe(3)
    expect(f.requester.mock.calls.filter(([, params]) => params?.resultRecordCount === '30')).toHaveLength(3)
  })

  it('keeps both V3 components in the same survey folder and part', async () => {
    const f = fixture()
    const surveys = f.input.surveys.slice(0, 2).map((survey): MicrodataSurvey => ({ ...survey,
      key: survey.key.replace('v2', 'v3'), generation: 'v3', testData: true,
      components: ['mandatory', 'optional'].map((component) => ({ ...survey.components[0], component: component as 'mandatory' | 'optional' })),
    }))
    const resolve = f.input.resolve!
    await buildMicrodataParts({ ...f.input, surveys, includeV3Optional: true,
      budget: { ...f.input.budget, records: 2 },
      resolve: async (...args) => { const def = await resolve(...args); return { ...def, resource: { ...def.resource, version: 'v3' } } },
      onPart: (part) => f.parts.push(part) })
    expect(f.parts).toHaveLength(2)
    expect(f.parts.every((part) => part.surveyKeys.length === 1 && part.fileCount === 2)).toBe(true)
  })
})
