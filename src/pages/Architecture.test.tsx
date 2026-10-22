// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true,"disableCSSFileLoading":true,"disableJavaScriptFileLoading":true,"handleDisabledFileLoadingAsSuccess":true,"navigation":{"disableChildFrameNavigation":true,"disableChildPageNavigation":true}}}
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import manifestJson from '../content/architecture/manifest.json'

const auth = {
  status: 'anonymous' as string,
  user: null as null | { username: string; capabilities: { contributor: boolean } },
  signIn: vi.fn(),
}
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../components/SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('../components/SiteFooter', () => ({ SiteFooter: () => null }))
vi.mock('../lib/diagramDocument', async () => {
  const actual = await vi.importActual<typeof import('../lib/diagramDocument')>('../lib/diagramDocument')
  return { ...actual, loadDiagramFontFaceCss: () => Promise.resolve('') }
})

const loadArchitectureManifest = vi.fn()
const loadDiagramSource = vi.fn()
vi.mock('../services/architectureDiagrams', async () => {
  const actual = await vi.importActual<typeof import('../services/architectureDiagrams')>('../services/architectureDiagrams')
  return { ...actual, loadArchitectureManifest, loadDiagramSource }
})

const { validateArchitectureManifest, ArchitectureManifestError, DiagramMissingError } = await import('../services/architectureDiagrams')
const { default: Architecture } = await import('./Architecture')

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root
let navigateTo: (path: string) => void

function NavigationProbe() {
  navigateTo = useNavigate()
  return null
}

const diagramHtml = (key: string) => `<title>${key}</title><div class="wrap"><svg role="img" aria-label="The ${key} diagram, labelled for tests"><text>${key}-label</text></svg></div>`
const flush = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

async function renderAt(path: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <NavigationProbe />
        <Routes>
          <Route path="/architecture" element={<Architecture />} />
          <Route path="/architecture/:key" element={<Architecture />} />
          <Route path="/architecture/:key/full" element={<Architecture fullPage />} />
        </Routes>
      </MemoryRouter>,
    )
  })
  await flush()
}

const signIn = (contributor: boolean, username = 'reader') => {
  auth.status = 'authenticated'
  auth.user = { username, capabilities: { contributor } }
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // happy-dom does not implement the browser's top layer or native modal focus.
  vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) { this.open = true })
  vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) { this.open = false })
  auth.status = 'anonymous'
  auth.user = null
  loadArchitectureManifest.mockReset().mockResolvedValue(validateArchitectureManifest(manifestJson))
  loadDiagramSource.mockReset().mockImplementation((key: string) => Promise.resolve(diagramHtml(key)))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.restoreAllMocks()
})

const iframe = () => container.querySelector('iframe')

describe('Architecture gate', () => {
  it('asks anonymous visitors to sign in and loads nothing about the diagrams', async () => {
    await renderAt('/architecture/eve')
    expect(container.textContent).toContain('Sign in to continue')
    expect(container.textContent).not.toMatch(/EVE|VISTA|monitoring/i)
    expect(loadArchitectureManifest).not.toHaveBeenCalled()
    expect(loadDiagramSource).not.toHaveBeenCalled()
  })

  it('gives signed-in non-Contributors the no-access state without loading anything', async () => {
    signIn(false)
    await renderAt('/architecture')
    expect(container.textContent).toContain('This page is for DIEM Contributors.')
    expect(loadArchitectureManifest).not.toHaveBeenCalled()
    expect(iframe()).toBe(null)
  })

  it('waits for the session check before deciding', async () => {
    auth.status = 'loading'
    await renderAt('/architecture')
    expect(container.textContent).toContain('Checking your DIEM session')
    expect(loadArchitectureManifest).not.toHaveBeenCalled()
  })
})

describe('Architecture for Contributors', () => {
  beforeEach(() => signIn(true))

  it('renders the hero, map, tabs and the first diagram in an inert sandbox', async () => {
    await renderAt('/architecture')
    expect(container.querySelector('h1')?.textContent).toBe('How DIEM works')
    expect(container.querySelectorAll('.architecture-tabs a')).toHaveLength(4)
    expect(container.querySelectorAll('.architecture-map-node')).toHaveLength(4)
    expect(container.querySelectorAll('.architecture-map-edge')).toHaveLength(4)
    const frame = iframe()!
    expect(frame.getAttribute('sandbox')).toBe('')
    expect(frame.getAttribute('title')).toBe('Household monitoring architecture diagram')
    expect(frame.getAttribute('srcdoc')).toContain("default-src 'none'")
    expect(frame.getAttribute('srcdoc')).toContain('monitoring-label')
    // The fetched HTML is never placed in the Hub document itself.
    expect([...container.querySelectorAll('text')].some((node) => node.textContent === 'monitoring-label')).toBe(false)
    expect(document.title).toContain('Household monitoring architecture')
  })

  it('opens a deep link and marks it current', async () => {
    await renderAt('/architecture/vista')
    expect(container.querySelector('.architecture-tabs a[aria-current="page"]')?.textContent).toContain('VISTA')
    expect(iframe()?.getAttribute('srcdoc')).toContain('vista-label')
    expect(container.querySelector('a[href="/architecture/vista/full"]')?.getAttribute('rel')).toContain('noopener')
  })

  it('shows a useful not-found state for an unknown key', async () => {
    await renderAt('/architecture/atlantis')
    expect(container.textContent).toContain('No diagram called “atlantis”')
    expect(container.querySelectorAll('.architecture-unknown a')).toHaveLength(4)
    expect(loadDiagramSource).not.toHaveBeenCalled()
  })

  it('ignores a late response for a diagram the reader has left', async () => {
    let resolveEve!: (value: string) => void
    loadDiagramSource.mockImplementation((key: string) => key === 'eve'
      ? new Promise<string>((resolve) => { resolveEve = resolve })
      : Promise.resolve(diagramHtml(key)))
    await renderAt('/architecture/eve')
    expect(container.textContent).toContain('Loading the EVE flood monitoring diagram')
    await act(async () => navigateTo('/architecture/hub'))
    await flush()
    await act(async () => resolveEve(diagramHtml('eve')))
    await flush()
    expect(iframe()?.getAttribute('srcdoc')).toContain('hub-label')
    expect(iframe()?.getAttribute('srcdoc')).not.toContain('eve-label')
  })

  it('isolates a failed diagram and retries it', async () => {
    loadDiagramSource.mockRejectedValueOnce(new Error('network'))
    await renderAt('/architecture/eve')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('The diagram did not load')
    expect(container.querySelectorAll('.architecture-tabs a')).toHaveLength(4)
    await act(async () => (container.querySelector('.architecture-frame-status button') as HTMLButtonElement).click())
    await flush()
    expect(iframe()?.getAttribute('srcdoc')).toContain('eve-label')
  })

  it('reports a diagram missing from the build without a pointless retry', async () => {
    loadDiagramSource.mockRejectedValueOnce(new DiagramMissingError('The eve diagram is listed but its file is missing from this Hub build.'))
    await renderAt('/architecture/eve')
    expect(container.textContent).toContain('This diagram is not in this Hub build.')
    expect(container.querySelector('.architecture-frame-status button')).toBe(null)
  })

  it('explains an unsupported manifest version', async () => {
    loadArchitectureManifest.mockRejectedValueOnce(new ArchitectureManifestError('The architecture manifest uses schema version 2, but this Hub reads version 1.'))
    await renderAt('/architecture')
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('schema version 2')
    expect(container.querySelector('button')?.textContent).toBe('Try again')
  })

  it('clears every diagram when the reader signs out', async () => {
    await renderAt('/architecture/eve')
    expect(iframe()).not.toBe(null)
    auth.status = 'anonymous'
    auth.user = null
    await renderAt('/architecture/eve')
    expect(iframe()).toBe(null)
    expect(container.textContent).not.toContain('EVE flood monitoring')
  })

  it('reloads from scratch for a different identity', async () => {
    await renderAt('/architecture/eve')
    expect(loadArchitectureManifest).toHaveBeenCalledTimes(1)
    signIn(true, 'someone-else')
    await renderAt('/architecture/eve')
    expect(loadArchitectureManifest).toHaveBeenCalledTimes(2)
  })

  it('renders the full-page route with the same sandboxed frame', async () => {
    await renderAt('/architecture/hub/full')
    expect(container.querySelector('.architecture-fullpage')).not.toBe(null)
    expect(iframe()?.getAttribute('sandbox')).toBe('')
    expect(container.querySelector('.architecture-hero')).toBe(null)
  })

  it('downloads a sanitized copy and revokes its object URL', async () => {
    await renderAt('/architecture/eve')
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const created: Blob[] = []
    const create = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => { created.push(blob as Blob); return 'blob:test' })
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    try {
      await act(async () => (container.querySelector('.architecture-download') as HTMLButtonElement).click())
      const text = await created[0].text()
      expect(text).toContain("default-src 'none'")
      expect(text).toContain('This copy is not updated when the source changes')
      vi.advanceTimersByTime(10_000)
      expect(revoke).toHaveBeenCalledWith('blob:test')
    } finally {
      create.mockRestore()
      revoke.mockRestore()
      vi.useRealTimers()
    }
  })

  it('opens and closes the expanded view from the keyboard', async () => {
    await renderAt('/architecture/eve')
    const expand = container.querySelector('.architecture-frame-tools button') as HTMLButtonElement
    await act(async () => expand.click())
    expect(container.querySelector('.architecture-frame.is-expanded')).not.toBe(null)
    const dialog = container.querySelector('dialog')!
    expect(dialog.open).toBe(true)
    expect(dialog.getAttribute('aria-label')).toContain('EVE flood monitoring')
    expect(container.querySelectorAll('iframe')).toHaveLength(1)
    // The inline frame keeps an empty stage so the page behind does not shrink.
    expect(container.querySelector('.architecture-frame-inline > .architecture-frame-stage[aria-hidden="true"]')).not.toBe(null)
    await act(async () => { dialog.dispatchEvent(new Event('cancel', { cancelable: true })) })
    expect(container.querySelector('.architecture-frame.is-expanded')).toBe(null)
    expect(document.activeElement).toBe(expand)
    expect(container.querySelectorAll('iframe')).toHaveLength(1)
  })

  it('closes the modal using its visible close button and on diagram navigation', async () => {
    await renderAt('/architecture/eve')
    await act(async () => (container.querySelector('.architecture-frame-tools button') as HTMLButtonElement).click())
    await act(async () => (container.querySelector('dialog button') as HTMLButtonElement).click())
    expect(container.querySelector('dialog')).toBe(null)
    await act(async () => (container.querySelector('.architecture-frame-tools button') as HTMLButtonElement).click())
    await act(async () => navigateTo('/architecture/hub'))
    await flush()
    expect(container.querySelector('dialog')).toBe(null)
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('keeps the target-architecture status visible inside the expanded view', async () => {
    await renderAt('/architecture/monitoring')
    // The embedded document no longer carries its own status line.
    expect(iframe()?.getAttribute('srcdoc')).not.toContain('architecture-status')
    await act(async () => (container.querySelector('.architecture-frame-tools button') as HTMLButtonElement).click())
    const status = container.querySelector('dialog .architecture-status')
    expect(status?.textContent).toContain('Target architecture')
    expect(status?.querySelector('time')?.getAttribute('dateTime')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shows architecture status and includes complete handoffs in the mobile list', async () => {
    await renderAt('/architecture/monitoring')
    expect(container.querySelector('.architecture-status')?.textContent).toContain('Target architecture')
    const details = [...container.querySelectorAll('.architecture-map-list p')].map((node) => node.textContent)
    expect(details).toEqual(manifestJson.relationships.map((relationship) => relationship.detail))
  })
})

describe('system map labels', () => {
  it('wraps long labels at the space nearest the middle and keeps short ones whole', async () => {
    const { labelLines } = await import('../components/ArchitectureSystemMap')
    expect(labelLines('Reference links')).toEqual(['Reference links'])
    expect(labelLines('Survey data and embedded explorer')).toEqual(['Survey data and', 'embedded explorer'])
    expect(labelLines('Unbreakablelabelwithoutspaces')).toEqual(['Unbreakablelabelwithoutspaces'])
  })
})
