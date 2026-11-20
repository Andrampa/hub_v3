import { useEffect, useState } from 'react'
import { fetchPhotoGalleryCatalogue, type PhotoGallery } from '../services/photoGalleries'

export interface PhotoGalleryState {
  galleries: PhotoGallery[]
  /** Wrapper ids any row (Draft included) records as replaced. */
  replacedWrapperIds: Set<string>
  /**
   * True once the gallery catalogue has answered or failed. A caller deciding
   * that a URL filter is unsupported must wait for this, or `product=Photo
   * gallery` would be stripped before the galleries arrive. After a failure
   * the filters must not be validated at all (see Catalog.tsx).
   */
  settled: boolean
  failed: boolean
}

/**
 * Published galleries for a discovery surface. A failure leaves the list empty
 * and marks it, so the surface keeps its ordinary content instead of erroring.
 */
export function usePhotoGalleries(): PhotoGalleryState {
  const [state, setState] = useState<PhotoGalleryState>({ galleries: [], replacedWrapperIds: new Set(), settled: false, failed: false })

  useEffect(() => {
    const controller = new AbortController()
    fetchPhotoGalleryCatalogue(controller.signal)
      .then(({ galleries, replacedWrapperIds }) => setState({ galleries, replacedWrapperIds, settled: true, failed: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setState({ galleries: [], replacedWrapperIds: new Set(), settled: true, failed: true })
      })
    return () => controller.abort()
  }, [])

  return state
}
