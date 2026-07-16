import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function SiteHeader({ active }: { active: 'home' | 'countries' | 'data' }) {
  const auth = useAuth()
  const memberInitial = auth.user?.fullName?.trim().charAt(0).toUpperCase() || 'D'

  return (
    <header className="site-header">
      <div className="utility-bar">
        <span>Food and Agriculture Organization of the United Nations</span>
        <a href="https://www.fao.org/emergencies/" target="_blank" rel="noreferrer">FAO emergencies and resilience</a>
      </div>
      <nav className="main-nav" aria-label="Primary navigation">
        <Link className="brand" to="/" aria-label="DIEM Hub 3.0 home">
          <span className="brand-mark">FAO</span>
          <span><strong>DIEM</strong><small>Hub 3.0</small></span>
        </Link>
        <div className="nav-links">
          <a className={active === 'home' ? 'active' : ''} href="/#catalog">Public catalog</a>
          <Link className={active === 'countries' ? 'active' : ''} to="/countries">Countries</Link>
          <Link className={active === 'data' ? 'active' : ''} to="/data">Data access</Link>
          <a href="/#about">About DIEM</a>
        </div>
        <div className="auth-actions">
          {auth.status !== 'authenticated' && (
            <button
              className="join-button"
              type="button"
              disabled={auth.status === 'loading' || auth.status === 'authenticating'}
              onClick={() => void auth.signIn()}
            >
              Create account
            </button>
          )}
          {auth.status === 'authenticated' && auth.user ? (
            <div className="member-session">
              <span className="member-avatar" aria-hidden="true">{memberInitial}</span>
              <span className="member-name">
                <strong>{auth.user.fullName || auth.user.username}</strong>
                <small>DIEM community</small>
              </span>
              <button type="button" onClick={() => void auth.signOut()}>Sign out</button>
            </div>
          ) : (
            <button
              className="login-button"
              type="button"
              disabled={auth.status === 'loading' || auth.status === 'authenticating'}
              aria-busy={auth.status === 'authenticating'}
              onClick={() => void auth.signIn()}
            >
              {auth.status === 'authenticating' ? 'Signing in…' : auth.status === 'loading' ? 'Checking session…' : 'Sign in'}
            </button>
          )}
        </div>
      </nav>
      {auth.error && (
        <div className="auth-notice" role="alert">
          <span>{auth.error}</span>
          <button className="auth-notice-action" type="button" onClick={() => void auth.signIn()}>Try community sign-in</button>
          <button type="button" aria-label="Dismiss sign-in message" onClick={auth.clearError}>×</button>
        </div>
      )}
    </header>
  )
}
