import { describe, expect, it } from 'vitest'
import type { ArcGISItem } from '../types'
import type { SurveyRelease } from './monitoring'
import { joinRoundProducts } from './monitoringProducts'

const BRIEF_ID = 'a'.repeat(32)
const IMPACT_ID = 'b'.repeat(32)

function release(products: SurveyRelease['products']): SurveyRelease {
  return {
    id: 1,
    iso3: 'NER',
    country: 'Niger',
    round: 'Round 07',
    roundValue: '7',
    status: 'published',
    publicationDate: Date.UTC(2025, 5, 1),
    products,
    legacyThemes: [],
  }
}

function item(id: string, overrides: Partial<ArcGISItem> = {}) {
  return {
    id,
    title: 'Niger - Note d’information DIEM - Round 7',
    type: 'PDF',
    tags: [],
    groupCategories: ['/Categories/Languages/French'],
    ...overrides,
  } as unknown as ArcGISItem
}

describe('joinRoundProducts', () => {
  it('takes title and languages from the Hub catalog item a round links to', () => {
    const [round] = joinRoundProducts(
      [release([{ label: 'Country brief', url: 'https://example.org/brief', itemId: BRIEF_ID }])],
      [item(BRIEF_ID)],
    )
    expect(round.roundProducts).toHaveLength(1)
    expect(round.roundProducts[0]).toMatchObject({ type: 'Country brief', languages: ['French'], title: item(BRIEF_ID).title })
  })

  it('keeps the monitoring link when the catalog does not hold the item', () => {
    const [round] = joinRoundProducts(
      [release([{ label: 'Findings', url: 'https://example.org/findings' }])],
      [],
    )
    expect(round.roundProducts[0]).toMatchObject({
      type: 'Findings presentation',
      languages: [],
      link: { kind: 'external', href: 'https://example.org/findings' },
    })
  })

  it('drops interactive charts, impact-assessment items and duplicate links, and orders by type', () => {
    const [round] = joinRoundProducts(
      [release([
        { label: 'Questionnaire', url: 'https://example.org/q' },
        { label: 'Interactive charts', url: 'https://example.org/charts' },
        { label: 'Report', url: 'https://example.org/impact', itemId: IMPACT_ID },
        { label: 'Country brief', url: 'https://example.org/brief', itemId: BRIEF_ID },
        { label: 'Report', url: 'https://example.org/brief-again', itemId: BRIEF_ID },
      ])],
      [item(BRIEF_ID), item(IMPACT_ID, { tags: ['Impact Assessment'] })],
    )
    expect(round.roundProducts.map((product) => product.type)).toEqual(['Country brief', 'Questionnaire'])
  })
})
