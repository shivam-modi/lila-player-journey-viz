import { useEffect, useState } from 'react'

/**
 * Shared fetch-effect logic for the data hooks: tracks loading/error/data,
 * ignores results from a stale request (deps changed before it resolved),
 * and clears any previous error as soon as a new fetch starts.
 *
 * Pass `fetchFn: null` to skip fetching (e.g. no id selected yet).
 */
export function useAsyncData<T>(
  fetchFn: (() => Promise<T>) | null,
  deps: unknown[]
): { data: T | null; loading: boolean; error: Error | null } {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(fetchFn !== null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!fetchFn) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchFn()
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}
