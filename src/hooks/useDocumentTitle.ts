import { useEffect } from 'react'

const SITE_NAME = 'DIEM Hub'

/**
 * Sets the browser tab title for a route.
 *
 * A single-page application keeps whatever `index.html` declared unless a route
 * says otherwise, so every page was titled "DIEM Hub 3.0 | Data in Emergencies"
 * in the tab, in browser history, in a bookmark and in a shared link preview.
 *
 * Pass `undefined` while a page is still resolving its subject, so a country
 * page does not flash the ISO code before the country name is known.
 */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    if (!title) return
    const previous = document.title
    document.title = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`
    return () => {
      document.title = previous
    }
  }, [title])
}
