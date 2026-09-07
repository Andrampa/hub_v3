import { useCallback, useEffect, useState } from 'react'
import { fetchCountryCatalog, type CountryCatalog } from '../services/countries'

export interface CountryCatalogOptions {
  /**
   * Render each page of the content group as it arrives instead of waiting for
   * all nine.
   *
   * Off by default, and deliberately. A progressive catalogue re-renders as it
   * grows, which is right for a result grid the reader is waiting on and wrong
   * for the surfaces that publish a figure: the homepage's "DIEM in numbers"
   * would count up on screen, and a country page would re-run its editorial and
   * monitoring lookups against a new `allResources` array on every page. Those
   * pages read a settled catalogue, exactly as before.
   */
  progressive?: boolean
}

export function useCountryCatalog({ progressive = false }: CountryCatalogOptions = {}) {
  const [catalog, setCatalog] = useState<CountryCatalog>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError(undefined)
    fetchCountryCatalog(progressive ? (partial) => {
      // A partial never replaces a catalogue that is already complete: the
      // background refresh of a cached copy resolves through this same module.
      if (active) setCatalog((current) => (current?.complete ? current : partial))
    } : undefined)
      .then((data) => {
        if (active) setCatalog(data)
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
    return () => {
      active = false
    }
  }, [attempt, progressive])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { catalog, error, retry }
}
