import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { request, type ArcGISIdentityManager } from '@esri/arcgis-rest-request'
import {
  CommunityAccessError,
  restoreSession,
  signIn as beginSignIn,
  signOut as endSession,
  type CommunityUser,
} from '../services/auth'

type AuthStatus = 'loading' | 'anonymous' | 'authenticating' | 'authenticated'

interface AuthContextValue {
  status: AuthStatus
  user: CommunityUser | null
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  clearError: () => void
  requestProtected: <T>(url: string, params?: Record<string, unknown>) => Promise<T>
  downloadProtected: (url: string, params?: Record<string, unknown>) => Promise<Blob>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function authMessage(error: unknown) {
  if (error instanceof CommunityAccessError) return error.message
  if (error instanceof Error && /popup|closed|cancel/i.test(error.message)) {
    return 'Sign-in was cancelled. You can continue using the public catalog or try again.'
  }
  return 'DIEM community sign-in could not be completed. Please try again.'
}

const EXPORT_POLL_INTERVAL_MS = 1500
const EXPORT_POLL_LIMIT = 80

interface ExportStatusResponse {
  status?: string
  resultUrl?: string
  message?: string
  error?: { message?: string }
}

function exportStatusMessage(payload: ExportStatusResponse) {
  return payload.error?.message || payload.message || payload.status || 'The export service returned an unexpected response.'
}

function waitForExportPoll() {
  return new Promise<void>((resolve) => window.setTimeout(resolve, EXPORT_POLL_INTERVAL_MS))
}

async function readExportStatus(response: Response) {
  try {
    return await response.json() as ExportStatusResponse
  } catch {
    throw new Error('The export service returned an unreadable status response.')
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<CommunityUser | null>(null)
  const [manager, setManager] = useState<ArcGISIdentityManager | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    restoreSession()
      .then((session) => {
        if (!active) return
        setManager(session?.manager || null)
        setUser(session?.user || null)
        setStatus(session ? 'authenticated' : 'anonymous')
      })
      .catch((reason) => {
        if (!active) return
        setError(authMessage(reason))
        setStatus('anonymous')
      })

    return () => {
      active = false
    }
  }, [])

  const signIn = useCallback(async () => {
      setError(null)
      setStatus('authenticating')
      try {
        const session = await beginSignIn()
        setManager(session.manager)
        setUser(session.user)
        setStatus('authenticated')
      } catch (reason) {
        setManager(null)
        setUser(null)
        setError(authMessage(reason))
        setStatus('anonymous')
      }
  }, [])

  const signOut = useCallback(async () => {
      const currentManager = manager
      setManager(null)
      setUser(null)
      setError(null)
      setStatus('anonymous')
      await endSession(currentManager)
  }, [manager])

  const clearError = useCallback(() => setError(null), [])

  const requestProtected = useCallback(async <T,>(url: string, params: Record<string, unknown> = {}) => {
      if (!manager || status !== 'authenticated') {
        throw new Error('Sign in with a DIEM community account to access this resource.')
      }
      return request(url, {
        authentication: manager,
        params: { f: 'json', ...params },
      }) as Promise<T>
  }, [manager, status])

  const downloadProtected = useCallback(async (url: string, params: Record<string, unknown> = {}) => {
      if (!manager || status !== 'authenticated') {
        throw new Error('Sign in with a DIEM community account to download this resource.')
      }

      const exportToken = await manager.getToken(manager.portal)

      const exportOrigin = new URL(url).origin
      const initialUrl = new URL(url)
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) initialUrl.searchParams.set(key, String(value))
      }
      initialUrl.searchParams.set('redirect', 'true')
      // Hub Download API v1 requires the ArcGIS token as a query parameter.
      // Keep this construction inside the provider so page components never receive it.
      initialUrl.searchParams.set('token', exportToken)

      let nextUrl = initialUrl.toString()
      for (let attempt = 0; attempt <= EXPORT_POLL_LIMIT; attempt += 1) {
        const candidate = new URL(nextUrl, initialUrl)
        if (candidate.origin === exportOrigin) candidate.searchParams.set('token', exportToken)
        else candidate.searchParams.delete('token')
        const response = await fetch(candidate, {
          method: 'GET',
          credentials: 'omit',
          headers: { Accept: 'application/octet-stream, application/json;q=0.9, */*;q=0.8' },
        })

        if (!response.ok && response.status !== 202) {
          const contentType = response.headers.get('content-type') || ''
          if (/json/i.test(contentType)) {
            const payload = await readExportStatus(response)
            throw new Error(exportStatusMessage(payload))
          }
          throw new Error(`The export service responded with HTTP ${response.status}.`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (response.status === 202 || /json/i.test(contentType)) {
          const payload = await readExportStatus(response)
          if (/fail|error|cancel/i.test(payload.status || '')) throw new Error(exportStatusMessage(payload))
          // Hub v1 omits resultUrl while the export job is still running; only a
          // non-202 response with neither a pending status nor a resultUrl is an error.
          const pending = response.status === 202 || /pending|creating|progress|processing|queue/i.test(payload.status || '')
          if (!payload.resultUrl && !pending) throw new Error(exportStatusMessage(payload))
          if (attempt === EXPORT_POLL_LIMIT) throw new Error('The export is still being prepared. Please try again in a few minutes.')
          if (payload.resultUrl) nextUrl = payload.resultUrl
          await waitForExportPoll()
          continue
        }

        if (/text\/html/i.test(contentType)) throw new Error('The export service returned a web page instead of a data file.')
        const blob = await response.blob()
        if (!blob.size) throw new Error('The export service returned an empty file.')
        return blob
      }
      throw new Error('The export could not be completed.')
  }, [manager, status])

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    error,
    signIn,
    signOut,
    clearError,
    requestProtected,
    downloadProtected,
  }), [clearError, downloadProtected, error, requestProtected, signIn, signOut, status, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
