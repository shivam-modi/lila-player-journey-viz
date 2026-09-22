export type MapId = 'AmbroseValley' | 'GrandRift' | 'Lockdown'

export interface MatchIndexEntry {
  match_id: string
  map_id: MapId
  date: string
  human_count: number
  bot_count: number
  duration_ms: number
  kills: number
  deaths: number
  storm_deaths: number
  loot: number
}

export type EventType =
  | 'Position'
  | 'BotPosition'
  | 'Kill'
  | 'Killed'
  | 'BotKill'
  | 'BotKilled'
  | 'KilledByStorm'
  | 'Loot'

export interface MatchEvent {
  user_id: string
  is_bot: boolean
  x: number
  z: number
  ts: number
  event: EventType
}

export interface OverviewEvent {
  date: string
  x: number
  z: number
  event: EventType
  is_bot: boolean
}

export type HeatmapCategory = 'kills' | 'deaths' | 'storm_deaths' | 'loot' | 'traffic'

export type HeatmapGrids = Record<HeatmapCategory, number[][]>

export type DrawPointKind = 'kill' | 'death' | 'storm' | 'loot'

export interface DrawPoint {
  x: number
  y: number
  kind: DrawPointKind
  isBot: boolean
}

export interface PlaybackFrame {
  positions: { x: number; y: number; isBot: boolean; trail: { x: number; y: number }[] }[]
  events: DrawPoint[]
}
