import { describe, expect, it } from 'vitest'
import { UNRECORDED_LANGUAGE, groupProductFamilies, itemLanguage } from './productFamilies'
import type { ArcGISItem } from '../types'

/**
 * Family grouping decides the public product count - 715 families over 755
 * discoverable records at the time of writing - and every "Available in" chip.
 * It runs entirely on mutable tags, so the cases worth pinning are the ones
 * where a tag is missing, malformed, or disagrees with the title.
 */
function item(overrides: Partial<ArcGISItem> = {}): ArcGISItem {
  return {
    id: '1'.repeat(32),
    title: 'Mali - DIEM Monitoring Brief - Round 7',
    type: 'PDF',
    owner: 'diem_publisher',
    created: Date.UTC(2024, 0, 1),
    modified: Date.UTC(2024, 0, 1),
    tags: [],
    ...overrides,
  } as ArcGISItem
}

const CANONICAL = 'a'.repeat(32)
const VARIANT = 'b'.repeat(32)

describe('itemLanguage', () => {
  it('trusts the DIEM-LANGUAGE tag first', () => {
    expect(itemLanguage(item({ tags: ['DIEM-LANGUAGE:French'] }))).toBe('French')
    expect(itemLanguage(item({ tags: ['diem-language:Spanish'] }))).toBe('Spanish')
  })

  /**
   * The tag wins even when the title marker contradicts it. That is a known
   * gap: the 2026-09-03 review found two records tagged French that were not
   * ("Honduras - DIEM Monitoring Executive Brief - Round 4", "Nigeria -
   * Household Questionnaire - Round8"), and asked for a cross-check here.
   *
   * The fix was applied to the data instead - scripts/categorize_monitoring_
   * products.py corrected 57 rows on 2026-09-04 - and a live check on
   * 2026-09-07 found 0 of 75 tagged items disagreeing with their title marker.
   * So there is currently nothing for a cross-check to catch, and this test
   * records the precedence as it actually is rather than as the review
   * described it. If a mislabelled tag ever reappears, this is the line that
   * explains why the card believed it.
   */
  it('lets the tag override a contradicting title marker', () => {
    expect(itemLanguage(item({
      title: 'Honduras - DIEM Monitoring Executive Brief - Round 4 (ES)',
      tags: ['DIEM-LANGUAGE:French'],
    }))).toBe('French')
  })

  it('reads an explicit title marker when no tag is present', () => {
    expect(itemLanguage(item({ title: 'Honduras - Executive Brief - Round 4 (ES)' }))).toBe('Spanish')
    expect(itemLanguage(item({ title: 'RDC - Note d’information (FR)' }))).toBe('French')
    expect(itemLanguage(item({ title: 'Mali - Brief (EN)' }))).toBe('English')
    expect(itemLanguage(item({ title: 'Mali - Brief Français' }))).toBe('French')
    expect(itemLanguage(item({ title: 'Honduras - Informe Español' }))).toBe('Spanish')
  })

  it('only reads a marker at the end of the title', () => {
    // "(ES)" in the middle is part of a name, not a language declaration.
    expect(itemLanguage(item({ title: 'Report (ES) for the region' }))).toBe(UNRECORDED_LANGUAGE)
  })

  it('falls back to the Languages category, then says nothing', () => {
    expect(itemLanguage(item({ groupCategories: ['/Categories/Languages/Portuguese'] }))).toBe('Portuguese')
    expect(itemLanguage(item({}))).toBe(UNRECORDED_LANGUAGE)
  })
})

describe('groupProductFamilies', () => {
  it('groups variants onto the canonical item named by DIEM-FAMILY', () => {
    const families = groupProductFamilies([
      item({ id: CANONICAL, title: 'Mali - Brief - Round 7' }),
      item({ id: VARIANT, title: 'Mali - Note - Cycle 7 (FR)', tags: [`DIEM-FAMILY:${CANONICAL}`] }),
    ])
    expect(families).toHaveLength(1)
    expect(families[0].primary.id).toBe(CANONICAL)
    expect(families[0].variants).toHaveLength(2)
  })

  it('counts an untagged item as its own family', () => {
    // This is what makes the public count a count of products rather than files.
    expect(groupProductFamilies([item({ id: CANONICAL }), item({ id: VARIANT })])).toHaveLength(2)
  })

  it('ignores a malformed family tag rather than merging on it', () => {
    // A tag that is not a 32-character item id cannot name a canonical item, so
    // treating it as a group key would fuse unrelated products.
    const families = groupProductFamilies([
      item({ id: CANONICAL, tags: ['DIEM-FAMILY:not-an-id'] }),
      item({ id: VARIANT, tags: ['DIEM-FAMILY:not-an-id'] }),
    ])
    expect(families).toHaveLength(2)
  })

  it('falls back to the most recently modified variant when the canonical item is absent', () => {
    // The canonical item can leave the group while its translations remain.
    const families = groupProductFamilies([
      item({ id: VARIANT, modified: 10, tags: [`DIEM-FAMILY:${CANONICAL}`] }),
      item({ id: 'c'.repeat(32), modified: 99, tags: [`DIEM-FAMILY:${CANONICAL}`] }),
    ])
    expect(families).toHaveLength(1)
    expect(families[0].primary.id).toBe('c'.repeat(32))
  })

  it('orders languages English, French, Spanish, then anything else', () => {
    const families = groupProductFamilies([
      item({ id: CANONICAL, tags: ['DIEM-LANGUAGE:English'] }),
      item({ id: VARIANT, tags: [`DIEM-FAMILY:${CANONICAL}`, 'DIEM-LANGUAGE:Spanish'] }),
      item({ id: 'c'.repeat(32), tags: [`DIEM-FAMILY:${CANONICAL}`, 'DIEM-LANGUAGE:French'] }),
      item({ id: 'd'.repeat(32), tags: [`DIEM-FAMILY:${CANONICAL}`, 'DIEM-LANGUAGE:Portuguese'] }),
    ])
    expect(families[0].languages.map((entry) => entry.language))
      .toEqual(['English', 'French', 'Spanish', 'Portuguese'])
  })

  it('takes latestCreated and latestModified across the whole family', () => {
    // Sorting and the "New" badge run on latestCreated, so a translation added
    // later must lift the family in "Recently added".
    const families = groupProductFamilies([
      item({ id: CANONICAL, created: 100, modified: 100 }),
      item({ id: VARIANT, created: 500, modified: 300, tags: [`DIEM-FAMILY:${CANONICAL}`] }),
    ])
    expect(families[0].latestCreated).toBe(500)
    expect(families[0].latestModified).toBe(300)
  })

  it('returns nothing for an empty catalogue rather than throwing', () => {
    expect(groupProductFamilies([])).toEqual([])
  })
})
