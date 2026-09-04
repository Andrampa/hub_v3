import { useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import faoLogo from '../assets/fao/fao-logo-blue-3lines-en.svg'

export function SiteHeader({ active }: { active: 'home' | 'catalog' | 'countries' | 'data' | 'monitoring' | 'impact' | 'flood' | 'about' }) {
  const auth = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const memberInitial = auth.user?.fullName?.trim().charAt(0).toUpperCase() || 'D'

  /**
   * Only five of the twenty page components give their `<main>` an id, so the
   * target is resolved at click time rather than through a fixed hash. `main`
   * is not focusable by default, so it takes a programmatic `tabindex` before
   * focus moves; without that the browser scrolls but leaves the cursor in the
   * header and the next Tab returns to the navigation.
   */
  const skipToContent = (event: MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector('main')
    if (!main) return
    event.preventDefault()
    main.setAttribute('tabindex', '-1')
    main.focus({ preventScroll: true })
    main.scrollIntoView({ behavior: 'auto', block: 'start' })
  }

  return (
    <header className="fao-header subsite-header site-header">
      <a className="skip-link" href="#top" onClick={skipToContent}>Skip to content</a>
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
          <Link className={active === 'home' ? 'active' : ''} to="/">Home</Link>
          <div className={`nav-dropdown${active === 'monitoring' || active === 'data' ? ' active' : ''}`}>
            <button type="button" aria-haspopup="true">
              Household Surveys
              <span aria-hidden="true" />
            </button>
            <div className="nav-dropdown-menu">
              <Link to="/monitoring-system">
                <strong>Surveys catalogue</strong>
                <small>Browse surveys and products</small>
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
          <Link className={active === 'catalog' ? 'active' : ''} to="/catalog">Catalogue</Link>
          <div className={`nav-dropdown${active === 'about' ? ' active' : ''}`}>
            <button type="button" aria-haspopup="true">
              About DIEM
              <span aria-hidden="true" />
            </button>
            <div className="nav-dropdown-menu nav-dropdown-menu--end">
              <Link to="/about">
                <strong>What is DIEM?</strong>
                <small>Purpose, approach and stories from users</small>
              </Link>
              <Link to="/photo-galleries">
                <strong>Photo galleries</strong>
                <small>DIEM teams and fieldwork in pictures</small>
              </Link>
              <Link to="/contact">
                <strong>Contact us</strong>
                <small>Questions, support and collaboration</small>
              </Link>
            </div>
          </div>
        </div>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileMenuOpen((open) => !open)}
        >
          <span aria-hidden="true">{mobileMenuOpen ? '×' : '☰'}</span>
          <span>Menu</span>
        </button>
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
      <nav id="mobile-navigation" className={`mobile-nav${mobileMenuOpen ? ' is-open' : ''}`} aria-label="Mobile navigation">
        <Link className={active === 'home' ? 'active' : ''} to="/" onClick={() => setMobileMenuOpen(false)}>Home</Link>
        <Link className={active === 'catalog' ? 'active' : ''} to="/catalog" onClick={() => setMobileMenuOpen(false)}>Catalogue</Link>
        <Link className={active === 'countries' ? 'active' : ''} to="/countries" onClick={() => setMobileMenuOpen(false)}>Countries</Link>
        <Link className={active === 'impact' ? 'active' : ''} to="/hazard-impact-assessments" onClick={() => setMobileMenuOpen(false)}>Hazard impacts</Link>
        <Link className={active === 'flood' ? 'active' : ''} to="/flood-services" onClick={() => setMobileMenuOpen(false)}>Flood services</Link>
        {/* Mirrors the desktop Household Surveys dropdown; /data and the survey
            explorer were previously unreachable from the mobile menu. */}
        <span className="mobile-nav-heading">Household surveys</span>
        <Link className={active === 'monitoring' ? 'active' : ''} to="/monitoring-system" onClick={() => setMobileMenuOpen(false)}>Surveys catalogue</Link>
        <Link to="/monitoring" onClick={() => setMobileMenuOpen(false)}>Survey explorer</Link>
        <Link className={active === 'data' ? 'active' : ''} to="/data" onClick={() => setMobileMenuOpen(false)}>Data access</Link>
        <span className="mobile-nav-heading">About DIEM</span>
        <Link className={active === 'about' ? 'active' : ''} to="/about" onClick={() => setMobileMenuOpen(false)}>What is DIEM?</Link>
        <Link className={active === 'about' ? 'active' : ''} to="/photo-galleries" onClick={() => setMobileMenuOpen(false)}>Photo galleries</Link>
        <Link className={active === 'about' ? 'active' : ''} to="/contact" onClick={() => setMobileMenuOpen(false)}>Contact us</Link>
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
