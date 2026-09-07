import { Link } from 'react-router-dom'
import { SiteFooter } from '../components/SiteFooter'
import { SiteHeader } from '../components/SiteHeader'
import { usePageMetadata } from '../hooks/usePageMetadata'

export default function NotFound() {
  // The host serves index.html for every unmatched path, so this page answers
  // 200. The tag is the only thing that keeps a mistyped address out of the
  // index; 'follow' because the two recovery links are worth crawling.
  usePageMetadata({ title: 'Page not found', noindex: true })
  return (
    <>
      <SiteHeader />
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
