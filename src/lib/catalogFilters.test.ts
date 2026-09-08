import { describe, expect, it } from 'vitest'
import {
  LEGACY_UNASSIGNED_PATHWAY,
  activeFilterCount,
  activeFilters,
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

describe('activeFilters', () => {
  const inputs = [
    { key: 'country', label: 'Country', value: 'NER', defaultValue: 'All countries', display: 'Niger' },
    { key: 'pathway', label: 'Evidence pathway', value: 'Seasonal calendar', defaultValue: 'All pathways', display: 'Agricultural calendar' },
    { key: 'product', label: 'Product', value: 'All products', defaultValue: 'All products' },
  ]

  it('keeps only the controls set away from their default', () => {
    expect(activeFilters(inputs).map((filter) => filter.key)).toEqual(['country', 'pathway'])
  })

  it('chips read in the words the controls use, not the stored value', () => {
    // The pathway is stored as "Seasonal calendar" and shown everywhere as
    // "Agricultural calendar"; a chip naming the stored value would be the
    // defect this replaces.
    const [, pathway] = activeFilters(inputs)
    expect(pathway.display).toBe('Agricultural calendar')
    expect(pathway.value).toBe('Seasonal calendar')
  })

  it('names each removal after the filter it removes', () => {
    expect(activeFilters(inputs)[0].removeLabel).toBe('Remove country filter: Niger')
    expect(activeFilters(inputs)[1].removeLabel).toBe('Remove evidence pathway filter: Agricultural calendar')
  })

  it('carries the unassigned pathway through as itself', () => {
    const [chip] = activeFilters([
      { key: 'pathway', label: 'Evidence pathway', value: UNASSIGNED_PATHWAY, defaultValue: 'All pathways', display: UNASSIGNED_PATHWAY },
    ])
    expect(chip.display).toBe('No pathway assigned')
    expect(chip.removeLabel).toBe('Remove evidence pathway filter: No pathway assigned')
  })

  it('falls back to the stored value when no display string is given', () => {
    const [chip] = activeFilters([{ key: 'year', label: 'Year added', value: '2026', defaultValue: 'All years' }])
    expect(chip.display).toBe('2026')
  })

  it('ignores an empty value', () => {
    expect(activeFilters([{ key: 'q', label: 'Search', value: '', defaultValue: '' }])).toEqual([])
  })

  it('counts what the chips show, so the badge and the list agree', () => {
    expect(activeFilterCount(inputs)).toBe(activeFilters(inputs).length)
    expect(activeFilterCount(inputs)).toBe(2)
  })
})

describe('activeFilters — sorting', () => {
  const sortInput = (value: string, display: string) => ({
    key: 'sort',
    label: 'Sort',
    value,
    defaultValue: 'newest',
    display,
    resets: true,
  })

  it('says nothing about the default sort', () => {
    // "Recently added" is what the catalogue does anyway; a chip for it would
    // be a control the reader never set.
    expect(activeFilters([sortInput('newest', 'Recently added')])).toEqual([])
    expect(activeFilterCount([sortInput('newest', 'Recently added')])).toBe(0)
  })

  it('summarises a non-default sort in the words the control uses', () => {
    const [chip] = activeFilters([sortInput('oldest', 'Oldest first')])
    expect(chip.display).toBe('Oldest first')
    expect(chip.value).toBe('oldest')
  })

  it('offers to reset the sort rather than to remove a filter', () => {
    // Sorting by title excludes nothing, so "Remove sort filter" would name an
    // action the control does not perform.
    expect(activeFilters([sortInput('oldest', 'Oldest first')])[0].removeLabel)
      .toBe('Reset sort: Oldest first')
    expect(activeFilters([sortInput('title', 'Title A–Z')])[0].removeLabel)
      .toBe('Reset sort: Title A–Z')
  })

  it('resetting returns the control to its default value', () => {
    expect(activeFilters([sortInput('title', 'Title A–Z')])[0].defaultValue).toBe('newest')
  })

  it('counts the sort alongside the filters, so the badge matches the chips', () => {
    const inputs = [
      { key: 'country', label: 'Country', value: 'NER', defaultValue: 'All countries', display: 'Niger' },
      sortInput('title', 'Title A–Z'),
    ]
    expect(activeFilterCount(inputs)).toBe(2)
    expect(activeFilters(inputs).map((chip) => chip.display)).toEqual(['Niger', 'Title A–Z'])
  })

  it('a search term is not part of the summary, because its field stays visible', () => {
    const inputs = [
      { key: 'q', label: 'Search', value: 'brief', defaultValue: '' },
      sortInput('newest', 'Recently added'),
    ]
    // The caller does not pass `q`; asserted here as the contract that keeps the
    // badge honest when the only thing set is the visible search box.
    expect(activeFilterCount(inputs.slice(1))).toBe(0)
  })
})
