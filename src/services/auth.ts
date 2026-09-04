import { ArcGISIdentityManager, request } from '@esri/arcgis-rest-request'

export const ARCGIS_CLIENT_ID = '7ZnjQhVHwjuYi1FM'
export const COMMUNITY_ORG_ID = 'D5aXW6TZFpeM2wke'
export const COMMUNITY_ORG_NAME = 'FAO Data in Emergency Community'
export const COMMUNITY_PORTAL = 'https://hqfao-hub.maps.arcgis.com'
export const COMMUNITY_PORTAL_REST = `${COMMUNITY_PORTAL}/sharing/rest`

export const DIEM_ACCESS_GROUPS = {
  contributor: 'ad13b87919464cb6b9bb6cd8defa0257',
  aggregatedData: 'c8ae74a0f2de480abe6f72876a52b0cc',
  householdData: '3f1e99b44e3e4107957de001a1242a70',
} as const

const SESSION_KEY = 'diem-hub-3.arcgis-session'

export interface CommunityUser {
  username: string
  fullName: string
  firstName?: string
  lastName?: string
  orgId: string
  role?: string
  userLicenseTypeId?: string
  capabilities: CommunityCapabilities
}

export interface CommunityCapabilities {
  contributor: boolean
  aggregatedData: boolean
  householdData: boolean
}

export interface AuthSession {
  manager: ArcGISIdentityManager
  user: CommunityUser
}

export class CommunityAccessError extends Error {
  constructor(
    message: string,
    readonly reason: 'wrong-organization' | 'disabled-account',
  ) {
    super(message)
    this.name = 'CommunityAccessError'
  }
}

/**
 * Always the origin actually serving the page.
 *
 * A hardcoded development origin breaks as soon as Vite is not on its usual
 * port: the popup lands on the hardcoded origin, which is cross-origin to the
 * opener, and the SDK's postMessage handshake dies with an opaque frame-access
 * error rather than anything mentioning OAuth. Deriving it means the only way to
 * fail is an unregistered origin, which ArcGIS reports plainly. Every dev port
 * that is used has to be registered as a redirect URL on the OAuth application.
 */
function redirectUri() {
  return `${window.location.origin}/oauth-callback.html`
}

function oauthOptions() {
  return {
    clientId: ARCGIS_CLIENT_ID,
    redirectUri: redirectUri(),
    portal: COMMUNITY_PORTAL_REST,
    popup: true,
    pkce: true,
  }
}

interface CommunitySelf extends Omit<CommunityUser, 'capabilities'> {
  disabled?: boolean
  groups?: Array<{ id?: string } | string>
}

interface GroupUsers {
  owner?: string
  admins?: Array<{ username?: string } | string>
  users?: Array<{ username?: string } | string>
}

export function deriveCommunityCapabilities(groupIds: string[]): CommunityCapabilities {
  const memberships = new Set(groupIds)
  const contributor = memberships.has(DIEM_ACCESS_GROUPS.contributor)
  return {
    contributor,
    aggregatedData: contributor || memberships.has(DIEM_ACCESS_GROUPS.aggregatedData),
    householdData: contributor || memberships.has(DIEM_ACCESS_GROUPS.householdData),
  }
}

async function confirmGroupMembership(
  manager: ArcGISIdentityManager,
  groupId: string,
  username: string,
  directGroupIds: string[],
) {
  if (directGroupIds.includes(groupId)) return true
  try {
    const membership = await request(`${COMMUNITY_PORTAL_REST}/community/groups/${groupId}/users`, {
      authentication: manager,
      params: { f: 'json' },
    }) as GroupUsers
    const usernames = [
      membership.owner,
      ...(membership.admins || []),
      ...(membership.users || []),
    ].map((entry) => String(typeof entry === 'string' ? entry : entry?.username || '').toLowerCase())
    return usernames.includes(username.toLowerCase())
  } catch {
    return false
  }
}

async function validateCommunityUser(manager: ArcGISIdentityManager) {
  const user = await request(`${COMMUNITY_PORTAL_REST}/community/self`, {
    authentication: manager,
    params: { f: 'json' },
  }) as CommunitySelf

  if (user.disabled) {
    await revokeQuietly(manager)
    throw new CommunityAccessError(
      'This DIEM community account is disabled. Contact the DIEM community administrator.',
      'disabled-account',
    )
  }

  if (user.orgId !== COMMUNITY_ORG_ID) {
    await revokeQuietly(manager)
    throw new CommunityAccessError(
      `This account is not a member of the ${COMMUNITY_ORG_NAME}.`,
      'wrong-organization',
    )
  }

  const directGroupIds = Array.isArray(user.groups)
    ? user.groups.map((group) => String(typeof group === 'string' ? group : group?.id || ''))
    : []
  const membershipPairs = await Promise.all(
    Object.values(DIEM_ACCESS_GROUPS).map(async (groupId) => [
      groupId,
      await confirmGroupMembership(manager, groupId, user.username, directGroupIds),
    ] as const),
  )
  const recognizedGroupIds = membershipPairs.flatMap(([groupId, member]) => member ? [groupId] : [])

  return {
    ...user,
    capabilities: deriveCommunityCapabilities(recognizedGroupIds),
  }
}

/**
 * Cross-tab session handoff.
 *
 * The token lives in `sessionStorage`, which is per-tab, so opening a dataset
 * in a new tab landed on the sign-in gate even though the user was signed in
 * next door. Rather than move the token to `localStorage` -- which would
 * persist it to disk across browser restarts and widen its exposure, against
 * the storage invariant in `docs/authentication.md` -- a new tab asks the tabs
 * already open for the session it should adopt.
 *
 * `BroadcastChannel` is same-origin only and lives in memory, so this adds no
 * new place the token is written. A tab opened when nothing else is open still
 * has to sign in, exactly as before.
 */
const SESSION_CHANNEL = 'diem-hub-3.session-handoff'
const HANDOFF_TIMEOUT_MS = 700

type HandoffMessage =
  | { type: 'request' }
  | { type: 'offer'; session: string }
  | { type: 'signout' }

function sessionChannel() {
  return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(SESSION_CHANNEL)
}

const signOutListeners = new Set<() => void>()

/** Notified when another tab signs out, so this tab does not keep a revoked session. */
export function onRemoteSignOut(listener: () => void) {
  signOutListeners.add(listener)
  return () => { signOutListeners.delete(listener) }
}

let responder: BroadcastChannel | null = null

/** Answer other tabs' requests for the session this tab holds. */
export function startSessionSharing() {
  if (responder) return () => {}
  const channel = sessionChannel()
  if (!channel) return () => {}
  responder = channel
  channel.onmessage = (event: MessageEvent<HandoffMessage>) => {
    const message = event.data
    if (message?.type === 'request') {
      const serialized = sessionStorage.getItem(SESSION_KEY)
      if (serialized) channel.postMessage({ type: 'offer', session: serialized } satisfies HandoffMessage)
      return
    }
    if (message?.type === 'signout') {
      sessionStorage.removeItem(SESSION_KEY)
      for (const listener of signOutListeners) listener()
    }
  }
  return () => {
    channel.close()
    responder = null
  }
}

/** Ask any open tab for its session. Resolves to null when nobody answers. */
function requestSessionFromPeers(): Promise<string | null> {
  const channel = sessionChannel()
  if (!channel) return Promise.resolve(null)
  return new Promise((resolve) => {
    const finish = (value: string | null) => {
      window.clearTimeout(timer)
      channel.close()
      resolve(value)
    }
    const timer = window.setTimeout(() => finish(null), HANDOFF_TIMEOUT_MS)
    channel.onmessage = (event: MessageEvent<HandoffMessage>) => {
      if (event.data?.type === 'offer' && event.data.session) finish(event.data.session)
    }
    channel.postMessage({ type: 'request' } satisfies HandoffMessage)
  })
}

function announceSignOut() {
  const channel = sessionChannel()
  if (!channel) return
  channel.postMessage({ type: 'signout' } satisfies HandoffMessage)
  channel.close()
}

function saveSession(manager: ArcGISIdentityManager) {
  sessionStorage.setItem(SESSION_KEY, manager.serialize())
}

function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

async function revokeQuietly(manager: ArcGISIdentityManager) {
  try {
    await manager.signOut()
  } catch {
    // Local session removal is still required when ArcGIS cannot revoke an
    // already expired token or the network is unavailable.
  } finally {
    clearSession()
  }
}

export async function restoreSession(): Promise<AuthSession | null> {
  const serialized = sessionStorage.getItem(SESSION_KEY) || await requestSessionFromPeers()
  if (!serialized) return null

  try {
    const manager = ArcGISIdentityManager.deserialize(serialized)
    const user = await validateCommunityUser(manager)
    saveSession(manager)
    return { manager, user }
  } catch (error) {
    clearSession()
    if (error instanceof CommunityAccessError) throw error
    return null
  }
}

export async function signIn(): Promise<AuthSession> {
  const manager = await ArcGISIdentityManager.beginOAuth2(oauthOptions())
  if (!manager) throw new Error('The identity service did not return an authenticated session.')
  const user = await validateCommunityUser(manager)
  saveSession(manager)
  return { manager, user }
}

export async function signOut(manager: ArcGISIdentityManager | null) {
  announceSignOut()
  if (manager) await revokeQuietly(manager)
  else clearSession()
}

export async function completeOAuthSignIn() {
  return ArcGISIdentityManager.completeOAuth2(oauthOptions())
}
