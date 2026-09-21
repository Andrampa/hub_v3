// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = {
  status: 'anonymous' as string,
  user: null as { username: string; fullName?: string } | null,
  requestProtected: vi.fn().mockResolvedValue({}),
  signIn: vi.fn(),
}

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))

const { default: DataAccess } = await import('./DataAccess')

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root

async function render() {
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/data']}><DataAccess /></MemoryRouter>)
  })
}

/** The page body without the hero's sign-in action, the one part meant to differ. */
function bodyText() {
  return Array.from(container.querySelectorAll('main > section'))
    .slice(1)
    .map((section) => section.textContent)
    .join(' ')
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  auth.requestProtected.mockClear()
  auth.status = 'anonymous'
  auth.user = null
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('/data public overview', () => {
  it('reads the same signed in and signed out, below the hero', async () => {
    await render()
    const anonymous = bodyText()

    auth.status = 'authenticated'
    auth.user = { username: 'alice', fullName: 'Alice' }
    await render()

    expect(bodyText()).toBe(anonymous)
  })

  it('offers sign-in to a visitor and the workspace to a signed-in member', async () => {
    await render()
    expect(container.querySelector('.data-gate-actions button')?.textContent).toContain('Sign in or create an account')

    auth.status = 'authenticated'
    auth.user = { username: 'alice', fullName: 'Alice' }
    await render()
    const action = container.querySelector('.data-gate-actions a')
    expect(action?.getAttribute('href')).toBe('/data/surveys')
    expect(container.querySelector('.data-gate-actions')?.textContent).toContain('Signed in as Alice')
  })

  it('keeps the anchors country pages link to', async () => {
    await render()

    expect(container.querySelector('#aggregated')?.textContent).toContain('Aggregated data')
    expect(container.querySelector('#microdata')?.textContent).toContain('Household microdata')
  })

  it('explains the two kinds of data before the questionnaire generations', async () => {
    await render()

    const headings = Array.from(container.querySelectorAll('h2')).map((heading) => heading.textContent)
    expect(headings.indexOf('Aggregated data or household microdata'))
      .toBeLessThan(headings.indexOf('Three questionnaire generations, chosen for you'))
  })

  it('lists no dataset and requests no protected metadata', async () => {
    auth.status = 'authenticated'
    auth.user = { username: 'alice' }
    await render()

    // The overview explains; datasets are chosen in the workspace. The site
    // header still checks for pending grant invitations, as on every page, so
    // the assertion is about protected items, not every request.
    expect(container.querySelector('.dataset-card')).toBe(null)
    const itemRequests = auth.requestProtected.mock.calls.filter(([url]) => String(url).includes('/content/items/'))
    expect(itemRequests).toHaveLength(0)
  })

  it('does not advertise simulated V3 surveys as data', async () => {
    await render()

    const current = container.querySelector('.generation-strip-card--reference')?.textContent
    expect(current).toContain('No production data yet')
  })

  it('routes data actions into the workspace and offers the public guide', async () => {
    await render()

    const workspaceLinks = container.querySelectorAll('a[href="/data/surveys"]')
    expect(workspaceLinks.length).toBeGreaterThanOrEqual(2)
    const guideLink = container.querySelector('.data-gate-secondary[href="/data/guide"]')
    expect(guideLink?.textContent).toContain('Read the data access guide')
    expect(container.querySelector('a[href="/data/microdata-request"]')).not.toBe(null)
  })
})
