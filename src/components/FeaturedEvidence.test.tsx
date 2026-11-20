import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { FeaturedEvidence } from './FeaturedEvidence'
import { groupProductFamilies } from '../lib/productFamilies'
import type { CountryResource } from '../services/countries'
const item = (overrides: Partial<CountryResource>) => ({ id: 'brief', title: 'New brief', type: 'PDF', owner: 'FAO', created: Date.UTC(2026,10,18), modified: 1, tags: [], countries: ['TCD'], productTypes: ['Country Briefs'], evidencePathways: [], ...overrides }) as CountryResource
const gallery = item({id:'gallery-test', title:'New gallery', type:'Photo gallery', galleryId:'test', galleryDate:Date.UTC(2026,7,1), galleryPublishedOn:Date.UTC(2026,10,20), created:Date.UTC(2026,10,20), countries:['COD'], productTypes:['Photo gallery']})
function render(items: CountryResource[]) { return renderToStaticMarkup(<MemoryRouter><FeaturedEvidence families={groupProductFamilies(items)} /></MemoryRouter>) }
describe('Recent publications gallery dates', () => {
  it('includes the gallery ahead of older publications and labels its publication date', () => {
    const html = render([item({}), gallery])
    expect(html.indexOf('New gallery')).toBeLessThan(html.indexOf('New brief'))
    expect(html).toContain('Published 20 November 2026')
    expect(html).not.toContain('Photos 1 August 2026')
  })
  it('excludes a gallery with unknown publication date even if its photo date is recent', () => {
    const html = render([item({}), {...gallery, galleryPublishedOn:undefined}])
    expect(html).not.toContain('New gallery')
    expect(html).toContain('New brief')
  })
})
