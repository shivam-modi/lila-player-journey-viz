import { useEffect, useState } from 'react'
import { fetchOverviewEvents } from '../lib/dataClient'
import type { MapId, OverviewEvent } from '../lib/types'

export function useOverviewEvents(mapId: MapId) {
  const [data, setData] = useState<OverviewEvent[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchOverviewEvents(mapId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [mapId])

  return { data, loading, error }
}
