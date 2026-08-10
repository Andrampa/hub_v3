import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import faoLogo from '../assets/fao/fao-logo-blue-3lines-en.svg'

export function SiteHeader({ active }: { active: 'home' | 'countries' | 'data' | 'monitoring' | 'impact' | 'flood' | 'contact' }) {
  const auth = useAuth()
  const memberInitial = auth.user?.fullName?.trim().charAt(0).toUpperCase() || 'D'

  return (
    <header className="fao-header subsite-header site-header">
      <div className="utility-bar">
        <span>Food and Agriculture Organization of the United Nations</span>
        <a href="https://www.fao.org/emergencies/" target="_blank" rel="noreferrer">FAO emergencies and resilience</a>
      </div>
      <nav className="main-nav" aria-label="Primary navigation">
        <div className="brand-group">
          <a className="fao-brand" href="https://www.fao.org/home/en/" aria-label="Food and Agriculture Organization of the United Nations">
            <img src={faoLogo} alt="Food and Agriculture Organization of the United Nations" className="header-fao-logo" />
          </a>
          <Link className="brand" to="/" aria-label="DIEM Hub 3.0 home">
            <strong>DIEM Hub</strong><small>Data in Emergencies</small>
          </Link>
        </div>
        <div className="nav-links">
          <a className={active === 'home' ? 'active' : ''} href="/#catalog">Public catalog</a>
          <div className={`nav-dropdown${active === 'monitoring' || active === 'data' ? ' active' : ''}`}>
            <button type="button" aria-haspopup="true">
              Household Surveys
              <span aria-hidden="true" />
            </button>
            <div className="nav-dropdown-menu">
              <Link to="/monitoring-system">
                <strong>Monitoring System</strong>
                <small>Survey arrivals, departures and products</small>
              </Link>
              <Link to="/monitoring">
                <strong>Household Survey Explorer</strong>
                <small>Explore survey results in the full-screen app</small>
              </Link>
              <Link to="/data">
                <strong>Data access</strong>
                <small>Access household survey data and related resources</small>
              </Link>
            </div>
          </div>
          <Link className={active === 'impact' ? 'active' : ''} to="/hazard-impact-assessments">Hazard impacts</Link>
          <Link className={active === 'flood' ? 'active' : ''} to="/flood-services">Flood services</Link>
          <Link className={active === 'countries' ? 'active' : ''} to="/countries">Countries</Link>
          <Link className={active === 'contact' ? 'active' : ''} to="/contact">Contact</Link>
        </div>
        <div className="auth-actions">
          {auth.status !== 'authenticated' && (
            <a
              className="join-button"
              href="https://hqfao.maps.arcgis.com/sharing/rest/oauth2/signup?client_id=aEXLMtXxljlIrgPN&response_type=token&redirect_uri=https%3A%2F%2Fdata-in-emergencies.fao.org%2Ftorii-provider-arcgis%2Fhub-redirect.html"
              target="_blank"
              rel="noreferrer"
            >
              Create account
            </a>
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
      <nav className="mobile-nav" aria-label="Mobile navigation">
        <a className={active === 'home' ? 'active' : ''} href="/#catalog">Catalog</a>
        <Link className={active === 'monitoring' ? 'active' : ''} to="/monitoring-system">Surveys</Link>
        <Link className={active === 'impact' ? 'active' : ''} to="/hazard-impact-assessments">Impacts</Link>
        <Link className={active === 'flood' ? 'active' : ''} to="/flood-services">Flood</Link>
        <Link className={active === 'countries' ? 'active' : ''} to="/countries">Countries</Link>
        <Link className={active === 'contact' ? 'active' : ''} to="/contact">Contact</Link>
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
