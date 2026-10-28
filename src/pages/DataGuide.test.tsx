// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AGGREGATE_RESOURCES, GENERATIONS, REFERENCE_GENERATION, resourcesForGeneration } from '../services/protectedData'

// The guide is about its own content; the site chrome needs an AuthProvider.
vi.mock('../components/SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('../components/SiteFooter', () => ({ SiteFooter: () => null }))

const { default: DataGuide } = await import('./DataGuide')

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.stubGlobal('IntersectionObserver', class {
    observe() {}
    disconnect() {}
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/data/guide']}><DataGuide /></MemoryRouter>)
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

describe('/data/guide', () => {
  it('leads with the three actions and leaves sign-in to the workspace', () => {
    const actions = [...container.querySelectorAll('.guide-hero-actions a')]
    expect(actions.map((link) => link.getAttribute('href'))).toEqual([
      '/data/surveys',
      expect.stringContaining('microdata.fao.org'),
      '/data/microdata-request',
    ])
    expect(container.querySelector('.guide-hero button')).toBe(null)
  })

  it('puts access instructions before background and reference material', () => {
    const order = [...container.querySelectorAll('.guide-body > section[id]')].map((section) => section.id)
    expect(order.slice(0, 5)).toEqual(['accessibility', 'aggregated', 'microdata', 'about', 'generations'])
    const toc = [...container.querySelectorAll('.guide-toc a')].map((link) => link.getAttribute('href'))
    expect(toc).toEqual(order.map((id) => `#${id}`))
    expect(container.querySelector('.guide-toc a.active')?.getAttribute('href')).toBe('#accessibility')
  })

  it('keeps the anchors older /data links and other pages point at', () => {
    for (const id of ['aggregated', 'microdata', 'generations', 'boundaries', 'accessibility']) {
      expect(container.querySelector(`#${id}`)).not.toBe(null)
    }
  })

  it('says when a generation has no production data yet', () => {
    const cards = [...container.querySelectorAll('.guide-generation')]
    for (const card of cards) {
      const id = (Object.keys(GENERATIONS) as Array<keyof typeof GENERATIONS>)
        .find((key) => card.querySelector('h3')?.textContent === GENERATIONS[key].name)!
      const themes = resourcesForGeneration(AGGREGATE_RESOURCES, id)
      const preview = themes.length > 0 && themes.every((resource) => resource.preview)
      expect(card.textContent?.includes('No production data yet.')).toBe(preview)
    }
    // The configuration this guards: the current standard is still preview-only.
    const reference = cards.find((card) => card.classList.contains('guide-generation--reference'))
    expect(reference?.querySelector('h3')?.textContent).toBe(GENERATIONS[REFERENCE_GENERATION].name)
  })
})
