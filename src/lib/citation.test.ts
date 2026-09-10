import { describe, expect, it } from 'vitest'
import {
  citationFor,
  citationForm,
  citationModel,
  citationRound,
  citationSegments,
  citationText,
  citationUrl,
  collectionCitationModel,
  defaultCitationLanguage,
  productUrl,
} from './citation'
import type { CountryResource } from '../services/countries'

/**
 * The citation is the one output of this application that leaves it and gets
 * printed in someone else's report, so a wrong year, a wrong form or an
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
const HUB_CARD = productUrl('a'.repeat(32))

const storymap = (overrides: Partial<CountryResource> = {}) => product({
  id: 'd129b33705a84b6daaa5d6479f216f2f',
  title: 'Monitoring floods in the Sahel and Central Africa, 2024',
  type: 'StoryMap',
  url: 'https://storymaps.arcgis.com/stories/abc',
  evidencePathways: ['Hazard impact'],
  ...overrides,
})

describe('citationForm', () => {
  // Split by ArcGIS item type alone. EVE falls out of it with no rule of its
  // own: its app, dashboard and services are living, its reports are not.
  it.each([
    ['StoryMap', 'living'],
    ['Dashboard', 'living'],
    ['Web Mapping Application', 'living'],
    ['Web Experience', 'living'],
    ['Hub Page', 'living'],
    ['Web Map', 'living'],
    ['Feature Service', 'living'],
    ['Map Service', 'living'],
    ['Image Service', 'living'],
    ['PDF', 'static'],
    ['Document Link', 'static'],
    ['Microsoft Word', 'static'],
    ['Microsoft Powerpoint', 'static'],
    ['Microsoft Excel', 'static'],
    ['CSV', 'static'],
    ['File Geodatabase', 'static'],
    ['Shapefile', 'static'],
    ['Form', 'static'],
    ['Image', 'static'],
    ['Some type ArcGIS adds next year', 'static'],
  ])('%s cites as %s', (type, form) => {
    expect(citationForm({ type })).toBe(form)
  })
})

describe('citationUrl', () => {
  it('prefers a DOI or an FAO Open Knowledge handle over the Hub URL', () => {
    // Those outlive this catalogue; items are removed from the group over time.
    expect(citationUrl(product({ url: 'https://doi.org/10.4060/cd1234en' }))).toBe('https://doi.org/10.4060/cd1234en')
    expect(citationUrl(product({ url: 'https://openknowledge.fao.org/handle/20.500.14283/cd1234en' })))
      .toBe('https://openknowledge.fao.org/handle/20.500.14283/cd1234en')
  })

  it('cites the Hub product page for anything else, including a storymap', () => {
    expect(citationUrl(storymap({ id: 'a'.repeat(32) }))).toBe(HUB_CARD)
    expect(citationUrl(product({ url: undefined }))).toBe(HUB_CARD)
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

describe('static publication citations', () => {
  it('follow the publications editor’s example exactly, with FAO as author', () => {
    const report = product({
      title: 'Forced displacement, agricultural livelihoods and food security needs – Analytical report, May 2026',
      type: 'Document Link',
      url: 'https://openknowledge.fao.org/handle/20.500.14283/ce0389en',
      created: Date.UTC(2026, 4, 20),
    })
    expect(citationFor(report, 'English', { on: ON })).toBe(
      'FAO. 2026. Forced displacement, agricultural livelihoods and food security needs – Analytical report, May 2026. Rome. https://openknowledge.fao.org/handle/20.500.14283/ce0389en',
    )
  })

  it('carry a DOI where the product has one', () => {
    expect(citationFor(product({ url: 'https://doi.org/10.4060/cd1234en' }), 'English', { on: ON }))
      .toBe('FAO. 2024. Niger - DIEM Monitoring Brief - Round 8. Rome. https://doi.org/10.4060/cd1234en')
  })

  it('fall back to the Hub product page without a persistent address', () => {
    expect(citationFor(product(), 'English', { on: ON }))
      .toBe(`FAO. 2024. Niger - DIEM Monitoring Brief - Round 8. Rome. ${HUB_CARD}`)
  })

  it('have no container and no access date, in any language', () => {
    for (const language of ['English', 'Français', 'Español'] as const) {
      const text = citationFor(product(), language, { on: ON })
      expect(text).not.toMatch(/\b(In|Dans|En) ?:/)
      expect(text).not.toContain('[')
      expect(text).not.toContain('DIEM Hub')
    }
    expect(citationFor(product(), 'Español', { on: ON })).toContain('Round 8. Roma.')
  })

  it('italicise the whole title and nothing else, the full stop excluded', () => {
    const emphasised = citationSegments(citationModel(product(), 'English', { on: ON }))
      .filter((segment) => segment.emphasis)
    expect(emphasised).toEqual([{ text: 'Niger - DIEM Monitoring Brief - Round 8', emphasis: true }])
  })
})

describe('living product citations', () => {
  it('follow the StoryMap example exactly', () => {
    const sahel = storymap({ created: Date.UTC(2024, 9, 1) })
    expect(citationFor(sahel, 'English', { on: new Date(Date.UTC(2026, 8, 9)) })).toBe(
      'FAO. 2024. Monitoring floods in the Sahel and Central Africa, 2024. In: DIEM Hub. Rome. [Cited 9 September 2026]. https://data-in-emergencies.fao.org/catalog/d129b33705a84b6daaa5d6479f216f2f',
    )
  })

  it('italicise the Hub’s name only, not the product title', () => {
    const emphasised = citationSegments(citationModel(storymap(), 'English', { on: ON }))
      .filter((segment) => segment.emphasis)
    expect(emphasised).toEqual([{ text: 'DIEM Hub', emphasis: true }])
  })

  it('fill in the access date instead of leaving a placeholder, localised', () => {
    // "[Cited date]" is the part people forget to replace.
    expect(citationFor(storymap(), 'Français', { on: ON }))
      .toContain('Dans : DIEM Hub. Rome. [Consulté le 7 septembre 2026].')
    expect(citationFor(storymap(), 'Español', { on: ON }))
      .toContain('En: DIEM Hub. Roma. [Consultado el 7 de septiembre de 2026].')
  })

  it('no longer name an inferred programme series', () => {
    expect(citationFor(storymap(), 'English', { on: ON }))
      .not.toMatch(/DIEM-(Monitoring|Impact|Research)|Events Visualization|Data in Emergencies/)
  })
})

describe('shared citation rules', () => {
  it('date the reference from created, not from the last ArcGIS edit', () => {
    // `modified` here is 2026, rewritten by the category migration. `created`
    // is the publication proxy ArcGIS offers; a citation carrying the edit
    // year would misdate the publication by two years.
    expect(citationFor(product(), 'English', { on: ON })).toMatch(/^FAO\. 2024\./)
    expect(citationFor(storymap(), 'English', { on: ON })).toMatch(/^FAO\. 2024\./)
  })

  it('fold a borrowed round into the title, in English, and never twice', () => {
    const untitled = product({ title: 'Niger - Note d’information DIEM' })
    const model = citationModel(untitled, 'Français', { on: ON, round: 8 })
    expect(model.title).toBe('Niger - Note d’information DIEM, Round 8')
    expect(citationText(model)).toContain('DIEM, Round 8. Rome.')
    expect(citationModel(product(), 'English', { round: 8 }).title).toBe('Niger - DIEM Monitoring Brief - Round 8')
  })

  it('do not double a full stop that ends the title', () => {
    expect(citationFor(product({ title: 'Annual review 2025.' }), 'English', { on: ON }))
      .toContain('Annual review 2025. Rome.')
  })

  it('give the clipboard the rendered runs without their emphasis', () => {
    const model = citationModel(storymap(), 'English', { on: ON })
    expect(citationText(model)).toBe(citationSegments(model).map((segment) => segment.text).join(''))
  })
})

describe('collectionCitationModel', () => {
  it('cites DIEM-Monitoring as a living collection, with a date for the reader to fill in', () => {
    expect(citationText(collectionCitationModel('English')))
      .toBe('FAO. 2026. DIEM-Monitoring. In: DIEM Hub. Rome. [Cited date]. https://data-in-emergencies.fao.org')
    expect(citationText(collectionCitationModel('Français')))
      .toBe('FAO. 2026. DIEM-Monitoring [DIEM-Suivi]. Dans : DIEM Hub. Rome. [Consulté le date]. https://data-in-emergencies.fao.org')
    expect(citationText(collectionCitationModel('Español')))
      .toBe('FAO. 2026. DIEM-Monitoring [DIEM-Monitoreo]. En: DIEM Hub. Roma. [Consultado el fecha]. https://data-in-emergencies.fao.org')
  })

  it('uses the real access date when given one, and italicises the Hub', () => {
    const model = collectionCitationModel('English', { on: ON })
    expect(citationText(model)).toContain('[Cited 7 September 2026]')
    expect(citationSegments(model).filter((segment) => segment.emphasis).map((segment) => segment.text))
      .toEqual(['DIEM Hub'])
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
