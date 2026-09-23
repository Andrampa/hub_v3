import { describe, expect, it, vi } from 'vitest'
import { downloadFilename, downloadPublicItem, itemResourceAction, publicItemDataUrl, usesAnonymousDownload } from './arcgis'
import type { ArcGISItem } from '../types'

const item = { id: '743a0290c07645a8ba03afded1507e5b', title: 'Afghanistan - Round 12', type: 'Microsoft Excel' }

function deps(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response
    return response
  })
  return {
    fetchMock,
    fetch: fetchMock as unknown as typeof fetch,
    save: vi.fn(),
    openFallback: vi.fn(),
  }
}

describe('public item downloads', () => {
  it('builds a tokenless, encoded, cache-busted data URL', () => {
    expect(publicItemDataUrl('a/b?c', 42)).toBe('https://www.arcgis.com/sharing/rest/content/items/a%2Fb%3Fc/data?_=42')
    expect(publicItemDataUrl(item.id)).not.toBe(publicItemDataUrl(item.id, 1))
    expect(publicItemDataUrl(item.id)).not.toMatch(/token/i)
  })

  it('fetches without cookies, cache or referrer and saves the blob', async () => {
    const d = deps(new Response('xlsx', { status: 200, headers: { 'content-disposition': 'attachment; filename="round12.xlsx"' } }))
    await expect(downloadPublicItem(item, d)).resolves.toBe('saved')
    const [url, init] = d.fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toMatch(/\/data\?_=\d+$/)
    expect(init).toMatchObject({ credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' })
    expect(d.save).toHaveBeenCalledWith(expect.any(Blob), 'round12.xlsx')
    expect(d.openFallback).not.toHaveBeenCalled()
  })

  it.each([
    ['a network failure', new TypeError('Failed to fetch')],
    ['a 404', new Response('', { status: 404 })],
  ])('opens the ArcGIS item page, never /data, on %s', async (_label, response) => {
    const d = deps(response)
    await expect(downloadPublicItem(item, d)).resolves.toBe('fallback')
    expect(d.save).not.toHaveBeenCalled()
    expect(d.openFallback).toHaveBeenCalledWith(`https://www.arcgis.com/home/item.html?id=${item.id}`)
  })

  it('refuses a token-bearing redirect', async () => {
    const response = new Response('x', { status: 200 })
    Object.defineProperty(response, 'url', { value: 'https://www.arcgis.com/itemdata/x?token=abc' })
    const d = deps(response)
    await expect(downloadPublicItem(item, d)).resolves.toBe('fallback')
    expect(d.save).not.toHaveBeenCalled()
  })

  it('names the file from the item, the header or the title', () => {
    expect(downloadFilename({ ...item, name: 'a.xlsx' }, 'filename="b.xlsx"')).toBe('a.xlsx')
    expect(downloadFilename(item, "attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf")).toBe('résumé.pdf')
    expect(downloadFilename(item, null)).toBe('Afghanistan - Round 12')
  })

  it('limits the anonymous path to public direct files', () => {
    expect(usesAnonymousDownload({ type: 'Microsoft Excel', access: 'public', url: '' })).toBe(true)
    expect(usesAnonymousDownload({ type: 'PDF', access: 'public', url: '' })).toBe(true)
    expect(usesAnonymousDownload({ type: 'Microsoft Excel', access: 'org', url: '' })).toBe(false)
    expect(usesAnonymousDownload({ type: 'Image', access: 'public', url: '' })).toBe(false)
    expect(usesAnonymousDownload({ type: 'Web Mapping Application', access: 'public', url: 'https://x.org' })).toBe(false)
    expect(itemResourceAction({ id: 'x', type: 'StoryMap', url: 'https://storymaps.arcgis.com/x' } as ArcGISItem))
      .toEqual({ href: 'https://storymaps.arcgis.com/x', label: 'Open resource' })
    expect(itemResourceAction({ id: 'x', type: 'Web Mapping Application', url: '' } as ArcGISItem))
      .toEqual({ href: 'https://www.arcgis.com/home/item.html?id=x', label: 'View original product page' })
  })
})
