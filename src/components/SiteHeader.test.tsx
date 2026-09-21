// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = {
  status: 'anonymous',
  user: null,
  error: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  clearError: vi.fn(),
}

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('./MicrodataInvitationDialog', () => ({ MicrodataInvitationDialog: () => null }))

const { SiteHeader } = await import('./SiteHeader')
const { SiteFooter } = await import('./SiteFooter')

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root

async function renderAt(pathname: string) {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={[pathname]}><SiteHeader /></MemoryRouter>)
  })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('SiteHeader household survey navigation', () => {
  it('offers the overview, personal workspace and guide in both navigation modes', async () => {
    await renderAt('/data')

    for (const selector of ['.nav-links', '#mobile-navigation']) {
      const navigation = container.querySelector(selector)
      expect(navigation?.querySelector('a[href="/data"]')).not.toBe(null)
      expect(navigation?.querySelector('a[href="/data/surveys"]')?.textContent).toContain('Your surveys')
      expect(navigation?.querySelector('a[href="/data/guide"]')?.textContent).toContain('Data access guide')
    }
  })

  it.each([
    ['/data', 'How to access data'],
    ['/data/surveys', 'Your surveys'],
    ['/data/guide', 'Data access guide'],
  ])('marks only the exact data destination current at %s', async (pathname, label) => {
    await renderAt(pathname)

    for (const selector of ['.nav-links', '#mobile-navigation']) {
      const navigation = container.querySelector(selector)
      const current = navigation?.querySelectorAll('a[aria-current="page"]') ?? []
      expect(current).toHaveLength(1)
      expect(current[0]?.textContent).toContain(label)
    }
  })
})

describe('SiteFooter household survey navigation', () => {
  it('offers the same three data destinations as the header', async () => {
    await act(async () => {
      root.render(<MemoryRouter><SiteFooter /></MemoryRouter>)
    })

    const navigation = container.querySelector('nav[aria-label="Site sections"]')
    expect(navigation?.querySelector('a[href="/data"]')?.textContent).toBe('How to access data')
    expect(navigation?.querySelector('a[href="/data/surveys"]')?.textContent).toBe('Your surveys')
    expect(navigation?.querySelector('a[href="/data/guide"]')?.textContent).toBe('Data access guide')
  })
})
