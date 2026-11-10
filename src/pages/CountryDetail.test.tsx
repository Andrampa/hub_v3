// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CountryCatalog, CountryResource, EvidencePathway, ProductType } from '../services/countries'

/**
 * The country evidence section: one filter set over one list. What is pinned
 * here is the URL contract (deep links, Back, dropped values), the contextual
 * counts, and that no control leads to an empty list it could have predicted.
 */

// Everything on the page but the evidence section is out of scope.
vi.mock('../components/SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('../components/SiteFooter', () => ({ SiteFooter: () => null }))
vi.mock('../components/HeroImage', () => ({ HeroImage: () => null }))
vi.mock('../components/CountryEditorial', () => ({ CountryEditorial: () => null }))
vi.mock('../components/CountryEveOverview', () => ({ CountryEveOverview: () => null }))
vi.mock('../components/CountryRoundTimeline', () => ({ CountryRoundTimeline: () => null }))
vi.mock('../components/CountryMonitoring', () => ({ CountryMonitoring: () => null }))
vi.mock('../components/CountryPhotoGalleries', () => ({ CountryPhotoGalleries: () => null }))
vi.mock('../components/CountryMap', () => ({ CountryShape: () => null }))
vi.mock('../services/countryEditorial', () => ({ fetchCountryEditorial: () => new Promise(() => {}) }))
vi.mock('../services/monitoring', () => ({ fetchCountryMonitoringCoverage: () => new Promise(() => {}) }))
vi.mock('../services/eve', () => ({ isEveRegularMonitoringActive: () => Promise.resolve(false) }))

let next = 0
function resource(productTypes: ProductType[], evidencePathways: EvidencePathway[], year: number): CountryResource {
  next += 1
  return {
    id: String(next).padStart(32, '0'),
    title: `Afghanistan - product ${next}`,
    type: 'PDF',
    owner: 'diem_publisher',
    access: 'public',
    created: Date.UTC(year, 5, 1 + next),
    modified: Date.UTC(year, 5, 1 + next),
    tags: [],
    countries: ['AFG'],
    productTypes,
    evidencePathways,
  }
}

const items: CountryResource[] = [
  ...Array.from({ length: 20 }, () => resource(['Questionnaires'], ['Regular monitoring'], 2025)),
  resource(['Country Briefs'], ['Regular monitoring'], 2024),
  resource(['Assessment Reports'], ['Hazard impact'], 2025),
  resource(['Assessment Reports'], ['Hazard impact'], 2024),
  resource(['Crop calendar'], ['Seasonal calendar'], 2023),
  resource(['Other DIEM documents'], [], 2024),
]

const catalog: CountryCatalog = {
  items,
  countries: [{
    iso3: 'AFG',
    name: 'Afghanistan',
    region: 'Southern Asia',
    continent: 'Asia',
    subregion: 'Southern Asia',
    resourceCount: items.length,
    latestPublished: Date.UTC(2025, 6, 1),
    typeCounts: {},
  }],
  fetchedAt: new Date(),
  complete: true,
} as CountryCatalog

vi.mock('../hooks/useCountryCatalog', () => ({
  useCountryCatalog: () => ({ catalog, error: undefined, retry: () => {} }),
}))

const { default: CountryDetail } = await import('./CountryDetail')

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root
let router: ReturnType<typeof createMemoryRouter>

async function open(path: string) {
  router = createMemoryRouter([{ path: '/countries/:iso3', element: <CountryDetail /> }], { initialEntries: [path] })
  await act(async () => root.render(<RouterProvider router={router} />))
}

const params = () => new URLSearchParams(router.state.location.search)
const tiles = () => [...container.querySelectorAll<HTMLButtonElement>('.product-filter-grid button')]
const tile = (label: string) => tiles().find((button) => button.querySelector('span')?.textContent === label)!
const tileCount = (label: string) => tile(label).querySelector('strong')?.textContent
const select = (caption: string) => [...container.querySelectorAll('.country-filter-bar label')]
  .find((label) => label.querySelector('span')?.textContent === caption)!
  .querySelector('select')!
const resultCount = () => container.querySelector('.country-results-meta strong')?.textContent

async function click(element: HTMLElement) {
  await act(async () => element.click())
}
async function choose(element: HTMLSelectElement, value: string) {
  await act(async () => {
    element.value = value
    element.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('scrollTo', () => {})
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('/countries/:iso3 evidence filters', () => {
  it('shows one evidence section, product tiles first and the pathway as a select', async () => {
    await open('/countries/afg')
    const headings = [...container.querySelectorAll('h2')].map((heading) => heading.textContent)
    expect(headings).toContain('Find country evidence')
    expect(headings).not.toContain('Choose a product')
    expect(container.querySelector('.country-pathway-filter')).toBe(null)
    expect(container.querySelector('.product-filter-grid')?.getAttribute('role')).toBe('group')
    const pathways = [...select('Evidence pathway').options].map((option) => option.textContent)
    expect(pathways).toEqual(['All pathways (25)', 'Regular monitoring (21)', 'Hazard impact (2)', 'Agricultural calendar (1)'])
    expect(pathways.join()).not.toContain('No pathway assigned')
  })

  it('narrows the tile counts by the pathway and disables tiles that would give nothing', async () => {
    await open('/countries/afg')
    await choose(select('Evidence pathway'), 'Hazard impact')
    expect(params().get('pathway')).toBe('Hazard impact')
    expect(resultCount()).toBe('2')
    expect(tileCount('All products')).toBe('2')
    expect(tileCount('Questionnaires')).toBe('0')
    expect(tile('Questionnaires').disabled).toBe(true)
    expect(tile('Assessment Reports').disabled).toBe(false)
    // The tile stays where it was, so the grid does not reflow.
    expect(tiles().map((button) => button.querySelector('span')?.textContent)).toEqual([
      'All products', 'Country Briefs', 'Assessment Reports', 'Questionnaires', 'Crop calendar', 'Other DIEM documents',
    ])
  })

  it('narrows the pathway and year options by the selected type', async () => {
    await open('/countries/afg')
    await click(tile('Assessment Reports'))
    expect(params().get('type')).toBe('Assessment Reports')
    const pathway = [...select('Evidence pathway').options]
    expect(pathway.find((option) => option.value === 'Regular monitoring')?.disabled).toBe(true)
    expect(pathway.find((option) => option.value === 'Hazard impact')?.textContent).toBe('Hazard impact (2)')
    const year = [...select('Year added').options]
    expect(year.find((option) => option.value === '2023')?.disabled).toBe(true)
    expect(year.find((option) => option.value === '2025')?.textContent).toBe('2025 (1)')
  })

  it('opens a shared link with its filters applied, keeping the stored pathway value', async () => {
    await open('/countries/afg?pathway=Seasonal+calendar')
    expect(select('Evidence pathway').value).toBe('Seasonal calendar')
    expect(resultCount()).toBe('1')
    expect(container.querySelector('.country-results-meta')?.textContent).toContain('Agricultural calendar')
    expect(container.querySelector('.filter-notice')).toBe(null)
  })

  it.each(['No pathway assigned', 'No pillar assigned'])('names and drops a "%s" link, keeping the other filters', async (value) => {
    await open(`/countries/afg?pathway=${encodeURIComponent(value)}&year=2024&page=2`)
    expect(container.querySelector('.filter-notice')?.textContent).toContain(value)
    expect(params().get('pathway')).toBe(null)
    expect(params().get('page')).toBe(null)
    expect(params().get('year')).toBe('2024')
    expect(resultCount()).toBe('3')
  })

  it('steps back one filter at a time and drops the page on a filter change', async () => {
    await open('/countries/afg')
    await click(container.querySelector<HTMLButtonElement>('.pagination button:last-of-type')!)
    expect(params().get('page')).toBe('2')
    await click(tile('Questionnaires'))
    expect(params().get('page')).toBe(null)
    await choose(select('Year added'), '2025')
    expect(params().get('year')).toBe('2025')
    await act(async () => { await router.navigate(-1) })
    expect(params().get('year')).toBe(null)
    expect(params().get('type')).toBe('Questionnaires')
    await act(async () => { await router.navigate(-1) })
    expect(params().get('type')).toBe(null)
    expect(params().get('page')).toBe('2')
  })

  it('recovers from an empty search through the empty state', async () => {
    await open('/countries/afg?q=zzzznomatch')
    expect(resultCount()).toBe('0')
    // Every tile reads 0; the selected "All products" stays usable.
    expect(tileCount('All products')).toBe('0')
    expect(tile('Questionnaires').disabled).toBe(true)
    await click(container.querySelector<HTMLButtonElement>('.empty-state button')!)
    expect(router.state.location.search).toBe('')
    expect(resultCount()).toBe('25')
  })
})
