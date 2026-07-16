import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ArcGISIdentityManager } from '@esri/arcgis-rest-request'
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
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function authMessage(error: unknown) {
  if (error instanceof CommunityAccessError) return error.message
  if (error instanceof Error && /popup|closed|cancel/i.test(error.message)) {
    return 'Sign-in was cancelled. You can continue using the public catalog or try again.'
  }
  return 'DIEM community sign-in could not be completed. Please try again.'
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

  const value = useMemo<AuthContextValue>(() => ({
    status,
    user,
    error,
    async signIn() {
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
    },
    async signOut() {
      const currentManager = manager
      setManager(null)
      setUser(null)
      setError(null)
      setStatus('anonymous')
      await endSession(currentManager)
    },
    clearError() {
      setError(null)
    },
  }), [error, manager, status, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

