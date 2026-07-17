import { ArcGISIdentityManager } from '@esri/arcgis-rest-request'

export const ARCGIS_CLIENT_ID = '7ZnjQhVHwjuYi1FM'
export const COMMUNITY_ORG_ID = 'D5aXW6TZFpeM2wke'
export const COMMUNITY_ORG_NAME = 'FAO Data in Emergency Community'
export const COMMUNITY_PORTAL = 'https://hqfao-hub.maps.arcgis.com'
export const COMMUNITY_PORTAL_REST = `${COMMUNITY_PORTAL}/sharing/rest`

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

async function validateCommunityUser(manager: ArcGISIdentityManager) {
  const user = (await manager.getUser()) as CommunityUser & { disabled?: boolean }

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

  return user
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
  if (!manager) throw new Error('ArcGIS did not return an authenticated session.')
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
