import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  ARCGIS_NOTIFICATIONS_URL,
  INVITATION_ACCESS_WINDOW_NOTE,
  UNCONFIRMED_INVITATION_NOTE,
  acceptGrantInvitation,
  fetchPendingGrantInvitations,
  type GrantInvitationCheck,
  type PendingGrantInvitation,
} from '../services/microdataGrantInvitations'

/**
 * A pending grant invitation is the one state where a user has been approved
 * and still sees nothing: ArcGIS gives them no membership until they accept, so
 * discovery correctly returns empty. Without this notice the only clue lives in
 * an ArcGIS notifications page most DIEM recipients have never opened.
 *
 * It is checked, never remembered. An invitation accepted or withdrawn
 * elsewhere disappears on the next check rather than lingering as a claim the
 * Hub is not entitled to make.
 */
function usePendingGrantInvitations() {
  const auth = useAuth()
  const [check, setCheck] = useState<GrantInvitationCheck>()
  const [busyId, setBusyId] = useState<string>()
  const [failure, setFailure] = useState<string>()
  const runId = useRef(0)

  const refresh = useCallback(async () => {
    if (auth.status !== 'authenticated' || !auth.user) {
      setCheck(undefined)
      return
    }
    const run = ++runId.current
    const result = await fetchPendingGrantInvitations(auth.user.username, auth.requestProtected)
    if (runId.current === run) setCheck(result)
  }, [auth.requestProtected, auth.status, auth.user])

  useEffect(() => {
    if (auth.status !== 'authenticated') {
      runId.current += 1
      setCheck(undefined)
      return
    }
    void refresh()
  }, [auth.status, refresh])

  // Accepting in the ArcGIS tab is the documented fallback, so returning to the
  // Hub has to be enough to clear the notice.
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [auth.status, refresh])

  const accept = useCallback(async (invitation: PendingGrantInvitation) => {
    if (!auth.user) return
    setBusyId(invitation.id)
    setFailure(undefined)
    try {
      await acceptGrantInvitation(invitation, auth.user.username, auth.requestProtected)
      await refresh()
    } catch (error) {
      setFailure((error as Error)?.message || 'The invitation could not be accepted here.')
    } finally {
      setBusyId(undefined)
    }
  }, [auth.requestProtected, auth.user, refresh])

  return { check, accept, busyId, failure }
}

export function MicrodataInvitationNotice() {
  const { check, accept, busyId, failure } = usePendingGrantInvitations()
  if (!check || (!check.invitations.length && !check.unverified)) return null

  return (
    <div className="auth-notice invitation-notice" role="status">
      <span className="invitation-notice-body">
        {check.invitations.length > 0 ? (
          <>
            <strong>Approved microdata access is waiting for you.</strong>{' '}
            Accept the invitation to
            {check.invitations.length === 1 ? ' ' : ' each of '}
            {check.invitations.map((invitation, index) => (
              <span key={invitation.id}>
                {index > 0 && ', '}
                <em>{invitation.groupTitle}</em>
              </span>
            ))}
            {' '}to see the surveys you were approved for. {INVITATION_ACCESS_WINDOW_NOTE}
          </>
        ) : (
          <>
            <strong>You have {check.unverified === 1 ? 'a pending ArcGIS group invitation' : 'pending ArcGIS group invitations'}.</strong>{' '}
            {UNCONFIRMED_INVITATION_NOTE}
          </>
        )}
        {failure && <span className="invitation-notice-failure"> {failure}</span>}
      </span>

      {check.invitations.map((invitation) => (
        <button
          className="auth-notice-action"
          type="button"
          key={invitation.id}
          disabled={Boolean(busyId)}
          onClick={() => void accept(invitation)}
        >
          {busyId === invitation.id ? 'Accepting…' : `Accept ${invitation.groupTitle}`}
        </button>
      ))}

      <a className="auth-notice-action" href={ARCGIS_NOTIFICATIONS_URL} target="_blank" rel="noreferrer">
        Open ArcGIS notifications
      </a>
    </div>
  )
}
