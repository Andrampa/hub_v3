// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import spotlightExport from '../data/briefSpotlight.json'
import type { SpotlightData } from '../lib/briefSpotlight'
import type { ArcGISItem } from '../types'
import BriefSpotlight from './BriefSpotlight'

const DATA = spotlightExport as unknown as SpotlightData
const item = (id: string) => ({ id }) as ArcGISItem
const ALL = DATA.briefs.map((brief) => item(brief.agol_item_id))

describe('BriefSpotlight', () => {
  let host: HTMLDivElement
  let root: Root
  let reducedMotion = false
  let gtag: ReturnType<typeof vi.fn>

  async function render(items: ArcGISItem[], iso3?: string) {
    await act(async () => { root.render(<BriefSpotlight items={items} iso3={iso3} />) })
  }
  const headline = () => host.querySelector('.bs-headline')?.textContent
  const button = (label: string) => [...host.querySelectorAll('button')].find((node) => node.textContent?.includes(label))

  beforeEach(() => {
    reducedMotion = false
    gtag = vi.fn()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('gtag', gtag)
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: reducedMotion && query.includes('reduce'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    window.localStorage.clear()
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    host.remove()
    vi.unstubAllGlobals()
  })

  it('renders nothing when no brief is in the public catalogue', async () => {
    await render([item('not-a-brief')])
    expect(host.innerHTML).toBe('')
    await render([])
    expect(host.innerHTML).toBe('')
  })

  it('shows one finding with its attribution, proof and link to the brief', async () => {
    await render(ALL)
    expect(headline()).toBeTruthy()
    expect(host.querySelector('.bs-attribution')?.textContent).toMatch(/^From the .+ brief, [A-Z][a-z]+ \d{4}$/)
    const link = host.querySelector<HTMLAnchorElement>('.bs-cta')!
    expect(link.href).toMatch(/^https:\/\/openknowledge\.fao\.org\//)
    expect(link.textContent).toMatch(/^Read the .+ brief/)
    expect(DATA.briefs.map((brief) => brief.record_url)).toContain(link.getAttribute('href'))
    expect(host.querySelector('blockquote')?.textContent?.length).toBeGreaterThan(10)
    expect(host.querySelector('.bs-footnote')?.textContent).toContain('CC BY 4.0')
    expect(host.textContent).not.toMatch(/\bIPC\b/)
  })

  it('links the card to the brief it came from', async () => {
    const lebanon = DATA.briefs.find((brief) => brief.iso3 === 'LBN')!
    await render([item(lebanon.agol_item_id)])
    expect(host.querySelector('.bs-cta')?.getAttribute('href')).toBe(lebanon.record_url)
    expect(host.querySelector('a[href^="/monitoring?"]')?.getAttribute('href'))
      .toBe(`/monitoring?iso=LBN&round=${Math.max(...lebanon.rounds)}`)
    expect(host.querySelector('.bs-origin strong')?.textContent).toBe('Lebanon')
    await render([])
    expect(host.querySelector('.bs-cta')).toBeNull()
  })

  it('moves to another finding on request, announces it and reports the click on the link', async () => {
    await render(ALL)
    const first = headline()
    const globe = host.querySelector('.bs-globe')
    expect(globe).toBeTruthy()
    expect(host.querySelector('[aria-live]')?.textContent).toBe('')
    await act(async () => { button('Next finding')!.click() })
    expect(headline()).not.toBe(first)
    expect(host.querySelector('.bs-globe')).toBe(globe)
    expect(host.querySelector('[aria-live]')?.textContent).toContain(headline())
    expect(gtag).toHaveBeenCalledWith('event', 'brief_spotlight_impression', expect.objectContaining({ card_id: expect.any(String) }))
    await act(async () => {
      const link = host.querySelector<HTMLAnchorElement>('.bs-cta')!
      link.addEventListener('click', (event) => event.preventDefault(), { once: true })
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(gtag).toHaveBeenCalledWith('event', 'brief_spotlight_click', expect.objectContaining({ treatment: expect.any(String) }))
  })

  it('rotates on the progress timer and pauses on request', async () => {
    await render(ALL)
    const first = headline()
    expect(host.querySelector('.bs-card')?.classList.contains('is-running')).toBe(true)
    await act(async () => { host.querySelector('.bs-progress')!.dispatchEvent(new Event('animationend', { bubbles: true })) })
    expect(headline()).not.toBe(first)
    await act(async () => { button('Pause')!.click() })
    expect(host.querySelector('.bs-progress')).toBeTruthy()
    expect(host.querySelector('.bs-card')?.classList.contains('is-running')).toBe(false)
    expect(button('Play')?.getAttribute('aria-pressed')).toBe('true')
  })

  it('shows twenty different findings before repeating the same automatic cycle', async () => {
    await render(ALL)
    const first = headline()
    const advance = () => act(async () => {
      host.querySelector('.bs-progress')!.dispatchEvent(new Event('animationend', { bubbles: true }))
    })
    const visited = new Set([first])
    for (let index = 1; index < 20; index++) {
      await advance()
      visited.add(headline())
    }
    expect(visited.size).toBe(20)
    await advance()
    expect(headline()).toBe(first)
    await advance()
    expect(headline()).not.toBe(first)
  })

  it('holds the card while its evidence is open or it has keyboard focus', async () => {
    await render(ALL)
    const card = host.querySelector('.bs-card')!
    const first = headline()
    await act(async () => { button('Next finding')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true })) })
    expect(card.classList.contains('is-running')).toBe(false)
    await act(async () => { host.querySelector('.bs-progress')!.dispatchEvent(new Event('animationend', { bubbles: true })) })
    expect(headline()).toBe(first)
  })

  it('does not rotate by itself under reduced motion and leaves Next available', async () => {
    reducedMotion = true
    await render(ALL)
    expect(host.querySelector('.bs-progress')).toBeNull()
    expect(host.querySelector('.bs-card')?.classList.contains('is-running')).toBe(false)
    expect(button('Pause')).toBeUndefined()
    expect(button('Next finding')).toBeDefined()
  })

  it('starts impressions and rotation only when enough of the card is visible', async () => {
    let reportVisibility!: IntersectionObserverCallback
    const observe = vi.fn()
    vi.stubGlobal('IntersectionObserver', class {
      observe = observe
      disconnect = vi.fn()
      constructor(callback: IntersectionObserverCallback) { reportVisibility = callback }
    })
    await render(ALL)
    const card = host.querySelector('.bs-card')!
    expect(observe).toHaveBeenCalledWith(card)
    const report = (ratio: number) => act(async () => {
      reportVisibility([{ isIntersecting: true, intersectionRatio: ratio } as IntersectionObserverEntry],
        {} as IntersectionObserver)
    })
    await report(0.1)
    expect(card.classList.contains('is-running')).toBe(false)
    expect(gtag).not.toHaveBeenCalled()
    await report(0.35)
    expect(card.classList.contains('is-running')).toBe(true)
    expect(gtag).toHaveBeenCalledTimes(1)
  })

  it('shows a single eligible card without rotation controls', async () => {
    const single = DATA.briefs.find((brief) => DATA.cards.filter((card) => card.survey === brief.survey).length >= 1)!
    const onlyCard = DATA.cards.find((card) => card.survey === single.survey)!
    vi.resetModules()
    vi.doMock('../data/briefSpotlight.json', () => ({ default: { ...DATA, briefs: [single], cards: [onlyCard] } }))
    const { default: Isolated } = await import('./BriefSpotlight')
    await act(async () => { root.render(<Isolated items={[item(single.agol_item_id)]} />) })
    expect(headline()).toBe(onlyCard.headline)
    expect(host.querySelector('.bs-controls')).toBeNull()
    expect(host.querySelector('.bs-progress')).toBeNull()
    vi.doUnmock('../data/briefSpotlight.json')
  })

  it('offers the same country’s previous round where the export holds both', async () => {
    const chad = DATA.briefs.filter((brief) => brief.iso3 === 'TCD')
    expect(chad.length).toBe(2)
    window.localStorage.clear()
    await render(chad.map((brief) => item(brief.agol_item_id)), 'TCD')
    for (let step = 0; step < 12 && !button('round 9'); step += 1) {
      await act(async () => { button('Next finding')!.click() })
    }
    await act(async () => {
      button('round 9')!.focus()
      button('round 9')!.click()
    })
    expect(host.querySelector('.bs-origin span')?.textContent).toBe('Round 9')
    expect(button('round 9')).toBeUndefined()
    expect(document.activeElement).toBe(button('Next finding'))
  })
})
