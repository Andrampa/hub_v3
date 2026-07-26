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
const DEVELOPMENT_REDIRECT_URI = 'https://localhost:5173/oauth-callback.html'

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

function redirectUri() {
  if (import.meta.env.DEV) return DEVELOPMENT_REDIRECT_URI
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
  const serialized = sessionStorage.getItem(SESSION_KEY)
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
  if (manager) await revokeQuietly(manager)
  else clearSession()
}

export async function completeOAuthSignIn() {
  return ArcGISIdentityManager.completeOAuth2(oauthOptions())
}
