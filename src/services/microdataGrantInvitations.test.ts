import { describe, expect, it, vi } from 'vitest'
import { GRANT_GROUP_TAG, onGrantAccessChanged } from './microdataGrants'
import {
  ARCGIS_NOTIFICATIONS_URL,
  MEMBERSHIP_RETRY_DELAYS_MS,
  acceptGrantInvitation,
  fetchPendingGrantInvitations,
} from './microdataGrantInvitations'

const USERNAME = 'andrea.amparore_faohub_testaccount'

interface RequestOptions { method?: 'GET' | 'POST' }

/**
 * Stands in for the authenticated requester, and models the one thing the live
 * endpoint is strict about: ArcGIS accepts the invitation operation over POST
 * only, so this fake refuses anything else exactly as the service would.
 */
function fakeRequester(options: {
  invitations?: unknown[]
  groups?: Record<string, { title?: string; tags?: string[] }>
  unreadableGroups?: string[]
  failInvitations?: boolean
  acceptResponse?: unknown
  failAccept?: boolean
  /** Groups `/community/self` reports after the acceptance. */
  memberOf?: string[]
  /**
   * Membership as ArcGIS reports it on successive reads, so a propagation
   * delay can be modelled: the first entries are what it says before the new
   * group appears. The last entry repeats once the list is exhausted.
   */
  memberOfSequence?: string[][]
  selfUsername?: string | null
  failSelf?: boolean
}) {
  let selfReads = 0
  const unreadable = new Set(options.unreadableGroups || [])
  return vi.fn(async (url: string, _params?: Record<string, unknown>, requestOptions?: RequestOptions) => {
    if (url.endsWith(`/community/users/${encodeURIComponent(USERNAME)}/invitations`)) {
      if (options.failInvitations) throw new Error('invitations unavailable')
      return { userInvitations: options.invitations ?? [] }
    }
    if (/\/invitations\/[^/]+\/accept$/.test(url)) {
      if (requestOptions?.method !== 'POST') {
        throw new Error('HTTP 405: the accept operation is POST only')
      }
      if (options.failAccept) throw new Error('403 the invitation has expired')
      // `in` rather than `??`, so a test can model a null or empty response.
      return 'acceptResponse' in options ? options.acceptResponse : { success: true }
    }
    if (url.endsWith('/community/self')) {
      if (options.failSelf) throw new Error('network down')
      const sequence = options.memberOfSequence
      const groups = sequence
        ? sequence[Math.min(selfReads, sequence.length - 1)]
        : options.memberOf ?? ['grant-group']
      selfReads += 1
      return {
        // `null` models a response with no identity at all; `undefined` here
        // means "the ordinary case", which is the signed-in user.
        username: options.selfUsername === null ? undefined : options.selfUsername ?? USERNAME,
        groups: groups.map((id) => ({ id })),
      }
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
  }) as unknown as <T>(url: string, params?: Record<string, unknown>, options?: RequestOptions) => Promise<T>
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
  const ACCEPT_URL = `https://www.arcgis.com/sharing/rest/community/users/${encodeURIComponent(USERNAME)}/invitations/inv-1/accept`

  function calls(requester: unknown) {
    return (requester as { mock: { calls: [string, unknown, RequestOptions | undefined][] } }).mock.calls
  }

  /** The retry schedule is asserted from the recorded delays, never waited out. */
  const recordedWait = () => vi.fn(async (_ms: number) => {})

  /** Asserts the rejection left the user's access untouched as far as the Hub is concerned. */
  async function expectRejectedWithoutEvent(requester: Parameters<typeof acceptGrantInvitation>[2]) {
    const changed = vi.fn()
    const stop = onGrantAccessChanged(changed)
    try {
      await expect(acceptGrantInvitation(invitation, USERNAME, requester, recordedWait())).rejects.toThrow()
      expect(changed).not.toHaveBeenCalled()
    } finally {
      stop()
    }
  }

  it('sends the accept operation over POST', async () => {
    const requester = fakeRequester({ acceptResponse: { success: true, id: 'inv-1', groupId: 'grant-group', username: USERNAME } })
    await acceptGrantInvitation(invitation, USERNAME, requester)

    const acceptCall = calls(requester).find(([url]) => url === ACCEPT_URL)
    expect(acceptCall).toBeDefined()
    expect(acceptCall?.[2]).toEqual({ method: 'POST' })
  })

  it('cannot have used GET, because the endpoint refuses it', async () => {
    // The fake gates on the method the way the live service does. Acceptance
    // succeeding against it is only possible over POST — and the direct call
    // below shows the gate is real rather than a fake that lets anything past.
    const postOnly = fakeRequester({
      acceptResponse: { success: true, id: 'inv-1', groupId: 'grant-group', username: USERNAME },
    })
    await expect(acceptGrantInvitation(invitation, USERNAME, postOnly)).resolves.toBeUndefined()

    await expect(
      (postOnly as (url: string, params?: Record<string, unknown>, options?: RequestOptions) => Promise<unknown>)(
        ACCEPT_URL, {}, { method: 'GET' },
      ),
    ).rejects.toThrow(/POST only/)
  })

  it('accepts a success that names the same invitation, group and user, and announces the change', async () => {
    const requester = fakeRequester({
      acceptResponse: { success: true, id: 'inv-1', groupId: 'grant-group', username: USERNAME },
      memberOf: ['grant-group'],
    })
    const changed = vi.fn()
    const stop = onGrantAccessChanged(changed)

    await acceptGrantInvitation(invitation, USERNAME, requester)

    // Discovery re-runs in the same visit, so the grant appears without a reload.
    expect(changed).toHaveBeenCalledTimes(1)
    stop()
  })

  it('rejects a response with no success flag', async () => {
    await expectRejectedWithoutEvent(fakeRequester({ acceptResponse: { id: 'inv-1', groupId: 'grant-group' } }))
  })

  it('rejects an explicit failure and reports what ArcGIS said', async () => {
    const declined = fakeRequester({ acceptResponse: { success: false, error: { message: 'Invitation is no longer valid.' } } })
    await expect(acceptGrantInvitation(invitation, USERNAME, declined)).rejects.toThrow('Invitation is no longer valid.')
    await expectRejectedWithoutEvent(declined)
  })

  it('rejects a success that is not JSON, or not an object at all', async () => {
    await expectRejectedWithoutEvent(fakeRequester({ acceptResponse: 'OK' }))
    await expectRejectedWithoutEvent(fakeRequester({ acceptResponse: null }))
  })

  it('rejects a success naming a different invitation, group or user', async () => {
    await expectRejectedWithoutEvent(fakeRequester({
      acceptResponse: { success: true, id: 'inv-9', groupId: 'grant-group', username: USERNAME },
    }))
    await expectRejectedWithoutEvent(fakeRequester({
      acceptResponse: { success: true, id: 'inv-1', groupId: 'someone-elses-group', username: USERNAME },
    }))
    await expectRejectedWithoutEvent(fakeRequester({
      acceptResponse: { success: true, id: 'inv-1', groupId: 'grant-group', username: 'another.user' },
    }))
  })

  it('rejects a success that the membership does not bear out', async () => {
    // ArcGIS says yes but the identity is not in the group. Whatever happened,
    // it was not this acceptance, so nothing is announced.
    await expectRejectedWithoutEvent(fakeRequester({
      acceptResponse: { success: true },
      memberOf: ['some-other-group'],
    }))
    await expectRejectedWithoutEvent(fakeRequester({ acceptResponse: { success: true }, failSelf: true }))
    await expectRejectedWithoutEvent(fakeRequester({
      acceptResponse: { success: true },
      memberOf: ['grant-group'],
      selfUsername: 'another.user',
    }))
  })

  it('surfaces a transport rejection without announcing a change', async () => {
    await expectRejectedWithoutEvent(fakeRequester({ failAccept: true }))
  })

  it('tolerates the undocumented invitationId alias, and still checks it', async () => {
    const aliased = fakeRequester({ acceptResponse: { success: true, invitationId: 'inv-1', username: USERNAME } })
    await expect(acceptGrantInvitation(invitation, USERNAME, aliased, recordedWait())).resolves.toBeUndefined()

    await expectRejectedWithoutEvent(fakeRequester({
      acceptResponse: { success: true, invitationId: 'inv-9', username: USERNAME },
    }))
  })

  it('waits for a membership that has not propagated yet, then announces it', async () => {
    // ArcGIS can take a moment to show a new membership on /community/self.
    // Giving up on the first read would report a failure for an acceptance
    // that in fact succeeded.
    const requester = fakeRequester({
      acceptResponse: { success: true, id: 'inv-1', groupId: 'grant-group', username: USERNAME },
      memberOfSequence: [[], [], ['grant-group']],
    })
    const wait = recordedWait()
    const changed = vi.fn()
    const stop = onGrantAccessChanged(changed)

    await acceptGrantInvitation(invitation, USERNAME, requester, wait)

    expect(wait.mock.calls.map(([ms]) => ms)).toEqual(MEMBERSHIP_RETRY_DELAYS_MS.slice(0, 2))
    expect(changed).toHaveBeenCalledTimes(1)
    stop()
  })

  it('gives up after a bounded number of retries, announcing nothing', async () => {
    const requester = fakeRequester({
      acceptResponse: { success: true, id: 'inv-1', groupId: 'grant-group', username: USERNAME },
      memberOf: [],
    })
    const wait = recordedWait()
    const changed = vi.fn()
    const stop = onGrantAccessChanged(changed)

    await expect(acceptGrantInvitation(invitation, USERNAME, requester, wait)).rejects.toThrow()

    const delays = wait.mock.calls.map(([ms]) => ms)
    expect(delays).toEqual(MEMBERSHIP_RETRY_DELAYS_MS)
    // Modest enough that a real failure still reports back promptly.
    expect(delays.reduce((total, ms) => total + ms, 0)).toBeLessThanOrEqual(2000)
    expect(changed).not.toHaveBeenCalled()
    stop()
  })

  it('fails closed, and does not retry, when self names nobody', async () => {
    // An authenticated /community/self always names its caller. One that does
    // not is a response this code cannot reason about, and waiting cannot make
    // an unidentified answer trustworthy.
    const requester = fakeRequester({
      acceptResponse: { success: true, id: 'inv-1', groupId: 'grant-group', username: USERNAME },
      memberOf: ['grant-group'],
      selfUsername: null,
    })
    const wait = recordedWait()
    const changed = vi.fn()
    const stop = onGrantAccessChanged(changed)

    await expect(acceptGrantInvitation(invitation, USERNAME, requester, wait)).rejects.toThrow()

    expect(wait).not.toHaveBeenCalled()
    expect(changed).not.toHaveBeenCalled()
    stop()
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
