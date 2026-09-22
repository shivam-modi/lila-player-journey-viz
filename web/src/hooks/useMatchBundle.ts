import { useEffect, useState } from 'react'
import { fetchMatchBundle } from '../lib/dataClient'
import type { MatchEvent } from '../lib/types'

export function useMatchBundle(matchId: string | null) {
  const [data, setData] = useState<MatchEvent[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!matchId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setData(null)
    fetchMatchBundle(matchId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [matchId])

  return { data, loading, error }
}
