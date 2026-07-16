import { useCallback, useEffect, useState } from 'react'
import { fetchCountryCatalog, type CountryCatalog } from '../services/countries'

export function useCountryCatalog() {
  const [catalog, setCatalog] = useState<CountryCatalog>()
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setError(undefined)
    fetchCountryCatalog()
      .then((data) => {
        if (active) setCatalog(data)
      })
      .catch((reason: Error) => {
        if (active) setError(reason.message)
      })
    return () => {
      active = false
    }
  }, [attempt])

  const retry = useCallback(() => setAttempt((value) => value + 1), [])
  return { catalog, error, retry }
}

