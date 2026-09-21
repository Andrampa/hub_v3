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
vi.mock('../components/DatasetGeometryMap', () => ({ DatasetGeometryMap: () => null }))

const { default: DatasetExplorer } = await import('./DatasetExplorer')
const { ADMIN_REFERENCE_DATASET_ID } = await import('../services/protectedData')

const AGGREGATE_ID = '499917f1518141209c2a6de55a79d991'

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
    expect(breadcrumb?.querySelector('a[href="/data"]')?.textContent).toBe('Data access')
    expect(breadcrumb?.querySelector('a[href="/data/surveys"]')?.textContent).toBe('Your surveys')
    expect(breadcrumb?.textContent).toContain('Dataset explorer')
  })

  it('limits survey data to released rows for a non-Contributor', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', true))

    await open(AGGREGATE_ID)

    expect(whereOfFirstCount()).toBe('opendata = 1')
  })

  it('does not apply the rule to boundaries, which carry no flag and are not survey data', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(ADMIN_REFERENCE_DATASET_ID, 'reference', false))

    await open(ADMIN_REFERENCE_DATASET_ID)

    // Fail-closed must not reach unrelated public data.
    expect(container.textContent).not.toContain('has not been released')
    expect(whereOfFirstCount()).toBe('1=1')
  })

  it('withholds unflagged survey data and sends no query of any kind, options included', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', false))

    await open(AGGREGATE_ID)

    expect(container.textContent).toContain('This dataset has not been released')
    expect(fetchRecordCount).not.toHaveBeenCalled()
    expect(fetchTablePreview).not.toHaveBeenCalled()
    expect(fetchFieldOptions).not.toHaveBeenCalled()
  })

  it('shows a Contributor unflagged survey data, unfiltered', async () => {
    auth.user = { username: 'carla', capabilities: { contributor: true } }
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', false))

    await open(AGGREGATE_ID)

    expect(container.textContent).not.toContain('has not been released')
    expect(whereOfFirstCount()).toBe('1=1')
  })

  it('asks for filter options within the viewer\'s visibility', async () => {
    fetchDatasetDefinition.mockResolvedValue(definition(AGGREGATE_ID, 'aggregate', true))

    await open(AGGREGATE_ID)

    const optionCalls = fetchFieldOptions.mock.calls
    expect(optionCalls.length).toBeGreaterThan(0)
    expect(optionCalls.every((call) => call[3] === 'opendata = 1')).toBe(true)
  })
})
