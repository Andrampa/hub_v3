import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { readLegacyHubAddress, resolveLegacyHubSlug } from '../lib/legacyHubAddress'
import NotFound from './NotFound'

/**
 * Answers an address the previous ArcGIS Hub site served on this domain by
 * sending the reader to the same item in this catalogue. A path that names no
 * item is the 404 page, exactly as it would have been without this route.
 *
 * An item id is translated without a request, so the common case redirects on
 * the first render. Only a slug has to ask ArcGIS which item it names, and the
 * page says nothing while it waits: the lookup is a single request against an
 * address the reader is passing through, and a message would flash.
 */
export default function LegacyHubRoute() {
  const { pathname, search, hash } = useLocation()
  const address = readLegacyHubAddress(pathname)
  const slug = address?.kind === 'slug' ? address.slug : undefined

  /**
   * Carries the slug it answers for. A second legacy address can route to this
   * same component without remounting it, so a result held alone would redirect
   * the reader to the item the *previous* address named.
   */
  const [resolved, setResolved] = useState<{ slug: string; itemId?: string }>()

  useEffect(() => {
    if (!slug) return
    const controller = new AbortController()
    // An abandoned lookup must not answer. `resolveLegacyHubSlug` reports every
    // failure as "no item", an abort included, so a cancelled request would
    // otherwise redirect the reader to the catalogue while the live request was
    // still finding their product - which is what the paired effects of
    // StrictMode do on the first render.
    void resolveLegacyHubSlug(slug, controller.signal).then((itemId) => {
      if (!controller.signal.aborted) setResolved({ slug, itemId })
    })
    return () => controller.abort()
  }, [slug])

  if (!address) return <NotFound />
  if (address.kind === 'item') {
    return <Navigate to={{ pathname: `/catalog/${address.itemId}`, search, hash }} replace />
  }
  if (resolved?.slug !== address.slug) return null
  // A slug nothing answers for still lands inside the catalogue rather than on
  // an error, carrying the reader's query string and fragment no further: they
  // addressed a product, not a search.
  return resolved.itemId
    ? <Navigate to={{ pathname: `/catalog/${resolved.itemId}`, search, hash }} replace />
    : <Navigate to="/catalog" replace />
}
