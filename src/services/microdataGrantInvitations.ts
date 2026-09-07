/**
 * Pending invitations to a temporary microdata grant group.
 *
 * A recipient is invited, never added: the provisioning script sends an ArcGIS
 * group invitation and the access clock only starts once that person accepts it
 * themselves. Until they do, they hold no membership, discover no content, and
 * — before this module existed — saw nothing in the Hub to tell them an
 * approved grant was waiting for them in a different application.
 *
 * Everything here runs on the signed-in user's own token and does exactly what
 * that user could do in the ArcGIS web interface: read their own invitations,
 * and accept one addressed to them. There is no administrator credential, no
 * group management, and no way to add anybody to anything.
 */
import { COMMUNITY_PORTAL } from './auth'
import { GLOBAL_REST, GRANT_GROUP_TAG, isGrantGroup, notifyGrantAccessChanged } from './microdataGrants'
import type { ProtectedRequester } from './protectedData'

/** Where the user accepts an invitation the Hub cannot confirm or accept itself. */
export const ARCGIS_NOTIFICATIONS_URL = `${COMMUNITY_PORTAL}/home/notifications.html`

export interface PendingGrantInvitation {
  /** ArcGIS invitation id, the target of the documented accept operation. */
  id: string
  groupId: string
  groupTitle: string
  fromUsername?: string
  received?: number
}

export interface GrantInvitationCheck {
  /**
   * Invitations confirmed by exact group tag to be script-managed grant groups.
   * Only these are offered for acceptance inside the Hub.
   */
  invitations: PendingGrantInvitation[]
  /**
   * Group invitations that exist but could not be confirmed — usually because a
   * private group is unreadable before joining it. The Hub says an invitation
   * is waiting and sends the user to ArcGIS; it never guesses from a title,
   * because a group title is not a fact about who created the group.
   */
  unverified: number
  /** Set when the check itself failed, as distinct from finding nothing. */
  error?: string
}

interface InvitationsResponse {
  userInvitations?: Array<{
    id?: string
    targetType?: string
    groupId?: string
    fromUsername?: string
    created?: number
    received?: number
    /** Some ArcGIS responses embed the group, which saves a second request. */
    group?: GroupResponse
  }>
}

interface GroupResponse {
  id?: string
  title?: string
  tags?: string[]
}

interface AcceptResponse {
  success?: boolean
  /** ArcGIS echoes some subset of these; whatever it echoes has to match. */
  invitationId?: string
  groupId?: string
  username?: string
  error?: { message?: string }
}

interface SelfGroupsResponse {
  username?: string
  groups?: Array<{ id?: string }>
}

/**
 * Read the signed-in user's own pending invitations.
 *
 * ArcGIS scopes this endpoint to the caller, so it cannot report anybody else's
 * invitations even if a username were substituted.
 */
export async function fetchPendingGrantInvitations(
  username: string,
  requester: ProtectedRequester,
): Promise<GrantInvitationCheck> {
  let response: InvitationsResponse
  try {
    response = await requester<InvitationsResponse>(
      `${GLOBAL_REST}/community/users/${encodeURIComponent(username)}/invitations`,
    )
  } catch (error) {
    return { invitations: [], unverified: 0, error: (error as Error)?.message || 'Invitations could not be checked.' }
  }

  const groupInvitations = (response.userInvitations || []).filter(
    (invitation) => invitation.id && invitation.groupId && (invitation.targetType || 'group') === 'group',
  )

  type CheckedInvitation = PendingGrantInvitation | 'unverified' | 'other'

  const checked: CheckedInvitation[] = await Promise.all(groupInvitations.map(async (invitation): Promise<CheckedInvitation> => {
    let group = invitation.group
    if (!group?.tags) {
      try {
        group = await requester<GroupResponse>(`${GLOBAL_REST}/community/groups/${invitation.groupId}`)
      } catch {
        // A private group that refuses to describe itself to a non-member. The
        // invitation is real, but nothing here proves it is a DIEM grant.
        return 'unverified' as const
      }
    }
    if (!isGrantGroup(group.tags)) return 'other' as const
    return {
      id: String(invitation.id),
      groupId: String(invitation.groupId),
      groupTitle: group.title || GRANT_GROUP_TAG,
      fromUsername: invitation.fromUsername,
      received: invitation.received ?? invitation.created,
    }
  }))

  return {
    invitations: checked.filter((entry): entry is PendingGrantInvitation => typeof entry === 'object'),
    unverified: checked.filter((entry) => entry === 'unverified').length,
  }
}

const ACCEPT_FAILED = 'The invitation could not be accepted. Open your ArcGIS notifications and accept it there.'

/**
 * Anything ArcGIS echoes back has to describe the invitation that was sent.
 *
 * A response naming a different invitation, group or user is not this
 * operation's result, whatever its `success` flag says, so it is refused rather
 * than reconciled. Fields ArcGIS omits are not invented here — the membership
 * check below is what proves the outcome.
 */
function echoMatches(response: AcceptResponse, invitation: PendingGrantInvitation, username: string) {
  const mismatched = (echoed: string | undefined, expected: string) => (
    typeof echoed === 'string' && echoed.toLowerCase() !== expected.toLowerCase()
  )
  return !mismatched(response.invitationId, invitation.id)
    && !mismatched(response.groupId, invitation.groupId)
    && !mismatched(response.username, username)
}

/**
 * Ask ArcGIS whether this identity is now a member of the group.
 *
 * The accept response is a claim about what happened; membership is the thing
 * itself, and it is what discovery will read a moment later. Confirming it
 * proves the group and the user independently of whatever the operation chose
 * to echo, so a sparse but genuine success is accepted and a hollow one is not.
 */
async function confirmMembership(groupId: string, username: string, requester: ProtectedRequester) {
  try {
    const self = await requester<SelfGroupsResponse>(`${GLOBAL_REST}/community/self`)
    const joined = (self.groups || []).some((group) => group.id === groupId)
    const sameUser = !self.username || self.username.toLowerCase() === username.toLowerCase()
    return joined && sameUser
  } catch {
    return false
  }
}

/**
 * Accept one invitation with the user's own token.
 *
 * This is the documented per-user accept operation, the same one the ArcGIS
 * notifications page calls, and ArcGIS accepts it **only over POST** — hence
 * the explicit method rather than whatever the request library happens to
 * default to.
 *
 * Success is not assumed from the absence of an error. The event that makes the
 * Hub re-read a user's access is raised only when `success` is exactly `true`,
 * nothing ArcGIS echoed contradicts the invitation that was sent, and the
 * membership itself can then be read back. A missing, malformed or mismatched
 * response leaves the notice standing and sends the user to ArcGIS, which is
 * the honest outcome: acceptance is ArcGIS's to confirm, not the Hub's to
 * declare.
 *
 * Acceptance grants nothing by itself. It establishes the membership that lets
 * ArcGIS decide, on every later request, what this identity may read.
 */
export async function acceptGrantInvitation(
  invitation: PendingGrantInvitation,
  username: string,
  requester: ProtectedRequester,
): Promise<void> {
  const response = await requester<AcceptResponse>(
    `${GLOBAL_REST}/community/users/${encodeURIComponent(username)}/invitations/${invitation.id}/accept`,
    {},
    { method: 'POST' },
  )

  if (!response || typeof response !== 'object') throw new Error(ACCEPT_FAILED)
  if (response.success !== true) throw new Error(response.error?.message || ACCEPT_FAILED)
  if (!echoMatches(response, invitation, username)) throw new Error(ACCEPT_FAILED)
  if (!await confirmMembership(invitation.groupId, username, requester)) throw new Error(ACCEPT_FAILED)

  notifyGrantAccessChanged()
}
