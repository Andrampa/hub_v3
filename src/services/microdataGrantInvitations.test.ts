import { describe, expect, it, vi } from 'vitest'
import { GRANT_GROUP_TAG, onGrantAccessChanged } from './microdataGrants'
import {
  ARCGIS_NOTIFICATIONS_URL,
  acceptGrantInvitation,
  fetchPendingGrantInvitations,
} from './microdataGrantInvitations'

const USERNAME = 'andrea.amparore_faohub_testaccount'

function fakeRequester(options: {
  invitations?: unknown[]
  groups?: Record<string, { title?: string; tags?: string[] }>
  unreadableGroups?: string[]
  failInvitations?: boolean
  acceptResponse?: unknown
  failAccept?: boolean
}) {
  const unreadable = new Set(options.unreadableGroups || [])
  return vi.fn(async (url: string) => {
    if (url.endsWith(`/community/users/${encodeURIComponent(USERNAME)}/invitations`)) {
      if (options.failInvitations) throw new Error('invitations unavailable')
      return { userInvitations: options.invitations ?? [] }
    }
    if (/\/invitations\/[^/]+\/accept$/.test(url)) {
      if (options.failAccept) throw new Error('403 the invitation has expired')
      return options.acceptResponse ?? { success: true }
    }
    const groupMatch = url.match(/\/community\/groups\/([^/]+)$/)
    if (groupMatch) {
      const id = groupMatch[1]
      if (unreadable.has(id)) throw new Error('403 group is not visible')
      const group = options.groups?.[id]
      if (!group) throw new Error('404 group not found')
      return { id, ...group }
    }
    throw new Error(`unexpected request: ${url}`)
  }) as unknown as <T>(url: string, params?: Record<string, unknown>) => Promise<T>
}

describe('pending grant invitations', () => {
  it('lists an invitation to a group carrying the exact grant tag', async () => {
    const requester = fakeRequester({
      invitations: [{ id: 'inv-1', targetType: 'group', groupId: 'grant-group', fromUsername: 'Andrea.Amparore_hqfao', received: 1757000000000 }],
      groups: { 'grant-group': { title: 'DIEM restricted microdata grant request-2026-001', tags: [GRANT_GROUP_TAG] } },
    })
    const check = await fetchPendingGrantInvitations(USERNAME, requester)
    expect(check.invitations).toHaveLength(1)
    expect(check.invitations[0]).toMatchObject({ id: 'inv-1', groupId: 'grant-group' })
    expect(check.unverified).toBe(0)
  })

  it('ignores an ordinary group invitation that is not a microdata grant', async () => {
    const requester = fakeRequester({
      invitations: [{ id: 'inv-2', targetType: 'group', groupId: 'ordinary-group' }],
      groups: { 'ordinary-group': { title: 'DIEM Community discussion', tags: ['DIEM'] } },
    })
    const check = await fetchPendingGrantInvitations(USERNAME, requester)
    expect(check.invitations).toEqual([])
    expect(check.unverified).toBe(0)
  })

  it('never infers a grant from a group title alone', async () => {
    // A private group is often unreadable before joining it, and any user can
    // name a group anything. An unconfirmed invitation is reported as pending
    // and sent to ArcGIS, never offered for one-click acceptance here.
    const requester = fakeRequester({
      invitations: [{ id: 'inv-3', targetType: 'group', groupId: 'hidden-group' }],
      unreadableGroups: ['hidden-group'],
    })
    const check = await fetchPendingGrantInvitations(USERNAME, requester)
    expect(check.invitations).toEqual([])
    expect(check.unverified).toBe(1)
    expect(ARCGIS_NOTIFICATIONS_URL).toBe('https://hqfao-hub.maps.arcgis.com/home/notifications.html')
  })

  it('reports a failed check instead of claiming there is nothing waiting', async () => {
    const check = await fetchPendingGrantInvitations(USERNAME, fakeRequester({ failInvitations: true }))
    expect(check.error).toBeTruthy()
    expect(check.invitations).toEqual([])
  })
})

describe('accepting an invitation', () => {
  const invitation = { id: 'inv-1', groupId: 'grant-group', groupTitle: 'DIEM restricted microdata grant request-2026-001' }

  it('calls the per-user accept operation with the user own token and announces the change', async () => {
    const requester = fakeRequester({ acceptResponse: { success: true } })
    const changed = vi.fn()
    const stop = onGrantAccessChanged(changed)

    await acceptGrantInvitation(invitation, USERNAME, requester)

    const called = (requester as unknown as { mock: { calls: string[][] } }).mock.calls.map((call) => call[0])
    expect(called).toEqual([
      `https://www.arcgis.com/sharing/rest/community/users/${encodeURIComponent(USERNAME)}/invitations/inv-1/accept`,
    ])
    // Discovery re-runs in the same visit, so the grant appears without a reload.
    expect(changed).toHaveBeenCalledTimes(1)
    stop()
  })

  it('surfaces an ArcGIS refusal rather than reporting success', async () => {
    const declined = fakeRequester({ acceptResponse: { success: false, error: { message: 'Invitation is no longer valid.' } } })
    await expect(acceptGrantInvitation(invitation, USERNAME, declined)).rejects.toThrow('Invitation is no longer valid.')

    const rejected = fakeRequester({ failAccept: true })
    await expect(acceptGrantInvitation(invitation, USERNAME, rejected)).rejects.toThrow(/expired/)
  })
})

describe('embedded group details', () => {
  it('uses the group carried by the invitation instead of a second request', async () => {
    const requester = fakeRequester({
      invitations: [{
        id: 'inv-4',
        targetType: 'group',
        groupId: 'grant-group',
        group: { title: 'DIEM restricted microdata grant request-2026-002', tags: [GRANT_GROUP_TAG] },
      }],
    })
    const check = await fetchPendingGrantInvitations(USERNAME, requester)
    expect(check.invitations[0].groupTitle).toBe('DIEM restricted microdata grant request-2026-002')
    // The group endpoint has no entry here, so a second request would have thrown.
    expect((requester as unknown as { mock: { calls: string[][] } }).mock.calls).toHaveLength(1)
  })
})
