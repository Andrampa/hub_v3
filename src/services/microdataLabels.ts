/**
 * Value labels for household microdata packages.
 *
 * Labels come from the coded-value domains on the live layer schema, and are
 * trusted only when every domain matches the digest recorded by
 * `scripts/audit_microdata_domains.py` for that generation and component. A
 * domain edited after the audit, or a grant view whose domain differs from its
 * audited master, leaves codes available and labels unverified.
 */
import auditedDomainsFile from '../data/auditedDomains.json'
import { csvCell, type FeatureField } from './dataExplorer'
import type { DataGeneration } from './protectedData'
import type { MicrodataComponent } from './microdataSurveyAccess'

export type MicrodataValues = 'codes' | 'labels' | 'both'

export interface AuditedComponent {
  generation: DataGeneration
  component: MicrodataComponent
  item_id: string
  layer_id: number
  audited_at: string
  /** `codebook_matched`, or `domains_authoritative` when the domains were approved over a differing codebook; `consistency_only` without a codebook. */
  basis: 'codebook_matched' | 'domains_authoritative' | 'consistency_only'
  codebook_item_id?: string | null
  fields: Record<string, string>
}

export interface AuditedDomains {
  schema_version: number
  generated: string | null
  components: AuditedComponent[]
}

export type LabelStatus =
  | { verified: true, audit: AuditedComponent }
  | { verified: false, reason: 'not_audited' | 'domain_changed' | 'view_differs' | 'unsafe_label', fields: string[] }

export interface FieldLabels {
  field: string
  labels: Map<string, string>
}

export interface LabelPlan {
  labelled: FieldLabels[]
  fieldsWithoutDomain: string[]
  /** Fields whose domain repeats a code with different labels; left as codes. */
  ambiguousDomains: string[]
}

export interface UnlabelledCodes {
  count: number
  codes: string[]
}

export const UNLABELLED_CODE_SAMPLE = 20

export const AUDITED_DOMAINS = auditedDomainsFile as unknown as AuditedDomains

const FORMULA_PREFIX = /^[=+\-@\t\r]/

/** Text a spreadsheet may evaluate. A value that reads as a number is not flagged. */
export function isFormulaLike(value: string) {
  return FORMULA_PREFIX.test(value) && !(value.trim() !== '' && Number.isFinite(Number(value)))
}

/** The lookup key shared by domain codes and attribute values. Empty never maps. */
export function codeKey(value: unknown) {
  if (value === null || value === undefined || value === '') return undefined
  return String(value)
}

/** Coded-value entries in a stable order, or undefined for fields without a usable domain. */
export function canonicalDomain(field: FeatureField): Array<[string, string]> | undefined {
  const domain = field.domain
  if (!domain || (domain.type && domain.type !== 'codedValue') || !domain.codedValues?.length) return undefined
  return domain.codedValues
    .map((entry): [string, string] => [String(entry.code), String(entry.name ?? '')])
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
}

/**
 * SHA-256 of the canonical domain as compact JSON. The audit script computes the
 * same digest in Python; keep both in step.
 */
export async function domainDigest(entries: Array<[string, string]>) {
  const bytes = new TextEncoder().encode(JSON.stringify(entries))
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return [...hash].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function auditedComponent(
  generation: DataGeneration, component: MicrodataComponent, audit: AuditedDomains = AUDITED_DOMAINS,
) {
  return audit.components.find((entry) => entry.generation === generation && entry.component === component)
}

/** True when this exact table has passed the audit, so the picker can offer labels for it. */
export function componentHasAudit(
  generation: DataGeneration, component: MicrodataComponent, audit: AuditedDomains = AUDITED_DOMAINS,
) {
  return Boolean(auditedComponent(generation, component, audit))
}

/**
 * Compares the resolved schema with the audit. A master must be the audited
 * item and carry every audited coded field unchanged. A grant view may omit
 * fields, but a field it does expose must keep its audited domain exactly: a
 * present field whose domain was dropped would otherwise be written as codes
 * in a file presented as labelled.
 */
export async function labelStatus(
  generation: DataGeneration, component: MicrodataComponent, source: 'master' | 'grant',
  itemId: string, fields: FeatureField[], audit: AuditedDomains = AUDITED_DOMAINS,
): Promise<LabelStatus> {
  const entry = auditedComponent(generation, component, audit)
  if (!entry || (source === 'master' && entry.item_id !== itemId)) return { verified: false, reason: 'not_audited', fields: [] }
  const changed: string[] = []
  const unsafe: string[] = []
  for (const field of fields) {
    const domain = canonicalDomain(field)
    if (!domain) {
      if (entry.fields[field.name]) changed.push(field.name)
      continue
    }
    if (domain.some(([, label]) => isFormulaLike(label))) unsafe.push(field.name)
    if (entry.fields[field.name] !== await domainDigest(domain)) changed.push(field.name)
  }
  if (source === 'master') {
    const present = new Set(fields.map((field) => field.name))
    changed.push(...Object.keys(entry.fields).filter((name) => !present.has(name)))
  }
  if (changed.length) return { verified: false, reason: source === 'grant' ? 'view_differs' : 'domain_changed', fields: changed.sort() }
  if (unsafe.length) return { verified: false, reason: 'unsafe_label', fields: unsafe.sort() }
  return { verified: true, audit: entry }
}

export function labelPlan(fields: FeatureField[], columns: string[]): LabelPlan {
  const byName = new Map(fields.map((field) => [field.name, field]))
  const plan: LabelPlan = { labelled: [], fieldsWithoutDomain: [], ambiguousDomains: [] }
  for (const column of columns) {
    const field = byName.get(column)
    const domain = field && canonicalDomain(field)
    if (!domain) { plan.fieldsWithoutDomain.push(column); continue }
    const labels = new Map<string, string>()
    let ambiguous = false
    for (const [code, label] of domain) {
      if (code === '') continue
      const existing = labels.get(code)
      if (existing !== undefined && existing !== label) ambiguous = true
      labels.set(code, label)
    }
    if (ambiguous) plan.ambiguousDomains.push(column)
    else plan.labelled.push({ field: column, labels })
  }
  return plan
}

/** Replaces known codes in place and records the ones it could not label. */
export function labelRow(
  attributes: Record<string, unknown>, plan: LabelPlan, unlabelled: Record<string, UnlabelledCodes>,
) {
  const row = { ...attributes }
  for (const { field, labels } of plan.labelled) {
    const key = codeKey(row[field])
    if (key === undefined) continue
    const label = labels.get(key)
    if (label !== undefined) { row[field] = label; continue }
    const entry = unlabelled[field] ||= { count: 0, codes: [] }
    entry.count += 1
    if (entry.codes.length < UNLABELLED_CODE_SAMPLE && !entry.codes.includes(key)) entry.codes.push(key)
  }
  return row
}

export interface ValueLabelSource {
  component: MicrodataComponent
  itemId: string
  layerId: number
  plan: LabelPlan
}

export const VALUE_LABEL_COLUMNS = ['component', 'item_id', 'layer_id', 'variable', 'code', 'label']

/** One mapping file per survey. Only verified components contribute rows. */
export function valueLabelsCsv(sources: ValueLabelSource[]) {
  const lines = [VALUE_LABEL_COLUMNS.join(',')]
  for (const { component, itemId, layerId, plan } of sources) {
    for (const { field, labels } of plan.labelled) {
      for (const [code, label] of labels) {
        lines.push([component, itemId, layerId, field, code, label].map(csvCell).join(','))
      }
    }
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function labelStatusText(status: LabelStatus) {
  if (status.verified) return 'verified'
  const detail = status.fields.length ? ` (${status.fields.slice(0, 5).join(', ')}${status.fields.length > 5 ? ', …' : ''})` : ''
  switch (status.reason) {
    case 'not_audited': return 'its domains have not passed the label audit'
    case 'domain_changed': return `domains changed since the audit${detail}`
    case 'view_differs': return `the authorized view's domains differ from the audited table${detail}`
    case 'unsafe_label': return `labels that a spreadsheet could read as formulas${detail}`
  }
}
