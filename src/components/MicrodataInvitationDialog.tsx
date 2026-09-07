import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  ARCGIS_NOTIFICATIONS_URL,
  INVITATION_COPY,
  acceptGrantInvitation,
  fetchPendingGrantInvitations,
  type GrantInvitationCheck,
  type InvitationState,
  type PendingGrantInvitation,
} from '../services/microdataGrantInvitations'

/** Where the grants section lives, and how the dialog sends the user to it. */
export const GRANTS_SECTION_ID = 'temporary-microdata'
export const GRANTS_ROUTE = `/data#${GRANTS_SECTION_ID}`

/**
 * A pending grant invitation is the one state where a user has been approved,
 * holds nothing, and is losing time while they read: the seven days started
 * when the invitation was issued, not when they accept. As a thin strip under
 * the header it was easy to scroll past, and the button sat far enough from the
 * sentence explaining it that the two read as unrelated.
 *
 * It is now a modal, because that is what the situation is: a short-lived offer
 * needing one decision. It is styled as an important action rather than an
 * error — an approved grant is good news that happens to arrive on a clock.
 *
 * It is checked, never remembered. An invitation accepted or withdrawn
 * elsewhere disappears on the next check rather than lingering as a claim the
 * Hub is not entitled to make.
 */
function usePendingGrantInvitations() {
  const auth = useAuth()
  const [check, setCheck] = useState<GrantInvitationCheck>()
  const [accepting, setAccepting] = useState(false)
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

  // Accepting in ArcGIS is the whole point of the unverified state and the
  // supported fallback for the confirmed one, so returning to the Hub has to be
  // enough to update it. Grants re-read themselves on focus alongside this.
  useEffect(() => {
    if (auth.status !== 'authenticated') return
    const onFocus = () => { void refresh() }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [auth.status, refresh])

  const accept = useCallback(async (invitation: PendingGrantInvitation) => {
    if (!auth.user) return false
    setAccepting(true)
    setFailure(undefined)
    try {
      // Unchanged by this redesign: the user's own token, POST only, strict
      // response checking and a membership read-back. `acceptGrantInvitation`
      // raises the access-change event itself, and only once ArcGIS has
      // confirmed the membership.
      await acceptGrantInvitation(invitation, auth.user.username, auth.requestProtected)
      await refresh()
      return true
    } catch (error) {
      setFailure((error as Error)?.message || 'The invitation could not be accepted here.')
      return false
    } finally {
      setAccepting(false)
    }
  }, [auth.requestProtected, auth.user, refresh])

  return { check, refresh, accept, accepting, failure }
}

/**
 * Keeps keyboard focus inside the dialog while it is open.
 *
 * A modal that can be tabbed out of is a modal only for people using a mouse.
 * Focus starts on the dialog itself so a screen reader announces the title and
 * the message before the actions, and returns to whatever held it before —
 * usually the header indicator — when the dialog closes.
 */
function useModalFocus(open: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = dialogRef.current
    if (!dialog) return

    const previous = document.activeElement as HTMLElement | null
    dialog.focus()

    const focusable = () => Array.from(
      dialog.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    )

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const targets = focusable()
      if (!targets.length) {
        event.preventDefault()
        return
      }
      const first = targets[0]
      const last = targets[targets.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === dialog)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || active === dialog)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus?.()
    }
  }, [onClose, open])

  return dialogRef
}

function TimeLimitMark() {
  // The mark and the words carry the meaning; colour only reinforces them, so
  // the warning survives greyscale, colour-blind rendering and forced colours.
  return <span className="invitation-warning-mark" aria-hidden="true">!</span>
}

export function MicrodataInvitationDialog() {
  const { check, refresh, accept, accepting, failure } = usePendingGrantInvitations()
  const navigate = useNavigate()

  // "Remind me later" lasts exactly one visit, and is held in memory rather
  // than in storage. Nothing about an invitation may outlive the page: a
  // dismissal written to disk would go on hiding a live, expiring grant on
  // every later visit, and the recipient would never learn why nothing came.
  const [dismissed, setDismissed] = useState(false)
  const [accepted, setAccepted] = useState(false)

  const confirmed = check?.invitations[0]
  const state: InvitationState | undefined = confirmed ? 'confirmed'
    : check?.unverified ? 'unverified'
    : undefined

  // An invitation that is accepted, withdrawn or expired takes the dialog and
  // the indicator with it, and leaves the dismissal behind for the next one.
  useEffect(() => {
    if (!state) setDismissed(false)
  }, [state])

  const close = useCallback(() => setDismissed(true), [])
  // Closing on success is explicit rather than left to the next check. ArcGIS
  // stops listing an accepted invitation, but only once it catches up, and the
  // user has already done the thing the dialog was asking for.
  const open = Boolean(state) && !dismissed && !accepted
  const dialogRef = useModalFocus(open, close)

  const onPrimary = useCallback(async () => {
    if (state === 'unverified') {
      // The Hub cannot confirm this group, so it must not accept it either. The
      // user does that where ArcGIS can identify them, and the focus listener
      // picks up the result when they come back.
      window.open(ARCGIS_NOTIFICATIONS_URL, '_blank', 'noopener,noreferrer')
      setDismissed(true)
      return
    }
    if (!confirmed) return
    if (await accept(confirmed)) {
      setAccepted(true)
      navigate(GRANTS_ROUTE)
    }
  }, [accept, confirmed, navigate, state])

  const copy = state ? INVITATION_COPY[state] : undefined

  return (
    <>
      {accepted && (
        <div className="auth-notice invitation-success" role="status">
          <span className="invitation-notice-body">
            <span className="invitation-success-mark" aria-hidden="true">✓</span>
            <strong>Access accepted.</strong> Your approved microdata is listed below under your temporary access.
          </span>
          <button type="button" aria-label="Dismiss access confirmation" onClick={() => setAccepted(false)}>×</button>
        </div>
      )}

      {/* Dismissing the dialog must not dismiss the problem. The indicator keeps
          a live invitation visible for the rest of the visit, and is how the
          dialog is reopened. */}
      {state && dismissed && !accepted && (
        <div className="auth-notice invitation-indicator">
          <span className="invitation-notice-body">
            <TimeLimitMark />
            <strong>Time limited.</strong> Your microdata invitation is still waiting, and its seven days are running.
          </span>
          <button className="auth-notice-action" type="button" onClick={() => setDismissed(false)}>
            {state === 'confirmed' ? 'Review invitation' : 'Show instructions'}
          </button>
        </div>
      )}

      {open && state && copy && (
        <div className="invitation-overlay">
          <div
            className="invitation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invitation-dialog-title"
            aria-describedby="invitation-dialog-message"
            tabIndex={-1}
            ref={dialogRef}
          >
            <span className="invitation-dialog-kicker">DIEM microdata</span>
            <h2 id="invitation-dialog-title">{copy.title}</h2>
            <p id="invitation-dialog-message">{copy.message}</p>
            {confirmed && <p className="invitation-dialog-grant">{confirmed.groupTitle}</p>}

            <p className="invitation-warning">
              <TimeLimitMark />
              <span><strong>Time limited.</strong> {copy.warning}</span>
            </p>

            {failure && <p className="invitation-dialog-failure" role="alert">{failure}</p>}

            <div className="invitation-dialog-actions">
              <button
                className="invitation-dialog-primary"
                type="button"
                disabled={accepting}
                onClick={() => void onPrimary()}
              >
                {accepting ? 'Accepting…' : copy.action}
              </button>
              <button className="invitation-dialog-secondary" type="button" onClick={close}>
                Remind me later
              </button>
            </div>

            {state === 'confirmed' && (
              <p className="invitation-dialog-alternative">
                Prefer to do this in ArcGIS?{' '}
                <a href={ARCGIS_NOTIFICATIONS_URL} target="_blank" rel="noreferrer" onClick={() => void refresh()}>
                  Open ArcGIS notifications
                </a>
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
