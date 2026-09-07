// @vitest-environment happy-dom
import { act, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const fetchPendingGrantInvitations = vi.fn()
const acceptGrantInvitation = vi.fn()
const auth = {
  status: 'authenticated' as string,
  user: { username: 'andrea.amparore_faohub_testaccount' } as { username: string } | null,
  requestProtected: vi.fn(),
}

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/microdataGrantInvitations', async () => {
  const actual = await vi.importActual<typeof import('../services/microdataGrantInvitations')>(
    '../services/microdataGrantInvitations',
  )
  return { ...actual, fetchPendingGrantInvitations, acceptGrantInvitation }
})

const { MicrodataInvitationDialog, GRANTS_ROUTE } = await import('./MicrodataInvitationDialog')
const { INVITATION_COPY, ARCGIS_NOTIFICATIONS_URL } = await import('../services/microdataGrantInvitations')

const CONFIRMED = {
  invitations: [{ id: 'inv-1', groupId: 'grant-group', groupTitle: 'DIEM restricted microdata grant request-2026-001' }],
  unverified: 0,
}
const UNVERIFIED = { invitations: [], unverified: 1 }
const NOTHING = { invitations: [], unverified: 0 }

// React 19 renders through `act`, and Testing Library is deliberately not used:
// it resolves to a CommonJS build that cannot load this project's ES-module
// dependencies, and these tests need little more than querying and clicking.
declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root
let currentPath = ''

/** Records where the dialog navigates to, without mocking the router. */
function PathProbe() {
  const location = useLocation()
  currentPath = `${location.pathname}${location.hash}`
  return null
}

async function mount(ui: ReactElement) {
  await act(async () => { root.render(<MemoryRouter>{ui}<PathProbe /></MemoryRouter>) })
}

async function show(check: unknown) {
  fetchPendingGrantInvitations.mockResolvedValue(check)
  await mount(<MicrodataInvitationDialog />)
}

const dialog = () => container.querySelector<HTMLElement>('[role="dialog"]')
const text = () => container.textContent || ''
const buttons = () => Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
const button = (name: string | RegExp) => buttons().find((element) => {
  const label = (element.textContent || '').trim()
  return typeof name === 'string' ? label === name : name.test(label)
})

async function click(element: Element | undefined) {
  expect(element).toBeTruthy()
  await act(async () => { element!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
}

async function press(key: string, options: KeyboardEventInit = {}) {
  await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options })) })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  currentPath = ''
  auth.status = 'authenticated'
  auth.user = { username: 'andrea.amparore_faohub_testaccount' }
  acceptGrantInvitation.mockReset().mockResolvedValue(undefined)
  fetchPendingGrantInvitations.mockReset()
  vi.spyOn(window, 'open').mockImplementation(() => null)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  localStorage.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

describe('a confirmed invitation', () => {
  it('opens a labelled modal offering acceptance', async () => {
    await show(CONFIRMED)

    const modal = dialog()
    expect(modal).toBeTruthy()
    expect(modal?.getAttribute('aria-modal')).toBe('true')
    expect(container.querySelector('h2')?.textContent).toBe(INVITATION_COPY.confirmed.title)
    expect(text()).toContain(INVITATION_COPY.confirmed.message)
    expect(text()).toContain(INVITATION_COPY.confirmed.warning)
    expect(button(INVITATION_COPY.confirmed.action)).toBeTruthy()

    // The warning is not carried by colour alone.
    expect(text()).toContain('Time limited.')
    // And it names no date, because the browser cannot know one it could trust.
    expect(text()).not.toMatch(/\d{4}-\d{2}-\d{2}/)
  })

  it('accepts through the unchanged service call, then opens the data', async () => {
    await show(CONFIRMED)
    await click(button(INVITATION_COPY.confirmed.action))

    expect(acceptGrantInvitation).toHaveBeenCalledTimes(1)
    // The component hands the invitation and the signed-in username to the
    // service unchanged. POST, strict validation and the membership read-back
    // stay that service's business, and its own tests cover them.
    expect(acceptGrantInvitation.mock.calls[0][0]).toMatchObject({ id: 'inv-1', groupId: 'grant-group' })
    expect(acceptGrantInvitation.mock.calls[0][1]).toBe('andrea.amparore_faohub_testaccount')

    expect(currentPath).toBe(GRANTS_ROUTE)
    expect(dialog()).toBeNull()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Access accepted.')
  })

  it('keeps the modal open and reports the reason when ArcGIS refuses', async () => {
    acceptGrantInvitation.mockRejectedValue(new Error('Invitation is no longer valid.'))
    await show(CONFIRMED)
    await click(button(INVITATION_COPY.confirmed.action))

    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Invitation is no longer valid.')
    expect(dialog()).toBeTruthy()
    expect(currentPath).toBe('/')
  })
})

describe('an unverified invitation', () => {
  it('sends the user to ArcGIS instead of offering acceptance', async () => {
    await show(UNVERIFIED)

    expect(container.querySelector('h2')?.textContent).toBe(INVITATION_COPY.unverified.title)
    expect(text()).toContain(INVITATION_COPY.unverified.message)
    expect(text()).toContain(INVITATION_COPY.unverified.warning)

    // The security invariant as a UI fact: a group the Hub could not confirm
    // offers no acceptance anywhere in the dialog.
    expect(button(/accept/i)).toBeUndefined()
    expect(text()).not.toMatch(/accept invitation and open data/i)

    await click(button(INVITATION_COPY.unverified.action))
    expect(window.open).toHaveBeenCalledWith(ARCGIS_NOTIFICATIONS_URL, '_blank', 'noopener,noreferrer')
    expect(acceptGrantInvitation).not.toHaveBeenCalled()
  })

  it('keeps platform jargon out of the heading', async () => {
    await show(UNVERIFIED)
    expect(container.querySelector('h2')?.textContent).not.toMatch(/pending arcgis group invitation/i)
  })
})

describe('remind me later', () => {
  it('closes the modal for this visit but keeps a header indicator', async () => {
    await show(CONFIRMED)
    await click(button('Remind me later'))

    expect(dialog()).toBeNull()
    expect(text()).toMatch(/still waiting, and its seven days are running/i)

    // The indicator is how the dialog comes back within the same visit.
    await click(button('Review invitation'))
    expect(dialog()).toBeTruthy()
  })

  it('stores no permanent dismissal anywhere', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    await show(CONFIRMED)
    await click(button('Remind me later'))

    // A dismissal written to disk would go on hiding a live, expiring grant on
    // every later visit, and the recipient would never learn why.
    expect(setItem).not.toHaveBeenCalled()
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })

  it('shows the modal again on the next authenticated visit', async () => {
    await show(CONFIRMED)
    await click(button('Remind me later'))
    expect(dialog()).toBeNull()

    // A fresh mount is a fresh visit: nothing carried the dismissal across.
    await act(async () => { root.unmount() })
    root = createRoot(container)
    await show(CONFIRMED)
    expect(dialog()).toBeTruthy()
  })
})

describe('staying current', () => {
  it('re-reads the invitation when the window regains focus', async () => {
    await show(UNVERIFIED)
    expect(fetchPendingGrantInvitations).toHaveBeenCalledTimes(1)

    // Accepting in the ArcGIS tab is the supported route for this state, so
    // coming back has to be enough for the Hub to notice.
    fetchPendingGrantInvitations.mockResolvedValue(NOTHING)
    await act(async () => { window.dispatchEvent(new Event('focus')) })

    expect(fetchPendingGrantInvitations).toHaveBeenCalledTimes(2)
    expect(dialog()).toBeNull()
  })

  it('leaves nothing behind when the invitation is withdrawn or expires', async () => {
    await show(CONFIRMED)
    await click(button('Remind me later'))
    expect(text()).toMatch(/still waiting/i)

    fetchPendingGrantInvitations.mockResolvedValue(NOTHING)
    await act(async () => { window.dispatchEvent(new Event('focus')) })

    expect(text()).not.toMatch(/still waiting/i)
    expect(dialog()).toBeNull()
  })

  it('shows nothing at all to a signed-out visitor', async () => {
    auth.status = 'anonymous'
    auth.user = null
    await mount(<MicrodataInvitationDialog />)

    expect(fetchPendingGrantInvitations).not.toHaveBeenCalled()
    expect(dialog()).toBeNull()
    expect(text()).toBe('')
  })
})

describe('keyboard and dialog semantics', () => {
  it('names the dialog and its description for assistive technology', async () => {
    await show(CONFIRMED)
    const modal = dialog()

    expect(modal?.getAttribute('role')).toBe('dialog')
    expect(document.getElementById(modal?.getAttribute('aria-labelledby') || '')?.textContent)
      .toBe(INVITATION_COPY.confirmed.title)
    expect(document.getElementById(modal?.getAttribute('aria-describedby') || '')?.textContent)
      .toBe(INVITATION_COPY.confirmed.message)
  })

  it('moves focus into the dialog when it opens', async () => {
    await show(CONFIRMED)
    expect(document.activeElement).toBe(dialog())
  })

  it('closes on Escape, and keeps the invitation visible', async () => {
    await show(CONFIRMED)
    await press('Escape')

    expect(dialog()).toBeNull()
    expect(button('Review invitation')).toBeTruthy()
  })

  it('keeps Tab inside the dialog', async () => {
    await show(CONFIRMED)
    const focusable = Array.from(dialog()!.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'))
    expect(focusable.length).toBeGreaterThan(1)

    // Forward from the last focusable wraps to the first rather than escaping
    // to the page behind the modal.
    focusable[focusable.length - 1].focus()
    await press('Tab')
    expect(document.activeElement).toBe(focusable[0])

    // And backward from the first wraps to the last.
    await press('Tab', { shiftKey: true })
    expect(document.activeElement).toBe(focusable[focusable.length - 1])
  })
})
