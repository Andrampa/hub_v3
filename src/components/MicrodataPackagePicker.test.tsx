// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const auth = {
  status: 'authenticated',
  user: { username: 'alice' },
  requestProtected: vi.fn(),
}
const discoverMicrodataAccess = vi.fn()
const preflightMicrodataPackage = vi.fn()
const buildMicrodataParts = vi.fn()
const componentHasAudit = vi.fn((_generation: string, _component: string) => false)

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/microdataSurveyAccess', async () => {
  const actual = await vi.importActual<typeof import('../services/microdataSurveyAccess')>('../services/microdataSurveyAccess')
  return { ...actual, discoverMicrodataAccess }
})
vi.mock('../services/microdataBundle', async () => {
  const actual = await vi.importActual<typeof import('../services/microdataBundle')>('../services/microdataBundle')
  return { ...actual, preflightMicrodataPackage, buildMicrodataParts }
})
vi.mock('../services/microdataLabels', async () => {
  const actual = await vi.importActual<typeof import('../services/microdataLabels')>('../services/microdataLabels')
  return { ...actual, componentHasAudit }
})

const { MicrodataPackagePicker } = await import('./MicrodataPackagePicker')

let root: Root
let host: HTMLDivElement

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  auth.status = 'authenticated'
  auth.user.username = 'alice'
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
  preflightMicrodataPackage.mockResolvedValue({ recordCount: 5025, sourceTableCount: 1, outputFileCount: 1, resolved: [] })
  buildMicrodataParts.mockImplementation(async ({ onPart }) => {
    onPart({ partNumber: 1, fileName: 'DIEM_microdata_part1.zip', blob: new Blob(['zip']),
      recordCount: 5025, fileCount: 1, uncompressedBytes: 10, surveyKeys: ['v2:NGA:8'] })
    return { partCount: 1, recordCount: 5025 }
  })
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
  expect(host.textContent).toContain('1 survey selected')
  expect((Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Prepare microdata downloads') as HTMLButtonElement).disabled).toBe(true)
  const count = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Check access and count records') as HTMLButtonElement
  await act(async () => count.click())
  expect(preflightMicrodataPackage).toHaveBeenCalledWith(expect.objectContaining({
    budget: expect.objectContaining({ records: 50_000, uncompressedBytes: 40_000_000 }),
  }))
  const download = Array.from(host.querySelectorAll('button')).find((button) => button.textContent === 'Prepare microdata downloads') as HTMLButtonElement
  expect(download.disabled).toBe(true)
  expect(host.querySelector('#microdata-download-hint')?.textContent).toBe('Accept the microdata licence to download.')
  // The licence is its own step, shown in full rather than behind a disclosure.
  const licenceStep = host.querySelector('#microdata-step-licence') as HTMLElement
  expect(licenceStep.textContent).toContain('Your microdata licence')
  await acceptLicence()
  expect(download.disabled).toBe(false)
  await act(async () => download.click())
  expect(buildMicrodataParts).toHaveBeenCalledOnce()
  expect(host.textContent).toContain('Download part 1')
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce()
  expect(host.textContent).toContain('the link below is a fallback')
})

it('focuses a build failure, changes the hint and keeps earlier complete parts available', async () => {
  await renderWithSelection()
  await act(async () => button('Check access and count records').click())
  await acceptLicence()
  buildMicrodataParts.mockImplementationOnce(async ({ onPart }) => {
    onPart({ partNumber: 1, fileName: 'part1.zip', blob: new Blob(['zip']), recordCount: 20,
      fileCount: 1, uncompressedBytes: 10, surveyKeys: ['v2:NGA:8'] })
    throw new Error('Compression worker failed.')
  })
  await act(async () => button('Prepare microdata downloads').click())
  expect(host.textContent).toContain('Compression worker failed.')
  expect(document.activeElement).toBe(host.querySelector('[role="alert"]'))
  expect(host.querySelector('#microdata-download-hint')?.textContent).toContain('Preparation failed')
  expect(host.textContent).toContain('Download part 1')
  const link = host.querySelector('a[download="part1.zip"]')!
  link.addEventListener('click', (event) => event.preventDefault())
  await act(async () => link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
  expect(host.textContent).toContain('Download requested — check your browser')
  await act(async () => button('Clear prepared parts').click())
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
  expect(host.textContent).not.toContain('Download part 1')
})

it('does not automatically start downloads when the selection produces several parts', async () => {
  await renderWithSelection()
  await act(async () => button('Check access and count records').click())
  await acceptLicence()
  buildMicrodataParts.mockImplementationOnce(async ({ onPart }) => {
    for (const partNumber of [1, 2]) onPart({ partNumber, fileName: `part${partNumber}.zip`,
      blob: new Blob(['zip']), recordCount: 20, fileCount: 1, uncompressedBytes: 10, surveyKeys: [] })
    return { partCount: 2, recordCount: 40 }
  })
  await act(async () => button('Prepare microdata downloads').click())
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  expect(host.querySelectorAll('a[download]')).toHaveLength(2)
  expect(host.textContent).toContain('2 parts ready with 40 records')
})

it('shows estimates as information and clears prepared archives on selection changes', async () => {
  await renderWithSelection()
  preflightMicrodataPackage.mockResolvedValueOnce({ recordCount: 5025, sourceTableCount: 1,
    outputFileCount: 1, estimatedBytes: 50_000_000, resolved: [] })
  await act(async () => button('Check access and count records').click())
  expect(host.textContent).toContain('about 50 MB')
  await acceptLicence()
  expect(button('Prepare microdata downloads').disabled).toBe(false)
  await act(async () => button('Prepare microdata downloads').click())
  const choice = host.querySelector('details.microdata-country input[type="checkbox"]') as HTMLInputElement
  await act(async () => choice.click())
  expect(host.textContent).not.toContain('Download part 1')
  expect(URL.revokeObjectURL).toHaveBeenCalled()
})

async function acceptLicence() {
  await act(async () => (host.querySelector('.licence-accept input') as HTMLInputElement).click())
}

async function renderWithSelection() {
  await act(async () => root.render(<MemoryRouter><MicrodataPackagePicker
    grantDiscovery={{ bundles: [], source: 'none' }} grantChecking={false}
    householdData={true} contributor={true} testMode={false} licenceAccess="householdGroup"
  /></MemoryRouter>))
  const country = host.querySelector('details.microdata-country') as HTMLDetailsElement
  await act(async () => (country.querySelector('input[type="checkbox"]') as HTMLInputElement).click())
}

const valueRadio = (label: string) => Array.from(host.querySelectorAll<HTMLInputElement>('input[name="microdata-values-choice"]'))
  .find((input) => input.parentElement?.textContent?.startsWith(label))!
const button = (label: string) => Array.from(host.querySelectorAll('button')).find((entry) => entry.textContent === label) as HTMLButtonElement

it('keeps coded values for a generation whose labels were not audited', async () => {
  componentHasAudit.mockReturnValue(false)
  await renderWithSelection()
  expect(valueRadio('Coded values').checked).toBe(true)
  expect(valueRadio('Labels').disabled).toBe(true)
  expect(valueRadio('Both').disabled).toBe(true)
  expect(host.textContent).toContain('Labelled values are not yet available for the V2 household table')
  await act(async () => button('Check access and count records').click())
  expect(preflightMicrodataPackage).toHaveBeenCalledWith(expect.objectContaining({ values: 'codes' }))
})

it('counts output files for Both and invalidates the check when the values choice changes', async () => {
  componentHasAudit.mockReturnValue(true)
  await renderWithSelection()
  await act(async () => valueRadio('Both').click())
  expect(host.textContent).toContain('2 CSVs')
  preflightMicrodataPackage.mockResolvedValue({ recordCount: 5025, sourceTableCount: 1, outputFileCount: 2, resolved: [] })
  await act(async () => button('Check access and count records').click())
  expect(preflightMicrodataPackage).toHaveBeenCalledWith(expect.objectContaining({ values: 'both' }))
  expect(host.textContent).toContain('from 1 table, written as 2 CSV files')
  await acceptLicence()
  expect(button('Prepare microdata downloads').disabled).toBe(false)
  await act(async () => valueRadio('Labels').click())
  expect(button('Prepare microdata downloads').disabled).toBe(true)
})

it('gates labels on each selected V3 table, not the generation', async () => {
  const part = (component: 'mandatory' | 'optional') => ({ component, source: 'master', itemId: component,
    layerUrl: `https://example.test/${component}/0`, countryField: 'adm0_iso3', roundField: 'round', bulkExportEnabled: true })
  discoverMicrodataAccess.mockResolvedValue({
    surveys: [{ key: 'v3:COD:99', generation: 'v3', adm0Iso3: 'COD', countryName: 'Congo',
      round: 99, testData: true, components: [part('mandatory'), part('optional')] }],
    master: { status: 'complete', surveys: [], sources: [], pendingSourceCount: 0, unavailableSourceCount: 0 },
    grantCheckFailed: false, grantIssues: [],
  })
  componentHasAudit.mockImplementation((_generation: string, component: string) => component === 'mandatory')
  await act(async () => root.render(<MemoryRouter><MicrodataPackagePicker
    grantDiscovery={{ bundles: [], source: 'none' }} grantChecking={false}
    householdData={true} contributor={true} testMode={true} licenceAccess="householdGroup"
  /></MemoryRouter>))
  await act(async () => (host.querySelector('details.microdata-country input[type="checkbox"]') as HTMLInputElement).click())
  expect(valueRadio('Labels').disabled).toBe(false)
  await act(async () => valueRadio('Labels').click())
  const withOptional = Array.from(host.querySelectorAll<HTMLInputElement>('input[name="microdata-v3-choice"]'))[1]
  await act(async () => withOptional.click())
  expect(valueRadio('Labels').disabled).toBe(true)
  expect(valueRadio('Coded values').checked).toBe(true)
  expect(host.textContent).toContain('not yet available for the V3 optional table: its value labels have not passed the label audit')
})

it('does not carry licence acceptance to another signed-in account', async () => {
  await renderWithSelection()
  await acceptLicence()
  expect((host.querySelector('.licence-accept input') as HTMLInputElement).checked).toBe(true)
  auth.user.username = 'bob'
  await act(async () => root.render(<MemoryRouter><MicrodataPackagePicker
    grantDiscovery={{ bundles: [], source: 'none' }} grantChecking={false}
    householdData={true} contributor={true} testMode={false} licenceAccess="householdGroup"
  /></MemoryRouter>))
  expect((host.querySelector('.licence-accept input') as HTMLInputElement).checked).toBe(false)
})

it('explains a failed access check beside the disabled download button', async () => {
  preflightMicrodataPackage.mockRejectedValueOnce(new Error('The source could not be reached.'))
  await renderWithSelection()
  await act(async () => button('Check access and count records').click())
  expect(host.textContent).toContain('The source could not be reached.')
  expect(host.querySelector('#microdata-download-hint')?.textContent)
    .toBe('The access check failed. Return to Review and check again.')
  expect(button('Prepare microdata downloads').disabled).toBe(true)
  const survey = host.querySelector('details.microdata-country input[type="checkbox"]') as HTMLInputElement
  await act(async () => survey.click())
  await act(async () => survey.click())
  expect(host.textContent).not.toContain('The source could not be reached.')
  expect(host.querySelector('#microdata-download-hint')?.textContent)
    .toBe('Return to Review to check access and count records.')
})

it('keeps the inventory and selections visible while a refresh is pending', async () => {
  const discovery = { bundles: [], source: 'none' as const }
  const render = (checking: boolean, pending?: Promise<typeof discovery>) => <MemoryRouter><MicrodataPackagePicker grantDiscovery={discovery} grantPending={pending} grantChecking={checking} householdData={true} contributor={true} testMode={false} licenceAccess="householdGroup" /></MemoryRouter>
  await act(async () => root.render(render(false)))
  const checkbox = host.querySelector('.microdata-country input') as HTMLInputElement
  await act(async () => checkbox.click())
  let finish!: (value: typeof discovery) => void
  const pending = new Promise<typeof discovery>((resolve) => { finish = resolve })
  discoverMicrodataAccess.mockImplementationOnce(() => pending.then(() => ({ surveys: [], master: { pendingSourceCount: 0 }, grantCheckFailed: false, grantIssues: [] })))
  await act(async () => root.render(render(true, pending)))
  expect(host.textContent).toContain('Nigeria')
  expect(host.textContent).toContain('Re-checking access')
  expect((host.querySelector('.microdata-country input') as HTMLInputElement).checked).toBe(true)
  await act(async () => { finish(discovery) })
  expect(host.textContent).not.toContain('Nigeria')
})

it('keeps finished parts and an active preparation through refresh, applying changed sources afterwards', async () => {
  const discovery = { bundles: [], source: 'none' as const }
  const render = (pending?: Promise<typeof discovery>) => <MemoryRouter><MicrodataPackagePicker grantDiscovery={discovery} grantPending={pending} grantChecking={false} householdData={true} contributor={true} testMode={false} licenceAccess="householdGroup" /></MemoryRouter>
  await act(async () => root.render(render()))
  await act(async () => (host.querySelector('.microdata-country input') as HTMLInputElement).click())
  await act(async () => button('Check access and count records').click())
  await acceptLicence()
  let finish!: () => void
  let signal!: AbortSignal
  buildMicrodataParts.mockImplementationOnce(({ onPart, signal: current }) => {
    signal = current
    onPart({ partNumber: 1, fileName: 'finished.zip', blob: new Blob(['zip']), recordCount: 20, fileCount: 1, uncompressedBytes: 10, surveyKeys: ['v2:NGA:8'] })
    return new Promise((resolve) => { finish = () => resolve({ partCount: 1, recordCount: 20 }) })
  })
  await act(async () => button('Prepare microdata downloads').click())
  const original = await discoverMicrodataAccess.mock.results.at(-1)!.value
  discoverMicrodataAccess.mockResolvedValueOnce({ ...original, surveys: original.surveys.map((survey: any) => ({ ...survey, components: survey.components.map((part: any) => ({ ...part, itemId: 'changed-source' })) })) })
  await act(async () => root.render(render(Promise.resolve(discovery))))
  expect(signal.aborted).toBe(false)
  expect(host.querySelector('a[download="finished.zip"]')).not.toBeNull()
  await act(async () => finish())
  expect(host.querySelector('a[download="finished.zip"]')).not.toBeNull()
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  expect(button('Prepare microdata downloads').disabled).toBe(true) // changed source needs a fresh check
})

it('routes Check again to fresh grant discovery', async () => {
  discoverMicrodataAccess.mockResolvedValueOnce({ surveys: [], master: { pendingSourceCount: 1 }, grantCheckFailed: true, grantIssues: [] })
  const onRecheck = vi.fn()
  await act(async () => root.render(<MemoryRouter><MicrodataPackagePicker grantDiscovery={{ bundles: [], source: 'none' }} grantChecking={false} householdData={true} contributor={true} testMode={false} licenceAccess="householdGroup" onRecheck={onRecheck} /></MemoryRouter>))
  await act(async () => button('Check again').click())
  expect(onRecheck).toHaveBeenCalledTimes(1)
})

it.each(['account', 'sign-out', 'test-mode'])('clears the old displayed inventory after %s changes', async (change) => {
  const discovery = { bundles: [], source: 'none' as const }
  const render = (testMode = false) => <MemoryRouter><MicrodataPackagePicker grantDiscovery={discovery} grantChecking={false} householdData={true} contributor={true} testMode={testMode} licenceAccess="householdGroup" /></MemoryRouter>
  await act(async () => root.render(render()))
  expect(host.textContent).toContain('Nigeria')
  discoverMicrodataAccess.mockImplementationOnce(() => new Promise(() => {}))
  if (change === 'account') auth.user.username = 'bob'
  if (change === 'sign-out') auth.status = 'anonymous'
  await act(async () => root.render(render(change === 'test-mode')))
  expect(host.textContent).not.toContain('Nigeria')
})

describe('guided steps', () => {
  const flow = (props: Record<string, unknown> = {}) => <MemoryRouter><MicrodataPackagePicker
    grantDiscovery={{ bundles: [], source: 'none' }} grantChecking={false}
    householdData={true} contributor={true} testMode={false} licenceAccess="householdGroup"
    {...props}
  /></MemoryRouter>
  const storeSelection = (keys: string[]) => sessionStorage.setItem('diem.microdata-selection.v1.alice.production', JSON.stringify(keys))

  it('checks access by itself on Review, once for the package', async () => {
    storeSelection(['v2:NGA:8'])
    const onStep = vi.fn()
    await act(async () => root.render(flow({ requested: 'review', onStep })))
    expect(preflightMicrodataPackage).toHaveBeenCalledOnce()
    expect(onStep).not.toHaveBeenCalled()
    expect(host.querySelector('#microdata-step-review')?.hasAttribute('hidden')).toBe(false)
    await act(async () => root.render(flow({ requested: 'review', onStep })))
    expect(preflightMicrodataPackage).toHaveBeenCalledOnce()
  })

  it('does not restart a failed check on its own', async () => {
    storeSelection(['v2:NGA:8'])
    preflightMicrodataPackage.mockRejectedValueOnce(new Error('The source could not be reached.'))
    await act(async () => root.render(flow({ requested: 'review', onStep: vi.fn() })))
    expect(host.textContent).toContain('The source could not be reached.')
    await act(async () => root.render(flow({ requested: 'review', onStep: vi.fn() })))
    expect(preflightMicrodataPackage).toHaveBeenCalledOnce()
    await act(async () => button('Check access and count records').click())
    expect(preflightMicrodataPackage).toHaveBeenCalledTimes(2)
  })

  it('stops a running check when the user leaves Review', async () => {
    storeSelection(['v2:NGA:8'])
    let signal!: AbortSignal
    preflightMicrodataPackage.mockImplementationOnce(({ signal: current }) => {
      signal = current
      // As the real check does: a cancelled request rejects.
      return new Promise((_resolve, reject) => current.addEventListener('abort', () => reject(new Error('The microdata package was cancelled.'))))
    })
    await act(async () => root.render(flow({ requested: 'review', onStep: vi.fn() })))
    expect(signal.aborted).toBe(false)
    await act(async () => root.render(flow({ requested: 'options', onStep: vi.fn() })))
    expect(signal.aborted).toBe(true)
    await act(async () => root.render(flow({ requested: 'review', onStep: vi.fn() })))
    expect(host.textContent).toContain('The check was stopped before it finished')
    expect(preflightMicrodataPackage).toHaveBeenCalledOnce()
  })

  it('sends a URL that skips ahead back to the earliest unfinished step', async () => {
    storeSelection(['v2:NGA:8'])
    preflightMicrodataPackage.mockImplementationOnce(() => new Promise(() => {}))
    const onStep = vi.fn()
    // A licence acceptance and a finished check are never read from the URL.
    await act(async () => root.render(flow({ requested: 'download', onStep })))
    expect(onStep).toHaveBeenCalledWith('review', { replace: true })

    sessionStorage.clear()
    onStep.mockClear()
    await act(async () => root.unmount())
    root = createRoot(host)
    await act(async () => root.render(flow({ requested: 'options', onStep })))
    expect(onStep).toHaveBeenCalledWith('surveys', { replace: true })
  })

  it('applies a link request to the surveys this account can open', async () => {
    const onRequestApplied = vi.fn()
    await act(async () => root.render(flow({ request: { keys: [], country: 'NGA', round: 8 }, onRequestApplied, onStep: vi.fn() })))
    expect(onRequestApplied).toHaveBeenCalledWith(undefined)
    expect((host.querySelector('details.microdata-country input[type="checkbox"]') as HTMLInputElement).checked).toBe(true)
    expect((host.querySelector('details.microdata-country') as HTMLDetailsElement).open).toBe(true)
  })

  it('names a requested survey the account cannot open instead of dropping it', async () => {
    const onRequestApplied = vi.fn()
    await act(async () => root.render(flow({ request: { keys: [], country: 'NGA', round: 9 }, onRequestApplied, onStep: vi.fn() })))
    expect(onRequestApplied.mock.calls[0][0]).toContain('Nigeria round 9 is not among the surveys your account can download here')
    expect((host.querySelector('details.microdata-country input[type="checkbox"]') as HTMLInputElement).checked).toBe(false)
  })

  it('skips the licence step once the licence has been accepted in this visit', async () => {
    storeSelection(['v2:NGA:8'])
    const onStep = vi.fn()
    await act(async () => root.render(flow({ requested: 'review', onStep })))
    expect(button('Next: licence').disabled).toBe(false)
    await acceptLicence()
    await act(async () => button('Next: download').click())
    expect(onStep).toHaveBeenLastCalledWith('download')
  })
})

describe('exploring without bulk export', () => {
  const part = (component: string, itemId: string, bulkExportEnabled: boolean, source = 'grant') => ({
    component, source, grantId: 'g1', itemId, layerUrl: 'https://example.test/0', countryField: 'adm0_iso3', roundField: 'round', bulkExportEnabled,
  })
  const survey = (generation: string, iso3: string, round: number, components: unknown[]) => ({
    key: `${generation}:${iso3}:${round}`, generation, adm0Iso3: iso3, countryName: iso3, round, testData: false, components,
  })
  const inventory = (surveys: unknown[], grantCheckFailed = false) => ({
    surveys, master: { status: 'complete', surveys: [], sources: [], pendingSourceCount: 0, unavailableSourceCount: 0 }, grantCheckFailed, grantIssues: [],
  })
  const view = (itemId: string, component: string, questionnaireVersion: string, scope: Array<[string, number]>) => ({
    itemId, title: itemId, component, questionnaireVersion, grantId: 'g1', schemaVersion: 1, bulkExportEnabled: false,
    surveyScope: scope.map(([adm0_iso3, round]) => ({ adm0_iso3, round })),
  })
  const grants = (views: unknown[], version = 'v2') => ({ bundles: [{ key: 'g1:' + version, grantId: 'g1', questionnaireVersion: version, surveyScope: [], views, documentation: [], status: 'active', bulkExportEnabled: false, joinKeys: [] }], source: 'groups' as const })
  async function show(discovery: ReturnType<typeof grants>) {
    await act(async () => root.render(<MemoryRouter><MicrodataPackagePicker grantDiscovery={discovery as never} grantChecking={false}
      householdData={false} contributor={false} testMode={false} licenceAccess="temporaryGrant" /></MemoryRouter>))
  }
  const row = (key: string) => [...host.querySelectorAll('.microdata-survey-row')]
    .find((entry) => entry.querySelector('input')?.getAttribute('aria-label')?.startsWith(key))!

  it('links an explore-only survey to its table, filtered to that survey', async () => {
    discoverMicrodataAccess.mockResolvedValue(inventory([survey('v2', 'NGA', 8, [part('household', 'view-nga', false)])]))
    await show(grants([view('view-nga', 'legacy', 'v2', [['NGA', 8]])]))

    const nigeria = row('NGA, round 8')
    expect(nigeria.querySelector('input')?.disabled).toBe(true)
    expect(nigeria.textContent).toContain('Explore only — bulk export not approved')
    expect([...nigeria.querySelectorAll('a')].map((link) => [link.textContent, link.getAttribute('href')]))
      .toEqual([['Explore data', '/data/grants/view-nga?country=NGA&round=8']])
    expect(host.querySelector('.microdata-unmatched')).toBe(null)
  })

  it('offers no Explore link where the survey can be downloaded', async () => {
    discoverMicrodataAccess.mockResolvedValue(inventory([survey('v2', 'NGA', 8, [part('household', 'view-nga', true)])]))
    await show(grants([view('view-nga', 'legacy', 'v2', [['NGA', 8]])]))

    const nigeria = row('NGA, round 8')
    expect(nigeria.querySelector('input')?.disabled).toBe(false)
    expect(nigeria.querySelector('a')).toBe(null)
  })

  it('names the mandatory and optional tables of an explore-only V3 survey', async () => {
    discoverMicrodataAccess.mockResolvedValue(inventory([survey('v3', 'COD', 2, [part('mandatory', 'core-cod', false), part('optional', 'opt-cod', false)])]))
    await show(grants([]))

    expect([...row('COD, round 2').querySelectorAll('a')].map((link) => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Explore mandatory table', '/data/grants/core-cod?country=COD&round=2'],
      ['Explore optional table', '/data/grants/opt-cod?country=COD&round=2'],
    ])
  })

  it('keeps a route to an approved table the check could not match to a survey', async () => {
    discoverMicrodataAccess.mockResolvedValue(inventory([], true))
    await show(grants([view('view-sdn', 'legacy', 'v2', [['SDN', 4]])]))

    const note = host.querySelector('.microdata-unmatched')
    expect(note?.textContent).toContain('could not be matched')
    expect(note?.querySelector('a')?.getAttribute('href')).toBe('/data/grants/view-sdn')
    expect(note?.textContent).toContain('SDN round 4')
  })

  it('keeps a link to a V3 optional table that failed while its mandatory table loaded', async () => {
    discoverMicrodataAccess.mockResolvedValue(inventory([survey('v3', 'COD', 2, [part('mandatory', 'core-cod', true)])]))
    await show(grants([view('core-cod', 'core', 'v3', [['COD', 2]]), view('opt-cod', 'optional', 'v3', [['COD', 2]])], 'v3'))

    const links = [...(host.querySelector('.microdata-unmatched')?.querySelectorAll('a') ?? [])]
    expect(links.map((link) => [link.textContent, link.getAttribute('href')])).toEqual([['Explore optional table', '/data/grants/opt-cod']])
  })

  it('keeps the approved tables reachable when the inventory cannot be loaded at all', async () => {
    discoverMicrodataAccess.mockRejectedValue(new Error('Register unavailable'))
    await show(grants([view('view-sdn', 'legacy', 'v2', [['SDN', 4]])]))

    expect(host.querySelector('.microdata-country')).toBe(null)
    const note = host.querySelector('.microdata-unmatched')
    expect(note?.textContent).toContain('could not be listed')
    expect(note?.querySelector('a')?.getAttribute('href')).toBe('/data/grants/view-sdn')
  })
})
