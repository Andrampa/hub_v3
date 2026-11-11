import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ArcGISItem } from '../types'

const BriefSpotlight = lazy(() => import('./BriefSpotlight'))

/** Start loading this far before the section scrolls into view. */
const PRELOAD_MARGIN = '600px'

/**
 * The homepage's placeholder for the Brief spotlight.
 *
 * The component, its styles and its data are one lazy chunk that is requested
 * only when the visitor scrolls near this point, so the spotlight costs the
 * first paint nothing. It takes no space until then, and none at all when no
 * card is eligible.
 */
export function BriefSpotlightSlot({ items, iso3 }: { items?: ArcGISItem[]; iso3?: string }) {
  const marker = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)

  useEffect(() => {
    const element = marker.current
    if (!element || near) return
    if (typeof IntersectionObserver === 'undefined') {
      setNear(true)
      return
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true)
    }, { rootMargin: PRELOAD_MARGIN })
    observer.observe(element)
    return () => observer.disconnect()
  }, [near])

  return (
    <>
      <div ref={marker} aria-hidden="true" />
      {/* Eligibility is unknown until the public catalogue has loaded. */}
      {near && items && (
        <Suspense fallback={null}>
          <BriefSpotlight items={items} iso3={iso3} />
        </Suspense>
      )}
    </>
  )
}
