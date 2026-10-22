#!/usr/bin/env node
/**
 * Copies the four DIEM architecture diagrams from their source repositories
 * into src/content/architecture/ and writes the manifest the Hub's
 * /architecture page reads.
 *
 * The source repositories stay authoritative; the copies here exist only
 * because the deployment build cannot read sibling checkouts. The page is
 * shown to Contributors only, but these files ship in the public bundle and
 * the public hub_v3 repository: see docs/architecture_diagrams.md.
 *
 *   node scripts/sync_architecture_diagrams.mjs            copy and write the manifest
 *   node scripts/sync_architecture_diagrams.mjs --check    exit 1 if the copies are stale
 *   node scripts/sync_architecture_diagrams.mjs --allow-dirty
 *        accept uncommitted source changes for a local preview; the manifest
 *        marks them, and the page shows the mark
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HUB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = resolve(HUB_ROOT, 'scripts/architecture_diagrams.config.json')
const OUTPUT_DIR = resolve(HUB_ROOT, 'src/content/architecture')
const MANIFEST_PATH = resolve(OUTPUT_DIR, 'manifest.json')
const SCHEMA_VERSION = 1
const MAX_DIAGRAM_BYTES = 200_000
const KEY_PATTERN = /^[a-z][a-z0-9-]{1,31}$/
const REPOSITORY_PATTERN = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/
const PATH_PATTERN = /^[A-Za-z0-9._/-]+\.html$/

/**
 * Patterns a diagram must not contain. The Hub sanitizes again before
 * rendering, so this is an early, readable refusal at the source rather than
 * the only line of defence.
 */
const FORBIDDEN = [
  [/<script\b/i, 'a <script> element'],
  [/\son[a-z]+\s*=/i, 'an inline event handler'],
  [/javascript:/i, 'a javascript: URL'],
  [/<(iframe|object|embed|form|foreignObject|image|use)\b/i, 'an embedded frame, object, form or active SVG element'],
  [/<(animate|set|animateTransform|animateMotion)\b/i, 'an SVG animation element'],
  [/url\(\s*['"]?(?!#)/i, 'an external CSS or SVG url() reference'],
]

function fail(message) {
  console.error(`sync_architecture_diagrams: ${message}`)
  process.exit(1)
}

function git(repoDir, args) {
  return execFileSync('git', ['-C', repoDir, ...args], { encoding: 'utf8' }).trim()
}

function checkSource(key, html) {
  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes > MAX_DIAGRAM_BYTES) fail(`${key}: ${bytes} bytes exceeds the ${MAX_DIAGRAM_BYTES}-byte limit.`)
  // Strip the Google Fonts links first: they are expected, and the Hub removes them.
  const withoutFonts = html.replace(/<link\b[^>]*fonts\.(googleapis|gstatic)\.com[^>]*>/gi, '')
  for (const [pattern, description] of FORBIDDEN) {
    if (pattern.test(withoutFonts)) fail(`${key}: contains ${description}.`)
  }
  if (/<link\b/i.test(withoutFonts)) fail(`${key}: contains a <link> other than Google Fonts.`)
  const svgs = html.match(/<svg\b[^>]*>/gi) || []
  if (svgs.length !== 1) fail(`${key}: expected exactly one <svg>, found ${svgs.length}.`)
  // role="img" alone names nothing: require a real description.
  const label = svgs[0].match(/\saria-label="([^"]*)"/i)?.[1]?.trim() || ''
  if (!/\srole="img"/i.test(svgs[0]) || label.length < 40) {
    fail(`${key}: the <svg> needs role="img" and a descriptive aria-label (40 characters or more).`)
  }
  if (!/<title>[^<]+<\/title>/i.test(html)) fail(`${key}: missing <title>.`)
}

function readConfig() {
  const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
  const keys = new Set()
  for (const diagram of config.diagrams) {
    if (!KEY_PATTERN.test(diagram.key)) fail(`invalid key "${diagram.key}".`)
    if (keys.has(diagram.key)) fail(`duplicate key "${diagram.key}".`)
    keys.add(diagram.key)
    if (!REPOSITORY_PATTERN.test(diagram.repository)) fail(`${diagram.key}: invalid repository.`)
    if (!PATH_PATTERN.test(diagram.path) || diagram.path.includes('..')) fail(`${diagram.key}: invalid path.`)
    if (!['public', 'private'].includes(diagram.repositoryVisibility)) fail(`${diagram.key}: repositoryVisibility must be public or private.`)
    for (const field of ['title', 'system', 'summary']) {
      if (typeof diagram[field] !== 'string' || !diagram[field].trim()) fail(`${diagram.key}: missing ${field}.`)
    }
  }
  for (const relationship of config.relationships) {
    if (!keys.has(relationship.from) || !keys.has(relationship.to)) {
      fail(`relationship ${relationship.from} -> ${relationship.to} refers to an unlisted key.`)
    }
  }
  return config
}

function main() {
  const args = new Set(process.argv.slice(2))
  const checkOnly = args.has('--check')
  const allowDirty = args.has('--allow-dirty')
  const config = readConfig()
  const files = new Map()
  const diagrams = []
  const dirtyKeys = []

  for (const entry of config.diagrams) {
    const repoDir = resolve(HUB_ROOT, entry.localRepository)
    const sourcePath = resolve(repoDir, entry.path)
    if (!existsSync(sourcePath)) fail(`${entry.key}: source not found at ${entry.localRepository}/${entry.path}.`)
    if (!git(repoDir, ['ls-files', '--', entry.path])) fail(`${entry.key}: ${entry.path} is not tracked by git.`)
    // A HEAD commit alone is not provenance: the file must match a commit.
    const dirty = Boolean(git(repoDir, ['status', '--porcelain', '--', entry.path]))
    if (dirty) dirtyKeys.push(entry.key)
    const [commit, sourceChangedAt] = git(repoDir, ['log', '-1', '--format=%H%n%cI', '--', entry.path]).split('\n')
    const html = readFileSync(sourcePath, 'utf8')
    checkSource(entry.key, html)
    // Editorial architecture state belongs to the authoritative source, not its copy date.
    const status = html.match(/<meta name="diem-architecture-status" content="([^"]+)">/)?.[1]
    const architectureAsOf = html.match(/<meta name="diem-architecture-as-of" content="([^"]+)">/)?.[1]
    if (status !== undefined && !['current', 'target'].includes(status)) fail(`${entry.key}: invalid architecture status.`)
    if (architectureAsOf !== undefined && (!/^\d{4}-\d{2}-\d{2}$/.test(architectureAsOf)
      || Number.isNaN(Date.parse(architectureAsOf))
      || new Date(architectureAsOf).toISOString().slice(0, 10) !== architectureAsOf)) fail(`${entry.key}: invalid architecture reference date.`)
    files.set(entry.key, html)
    diagrams.push({
      key: entry.key,
      title: entry.title,
      system: entry.system,
      summary: entry.summary,
      repository: entry.repository,
      repositoryVisibility: entry.repositoryVisibility,
      path: entry.path,
      commit,
      sourceChangedAt: new Date(sourceChangedAt).toISOString(),
      uncommittedChanges: dirty,
      sha256: createHash('sha256').update(html, 'utf8').digest('hex'),
      sortOrder: entry.sortOrder,
      ...(status ? { status } : {}),
      ...(architectureAsOf ? { architectureAsOf } : {}),
    })
  }

  if (dirtyKeys.length && !allowDirty) {
    fail(`uncommitted changes in ${dirtyKeys.join(', ')}. Commit them in their repositories first, or pass --allow-dirty for a local preview only.`)
  }

  const content = { schemaVersion: SCHEMA_VERSION, diagrams, relationships: config.relationships }
  const previous = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : null
  const unchanged = previous
    && JSON.stringify({ ...previous, syncedAt: undefined }) === JSON.stringify({ ...content, syncedAt: undefined })
    && diagrams.every((diagram) => existsSync(resolve(OUTPUT_DIR, `${diagram.key}.html`))
      && readFileSync(resolve(OUTPUT_DIR, `${diagram.key}.html`), 'utf8') === files.get(diagram.key))

  if (checkOnly) {
    if (!unchanged) fail('the Hub copies are out of date. Run node scripts/sync_architecture_diagrams.mjs.')
    console.log('Architecture diagram copies match their sources.')
    return
  }
  if (unchanged) {
    console.log('Architecture diagram copies already match their sources; nothing written.')
    return
  }

  // syncedAt is the date the Hub copy changed, distinct from each source's commit date.
  const manifest = { schemaVersion: SCHEMA_VERSION, syncedAt: new Date().toISOString(), ...content }
  mkdirSync(OUTPUT_DIR, { recursive: true })
  for (const [key, html] of files) writeFileSync(resolve(OUTPUT_DIR, `${key}.html`), html, 'utf8')
  writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  for (const diagram of diagrams) {
    console.log(`${diagram.key.padEnd(11)} ${diagram.commit.slice(0, 10)} ${diagram.sha256.slice(0, 12)}${diagram.uncommittedChanges ? '  UNCOMMITTED' : ''}`)
  }
  console.log(`Wrote ${diagrams.length} diagrams and manifest.json to src/content/architecture/.`)
}

main()
