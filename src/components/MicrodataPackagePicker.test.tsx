// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const auth = {
  status: 'authenticated',
  user: { username: 'alice' },
  requestProtected: vi.fn(),
}
const discoverMicrodataAccess = vi.fn()
const preflightMicrodataPackage = vi.fn()
const buildMicrodataBundle = vi.fn()

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/microdataSurveyAccess', async () => {
  const actual = await vi.importActual<typeof import('../services/microdataSurveyAccess')>('../services/microdataSurveyAccess')
  return { ...actual, discoverMicrodataAccess }
})
vi.mock('../services/microdataBundle', async () => {
  const actual = await vi.importActual<typeof import('../services/microdataBundle')>('../services/microdataBundle')
  return { ...actual, preflightMicrodataPackage, buildMicrodataBundle }
})

const { MicrodataPackagePicker } = await import('./MicrodataPackagePicker')

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  sessionStorage.clear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  discoverMicrodataAccess.mockResolvedValue({
    surveys: [{ key: 'v2:NGA:8', generation: 'v2', adm0Iso3: 'NGA', countryName: 'Nigeria',
      round: 8, testData: false, components: [{ component: 'household', source: 'master',
        itemId: 'master', layerUrl: 'https://example.test/0', countryField: 'adm0_iso3', roundField: 'round', bulkExportEnabled: true }] }],
    master: { status: 'complete', surveys: [], sources: [], pendingSourceCount: 0, unavailableSourceCount: 0 },
    grantCheckFailed: false, grantIssues: [],
  })
  preflightMicrodataPackage.mockResolvedValue({ recordCount: 5025, dataFileCount: 1, resolved: [] })
  buildMicrodataBundle.mockResolvedValue({ fileName: 'DIEM_microdata_2026-09-23.zip',
    blob: new Blob(['zip']), recordCount: 5025, fileCount: 1 })
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('selects a live survey, preflights it, and offers a licensed package download', async () => {
  const onLoadingChange = vi.fn()
  await act(async () => root.render(<MemoryRouter><MicrodataPackagePicker
    grantDiscovery={{ bundles: [], source: 'none' }} grantChecking={false}
    householdData={true} contributor={true} testMode={false} licenceAccess="householdGroup"
    onLoadingChange={onLoadingChange}
  /></MemoryRouter>))
  expect(onLoadingChange).toHaveBeenCalledWith(true)
  expect(onLoadingChange).toHaveBeenLastCalledWith(false)
  expect(host.textContent).toContain('Nigeria')
  const country = host.querySelector('details.microdata-country') as HTMLDetailsElement
  await act(async () => country.querySelector('summary')!.dispatchEvent(new MouseEvent('click', { bubbles: true })))
  const survey = country.querySelector('input[type="checkbox"]') as HTMLInputElement
  await act(async () => survey.click())
  expect(host.textContent).toContain('1 of 10 surveys selected')
  expect((Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Download microdata package') as HTMLButtonElement).disabled).toBe(true)
  const count = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Check access and count records') as HTMLButtonElement
  await act(async () => count.click())
  expect(preflightMicrodataPackage).toHaveBeenCalledWith(expect.objectContaining({
    budget: expect.objectContaining({ records: 50_000, uncompressedBytes: 40_000_000 }),
  }))
  const download = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Download microdata package') as HTMLButtonElement
  expect(download.disabled).toBe(false)
  expect(host.textContent).toContain('Your microdata licence')
  await act(async () => download.click())
  expect(buildMicrodataBundle).toHaveBeenCalledOnce()
  expect(host.textContent).toContain('DIEM_microdata_2026-09-23.zip downloaded')
})
