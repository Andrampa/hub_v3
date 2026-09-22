// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { CountrySummary } from '../services/countries'
import { CountryMap, CountryShape } from './CountryMap'

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function summary(iso3: string, name: string): CountrySummary {
  return { iso3, name, region: 'Africa', continent: 'Africa', subregion: '', resourceCount: 3, latestPublished: 0, typeCounts: {} }
}

async function render(node: React.ReactNode) {
  await act(async () => {
    root.render(<MemoryRouter>{node}</MemoryRouter>)
  })
}

describe('CountryMap', () => {
  it('links covered countries by ISO3, Tanzania included', async () => {
    await render(<CountryMap countries={[summary('SOM', 'Somalia'), summary('TZA', 'United Republic of Tanzania')]} />)
    const links = [...container.querySelectorAll('.country-map a')].map((link) => link.getAttribute('href'))
    expect(links.sort()).toEqual(['/countries/som', '/countries/tza'])
  })

  it('draws UN boundaries over fills that carry no outline of their own', async () => {
    await render(<CountryMap countries={[summary('SDN', 'Sudan')]} />)
    const boundaries = container.querySelector('.map-boundaries')
    expect(boundaries?.getAttribute('aria-hidden')).toBe('true')
    expect(boundaries?.querySelector('.map-boundary--undetermined')).not.toBeNull()
    expect(boundaries?.querySelector('.map-boundary--control')).not.toBeNull()
    // The boundaries follow the country fills inside the zoomed group.
    expect(boundaries?.parentElement?.getAttribute('transform')).toBe('translate(0 0) scale(1)')
    // Neutral areas are drawn, never linked.
    expect(container.querySelectorAll('.country-map .map-area--neutral')).toHaveLength(3)
    expect(container.querySelector('a .map-area--neutral')).toBeNull()
  })

  it('offers the shared zoom controls', async () => {
    await render(<CountryMap countries={[]} />)
    const zoomIn = container.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!
    const reset = container.querySelector<HTMLButtonElement>('button[aria-label="Reset map view"]')!
    expect(reset.disabled).toBe(true)
    await act(async () => zoomIn.click())
    expect(container.querySelector('.country-map g')?.getAttribute('transform')).toContain('scale(1.6)')
    expect(reset.disabled).toBe(false)
  })

  it('credits the UN as the boundary source', async () => {
    await render(<CountryMap countries={[]} />)
    expect(container.querySelector('.map-source')?.textContent).toContain('United Nations Geospatial')
  })
})

describe('CountryShape', () => {
  it('shows a country beside the neutral area it touches', async () => {
    await render(<CountryShape iso3="PAK" name="Pakistan" />)
    expect(container.querySelectorAll('.country-shape .map-area--neutral')).toHaveLength(1)
    expect(container.querySelector('.country-shape .map-boundary--control')).not.toBeNull()
  })

  it('draws a country without disputed neighbours on its own', async () => {
    await render(<CountryShape iso3="KEN" name="Kenya" />)
    expect(container.querySelector('.country-shape-country')?.getAttribute('d')).toBeTruthy()
    expect(container.querySelector('.country-shape .map-area--neutral')).toBeNull()
  })
})
