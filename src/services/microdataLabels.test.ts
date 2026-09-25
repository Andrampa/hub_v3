import { describe, expect, it } from 'vitest'
import type { FeatureField } from './dataExplorer'
import {
  canonicalDomain, domainDigest, isFormulaLike, labelPlan, labelRow, labelStatus, valueLabelsCsv,
  type AuditedDomains, type UnlabelledCodes,
} from './microdataLabels'

const coded = (name: string, entries: Array<[string | number, string]>, type = 'esriFieldTypeInteger'): FeatureField => ({
  name, alias: name, type, domain: { type: 'codedValue', codedValues: entries.map(([code, label]) => ({ code, name: label })) },
})

const fields: FeatureField[] = [
  { name: 'hh_id', alias: 'Household', type: 'esriFieldTypeString' },
  coded('hh_gender', [[2, 'Female'], [1, 'Male']]),
  coded('crp_main_1', [[0, 'No'], [1, 'Yes']]),
  { name: 'income', alias: 'Income', type: 'esriFieldTypeDouble', domain: { type: 'range' } },
]

async function audit(overrides: Partial<AuditedDomains['components'][number]> = {}): Promise<AuditedDomains> {
  const digests: Record<string, string> = {}
  for (const field of fields) {
    const domain = canonicalDomain(field)
    if (domain) digests[field.name] = await domainDigest(domain)
  }
  return { schema_version: 1, generated: '2026-09-25', components: [{
    generation: 'v2', component: 'household', item_id: 'master', layer_id: 0,
    audited_at: '2026-09-25', basis: 'codebook_matched', fields: digests, ...overrides,
  }] }
}

describe('microdata labels', () => {
  it('canonicalizes coded domains and ignores range domains', () => {
    expect(canonicalDomain(fields[1])).toEqual([['1', 'Male'], ['2', 'Female']])
    expect(canonicalDomain(fields[3])).toBeUndefined()
    expect(canonicalDomain(fields[0])).toBeUndefined()
  })

  it('computes the digest the audit script writes', async () => {
    // sha256('[["1","Male"],["2","Female"]]'); scripts/audit_microdata_domains.py must produce the same value.
    expect(await domainDigest([['1', 'Male'], ['2', 'Female']]))
      .toBe('2e2bdc4f1f5245f66096b2502123c9737ec8fac8231e713559028c69933dab2d')
  })

  it('labels known codes in place, keeps unknown codes raw and never maps empty values', () => {
    const plan = labelPlan(fields, ['hh_id', 'hh_gender', 'crp_main_1', 'income'])
    expect(plan.labelled.map(({ field }) => field)).toEqual(['hh_gender', 'crp_main_1'])
    expect(plan.fieldsWithoutDomain).toEqual(['hh_id', 'income'])
    const unlabelled: Record<string, UnlabelledCodes> = {}
    expect(labelRow({ hh_id: 'A1', hh_gender: 2, crp_main_1: 1, income: 10 }, plan, unlabelled))
      .toEqual({ hh_id: 'A1', hh_gender: 'Female', crp_main_1: 'Yes', income: 10 })
    expect(labelRow({ hh_gender: '1', crp_main_1: 0 }, plan, unlabelled)).toMatchObject({ hh_gender: 'Male', crp_main_1: 'No' })
    expect(labelRow({ hh_gender: 9, crp_main_1: null }, plan, unlabelled)).toMatchObject({ hh_gender: 9, crp_main_1: null })
    expect(labelRow({ hh_gender: '', crp_main_1: undefined }, plan, unlabelled)).toMatchObject({ hh_gender: '' })
    labelRow({ hh_gender: 9 }, plan, unlabelled)
    expect(unlabelled).toEqual({ hh_gender: { count: 2, codes: ['9'] } })
  })

  it('merges identical duplicate codes and leaves conflicting ones as codes', () => {
    const plan = labelPlan([
      coded('same', [[1, 'Yes'], [1, 'Yes']]),
      coded('conflict', [[1, 'Yes'], [1, 'No']]),
    ], ['same', 'conflict'])
    expect(plan.labelled.map(({ field }) => field)).toEqual(['same'])
    expect(plan.ambiguousDomains).toEqual(['conflict'])
  })

  it('flags formula-like text but not numbers', () => {
    expect(isFormulaLike('=SUM(A1)')).toBe(true)
    expect(isFormulaLike('+ more')).toBe(true)
    expect(isFormulaLike('@home')).toBe(true)
    expect(isFormulaLike('- none')).toBe(true)
    expect(isFormulaLike('-99')).toBe(false)
    expect(isFormulaLike('+5')).toBe(false)
    expect(isFormulaLike('Male')).toBe(false)
  })

  it('verifies a master only when every audited domain is unchanged', async () => {
    const register = await audit()
    expect((await labelStatus('v2', 'household', 'master', 'master', fields, register)).verified).toBe(true)
    expect(await labelStatus('v1', 'household', 'master', 'master', fields, register)).toMatchObject({ reason: 'not_audited' })
    expect(await labelStatus('v2', 'household', 'master', 'other-item', fields, register)).toMatchObject({ reason: 'not_audited' })
    const edited = [fields[0], coded('hh_gender', [[1, 'Man'], [2, 'Female']]), fields[2]]
    expect(await labelStatus('v2', 'household', 'master', 'master', edited, register))
      .toMatchObject({ verified: false, reason: 'domain_changed', fields: ['hh_gender'] })
    expect(await labelStatus('v2', 'household', 'master', 'master', [fields[0], fields[1]], register))
      .toMatchObject({ reason: 'domain_changed', fields: ['crp_main_1'] })
    const dropped = [fields[0], { ...fields[1], domain: null }, fields[2]]
    expect(await labelStatus('v2', 'household', 'master', 'master', dropped, register))
      .toMatchObject({ reason: 'domain_changed', fields: ['hh_gender'] })
  })

  it('accepts a grant view exposing a subset of fields, and refuses one that changed a domain', async () => {
    const register = await audit()
    expect((await labelStatus('v2', 'household', 'grant', 'view', [fields[0], fields[1]], register)).verified).toBe(true)
    const changed = [fields[0], coded('hh_gender', [[1, 'Male']])]
    expect(await labelStatus('v2', 'household', 'grant', 'view', changed, register))
      .toMatchObject({ reason: 'view_differs', fields: ['hh_gender'] })
    const dropped = [fields[0], { ...fields[1], domain: null }]
    expect(await labelStatus('v2', 'household', 'grant', 'view', dropped, register))
      .toMatchObject({ reason: 'view_differs', fields: ['hh_gender'] })
    const added = [...fields, coded('new_field', [[1, 'Yes']])]
    expect(await labelStatus('v2', 'household', 'grant', 'view', added, register)).toMatchObject({ reason: 'view_differs', fields: ['new_field'] })
  })

  it('refuses labels a spreadsheet could evaluate even when their digest was recorded', async () => {
    const unsafe = [coded('hh_gender', [[1, '=HYPERLINK("x")']])]
    const digest = await domainDigest(canonicalDomain(unsafe[0])!)
    const register = await audit({ fields: { hh_gender: digest } })
    expect(await labelStatus('v2', 'household', 'master', 'master', unsafe, register))
      .toMatchObject({ reason: 'unsafe_label', fields: ['hh_gender'] })
  })

  it('writes one component-qualified mapping file, escaping labels', () => {
    const plan = labelPlan([coded('q', [[1, 'Yes, "often"'], [2, 'Line\nbreak']])], ['q'])
    const csv = valueLabelsCsv([
      { component: 'mandatory', itemId: 'core', layerId: 0, plan },
      { component: 'optional', itemId: 'opt', layerId: 0, plan },
    ])
    expect(csv.startsWith('\uFEFFcomponent,item_id,layer_id,variable,code,label\r\n')).toBe(true)
    expect(csv).toContain('mandatory,core,0,q,1,"Yes, ""often"""')
    expect(csv).toContain('optional,opt,0,q,2,"Line\nbreak"')
    expect(valueLabelsCsv([])).toBe('\uFEFFcomponent,item_id,layer_id,variable,code,label\r\n')
  })
})
