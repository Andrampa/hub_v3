// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SurveyDiscoveryResult } from '../services/surveyAccess'

const discoverAggregatedSurveys = vi.fn()
const auth = {
  status: 'authenticated' as string,
  user: {
    username: 'alice',
    fullName: 'Alice',
    capabilities: { contributor: false, aggregatedData: true, householdData: false },
  } as { username: string; fullName?: string; capabilities: Record<string, boolean> } | null,
  // The site header checks for grant invitations on mount; an empty response
  // keeps that unrelated request out of these tests.
  requestProtected: vi.fn().mockResolvedValue({}),
  signIn: vi.fn(),
}

const buildSurveyBundle = vi.fn()
const isBundleCancelled = vi.fn(() => false)

vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
// The budget rules stay real; only building the archive is faked.
vi.mock('../services/surveyBundle', async () => {
  const actual = await vi.importActual<typeof import('../services/surveyBundle')>('../services/surveyBundle')
  return { ...actual, buildSurveyBundle, isBundleCancelled }
})
// Grant discovery is faked at the service, so the real grants component - and
// what it reports to the page - is what the licence tests exercise.
const fetchCurrentUserMicrodataGrants = vi.fn()
vi.mock('../services/microdataGrants', async () => {
  const actual = await vi.importActual<typeof import('../services/microdataGrants')>('../services/microdataGrants')
  return { ...actual, fetchCurrentUserMicrodataGrants }
})
vi.mock('../services/monitoring', async () => {
  const actual = await vi.importActual<typeof import('../services/monitoring')>('../services/monitoring')
  return {
    ...actual,
    fetchSurveyCollectionPeriods: vi.fn().mockResolvedValue(new Map([['NGA:1', { start: Date.UTC(2024, 2, 4), end: Date.UTC(2024, 3, 20) }]])),
  }
})

vi.mock('../services/surveyAccess', async () => {
  const actual = await vi.importActual<typeof import('../services/surveyAccess')>('../services/surveyAccess')
  return { ...actual, discoverAggregatedSurveys }
})

const { default: SurveyWorkspace } = await import('./SurveyWorkspace')

const THEME_LABELS: Record<string, string> = {
  'food-security': 'Food security',
  'crop-production': 'Crop production',
}

function theme(id: string, generation: 'v1' | 'v2' | 'v3', testData = false) {
  return {
    id,
    label: THEME_LABELS[id] || id,
    resourceId: `resource-${id}`,
    generation,
    layerId: 0,
    layerName: 'layer',
    layerUrl: `https://example.test/${id}/FeatureServer/0`,
    countryField: 'adm0_iso3',
    roundField: 'round',
    testData,
  }
}

function survey(
  generation: 'v1' | 'v2' | 'v3',
  iso3: string,
  round: number,
  testData = false,
  themeIds = ['food-security'],
) {
  return {
    key: `${generation}:${iso3}:${round}`,
    generation,
    adm0Iso3: iso3,
    countryName: iso3 === 'NGA' ? 'Nigeria' : iso3 === 'TCD' ? 'Chad' : iso3,
    round,
    themes: themeIds.map((id) => theme(id, generation, testData)),
    testData,
  }
}

function discovery(overrides: Partial<SurveyDiscoveryResult> = {}): SurveyDiscoveryResult {
  return {
    status: 'complete',
    surveys: [survey('v2', 'NGA', 8), survey('v2', 'TCD', 3)],
    sources: [{
      resourceId: 'resource-1',
      generation: 'v2',
      themeId: 'food-security',
      themeLabel: 'Food security',
      testData: false,
      status: 'confirmed',
      surveyCount: 2,
    }],
    pendingSourceCount: 0,
    warningSourceCount: 0,
    unavailableSourceCount: 0,
    checkedAt: 1,
    ...overrides,
  }
}

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root

/**
 * Renders the workspace with every country opened, because most tests are about
 * selecting rounds. The collapsed default is covered by its own tests, which
 * pass `{ expand: false }`.
 */
async function render(path = '/data/surveys', { expand = true }: { expand?: boolean } = {}) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <SurveyWorkspace />
      </MemoryRouter>,
    )
  })
  if (!expand) return
  const expandAll = Array.from(container.querySelectorAll('.survey-list-controls button'))
    .find((button) => button.textContent === 'Expand all countries')
  if (expandAll) {
    await act(async () => { expandAll.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  }
}

function rows() {
  return Array.from(container.querySelectorAll('.survey-row')) as HTMLLabelElement[]
}

function checkboxes() {
  return Array.from(container.querySelectorAll('.survey-row input')) as HTMLInputElement[]
}

async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

beforeEach(() => {
  // Without it React 19 warns on every update that it is not inside act().
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  auth.requestProtected.mockReset()
  auth.requestProtected.mockResolvedValue({})
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  sessionStorage.clear()
  auth.status = 'authenticated'
  auth.user = {
    username: 'alice',
    fullName: 'Alice',
    capabilities: { contributor: false, aggregatedData: true, householdData: false },
  }
  fetchCurrentUserMicrodataGrants.mockReset()
  fetchCurrentUserMicrodataGrants.mockResolvedValue({ bundles: [], source: 'none' })
  buildSurveyBundle.mockReset()
  isBundleCancelled.mockReset()
  isBundleCancelled.mockReturnValue(false)
  discoverAggregatedSurveys.mockReset()
  discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
    options.onProgress?.(discovery())
    return Promise.resolve(discovery())
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('survey workspace access states', () => {
  it('reports an authorization delay instead of claiming that a community account has zero surveys', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({
        status: 'unavailable',
        unavailableSourceCount: 2,
        surveys: [],
        sources: [
          { resourceId: 'a', generation: 'v2', themeId: 'food-security', themeLabel: 'Food security', testData: false, status: 'restricted' },
          { resourceId: 'b', generation: 'v1', themeId: 'crop-production', themeLabel: 'Crop production', testData: false, status: 'restricted' },
        ],
      })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()

    const card = container.querySelector('.access-card')?.textContent
    expect(card).toContain('Access is still being provisioned')
    expect(card).toContain('valid DIEM community account')
    expect(card).not.toContain('0 surveys')
  })

  it('counts only production surveys and never presents a partial count as a total', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({
        status: 'partial',
        unavailableSourceCount: 1,
        sources: [
          { resourceId: 'a', generation: 'v2', themeId: 'food-security', themeLabel: 'Food security', testData: false, status: 'confirmed', surveyCount: 2 },
          { resourceId: 'b', generation: 'v2', themeId: 'crop-production', themeLabel: 'Crop production', testData: false, status: 'restricted' },
        ],
      })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()

    expect(container.textContent).toContain('could not be checked, so this is not the complete total')
  })

  it('says "confirmed so far", not "available", while any source is missing', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({
        status: 'partial',
        unavailableSourceCount: 1,
        sources: [
          { resourceId: 'a', generation: 'v2', themeId: 'food-security', themeLabel: 'Food security', testData: false, status: 'confirmed', surveyCount: 2 },
          { resourceId: 'b', generation: 'v2', themeId: 'crop-production', themeLabel: 'Crop production', testData: false, status: 'failed' },
        ],
      })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()

    const lede = container.querySelector('.access-card-lede')?.textContent
    expect(lede).toContain('2 surveys confirmed so far')
    expect(lede).not.toContain('available')
  })

  it('does not let a failing test source colour the production summary', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({
        status: 'partial',
        unavailableSourceCount: 1,
        surveys: [survey('v2', 'NGA', 8)],
        sources: [
          { resourceId: 'a', generation: 'v2', themeId: 'food-security', themeLabel: 'Food security', testData: false, status: 'confirmed', surveyCount: 1 },
          { resourceId: 'v3', generation: 'v3', themeId: 'food-security-and-needs', themeLabel: 'Food security and needs', testData: true, status: 'failed' },
        ],
      })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render('/data/surveys?test=1')

    // Every production source answered, so the production count is a total.
    const card = container.querySelector('.access-card')?.textContent
    expect(card).toContain('1 survey available')
    expect(card).not.toContain('could not be checked')
  })

  it('makes no claim about microdata access it has not resolved', async () => {
    auth.user = { username: 'alice', capabilities: { contributor: false, aggregatedData: true, householdData: true } }

    await render()

    // A household-data member and a temporary-grant holder are different paths,
    // and this page reads neither, so it must assert nothing about either.
    expect(container.textContent).not.toContain('Microdata is available by request')
    expect(container.textContent).not.toContain('collections are available to your account')
    expect(container.textContent).not.toContain('seven days')
    expect(container.textContent).toContain('Household microdata follows its own route')
  })
})

describe('survey selection', () => {
  it('locks only unchecked rows once the package limit is reached', async () => {
    const many = Array.from({ length: 12 }, (_, index) => survey('v2', 'NGA', index + 1))
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: many })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()
    for (const box of checkboxes().slice(0, 10)) await click(box)

    const boxes = checkboxes()
    expect(boxes.filter((box) => box.checked)).toHaveLength(10)
    expect(boxes.filter((box) => box.checked).every((box) => !box.getAttribute('aria-disabled'))).toBe(true)
    expect(boxes.filter((box) => !box.checked).every((box) => box.getAttribute('aria-disabled') === 'true')).toBe(true)
    expect(container.textContent).toContain('the most one package can hold')
  })

  it('says why, on the row, when an eleventh survey is clicked', async () => {
    const many = Array.from({ length: 12 }, (_, index) => survey('v2', 'NGA', index + 1))
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: many })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()
    for (const box of checkboxes().slice(0, 10)) await click(box)
    const eleventh = checkboxes().find((box) => !box.checked)!
    await click(eleventh)

    expect(checkboxes().filter((box) => box.checked)).toHaveLength(10)
    const alert = container.querySelector('.survey-row-limit[role="alert"]')
    expect(alert?.textContent).toContain('was not added: one package holds up to 10 surveys')
    expect(eleventh.getAttribute('aria-describedby')).toBe(alert?.id)
  })

  it('shows collection dates and links each generation to its explanation', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: [survey('v2', 'NGA', 1)] })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(container.querySelector('.survey-row-dates')?.textContent).toBe('Mar 2024 – Apr 2024')
    expect(container.querySelector('a.survey-row-generation')?.getAttribute('href')).toBe('/data/guide#generations')
  })

  it('does not cap a contributor', async () => {
    auth.user = { username: 'carla', capabilities: { contributor: true, aggregatedData: true, householdData: true } }
    const many = Array.from({ length: 12 }, (_, index) => survey('v2', 'NGA', index + 1))
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: many })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()
    for (const box of checkboxes().slice(0, 11)) await click(box)

    expect(checkboxes().filter((box) => box.getAttribute('aria-disabled'))).toHaveLength(0)
    expect(checkboxes().filter((box) => box.checked)).toHaveLength(11)
  })

  it('keeps a selection that a failed source could not confirm', async () => {
    sessionStorage.setItem('diem.survey-selection.alice.production', JSON.stringify({ version: 1, keys: ['v2:NGA:8', 'v2:COD:4'] }))
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ status: 'partial', unavailableSourceCount: 1 })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render()

    // COD/4 is absent only because a source failed: keeping it is the whole point.
    const stored = JSON.parse(sessionStorage.getItem('diem.survey-selection.alice.production') || '{}')
    expect(stored.keys).toContain('v2:COD:4')
    expect(container.textContent).toContain('could not be confirmed because a data source did not answer')
    expect(container.textContent).not.toContain('no longer available')
  })

  it('removes a selection only when complete discovery proves it is gone', async () => {
    sessionStorage.setItem('diem.survey-selection.alice.production', JSON.stringify({ version: 1, keys: ['v2:NGA:8', 'v2:COD:4'] }))

    await render()

    const stored = JSON.parse(sessionStorage.getItem('diem.survey-selection.alice.production') || '{}')
    expect(stored.keys).toEqual(['v2:NGA:8'])
    expect(container.textContent).toContain('no longer available and was removed')
  })

  it('does not hand one account the selection of another', async () => {
    sessionStorage.setItem('diem.survey-selection.alice.production', JSON.stringify({ version: 1, keys: ['v2:NGA:8'] }))
    await render()
    expect(checkboxes().filter((box) => box.checked)).toHaveLength(1)

    auth.user = { username: 'bob', capabilities: { contributor: false, aggregatedData: true, householdData: false } }
    await render()

    expect(checkboxes().filter((box) => box.checked)).toHaveLength(0)
  })
})

describe('test-data mode', () => {
  beforeEach(() => {
    // Test surveys are unreleased (opendata = 0): the mode is a Contributor's.
    auth.user = { username: 'carla', capabilities: { contributor: true, aggregatedData: true, householdData: true } }
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: [survey('v2', 'NGA', 8), survey('v3', 'COD', 99, true)] })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
  })

  it('is not offered to a non-Contributor, and a shared ?test=1 link is ignored', async () => {
    auth.user = { username: 'alice', capabilities: { contributor: false, aggregatedData: true, householdData: false } }

    await render('/data/surveys?test=1')

    expect(container.textContent).not.toContain('Test data mode')
    expect(container.querySelector('.test-mode-open')).toBe(null)
    expect(rows().map((row) => row.textContent).join(' ')).not.toContain('Test data')
  })

  it('hides simulated surveys and keeps them out of the count by default', async () => {
    await render()

    expect(rows()).toHaveLength(1)
    expect(container.textContent).toContain('Nigeria')
    expect(container.textContent).not.toContain('Chad')
    expect(container.querySelector('.access-card-lede')?.textContent).toContain('1 survey available')
    expect(container.querySelector('.test-mode-open')?.textContent).toContain('instead of production surveys')
  })

  it('shows simulated surveys alone, never beside production ones', async () => {
    await render('/data/surveys?test=1')

    const listed = rows().map((row) => row.textContent)
    expect(listed).toHaveLength(1)
    expect(listed[0]).toContain('Test data')
    // The guarantee: no production survey is selectable in the same breath.
    expect(listed.join(' ')).not.toContain('Nigeria')
    expect(container.textContent).toContain('Test data mode')
  })

  it('still reports the production count while test mode is open', async () => {
    await render('/data/surveys?test=1')

    expect(container.querySelector('.access-card-lede')?.textContent).toContain('1 survey available')
  })

  it('keeps test and production selections in separate storage scopes', async () => {
    await render('/data/surveys?test=1')
    await click(checkboxes()[0])

    expect(sessionStorage.getItem('diem.survey-selection.carla.test')).toContain('v3:COD:99')
    expect(sessionStorage.getItem('diem.survey-selection.carla.production')).toBe(null)
  })
})

describe('survey list grouped by country', () => {
  const MANY = [
    survey('v2', 'NGA', 7), survey('v2', 'NGA', 8), survey('v1', 'NGA', 3),
    survey('v2', 'TCD', 3),
  ]

  beforeEach(() => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: MANY })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
  })

  function toggles() {
    return Array.from(container.querySelectorAll('.survey-country-toggle')) as HTMLButtonElement[]
  }

  it('shows one collapsed row per country, not every round', async () => {
    await render('/data/surveys', { expand: false })

    expect(toggles().map((toggle) => toggle.querySelector('strong')?.textContent)).toEqual(['Chad', 'Nigeria'])
    expect(toggles().every((toggle) => toggle.getAttribute('aria-expanded') === 'false')).toBe(true)
    expect(checkboxes()).toHaveLength(0)
    expect(toggles()[1].textContent).toContain('3 rounds')
  })

  it('opens a country onto its rounds, latest first', async () => {
    await render('/data/surveys', { expand: false })

    await click(toggles()[1])

    const nigeria = toggles()[1]
    expect(nigeria.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector(`#${nigeria.getAttribute('aria-controls')}`)).not.toBe(null)
    expect(rows().map((row) => row.querySelector('.survey-row-round')?.textContent)).toEqual(['Round 8', 'Round 7', 'Round 3'])
  })

  it('says on the collapsed row how many of its rounds are selected', async () => {
    await render('/data/surveys', { expand: false })
    await click(toggles()[1])
    await click(checkboxes()[0])
    await click(toggles()[1])

    expect(toggles()[1].getAttribute('aria-expanded')).toBe('false')
    expect(toggles()[1].textContent).toContain('1 selected')
  })

  it('opens every matching country while searching', async () => {
    await render('/data/surveys', { expand: false })
    const search = container.querySelector('.survey-search input') as HTMLInputElement

    await act(async () => {
      const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setValue.call(search, 'nig')
      search.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(toggles()).toHaveLength(1)
    expect(toggles()[0].getAttribute('aria-expanded')).toBe('true')
    expect(checkboxes()).toHaveLength(3)
  })

  it('opens a lone country without asking for a click', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: [survey('v2', 'NGA', 8), survey('v2', 'NGA', 7)] })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await render('/data/surveys', { expand: false })

    expect(checkboxes()).toHaveLength(2)
    expect(container.querySelector('.survey-list-controls')).toBe(null)
  })

  it('labels each round checkbox with its country, since the country is no longer in the row', async () => {
    await render()

    expect(checkboxes()[0].getAttribute('aria-label')).toBe('Chad, round 3')
  })
})

describe('thematic areas and review', () => {
  const mixed = [
    survey('v2', 'NGA', 8, false, ['food-security', 'crop-production']),
    survey('v2', 'TCD', 3, false, ['food-security']),
  ]

  beforeEach(() => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: mixed })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
  })

  async function selectBothSurveys() {
    await render()
    for (const box of checkboxes()) await click(box)
  }

  it('states each theme reach against the current selection', async () => {
    await selectBothSurveys()
    await click(container.querySelectorAll('.theme-choice input')[1])

    const options = Array.from(container.querySelectorAll('.theme-option')) as HTMLElement[]
    const crop = options.find((option) => option.textContent?.includes('Crop production'))
    const food = options.find((option) => option.textContent?.includes('Food security'))
    expect(crop?.textContent).toContain('Available for 1 of 2 selected surveys')
    expect(food?.textContent).toContain('Available for all 2 selected surveys')
  })

  it('names the omitted survey-theme combinations before download', async () => {
    await selectBothSurveys()

    // "All available themes" spans both, so Chad is missing crop production.
    const rowText = Array.from(container.querySelectorAll('.package-table tbody tr')).map((row) => row.textContent)
    const chad = rowText.find((text) => text?.includes('Chad'))
    expect(chad).toContain('Crop production: not collected for this survey')
    expect(rowText.find((text) => text?.includes('Nigeria'))).toContain('Complete')
  })

  it('distinguishes a failed source from a theme the survey never carried', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({
        status: 'partial',
        surveys: mixed,
        unavailableSourceCount: 1,
        sources: [{
          resourceId: 'resource-crop-production',
          generation: 'v2',
          themeId: 'crop-production',
          themeLabel: 'Crop production',
          testData: false,
          status: 'failed',
          message: 'timeout',
        }],
      })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })

    await selectBothSurveys()

    const chad = Array.from(container.querySelectorAll('.package-table tbody tr'))
      .map((row) => row.textContent)
      .find((text) => text?.includes('Chad'))
    expect(chad).toContain('Crop production: could not be retrieved')
  })

  it('counts records only when asked, and totals what it measured', async () => {
    auth.requestProtected.mockResolvedValue({ count: 120 })
    await selectBothSurveys()

    expect(container.querySelector('.package-preflight')?.textContent).toContain('3 data files')
    expect(container.querySelector('.package-preflight')?.textContent).not.toContain('records')

    const countButton = Array.from(container.querySelectorAll('.package-actions button')).find((b) => b.textContent?.startsWith('Count')) as HTMLButtonElement
    await act(async () => { countButton.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(container.querySelector('.package-preflight')?.textContent).toContain('360 records')
  })

  it('offers combined files, keeps measured counts and passes the selected layout to the builder', async () => {
    auth.requestProtected.mockResolvedValue({ count: 2 })
    buildSurveyBundle.mockResolvedValue({ fileName: 'x.zip', blob: new Blob(['zip']), fileCount: 6, recordCount: 6 })
    await selectBothSurveys()
    expect(container.querySelectorAll('.package-layout-choice input')).toHaveLength(2)
    expect(container.querySelector('.package-preflight')?.textContent).toContain('3 data files')
    await click(container.querySelectorAll('.package-layout-choice input')[1])
    expect(container.querySelector('.package-preflight')?.textContent).toContain('2 data files')
    expect(container.querySelectorAll('.package-generated-files li')).toHaveLength(2)
    expect(container.querySelector('.package-generated-files')?.textContent).toContain('v2_food-security.csv')
    const countButton = Array.from(container.querySelectorAll('.package-actions button')).find((button) => button.textContent?.startsWith('Count'))!
    await click(countButton)
    expect(container.querySelector('.package-preflight')?.textContent).toContain('6 records')
    const downloadButton = Array.from(container.querySelectorAll('.package-actions button')).find((button) => button.textContent?.startsWith('Download'))!
    await click(downloadButton)
    expect(buildSurveyBundle.mock.calls.at(-1)?.[0].layout).toBe('combined-by-source')
    expect(sessionStorage.getItem('diem.survey-package-layout.alice.production')).toBe('combined-by-source')
    await click(container.querySelectorAll('.package-layout-choice input')[0])
    expect(container.querySelector('.package-preflight')?.textContent).toContain('6 records')
    expect(container.querySelector('.package-outcome')).toBe(null)
  })

  it('blocks an oversized combined file while offering separate folders', async () => {
    auth.requestProtected.mockResolvedValue({ count: 11_000 })
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: [survey('v2', 'NGA', 8), survey('v2', 'TCD', 3)] })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
    await selectBothSurveys()
    await click(container.querySelectorAll('.package-layout-choice input')[1])
    const countButton = Array.from(container.querySelectorAll('.package-actions button')).find((button) => button.textContent?.startsWith('Count'))!
    await click(countButton)
    expect(container.querySelector('.package-blocker')?.textContent).toContain('Use separate survey folders')
    await click(container.querySelectorAll('.package-layout-choice input')[0])
    expect(container.querySelector('.package-blocker')).toBe(null)
  })

  it('restores the account-scoped layout preference with a fresh selection', async () => {
    sessionStorage.setItem('diem.survey-package-layout.alice.production', 'combined-by-source')
    await selectBothSurveys()
    expect((container.querySelectorAll('.package-layout-choice input')[1] as HTMLInputElement).checked).toBe(true)
    expect(container.querySelector('.package-preflight')?.textContent).toContain('2 data files')
  })

  it('discards a measurement once the selection changes', async () => {
    auth.requestProtected.mockResolvedValue({ count: 120 })
    await selectBothSurveys()
    await act(async () => {
      Array.from(container.querySelectorAll('.package-actions button')).find((b) => b.textContent?.startsWith('Count'))!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(container.querySelector('.package-preflight')?.textContent).toContain('records')

    await click(checkboxes()[1])

    expect(container.querySelector('.package-preflight')?.textContent).not.toContain('records')
  })
})

describe('package download', () => {
  beforeEach(() => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: [survey('v2', 'NGA', 8, false, ['food-security'])] })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
  })

  function button(prefix: string) {
    return Array.from(container.querySelectorAll('.package-actions button'))
      .find((entry) => entry.textContent?.startsWith(prefix)) as HTMLButtonElement
  }

  /** Selects one survey and runs the preflight a download now requires. */
  async function selectAndFindDownload() {
    auth.requestProtected.mockResolvedValue({ count: 5 })
    await render()
    await click(checkboxes()[0])
    await act(async () => { button('Count').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    return button('Download')
  }

  it('names what the download will contain', async () => {
    const download = await selectAndFindDownload()
    expect(download.textContent).toBe('Download 1 data file for 1 survey')
  })

  it('states the archive, licence, omissions and preflight result before generating', async () => {
    await selectAndFindDownload()

    const summary = container.querySelector('.package-summary')?.textContent || ''
    expect(summary).toMatch(/DIEM_aggregated_\d{4}-\d{2}-\d{2}\.zip/)
    expect(summary).toContain('5 records')
    expect(summary).toContain('CC BY 4.0')
    expect(summary).toContain('Nothing — every requested survey and theme is present')
    expect(summary).toContain('All checks passed')
    expect(summary).not.toContain('Test data')
  })

  it('moves focus to the preflight verdict when counting passes', async () => {
    await selectAndFindDownload()

    const verdict = container.querySelector('#package-preflight')
    expect(verdict?.className).toBe('package-ready')
    expect(verdict?.textContent).toContain('Preflight passed: 5 records in 1 data file')
    expect(document.activeElement).toBe(verdict)
  })

  it('moves focus to what blocks the download when counting fails', async () => {
    auth.requestProtected.mockRejectedValue(new Error('timeout'))
    await render()
    await click(checkboxes()[0])
    await act(async () => { button('Count').dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    const verdict = container.querySelector('#package-preflight')
    expect(verdict?.className).toBe('package-blocker')
    expect(verdict?.textContent).toContain('could not be counted')
    expect(document.activeElement).toBe(verdict)
  })

  it('clears a cancelled outcome once the package changes', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({ surveys: [survey('v2', 'NGA', 8), survey('v2', 'TCD', 3)] })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
    const cancelled = new Error('The package was cancelled.')
    cancelled.name = 'BundleCancelled'
    buildSurveyBundle.mockRejectedValue(cancelled)
    isBundleCancelled.mockReturnValue(true)
    const download = await selectAndFindDownload()
    await act(async () => { download.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(container.querySelector('.package-outcome')?.textContent).toContain('cancelled')

    // A different selection is a different package; "cancelled" no longer describes it.
    await click(checkboxes()[1])

    expect(container.querySelector('.package-outcome')).toBe(null)
  })

  it('says the preflight is incomplete while it is', async () => {
    await render()
    await click(checkboxes()[0])

    expect(container.querySelector('.package-summary')?.textContent).toContain('Not yet complete')
  })

  it('moves focus to the outcome when the package is ready', async () => {
    buildSurveyBundle.mockResolvedValue({ fileName: 'DIEM_aggregated_2026-09-21.zip', blob: new Blob(['zip']), fileCount: 5, recordCount: 5 })
    const download = await selectAndFindDownload()

    await act(async () => { download.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    const outcome = container.querySelector('.package-outcome')
    expect(outcome?.textContent).toContain('DIEM_aggregated_2026-09-21.zip downloaded')
    expect(document.activeElement).toBe(outcome)
  })

  it('moves focus to the error when the package fails', async () => {
    buildSurveyBundle.mockRejectedValue(new Error('Service unavailable.'))
    const download = await selectAndFindDownload()

    await act(async () => { download.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(document.activeElement).toBe(container.querySelector('.package-error'))
  })

  it('keeps download disabled until the records have been counted', async () => {
    await render()
    await click(checkboxes()[0])

    expect(button('Download').disabled).toBe(true)
    expect(container.querySelector('.package-blocker')?.textContent).toContain('Count the records first')
  })

  it('keeps download disabled when a count failed', async () => {
    auth.requestProtected.mockRejectedValue(new Error('timeout'))
    await render()
    await click(checkboxes()[0])
    await act(async () => { button('Count').dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(button('Download').disabled).toBe(true)
    expect(container.querySelector('.package-blocker')?.textContent).toContain('could not be counted')
  })

  it('keeps download disabled while a selected survey is unconfirmed', async () => {
    sessionStorage.setItem('diem.survey-selection.alice.production', JSON.stringify({ version: 1, keys: ['v2:NGA:8', 'v2:COD:4'] }))
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({
        status: 'partial',
        unavailableSourceCount: 1,
        surveys: [survey('v2', 'NGA', 8, false, ['food-security'])],
      })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
    auth.requestProtected.mockResolvedValue({ count: 5 })
    await render()
    await act(async () => { button('Count').dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    // COD/4 never reaches the package plan, so building now would drop it silently.
    expect(button('Download').disabled).toBe(true)
    expect(container.querySelector('.package-blocker')?.textContent).toContain('not been confirmed')
  })

  it('keeps download disabled when the package is over budget', async () => {
    auth.requestProtected.mockResolvedValue({ count: 60_000 })
    await render()
    await click(checkboxes()[0])
    await act(async () => { button('Count').dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(button('Download').disabled).toBe(true)
    expect(container.querySelector('.package-blocker')?.textContent).toContain('one package can hold')
  })

  it('builds the archive and reports the file it delivered', async () => {
    buildSurveyBundle.mockResolvedValue({
      fileName: 'DIEM_aggregated_2026-09-21.zip',
      blob: new Blob(['zip']),
      fileCount: 5,
      recordCount: 120,
    })
    const download = await selectAndFindDownload()

    await act(async () => { download.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    const passed = buildSurveyBundle.mock.calls[0][0]
    expect(passed.slices).toHaveLength(1)
    expect(passed.slices[0].survey.key).toBe('v2:NGA:8')
    expect(container.querySelector('.package-outcome')?.textContent).toContain('DIEM_aggregated_2026-09-21.zip downloaded')
  })

  it('keeps the selection and explains itself when the build fails', async () => {
    buildSurveyBundle.mockRejectedValue(new Error('Service unavailable.'))
    const download = await selectAndFindDownload()

    await act(async () => { download.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(container.querySelector('.package-error')?.textContent).toContain('Service unavailable.')
    expect(container.querySelector('.package-error')?.textContent).toContain('selection has been kept')
    expect(checkboxes().filter((box) => box.checked)).toHaveLength(1)
  })

  it('treats a cancellation as a choice, not an error', async () => {
    const cancelled = new Error('The package was cancelled.')
    cancelled.name = 'BundleCancelled'
    buildSurveyBundle.mockRejectedValue(cancelled)
    isBundleCancelled.mockReturnValue(true)
    const download = await selectAndFindDownload()

    await act(async () => { download.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(container.querySelector('.package-error')).toBe(null)
    const outcome = container.querySelector('.package-outcome')
    expect(outcome?.textContent).toContain('cancelled. Nothing was downloaded')
    expect(document.activeElement).toBe(outcome)
    isBundleCancelled.mockReturnValue(false)
  })

  it('carries the omitted combinations into the package', async () => {
    discoverAggregatedSurveys.mockImplementation((_requester: unknown, options: { onProgress?: (value: SurveyDiscoveryResult) => void }) => {
      const result = discovery({
        surveys: [
          survey('v2', 'NGA', 8, false, ['food-security', 'crop-production']),
          survey('v2', 'TCD', 3, false, ['food-security']),
        ],
      })
      options.onProgress?.(result)
      return Promise.resolve(result)
    })
    buildSurveyBundle.mockResolvedValue({ fileName: 'x.zip', blob: new Blob(['zip']), fileCount: 3, recordCount: 1 })
    auth.requestProtected.mockResolvedValue({ count: 5 })

    await render()
    for (const box of checkboxes()) await click(box)
    await act(async () => { button('Count').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    await act(async () => { button('Download').dispatchEvent(new MouseEvent('click', { bubbles: true })) })

    expect(buildSurveyBundle.mock.calls.at(-1)?.[0].omitted).toEqual([
      { surveyKey: 'v2:TCD:3', themeLabel: 'Crop production', reason: 'Not collected for this survey' },
    ])
  })
})

describe('microdata tab', () => {
  it('opens itself when an accepted grant invitation sends the user here', async () => {
    // GRANTS_ROUTE: the grants live in this tab now, and a hidden panel cannot be scrolled to.
    await render('/data/surveys#temporary-microdata')

    expect(container.querySelector('#tab-microdata')?.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('#panel-microdata')?.hasAttribute('hidden')).toBe(false)
  })

  it('opens on aggregated data otherwise', async () => {
    await render()

    expect(container.querySelector('#tab-aggregated')?.getAttribute('aria-selected')).toBe('true')
  })

  it('carries the routes and the full licence wherever microdata is offered', async () => {
    await render('/data/surveys#temporary-microdata')

    const panel = container.querySelector('#panel-microdata')?.textContent || ''
    expect(panel).toContain('FAO Microdata Catalogue (FAM)')
    expect(panel).toContain('Request direct access')
    // The licence must be read where download is offered, not only in the guide.
    expect(panel).toContain('the microdataset will not be redisseminated')
  })

  it('lists household collections only for an account holding household-data access', async () => {
    auth.requestProtected.mockImplementation(async (url: string) => {
      const id = /\/content\/items\/([^/?]+)/.exec(url)?.[1]
      if (id) return { id, title: id, type: 'Feature Service', owner: 'DIEM', modified: 1, access: 'shared' }
      return {}
    })
    await render('/data/surveys#temporary-microdata')
    expect(container.querySelector('#step-household')).toBe(null)

    auth.user = { username: 'hana', capabilities: { contributor: false, aggregatedData: true, householdData: true } }
    await render('/data/surveys#temporary-microdata')

    const section = container.querySelector('[aria-labelledby="step-household"]')
    expect(section?.textContent).toContain('DIEM Household Surveys Microdata')
    expect(section?.querySelector('a[href="/data/2d15e5b7768949b4905e452fcc5e0440"]')).not.toBe(null)
  })

  it('switches to the tab from the access summary, and moves focus with it', async () => {
    await render()
    const open = Array.from(container.querySelectorAll('.access-card button'))
      .find((entry) => entry.textContent?.startsWith('See your microdata')) as HTMLButtonElement

    await click(open)

    const tab = container.querySelector('#tab-microdata')
    expect(tab?.getAttribute('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab)
  })

  it('no longer sends anyone to the /data microdata section', async () => {
    await render()

    expect(container.querySelector('a[href^="/data#"]')).toBe(null)
  })
})

describe('microdata licence framing', () => {
  function licence() {
    return container.querySelector('.microdata-licence')
  }

  const ACTIVE_GRANT = {
    key: 'request-2026-001:v2',
    grantId: 'request-2026-001',
    questionnaireVersion: 'v2',
    surveyScope: [{ adm0_iso3: 'NGA', round: 8 }],
    views: [{ itemId: 'a'.repeat(32), title: 'Nigeria round 8', component: 'legacy', schemaVersion: 1, grantId: 'request-2026-001', questionnaireVersion: 'v2', surveyScope: [{ adm0_iso3: 'NGA', round: 8 }], bulkExportEnabled: false }],
    documentation: [],
    status: 'active',
    bulkExportEnabled: false,
    joinKeys: [],
  }

  it('offers the request form to an account with no microdata access', async () => {
    await render('/data/surveys#temporary-microdata')

    expect(licence()?.textContent).toContain('Conditions of use')
    expect(licence()?.querySelector('a[href="/data/microdata-request"]')).not.toBe(null)
    expect(licence()?.textContent).not.toContain('must include the following citation')
  })

  it('treats a temporary grant holder as holding access, not as someone to request it', async () => {
    // householdData stays false for a grant holder, by design: the grant is a separate path.
    fetchCurrentUserMicrodataGrants.mockResolvedValue({ bundles: [ACTIVE_GRANT], source: 'groups' })

    await render('/data/surveys#temporary-microdata')

    expect(container.querySelector('.grant-section')).not.toBe(null)
    expect(licence()?.textContent).toContain('Your microdata licence')
    expect(licence()?.textContent).toContain('which you accepted when you made your request')
    expect(licence()?.textContent).toContain('must include the following citation')
    expect(licence()?.querySelector('a[href="/data/microdata-request"]')).toBe(null)
  })

  it('does not tell a household-data group member they made a request', async () => {
    auth.user = { username: 'hana', capabilities: { contributor: false, aggregatedData: true, householdData: true } }

    await render('/data/surveys#temporary-microdata')

    expect(licence()?.textContent).toContain('Your account holds household microdata access')
    // Group membership may never have involved a request, so nothing may claim
    // this user made one. (The terms themselves still mention requesting.)
    expect(licence()?.textContent).not.toContain('when you made your request')
    expect(licence()?.textContent).not.toContain('when requesting access')
    expect(licence()?.textContent).toContain('must include the following citation')
  })

  it('names both paths when an account holds a grant and household-data access', async () => {
    auth.user = { username: 'hana', capabilities: { contributor: false, aggregatedData: true, householdData: true } }
    fetchCurrentUserMicrodataGrants.mockResolvedValue({ bundles: [ACTIVE_GRANT], source: 'groups' })

    await render('/data/surveys#temporary-microdata')

    const text = licence()?.textContent || ''
    // Neither single framing is enough: the grant one omits the collections,
    // the group one omits the request the grant followed.
    expect(text).toContain('holds household microdata access and a temporary grant issued following your request')
    expect(text).toContain('every collection and grant dataset you open')
    expect(text).not.toContain('every dataset in your grant')
    expect(text).toContain('must include the following citation')
    expect(licence()?.querySelector('a[href="/data/microdata-request"]')).toBe(null)
  })

  it('returns to the request framing once a grant is no longer active', async () => {
    fetchCurrentUserMicrodataGrants.mockResolvedValue({ bundles: [{ ...ACTIVE_GRANT, status: 'unavailable' }], source: 'groups' })

    await render('/data/surveys#temporary-microdata')

    expect(licence()?.textContent).toContain('Conditions of use')
  })
})

describe('technical resources', () => {
  it('carries the boundaries, documentation and tools that left /data', async () => {
    await render()

    const technical = container.querySelector('.technical-resources')?.textContent || ''
    expect(technical).toContain('Administrative reference boundaries')
    expect(technical).toContain('Documentation and metadata')
    expect(technical).toContain('Microdata codebook')
    expect(technical).toContain('DIEM data API')
    expect(technical).toContain('Microdata labelling')
  })
})

describe('workspace tabs', () => {
  it('keeps both panels mounted and moves between tabs with the arrow keys', async () => {
    await render()

    const tabs = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[]
    expect(container.querySelector('#panel-aggregated')).not.toBe(null)
    expect(container.querySelector('#panel-microdata')).not.toBe(null)
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([0, -1])

    await act(async () => {
      tabs[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    })

    const updated = Array.from(container.querySelectorAll('[role="tab"]')) as HTMLButtonElement[]
    expect(updated[1].getAttribute('aria-selected')).toBe('true')
    expect(updated.map((tab) => tab.tabIndex)).toEqual([-1, 0])
    expect(container.querySelector('#panel-aggregated')?.hasAttribute('hidden')).toBe(true)
  })
})

describe('signed out', () => {
  it('offers a sign-in gate instead of redirecting away from the destination', async () => {
    auth.status = 'anonymous'
    auth.user = null

    await render()

    expect(container.textContent).toContain('Sign in to choose your surveys')
    expect(container.querySelector('.survey-list')).toBe(null)
  })
})
