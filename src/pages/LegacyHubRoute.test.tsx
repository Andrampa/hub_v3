// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LegacyHubRoute from './LegacyHubRoute'

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

// The 404 page pulls in the whole site chrome, which needs an AuthProvider. This
// test is about which answer the route chooses, not how that page renders.
vi.mock('./NotFound', () => ({ default: () => <span>not found</span> }))

const AFGHANISTAN = '5469e0f0110c435396f2ed62e6203b98'
const CAMEROON = 'd721880c4a9748fabcc4c113c78169bb'
const AFGHANISTAN_SLUG = 'hqfao::afghanistan-agricultural-calendar'
const CAMEROON_SLUG = 'hqfao::cameroon-agricultural-calendar'

let container: HTMLDivElement
let root: Root
let go: (path: string) => void

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

/** Resolves each slug only when the test releases it, so a race can be staged. */
function deferredLookup(answers: Record<string, string>) {
  const pending: Array<() => void> = []
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    const slug = decodeURIComponent(new URL(String(input)).searchParams.get('filter[slug]') || '')
    return new Promise((resolve) => {
      pending.push(() => resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: answers[slug] ? [{ id: answers[slug] }] : [] }),
      } as Response))
    })
  })
  return pending
}

/**
 * Reports the address the router has settled on - which is what a redirect
 * changes - and hands the test a way to navigate inside this same router, so a
 * second legacy address reuses the route element rather than remounting it.
 */
function Harness() {
  const { pathname, search } = useLocation()
  go = useNavigate()
  return <span data-testid="address">{pathname}{search}</span>
}

async function renderAt(path: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <Harness />
        <Routes>
          <Route path="/documents/:identifier/*" element={<LegacyHubRoute />} />
          <Route path="/documents/:identifier" element={<LegacyHubRoute />} />
          <Route path="/catalog" element={<span>catalogue</span>} />
          <Route path="/catalog/:itemId" element={<span>product</span>} />
          <Route path="*" element={<span>elsewhere</span>} />
        </Routes>
      </MemoryRouter>,
    )
  })
}

const address = () => container.querySelector('[data-testid="address"]')?.textContent

describe('LegacyHubRoute', () => {
  it('translates an item id without waiting for any request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await renderAt(`/documents/${AFGHANISTAN}/about`)
    expect(address()).toBe(`/catalog/${AFGHANISTAN}`)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('carries a query string and fragment into the product page', async () => {
    vi.stubGlobal('fetch', vi.fn())
    await renderAt(`/documents/${AFGHANISTAN}/about?lang=fr`)
    expect(address()).toBe(`/catalog/${AFGHANISTAN}?lang=fr`)
  })

  it('opens the product a slug names', async () => {
    const pending = deferredLookup({ [CAMEROON_SLUG]: CAMEROON })
    await renderAt(`/documents/${CAMEROON_SLUG}/about`)
    expect(address()).toBe(`/documents/${CAMEROON_SLUG}/about`)
    await act(async () => { pending.forEach((settle) => settle()) })
    expect(address()).toBe(`/catalog/${CAMEROON}`)
  })

  it('follows the reader to a second legacy address while the first is in flight', async () => {
    // Both addresses match the same route, so the component is reused rather
    // than remounted, and two lookups are in flight at once. The reader must
    // land on the product they asked for last, whichever lookup settles first.
    const pending = deferredLookup({ [AFGHANISTAN_SLUG]: AFGHANISTAN, [CAMEROON_SLUG]: CAMEROON })
    await renderAt(`/documents/${AFGHANISTAN_SLUG}/about`)

    await act(async () => { go(`/documents/${CAMEROON_SLUG}/about`) })
    // The abandoned lookup settles first, and must not be taken for an answer.
    await act(async () => { pending.forEach((settle) => settle()) })

    expect(address()).toBe(`/catalog/${CAMEROON}`)
  })

  it('leaves a reader in the catalogue when the slug answers for no item', async () => {
    const pending = deferredLookup({})
    await renderAt('/documents/hqfao::withdrawn/about')
    await act(async () => { pending.forEach((settle) => settle()) })
    expect(address()).toBe('/catalog')
  })

  it('shows the 404 page for an address that names no item', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await renderAt('/documents/%ZZ/about')
    expect(container.textContent).toContain('not found')
    expect(address()).toBe('/documents/%ZZ/about')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
