// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true,"disableCSSFileLoading":true,"disableJavaScriptFileLoading":true,"handleDisabledFileLoadingAsSuccess":true,"navigation":{"disableChildFrameNavigation":true,"disableChildPageNavigation":true}}}
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const auth = { status: 'anonymous', user: null as null | { capabilities: { contributor: boolean } } }
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../components/SiteHeader', () => ({ SiteHeader: () => null }))
vi.mock('../components/SiteFooter', () => ({ SiteFooter: () => null }))
const { default: QuestionnaireGuide } = await import('./QuestionnaireGuide')
let container: HTMLDivElement
let root: Root
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })

it.each(['anonymous', 'loading', 'authenticating', 'noncontributor', 'contributor'])('opens the public route for %s visitors without duplicate bars', async (audience) => {
  auth.status = audience.includes('contributor') ? 'authenticated' : audience
  auth.user = { capabilities: { contributor: audience === 'contributor' } }
  await act(async () => {
    root.render(<MemoryRouter initialEntries={['/questionnaire-guide']}><Routes><Route path="/questionnaire-guide" element={<QuestionnaireGuide />} /></Routes></MemoryRouter>)
  })
  expect(container.querySelector('iframe')?.getAttribute('src')).toBe('https://diem-monitoring.apps.fao.org/questionnaire.html?diemEmbed=hub')
  expect(container.querySelector('iframe')?.title).toBe('DIEM household questionnaire guide')
  expect(container.querySelector('.questionnaire-guide-toolbar')).toBeNull()
  expect(container.querySelector('h1')?.className).toBe('visually-hidden')
  expect(container.querySelector('button')).toBeNull()
})
