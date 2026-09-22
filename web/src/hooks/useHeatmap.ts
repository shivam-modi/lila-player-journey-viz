import { useEffect, useState } from 'react'
import { fetchHeatmap } from '../lib/dataClient'
import type { HeatmapGrids, MapId } from '../lib/types'

export function useHeatmap(mapId: MapId | null) {
  const [data, setData] = useState<HeatmapGrids | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!mapId) {
      setData(null)
      return
    }
    let cancelled = false
    setLoading(true)
    fetchHeatmap(mapId)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [mapId])

  return { data, loading, error }
}
