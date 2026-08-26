import { useCallback, useEffect, useState } from 'react'
import { fetchCatalog } from '../services/arcgis'
import type { CatalogData } from '../types'

export function useCatalog() {
  const [catalog, setCatalog] = useState<CatalogData>()
  const [error, setError] = useState<string>()
  const [requestKey, setRequestKey] = useState(0)

  const retry = useCallback(() => setRequestKey((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    setError(undefined)
    fetchCatalog(controller.signal)
      .then(setCatalog)
      .catch((reason: Error) => {
        if (reason.name !== 'AbortError') setError(reason.message)
      })
    return () => controller.abort()
  }, [requestKey])

  return { catalog, error, retry }
}
