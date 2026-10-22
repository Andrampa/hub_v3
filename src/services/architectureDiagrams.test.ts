import { describe, expect, it } from 'vitest'
import manifestJson from '../content/architecture/manifest.json'
import {
  ArchitectureManifestError,
  DiagramMissingError,
  loadDiagramSource,
  sourceUrl,
  validateArchitectureManifest,
} from './architectureDiagrams'

const clone = () => JSON.parse(JSON.stringify(manifestJson)) as Record<string, any>

function rejects(mutate: (manifest: Record<string, any>) => void, message: RegExp) {
  const manifest = clone()
  mutate(manifest)
  expect(() => validateArchitectureManifest(manifest)).toThrow(ArchitectureManifestError)
  expect(() => validateArchitectureManifest(manifest)).toThrow(message)
}

describe('validateArchitectureManifest', () => {
  it('accepts the synced manifest and orders diagrams by sortOrder', () => {
    const manifest = validateArchitectureManifest(clone())
    expect(manifest.diagrams.map((diagram) => diagram.key)).toEqual(['monitoring', 'hub', 'eve', 'vista'])
    expect(manifest.relationships).toHaveLength(4)
  })

  it('names the version mismatch so the reader knows what to do', () => {
    rejects((manifest) => { manifest.schemaVersion = 2 }, /schema version 2.*reads version 1.*sync_architecture_diagrams/)
  })

  it('keeps older version-1 manifests valid and validates optional architecture metadata', () => {
    const old = clone()
    for (const diagram of old.diagrams) { delete diagram.status; delete diagram.architectureAsOf }
    expect(validateArchitectureManifest(old).diagrams[0].status).toBeUndefined()
    rejects((manifest) => { manifest.diagrams[0].status = 'deployed' }, /architecture status/)
    rejects((manifest) => { manifest.diagrams[0].architectureAsOf = '2026-02-30' }, /reference date/)
    rejects((manifest) => { manifest.diagrams[0].architectureAsOf = 'yesterday' }, /reference date/)
  })

  it('rejects duplicate keys, malformed keys and short commits', () => {
    rejects((manifest) => { manifest.diagrams[1].key = 'monitoring' }, /repeats the key/)
    rejects((manifest) => { manifest.diagrams[0].key = 'Monitoring!' }, /invalid key/)
    rejects((manifest) => { manifest.diagrams[0].commit = 'abc1234' }, /full commit hash/)
  })

  it('rejects unsafe repository and path values that would become links', () => {
    rejects((manifest) => { manifest.diagrams[0].repository = 'evil.example/../x' }, /repository name/)
    rejects((manifest) => { manifest.diagrams[0].path = '../../etc/passwd.html' }, /source path/)
    rejects((manifest) => { manifest.diagrams[0].path = 'javascript:alert(1)' }, /source path/)
  })

  it('requires UTC ISO dates', () => {
    rejects((manifest) => { manifest.syncedAt = '21/10/2026' }, /UTC ISO 8601/)
    rejects((manifest) => { manifest.diagrams[2].sourceChangedAt = '2026-10-21T20:51:35+02:00' }, /UTC ISO 8601/)
  })

  it('rejects relationships to unlisted diagrams and unknown kinds', () => {
    rejects((manifest) => { manifest.relationships[0].to = 'nowhere' }, /not listed/)
    rejects((manifest) => { manifest.relationships[0].kinds = ['teleport'] }, /invalid kind/)
  })

  it('bounds the number of diagrams', () => {
    rejects((manifest) => { manifest.diagrams = [] }, /no diagrams/)
  })

  it('accepts a diagram key it has never seen, so a new diagram needs no code change', () => {
    const manifest = clone()
    manifest.diagrams.push({ ...manifest.diagrams[0], key: 'early-warning', title: 'Early warning', sortOrder: 9 })
    manifest.relationships.push({ from: 'early-warning', to: 'hub', kinds: ['link'], label: 'Links', detail: 'Reference links.' })
    expect(validateArchitectureManifest(manifest).diagrams.at(-1)?.key).toBe('early-warning')
  })
})

describe('diagram sources', () => {
  it('links the source at the exact recorded commit', () => {
    const [monitoring] = validateArchitectureManifest(clone()).diagrams
    expect(sourceUrl(monitoring)).toBe(`https://github.com/Andrampa/hh_survey_v3/blob/${monitoring.commit}/docs/diagrams/diem_data_architecture.html`)
  })

  it('loads a bundled diagram and refuses invalid or missing keys', async () => {
    expect(await loadDiagramSource('eve')).toContain('<svg')
    await expect(loadDiagramSource('../manifest')).rejects.toBeInstanceOf(DiagramMissingError)
    await expect(loadDiagramSource('unknown')).rejects.toBeInstanceOf(DiagramMissingError)
  })
})
