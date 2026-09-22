import { useAsyncData } from './useAsyncData'
import { fetchOverviewEvents } from '../lib/dataClient'
import type { MapId, OverviewEvent } from '../lib/types'

export function useOverviewEvents(mapId: MapId) {
  return useAsyncData<OverviewEvent[]>(() => fetchOverviewEvents(mapId), [mapId])
}
