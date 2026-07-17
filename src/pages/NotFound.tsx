import { Link } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'

export default function NotFound() {
  return (
    <>
      <SiteHeader active="home" />
      <main className="route-not-found section-wrap">
        <span className="kicker">Page not found</span>
        <h1>This DIEM Hub page does not exist.</h1>
        <p>The address may be outdated, or the content may have moved into the country or data workspace.</p>
        <div>
          <Link to="/">Return to the hub</Link>
          <Link to="/countries">Explore countries</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
