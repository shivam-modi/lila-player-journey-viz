import type { MapId, MatchIndexEntry } from './types'

export function filterMatches(index: MatchIndexEntry[], mapId: MapId | null, date: string | null): MatchIndexEntry[] {
  return index.filter((m) => (mapId ? m.map_id === mapId : true) && (date ? m.date === date : true))
}

export function uniqueDates(index: MatchIndexEntry[], mapId: MapId | null): string[] {
  const dates = new Set(filterMatches(index, mapId, null).map((m) => m.date))
  return Array.from(dates).sort()
}
