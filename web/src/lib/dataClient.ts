import type { MapId, MatchIndexEntry, MatchEvent, HeatmapGrids, OverviewEvent } from './types'

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function fetchMatchesIndex(): Promise<MatchIndexEntry[]> {
  return getJson('/data/matches_index.json')
}

export function fetchMatchBundle(matchId: string): Promise<MatchEvent[]> {
  const safeName = matchId.replace(/\//g, '_')
  return getJson(`/data/matches/${safeName}.json`)
}

export function fetchHeatmap(mapId: MapId): Promise<HeatmapGrids> {
  return getJson(`/data/heatmaps/${mapId}.json`)
}

export function fetchOverviewEvents(mapId: MapId): Promise<OverviewEvent[]> {
  return getJson(`/data/overview_events/${mapId}.json`)
}
