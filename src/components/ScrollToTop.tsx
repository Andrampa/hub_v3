import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * A client-side route change keeps the window scroll position, so following a
 * link from halfway down one page (Open the catalogue, a product card, a
 * country) landed the next page mid-document. This resets the viewport on every
 * pathname change, once, for every route.
 *
 * Only the pathname is watched: query-string changes are filters and pagination,
 * which do their own targeted scrolling (see Catalog.tsx). A hash is honoured so
 * in-page anchors still work; "instant" because html has scroll-behavior:smooth
 * and animating a whole page down is worse than arriving.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (hash) {
      let id: string
      try {
        id = decodeURIComponent(hash.slice(1))
      } catch {
        id = hash.slice(1)
      }

      const scrollToTarget = () => {
        const target = document.getElementById(id)
        if (!target) return false
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' })
        return true
      }

      if (scrollToTarget()) return

      // Route pages are lazy-loaded. On a cold navigation this effect runs while
      // Suspense is still showing its fallback, before the anchor exists. Watch
      // the app root until the route mounts instead of silently leaving the user
      // at the top of the wrong section.
      const root = document.getElementById('root') || document.body
      const observer = new MutationObserver(() => {
        if (scrollToTarget()) observer.disconnect()
      })
      observer.observe(root, { childList: true, subtree: true })
      return () => observer.disconnect()
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])

  return null
}
