// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const galleryState = { galleries: [], replacedWrapperIds: new Set<string>(), settled: false, failed: false }
const catalog = { items: [], countries: [], complete: true, fetchedAt: new Date('2026-11-20T10:00:00Z') }
vi.mock('../hooks/useCountryCatalog', () => ({ useCountryCatalog: () => ({ catalog, retry: vi.fn() }) }))
vi.mock('../hooks/usePhotoGalleries', () => ({ usePhotoGalleries: () => galleryState }))
vi.mock('../hooks/useMediaQuery', () => ({ useMediaQuery: () => false }))
vi.mock('../hooks/usePageMetadata', () => ({ usePageMetadata: () => {} }))
vi.mock('../components/SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('../components/SiteFooter', () => ({ SiteFooter: () => null }))
vi.mock('../components/HeroImage', () => ({ HeroImage: () => null }))
vi.mock('../components/HeroCredit', () => ({ HeroCredit: () => null }))
vi.mock('../components/CatalogSearchBox', () => ({ CatalogSearchBox: () => null }))
const { default: Catalog } = await import('./Catalog')
let root: Root
let host: HTMLDivElement
let search = ''
function LocationProbe() { search = useLocation().search; return null }
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  galleryState.settled = false
  galleryState.failed = false
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove() })
async function render(url: string) {
  await act(async () => root.render(<MemoryRouter initialEntries={[url]}><Catalog /><LocationProbe /></MemoryRouter>))
  return new URLSearchParams(search)
}
it('preserves gallery filters and page while the gallery source is pending', async () => {
  const params = await render('/catalog?product=Photo+gallery&country=COD&page=3')
  expect(params.get('product')).toBe('Photo gallery')
  expect(params.get('country')).toBe('COD')
  expect(params.get('page')).toBe('3')
})
it('preserves the shared URL during a gallery outage and explains the missing source', async () => {
  galleryState.settled = true
  galleryState.failed = true
  const params = await render('/catalog?product=Photo+gallery&country=COD&page=3')
  expect(params.get('product')).toBe('Photo gallery')
  expect(params.get('country')).toBe('COD')
  expect(params.get('page')).toBe('3')
  expect(host.textContent).toContain('Photo galleries are temporarily unavailable')
})
it('still clamps an invalid page after all sources have successfully loaded', async () => {
  galleryState.settled = true
  const params = await render('/catalog?page=3')
  expect(params.get('page')).toBe('1')
})
