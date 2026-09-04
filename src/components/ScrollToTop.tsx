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
      const target = document.querySelector(hash)
      if (target) {
        window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY, behavior: 'instant' })
        return
      }
    }
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname, hash])

  return null
}
