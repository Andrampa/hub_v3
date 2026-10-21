/**
 * DIEM architecture diagrams shown to Contributors at /architecture.
 *
 * The diagrams are copied from their source repositories by
 * `scripts/sync_architecture_diagrams.mjs`. They ship in the public bundle:
 * the Contributor check decides what the Hub shows and links, not who can
 * fetch the files (see docs/architecture_diagrams.md). Everything here is
 * loaded lazily, so a visitor who is never shown the page never downloads it.
 */

export const ARCHITECTURE_SCHEMA_VERSION = 1

export type RelationshipKind = 'data' | 'embedded' | 'link'

export interface ArchitectureDiagram {
  key: string
  title: string
  system: string
  summary: string
  repository: string
  repositoryVisibility: 'public' | 'private'
  path: string
  commit: string
  sourceChangedAt: string
  uncommittedChanges: boolean
  sha256: string
  sortOrder: number
}

export interface ArchitectureRelationship {
  from: string
  to: string
  kinds: RelationshipKind[]
  label: string
  detail: string
}

export interface ArchitectureManifest {
  schemaVersion: number
  syncedAt: string
  diagrams: ArchitectureDiagram[]
  relationships: ArchitectureRelationship[]
}

export class ArchitectureManifestError extends Error {}

const KEY_PATTERN = /^[a-z][a-z0-9-]{1,31}$/
const REPOSITORY_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/
const PATH_PATTERN = /^[A-Za-z0-9._/-]+\.html$/
const COMMIT_PATTERN = /^[0-9a-f]{40}$/
const SHA256_PATTERN = /^[0-9a-f]{64}$/
const KINDS = new Set<RelationshipKind>(['data', 'embedded', 'link'])
const MAX_DIAGRAMS = 24
const MAX_TEXT = 600

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown, field: string, max = MAX_TEXT) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new ArchitectureManifestError(`The architecture manifest has an invalid ${field}.`)
  }
  return value
}

function isoDate(value: unknown, field: string) {
  const raw = text(value, field, 40)
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(raw) || Number.isNaN(Date.parse(raw))) {
    throw new ArchitectureManifestError(`The architecture manifest has an invalid ${field}; dates must be UTC ISO 8601.`)
  }
  return raw
}

/**
 * Validates the manifest before anything is rendered from it. Keys are free
 * to change - a fifth diagram needs only a config entry and a sync - but every
 * field that becomes a link or a lookup is checked against a fixed shape.
 */
export function validateArchitectureManifest(input: unknown): ArchitectureManifest {
  if (!isRecord(input)) throw new ArchitectureManifestError('The architecture manifest is not an object.')
  if (input.schemaVersion !== ARCHITECTURE_SCHEMA_VERSION) {
    throw new ArchitectureManifestError(
      `The architecture manifest uses schema version ${String(input.schemaVersion)}, but this Hub reads version ${ARCHITECTURE_SCHEMA_VERSION}. Re-run scripts/sync_architecture_diagrams.mjs with the matching Hub version.`,
    )
  }
  const syncedAt = isoDate(input.syncedAt, 'syncedAt')
  if (!Array.isArray(input.diagrams) || !input.diagrams.length || input.diagrams.length > MAX_DIAGRAMS) {
    throw new ArchitectureManifestError('The architecture manifest lists no diagrams, or too many.')
  }
  const keys = new Set<string>()
  const diagrams = input.diagrams.map((raw): ArchitectureDiagram => {
    if (!isRecord(raw)) throw new ArchitectureManifestError('The architecture manifest has an invalid diagram entry.')
    const key = text(raw.key, 'diagram key', 32)
    if (!KEY_PATTERN.test(key)) throw new ArchitectureManifestError(`The architecture manifest has an invalid key "${key}".`)
    if (keys.has(key)) throw new ArchitectureManifestError(`The architecture manifest repeats the key "${key}".`)
    keys.add(key)
    const repository = text(raw.repository, `${key} repository`, 120)
    const path = text(raw.path, `${key} path`, 200)
    const commit = text(raw.commit, `${key} commit`, 40)
    const sha256 = text(raw.sha256, `${key} sha256`, 64)
    if (!REPOSITORY_PATTERN.test(repository)) throw new ArchitectureManifestError(`The ${key} repository name is invalid.`)
    if (!PATH_PATTERN.test(path) || path.includes('..')) throw new ArchitectureManifestError(`The ${key} source path is invalid.`)
    if (!COMMIT_PATTERN.test(commit)) throw new ArchitectureManifestError(`The ${key} commit is not a full commit hash.`)
    if (!SHA256_PATTERN.test(sha256)) throw new ArchitectureManifestError(`The ${key} content hash is invalid.`)
    if (raw.repositoryVisibility !== 'public' && raw.repositoryVisibility !== 'private') {
      throw new ArchitectureManifestError(`The ${key} repository visibility is invalid.`)
    }
    if (typeof raw.sortOrder !== 'number' || !Number.isFinite(raw.sortOrder)) {
      throw new ArchitectureManifestError(`The ${key} sort order is invalid.`)
    }
    return {
      key,
      title: text(raw.title, `${key} title`, 80),
      system: text(raw.system, `${key} system`, 80),
      summary: text(raw.summary, `${key} summary`),
      repository,
      repositoryVisibility: raw.repositoryVisibility,
      path,
      commit,
      sourceChangedAt: isoDate(raw.sourceChangedAt, `${key} sourceChangedAt`),
      uncommittedChanges: raw.uncommittedChanges === true,
      sha256,
      sortOrder: raw.sortOrder,
    }
  })
  if (!Array.isArray(input.relationships)) throw new ArchitectureManifestError('The architecture manifest has no relationships list.')
  const relationships = input.relationships.map((raw): ArchitectureRelationship => {
    if (!isRecord(raw)) throw new ArchitectureManifestError('The architecture manifest has an invalid relationship.')
    const from = text(raw.from, 'relationship source', 32)
    const to = text(raw.to, 'relationship target', 32)
    if (!keys.has(from) || !keys.has(to) || from === to) {
      throw new ArchitectureManifestError(`The relationship ${from} → ${to} refers to a diagram that is not listed.`)
    }
    if (!Array.isArray(raw.kinds) || !raw.kinds.length || raw.kinds.some((kind) => !KINDS.has(kind as RelationshipKind))) {
      throw new ArchitectureManifestError(`The relationship ${from} → ${to} has an invalid kind.`)
    }
    return {
      from,
      to,
      kinds: raw.kinds as RelationshipKind[],
      label: text(raw.label, 'relationship label', 80),
      detail: text(raw.detail, 'relationship detail'),
    }
  })
  return {
    schemaVersion: ARCHITECTURE_SCHEMA_VERSION,
    syncedAt,
    diagrams: [...diagrams].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key)),
    relationships,
  }
}

/** The source file at the exact commit the Hub copy came from. */
export function sourceUrl(diagram: ArchitectureDiagram) {
  return `https://github.com/${diagram.repository}/blob/${diagram.commit}/${diagram.path}`
}

export function commitUrl(diagram: ArchitectureDiagram) {
  return `https://github.com/${diagram.repository}/commit/${diagram.commit}`
}

export async function loadArchitectureManifest(): Promise<ArchitectureManifest> {
  const module = await import('../content/architecture/manifest.json')
  return validateArchitectureManifest(module.default)
}

// One lazy chunk per diagram: a reader downloads only the diagram they open.
const diagramSources = import.meta.glob<string>('../content/architecture/*.html', { query: '?raw', import: 'default' })

export class DiagramMissingError extends Error {}

export async function loadDiagramSource(key: string): Promise<string> {
  if (!KEY_PATTERN.test(key)) throw new DiagramMissingError(`No diagram is published under "${key}".`)
  const load = diagramSources[`../content/architecture/${key}.html`]
  if (!load) throw new DiagramMissingError(`The ${key} diagram is listed but its file is missing from this Hub build.`)
  return load()
}
