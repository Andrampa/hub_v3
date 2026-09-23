// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * The explorer had no tests, and the two visibility defects found in review
 * both lived here. These cover the rule's scope and its fail-closed path; the
 * service calls are faked so what is asserted is which queries get sent.
 */

const auth = {
  status: 'authenticated' as string,
  user: { username: 'alice', capabilities: { contributor: false } } as { username: string; capabilities: Record<string, boolean> } | null,
  requestProtected: vi.fn().mockResolvedValue({}),
  signIn: vi.fn(),
}
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))

const fetchDatasetDefinition = vi.fn()
const fetchRecordCount = vi.fn()
const fetchTablePreview = vi.fn()
const fetchGeometryPreview = vi.fn()
const fetchFieldOptions = vi.fn()
vi.mock('../services/dataExplorer', async () => {
  const actual = await vi.importActual<typeof import('../services/dataExplorer')>('../services/dataExplorer')
  return { ...actual, fetchDatasetDefinition, fetchRecordCount, fetchTablePreview, fetchGeometryPreview, fetchFieldOptions }
})
const loadValidatedSurveyKeys = vi.fn()
vi.mock('../services/monitoring', async () => {
  const actual = await vi.importActual<typeof import('../services/monitoring')>('../services/monitoring')
  return { ...actual, loadValidatedSurveyKeys }
})
vi.mock('../components/DatasetGeometryMap', () => ({ DatasetGeometryMap: () => null }))

const { default: DatasetExplorer } = await import('./DatasetExplorer')
const { ADMIN_REFERENCE_DATASET_ID } = await import('../services/protectedData')

const AGGREGATE_ID = '499917f1518141209c2a6de55a79d991'
const MICRODATA_ID = 'fd3f8386f8dd40abaa6fdbc033580b65'

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root

function definition(id: string, kind: string, withFlag: boolean) {
  return {
    resource: { id, kind, fallbackTitle: 'Dataset', description: '', access: 'available', item: { id, title: 'Dataset', type: 'Feature Service', owner: 'DIEM', modified: 1, access: 'org' } },
    serviceUrl: 'https://example.test/FeatureServer',
    layerUrl: 'https://example.test/FeatureServer/0',
    isTable: true,
    layer: {
      id: 0,
      name: 'layer',
      objectIdField: 'OBJECTID',
      fields: [
        { name: 'OBJECTID', alias: 'OBJECTID', type: 'esriFieldTypeOID' },
        { name: 'adm0_iso3', alias: 'Country', type: 'esriFieldTypeString' },
        { name: 'round', alias: 'Round', type: 'esriFieldTypeInteger' },
        ...(withFlag ? [{ name: 'opendata', alias: 'Released', type: 'esriFieldTypeSmallInteger' }] : []),
      ],
    },
  }
}

async function open(id: string) {
  await act(async () => {
    root.render(
      <MemoryRouter initialEntries={[`/data/${id}`]}>
        <Routes><Route path="/data/:datasetId" element={<DatasetExplorer />} /></Routes>
      </MemoryRouter>,
    )
  })
  // Settle the definition load and the effects it triggers.
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  auth.user = { username: 'alice', capabilities: { contributor: false } }
  for (const mock of [fetchDatasetDefinition, fetchRecordCount, fetchTablePreview, fetchGeometryPreview, fetchFieldOptions]) mock.mockReset()
  fetchRecordCount.mockResolvedValue(3)
  loadValidatedSurveyKeys.mockReset().mockResolvedValue(new Set(['NGA:8', 'NGA:9', 'COD:4']))
  fetchTablePreview.mockResolvedValue({ features: [] })
  fetchFieldOptions.mockResolvedValue({ values: ['NGA'], truncated: false })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function whereOfFirstCount() {
  return fetchRecordCount.mock.calls[0]?.[1] as string | undefined
}

describe('dataset explorer visibility', () => {
  it('keeps the protected workspace in the breadcrumb trail', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', true))

    await open(AGGREGATE_ID)

    const breadcrumb = container.querySelector('nav[aria-label="Breadcrumb"]')
    expect(breadcrumb?.querySelector('a[href="/data"]')?.textContent).toBe('How to access data')
    expect(breadcrumb?.querySelector('a[href="/data/surveys"]')?.textContent).toBe('Your surveys')
    expect(breadcrumb?.textContent).toContain('Dataset explorer')
  })

  it('limits household microdata to released rows for a non-Contributor', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(MICRODATA_ID, 'microdata', true))

    await open(MICRODATA_ID)

    expect(whereOfFirstCount()).toBe('opendata = 1')
  })

  it('limits aggregated data to validated surveys and released rows for a community member', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', true))

    await open(AGGREGATE_ID)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(whereOfFirstCount()).toBe("((adm0_iso3 = 'NGA' AND round IN (8,9)) OR (adm0_iso3 = 'COD' AND round IN (4))) AND opendata = 1")
  })

  it('gates an unflagged aggregated layer by validation alone', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', false))

    await open(AGGREGATE_ID)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(container.textContent).not.toContain('has not been released')
    expect(whereOfFirstCount()).toBe("(adm0_iso3 = 'NGA' AND round IN (8,9)) OR (adm0_iso3 = 'COD' AND round IN (4))")
  })

  it('queries nothing when the survey register cannot be read', async () => {
    loadValidatedSurveyKeys.mockRejectedValue(new Error('down'))
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', true))

    await open(AGGREGATE_ID)
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })

    expect(container.textContent).toContain('The survey register could not be read')
    expect(fetchRecordCount).not.toHaveBeenCalled()
    expect(fetchFieldOptions).not.toHaveBeenCalled()
  })

  it('does not gate a Contributor', async () => {
    auth.user = { username: 'carla', capabilities: { contributor: true } }
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', true))

    await open(AGGREGATE_ID)

    expect(loadValidatedSurveyKeys).not.toHaveBeenCalled()
    expect(whereOfFirstCount()).toBe('1=1')
  })

  it('does not apply the rule to boundaries, which carry no flag and are not survey data', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(ADMIN_REFERENCE_DATASET_ID, 'reference', false))

    await open(ADMIN_REFERENCE_DATASET_ID)

    // Fail-closed must not reach unrelated public data.
    expect(container.textContent).not.toContain('has not been released')
    expect(whereOfFirstCount()).toBe('1=1')
  })

  it('withholds unflagged survey data and sends no query of any kind, options included', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(MICRODATA_ID, 'microdata', false))

    await open(MICRODATA_ID)

    expect(container.textContent).toContain('This dataset has not been released')
    expect(fetchRecordCount).not.toHaveBeenCalled()
    expect(fetchTablePreview).not.toHaveBeenCalled()
    expect(fetchFieldOptions).not.toHaveBeenCalled()
  })

  it('shows a Contributor unflagged survey data, unfiltered', async () => {
    auth.user = { username: 'carla', capabilities: { contributor: true } }
    fetchDatasetDefinition.mockResolvedValue(definition(MICRODATA_ID, 'microdata', false))

    await open(MICRODATA_ID)

    expect(container.textContent).not.toContain('has not been released')
    expect(whereOfFirstCount()).toBe('1=1')
  })

  it('asks for filter options within the viewer\'s visibility', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(MICRODATA_ID, 'microdata', true))

    await open(MICRODATA_ID)

    const optionCalls = fetchFieldOptions.mock.calls
    expect(optionCalls.length).toBeGreaterThan(0)
    expect(optionCalls.every((call) => call[3] === 'opendata = 1')).toBe(true)
  })
})

describe('table paging and sorting', () => {
  const page = (start: number, size = 30) => ({
    features: Array.from({ length: size }, (_, index) => ({ attributes: { OBJECTID: start + index, adm0_iso3: 'NGA', round: start + index } })),
  })

  async function click(node: Element | null | undefined) {
    await act(async () => { (node as HTMLElement).click() })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
  }

  function moreButton() {
    return [...container.querySelectorAll('.dataset-table-more button')][0]
  }

  it('appends the next page of records without repeating rows', async () => {
    fetchRecordCount.mockResolvedValue(70)
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', false))
    fetchTablePreview.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(31))

    await open(AGGREGATE_ID)
    expect(container.querySelectorAll('.dataset-table-scroll tbody tr').length).toBe(30)

    await click(moreButton())

    expect(container.querySelectorAll('.dataset-table-scroll tbody tr').length).toBe(60)
    // Offset is what the second page asked for; the first asked for none.
    expect(fetchTablePreview.mock.calls[1][4]).toBe(30)
    expect(container.textContent).toContain('Showing 60 of 70 records')
  })

  it('stops offering more when the service ignores the offset', async () => {
    fetchRecordCount.mockResolvedValue(70)
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', false))
    fetchTablePreview.mockResolvedValue(page(1))

    await open(AGGREGATE_ID)
    await click(moreButton())

    expect(container.querySelectorAll('.dataset-table-scroll tbody tr').length).toBe(30)
    expect(moreButton()).toBeUndefined()
  })

  it('sorts the whole result on the service and restarts from the first page', async () => {
    fetchRecordCount.mockResolvedValue(70)
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', false))
    fetchTablePreview.mockResolvedValue(page(1))

    await open(AGGREGATE_ID)
    const header = container.querySelector('.dataset-table-scroll th .dataset-sort')
    await click(header)

    const ascending = fetchTablePreview.mock.calls.at(-1)!
    expect(ascending[4]).toBe(0)
    expect(ascending[5]).toEqual({ field: 'adm0_iso3', direction: 'ASC' })
    expect(container.querySelector('.dataset-table-scroll th')?.getAttribute('aria-sort')).toBe('ascending')

    await click(container.querySelector('.dataset-table-scroll th .dataset-sort'))
    expect(fetchTablePreview.mock.calls.at(-1)![5]).toEqual({ field: 'adm0_iso3', direction: 'DESC' })

    // A third press clears the sort rather than cycling back to ascending.
    await click(container.querySelector('.dataset-table-scroll th .dataset-sort'))
    expect(fetchTablePreview.mock.calls.at(-1)![5]).toBeUndefined()
    expect(container.querySelector('.dataset-table-scroll th')?.getAttribute('aria-sort')).toBe('none')
  })
})
