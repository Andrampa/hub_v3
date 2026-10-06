import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { fetchCurrentUserMicrodataGrants, onGrantAccessChanged, type GrantDiscovery } from '../services/microdataGrants'

const FOCUS_REFRESH_INTERVAL = 60_000

/** Session-only discovery. Focus refreshes are throttled and wait for active work. */
export function useMicrodataGrants({ busy = false }: { busy?: boolean } = {}) {
  const auth = useAuth()
  const [discovery, setDiscovery] = useState<GrantDiscovery>()
  const previousDiscovery = useRef<GrantDiscovery | undefined>(undefined)
  const [checking, setChecking] = useState(false)
  const [pending, setPending] = useState<Promise<GrantDiscovery>>()
  const runId = useRef(0)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const active = useRef<Promise<GrantDiscovery> | undefined>(undefined)
  const queued = useRef(false)
  const lastStarted = useRef(0)

  const check = useCallback(async () => {
    if (auth.status !== 'authenticated') return
    if (busyRef.current || active.current) { queued.current = true; return }
    queued.current = false
    const run = ++runId.current
    lastStarted.current = Date.now()
    setChecking(true)
    const promise = fetchCurrentUserMicrodataGrants(auth.requestProtected).catch((error: unknown): GrantDiscovery => ({
      bundles: [], source: 'none', error: (error as Error)?.message || 'Access could not be checked.',
    })).then((result) => result.error && previousDiscovery.current
      ? { ...previousDiscovery.current, error: result.error }
      : result)
    active.current = promise
    setPending(promise)
    const result = await promise
    if (runId.current === run) {
      previousDiscovery.current = result
      setDiscovery(result)
      setChecking(false)
    }
    if (active.current === promise) active.current = undefined
  }, [auth.requestProtected, auth.status])

  useEffect(() => {
    runId.current += 1
    active.current = undefined
    queued.current = false
    lastStarted.current = 0
    setDiscovery(undefined)
    previousDiscovery.current = undefined
    setPending(undefined)
    setChecking(false)
    if (auth.status === 'authenticated') {
      // New sessions must start even if the old session's picker was busy.
      busyRef.current = false
      void check()
    }
    return () => { runId.current += 1 }
  }, [auth.status, check])

  useEffect(() => {
    if (!busy && !checking && queued.current) void check()
  }, [busy, checking, check])

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const onFocus = () => {
      if (Date.now() - lastStarted.current >= FOCUS_REFRESH_INTERVAL) void check()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [auth.status, check])

  useEffect(() => {
    if (auth.status !== 'authenticated') return
    return onGrantAccessChanged(() => { void check() })
  }, [auth.status, check])

  return { discovery, checking, check, pending }
}
