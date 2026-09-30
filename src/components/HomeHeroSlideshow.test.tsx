// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeHeroSlideshow } from './HomeHeroSlideshow'

describe('HomeHeroSlideshow', () => {
  let host: HTMLDivElement
  let root: Root

  beforeEach(async () => {
    vi.useFakeTimers()
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => { root.render(<HomeHeroSlideshow />) })
  })

  afterEach(async () => {
    await act(async () => { root.unmount() })
    host.remove()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('keeps the active frame visible while bounding mounted images during rotation', async () => {
    expect(host.querySelectorAll('.hero-slide')).toHaveLength(1)
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(host.querySelectorAll('.hero-slide')).toHaveLength(2)
    const outgoing = host.querySelector('.hero-slide.is-active')
    const pictures = [...host.querySelectorAll('.hero-slides picture')]
    vi.stubGlobal('getComputedStyle', vi.fn(() => ({ transform: 'matrix(1, 0, 0, 1, 0, 12)' })))
    await act(async () => { vi.advanceTimersByTime(3000) })
    // The preloaded frame becomes active without ever detaching the old frame.
    expect(outgoing?.isConnected).toBe(true)
    expect(outgoing?.classList.contains('is-leaving')).toBe(true)
    expect((outgoing as HTMLElement).style.transform).toBe('matrix(1, 0, 0, 1, 0, 12)')
    expect([...host.querySelectorAll('.hero-slides picture')]).toEqual(pictures)
    expect(host.querySelectorAll('.hero-slide')).toHaveLength(2)
    await act(async () => { vi.advanceTimersByTime(3000) })
    expect(host.querySelectorAll('.hero-slide').length).toBeLessThanOrEqual(3)
    expect(host.querySelectorAll('.hero-slide.is-active')).toHaveLength(1)
  })

  it('keeps one still image under reduced motion', async () => {
    await act(async () => { root.unmount() })
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    root = createRoot(host)
    await act(async () => { root.render(<HomeHeroSlideshow />) })
    await act(async () => { vi.advanceTimersByTime(60000) })
    expect(host.querySelectorAll('.hero-slide')).toHaveLength(1)
  })
})
