// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const auth = { status: 'authenticated', requestProtected: vi.fn() }
const fetchGrants = vi.fn()
vi.mock('../auth/AuthContext', () => ({ useAuth: () => auth }))
vi.mock('../services/microdataGrants', () => ({ fetchCurrentUserMicrodataGrants: fetchGrants, onGrantAccessChanged: () => () => {} }))
const { useMicrodataGrants } = await import('./useMicrodataGrants')
let root: Root
let host: HTMLDivElement
let latest: ReturnType<typeof useMicrodataGrants>
function Probe({ busy = false }: { busy?: boolean }) {
  latest = useMicrodataGrants({ busy })
  return latest.discovery?.bundles.some((bundle) => bundle.status === 'active')
    ? <a download="prepared.zip">Prepared part</a> : null
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  auth.status = 'authenticated'
  fetchGrants.mockReset().mockResolvedValue({ bundles: [], source: 'none' })
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-10-06T10:00:00Z'))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers() })
it('retains grant-only access through failed refreshes, including the pending result, but accepts successful removal', async () => {
  const granted = { bundles: [{ status: 'active', grantId: 'test-grant' }], source: 'groups' }
  fetchGrants.mockResolvedValueOnce(granted)
  await act(async () => root.render(<Probe />))
  const retained = latest.discovery?.bundles
  const preparedLink = host.querySelector('a[download]')
  expect(preparedLink).not.toBeNull()
  fetchGrants.mockRejectedValueOnce(new Error('Temporary ArcGIS failure'))
  await act(async () => { await latest.check() })
  expect(latest.discovery?.bundles).toBe(retained)
  expect((await latest.pending)?.bundles).toBe(retained)
  expect(latest.discovery?.error).toBe('Temporary ArcGIS failure')
  expect(host.querySelector('a[download]')).toBe(preparedLink)
  fetchGrants.mockResolvedValueOnce({ bundles: [], source: 'none', error: 'Discovery unavailable' })
  await act(async () => { await latest.check() })
  expect(latest.discovery?.bundles).toBe(retained)
  expect(host.querySelector('a[download]')).toBe(preparedLink)
  fetchGrants.mockResolvedValueOnce({ bundles: [], source: 'none' })
  await act(async () => { await latest.check() })
  expect(latest.discovery?.bundles).toEqual([])
  expect(latest.discovery?.error).toBeUndefined()
  expect(host.querySelector('a[download]')).toBeNull()
})
it('throttles focus refreshes and defers refresh until inventory or preparation finishes', async () => {
  await act(async () => root.render(<Probe />))
  const originalPending = latest.pending
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(fetchGrants).toHaveBeenCalledTimes(1)
  expect(latest.pending).toBe(originalPending)
  await act(async () => root.render(<Probe busy />))
  vi.setSystemTime(new Date('2026-10-06T10:01:01Z'))
  await act(async () => window.dispatchEvent(new Event('focus')))
  expect(fetchGrants).toHaveBeenCalledTimes(1)
  await act(async () => root.render(<Probe />))
  expect(fetchGrants).toHaveBeenCalledTimes(2)
})
it('does not restart an active grant check and queues an explicit retry', async () => {
  let finish!: (value: { bundles: []; source: string }) => void
  fetchGrants.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  await act(async () => root.render(<Probe />))
  const originalPending = latest.pending
  vi.setSystemTime(new Date('2026-10-06T10:01:01Z'))
  await act(async () => window.dispatchEvent(new Event('focus')))
  await act(async () => { void latest.check() })
  expect(latest.pending).toBe(originalPending)
  expect(fetchGrants).toHaveBeenCalledTimes(1)
  await act(async () => finish({ bundles: [], source: 'none' }))
  expect(fetchGrants).toHaveBeenCalledTimes(2)
})
it('discards late results after sign-out', async () => {
  let finish!: (value: { bundles: []; source: string }) => void
  fetchGrants.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
  await act(async () => root.render(<Probe />))
  auth.status = 'anonymous'
  await act(async () => root.render(<Probe />))
  await act(async () => finish({ bundles: [], source: 'none' }))
  expect(latest.discovery).toBeUndefined()
  expect(latest.pending).toBeUndefined()
})
