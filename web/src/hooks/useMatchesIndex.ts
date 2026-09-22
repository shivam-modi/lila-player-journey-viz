import { useEffect, useState } from 'react'
import { fetchMatchesIndex } from '../lib/dataClient'
import type { MatchIndexEntry } from '../lib/types'

export function useMatchesIndex() {
  const [data, setData] = useState<MatchIndexEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchMatchesIndex()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [])

  return { data, loading, error }
}
