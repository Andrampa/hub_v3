import { describe, expect, it } from 'vitest'
import {
  LEGACY_UNASSIGNED_PATHWAY,
  UNASSIGNED_PATHWAY,
  readFilters,
  stripUnsupportedFilters,
  unsupportedFilterKey,
  unsupportedFilterMessage,
  type FilterSpec,
} from './catalogFilters'

const productSpec: FilterSpec = {
  key: 'product',
  defaultValue: 'All products',
  allowed: ['Country Briefs', 'Questionnaires'],
}

const pathwaySpec: FilterSpec = {
  key: 'pathway',
  defaultValue: 'All pathways',
  allowed: ['Regular monitoring', UNASSIGNED_PATHWAY],
  aliases: { [LEGACY_UNASSIGNED_PATHWAY]: UNASSIGNED_PATHWAY },
}

describe('readFilters', () => {
  it('applies a value the controls can produce', () => {
    const result = readFilters(new URLSearchParams('product=Questionnaires'), [productSpec])
    expect(result.values.product).toBe('Questionnaires')
    expect(result.unsupported).toEqual([])
  })

  it('reads a missing or empty param as the default', () => {
    expect(readFilters(new URLSearchParams(''), [productSpec]).values.product).toBe('All products')
    expect(readFilters(new URLSearchParams('product='), [productSpec]).values.product).toBe('All products')
  })

  it('falls back to the default and reports a value no control shows', () => {
    // The renamed-product case: the singular of a stored plural.
    const result = readFilters(new URLSearchParams('product=Country+Brief'), [productSpec])
    expect(result.values.product).toBe('All products')
    expect(result.unsupported).toEqual([{ key: 'product', value: 'Country Brief' }])
  })

  it('resolves a superseded value through its alias rather than dropping it', () => {
    const result = readFilters(new URLSearchParams(`pathway=${encodeURIComponent(LEGACY_UNASSIGNED_PATHWAY)}`), [pathwaySpec])
    expect(result.values.pathway).toBe(UNASSIGNED_PATHWAY)
    expect(result.unsupported).toEqual([])
  })

  it('accepts the explicit default without reporting it', () => {
    const result = readFilters(new URLSearchParams('pathway=All+pathways'), [pathwaySpec])
    expect(result.values.pathway).toBe('All pathways')
    expect(result.unsupported).toEqual([])
  })

  it('suspends validation while the allowed values are still unknown', () => {
    // The catalogue is paged in, so an unrecognised value early in the load is
    // not yet evidence that the value is gone.
    const loading: FilterSpec = { key: 'product', defaultValue: 'All products' }
    const result = readFilters(new URLSearchParams('product=Country+Briefs'), [loading])
    expect(result.values.product).toBe('Country Briefs')
    expect(result.unsupported).toEqual([])
  })

  it('validates each spec independently', () => {
    const result = readFilters(new URLSearchParams('product=Gone&pathway=Regular+monitoring'), [productSpec, pathwaySpec])
    expect(result.values).toEqual({ product: 'All products', pathway: 'Regular monitoring' })
    expect(result.unsupported).toHaveLength(1)
  })
})

describe('stripUnsupportedFilters', () => {
  it('removes only the unsupported keys, and the page they were counted on', () => {
    const next = stripUnsupportedFilters(
      new URLSearchParams('product=Gone&country=NER&page=3'),
      [{ key: 'product', value: 'Gone' }],
    )
    expect(next.get('product')).toBeNull()
    expect(next.get('country')).toBe('NER')
    expect(next.get('page')).toBeNull()
  })

  it('leaves the params untouched when nothing was dropped', () => {
    const next = stripUnsupportedFilters(new URLSearchParams('country=NER&page=3'), [])
    expect(next.toString()).toBe('country=NER&page=3')
  })
})

describe('unsupportedFilterMessage', () => {
  it('names one dropped value', () => {
    expect(unsupportedFilterMessage([{ key: 'product', value: 'Country Brief' }]))
      .toContain('“Country Brief”')
  })

  it('names several', () => {
    const message = unsupportedFilterMessage([
      { key: 'product', value: 'Country Brief' },
      { key: 'year', value: '1999' },
    ])
    expect(message).toContain('“Country Brief”')
    expect(message).toContain('“1999”')
  })

  it('says nothing when nothing was dropped', () => {
    expect(unsupportedFilterMessage([])).toBe('')
  })
})

describe('unsupportedFilterKey', () => {
  it('is stable for the same dropped set and different for another', () => {
    const one = [{ key: 'product', value: 'Gone' }]
    expect(unsupportedFilterKey(one)).toBe(unsupportedFilterKey([...one]))
    expect(unsupportedFilterKey(one)).not.toBe(unsupportedFilterKey([{ key: 'year', value: 'Gone' }]))
  })
})
