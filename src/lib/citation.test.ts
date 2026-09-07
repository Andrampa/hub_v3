import { describe, expect, it } from 'vitest'
import { citationFor, citationRound, citationUrl, defaultCitationLanguage, productUrl } from './citation'
import type { CountryResource } from '../services/countries'

/**
 * The citation is the one output of this application that leaves it and gets
 * printed in someone else's report, so a wrong year, a wrong series or an
 * unstable URL outlives every other kind of defect here.
 */
function product(overrides: Partial<CountryResource> = {}): CountryResource {
  return {
    id: 'a'.repeat(32),
    title: 'Niger - DIEM Monitoring Brief - Round 8',
    type: 'PDF',
    owner: 'diem_publisher',
    created: Date.UTC(2024, 5, 12),
    modified: Date.UTC(2026, 7, 24),
    tags: [],
    groupCategories: [],
    countries: ['NER'],
    productTypes: ['Country Briefs'],
    evidencePathways: ['Regular monitoring'],
    ...overrides,
  } as CountryResource
}

const ON = new Date(Date.UTC(2026, 8, 7))

describe('citationUrl', () => {
  it('prefers a DOI or an FAO Open Knowledge handle over the Hub URL', () => {
    // Those outlive this catalogue; items are removed from the group over time.
    expect(citationUrl(product({ url: 'https://doi.org/10.4060/cd1234en' }))).toBe('https://doi.org/10.4060/cd1234en')
    expect(citationUrl(product({ url: 'https://openknowledge.fao.org/handle/20.500.14283/cd1234en' })))
      .toBe('https://openknowledge.fao.org/handle/20.500.14283/cd1234en')
  })

  it('cites the Hub product page for anything else, including a storymap', () => {
    expect(citationUrl(product({ url: 'https://storymaps.arcgis.com/stories/abc' })))
      .toBe(productUrl('a'.repeat(32)))
    expect(citationUrl(product({ url: undefined }))).toBe(productUrl('a'.repeat(32)))
  })
})

describe('citationRound', () => {
  it('takes the round from the product itself', () => {
    expect(citationRound(product())).toBe(8)
  })

  it('borrows a sibling edition’s round when its own title omits it', () => {
    // A French brief titled without its round is the same round as the English
    // edition it is grouped with; "DIEM-Monitoring, Niger" alone describes
    // fourteen documents.
    const untitled = product({ title: 'Niger - Note d’information DIEM' })
    expect(citationRound(untitled, [product({ title: 'Niger - Brief - Round 8' })])).toBe(8)
  })

  it('is undefined when neither the product nor a sibling declares one', () => {
    expect(citationRound(product({ title: 'Niger - Calendrier agricole' }), [])).toBeUndefined()
  })
})

describe('citationFor', () => {
  it('dates the reference from created, not from the last ArcGIS edit', () => {
    // `modified` here is 2026, rewritten by the category migration. A citation
    // carrying that year would misdate the publication by two years.
    expect(citationFor(product(), 'English', { on: ON })).toContain('FAO. 2024.')
  })

  it('names the series the pathway belongs to, and translates it', () => {
    expect(citationFor(product(), 'English', { on: ON })).toContain('In: DIEM-Monitoring.')
    expect(citationFor(product(), 'Français', { on: ON })).toContain('Dans: DIEM-Monitoring [DIEM-Suivi].')
    expect(citationFor(product(), 'Español', { on: ON })).toContain('En: DIEM-Monitoring [DIEM-Monitoreo].')
  })

  it('brands EVE by its own name rather than as a hazard-impact product', () => {
    const eve = product({ productTypes: ['EVE flood reports'], evidencePathways: ['Hazard impact'] })
    expect(citationFor(eve, 'English', { on: ON }))
      .toContain('FAO DIEM - Events Visualization in Emergencies (EVE)')
  })

  it('omits the series rather than inventing one when no pathway is assigned', () => {
    const orphan = product({ evidencePathways: [], productTypes: ['Unclassified'] })
    expect(citationFor(orphan, 'English', { on: ON })).toContain('In: Data in Emergencies (DIEM) Hub.')
  })

  it('adds a borrowed round only when the title does not already state one', () => {
    // "Round 8. Round 8." reads worse than leaving the number out.
    expect(citationFor(product(), 'English', { on: ON, round: 8 })).not.toContain('Round 8. Round 8.')
    const untitled = product({ title: 'Niger - Note d’information DIEM' })
    expect(citationFor(untitled, 'English', { on: ON, round: 8 })).toContain('Note d’information DIEM. Round 8.')
  })

  it('fills in the access date instead of leaving a placeholder', () => {
    // "[Cited date]" is the part people forget to replace.
    const english = citationFor(product(), 'English', { on: ON })
    expect(english).toContain('[Cited 7 September 2026]')
    expect(english).not.toContain('[Cited date]')
    expect(citationFor(product(), 'Français', { on: ON })).toContain('[Consulté le 7 septembre 2026]')
    expect(citationFor(product(), 'Español', { on: ON })).toContain('[Consultado el 7 de septiembre de 2026]')
  })

  it('localises the place of publication', () => {
    expect(citationFor(product(), 'English', { on: ON })).toContain('Rome.')
    expect(citationFor(product(), 'Español', { on: ON })).toContain('Roma.')
  })

  it('ends with the durable address', () => {
    expect(citationFor(product({ url: 'https://doi.org/10.4060/cd1234en' }), 'English', { on: ON }))
      .toMatch(/https:\/\/doi\.org\/10\.4060\/cd1234en$/)
  })
})

describe('defaultCitationLanguage', () => {
  it('opens on the product’s own language where DIEM publishes that form', () => {
    expect(defaultCitationLanguage(product({ tags: ['DIEM-LANGUAGE:French'] }))).toBe('Français')
    expect(defaultCitationLanguage(product({ tags: ['DIEM-LANGUAGE:Spanish'] }))).toBe('Español')
  })

  it('falls back to English for any other language, including none', () => {
    expect(defaultCitationLanguage(product({ tags: ['DIEM-LANGUAGE:Portuguese'] }))).toBe('English')
    expect(defaultCitationLanguage(product())).toBe('English')
  })
})
