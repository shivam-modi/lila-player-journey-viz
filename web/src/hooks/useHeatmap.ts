import { useAsyncData } from './useAsyncData'
import { fetchHeatmap } from '../lib/dataClient'
import type { HeatmapGrids, MapId } from '../lib/types'

export function useHeatmap(mapId: MapId | null) {
  return useAsyncData<HeatmapGrids>(mapId ? () => fetchHeatmap(mapId) : null, [mapId])
}
