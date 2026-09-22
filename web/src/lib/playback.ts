import { worldToPixel } from './coords'
import { eventsToDrawPoints } from './drawCommands'
import type { MapId, MatchEvent, PlaybackFrame } from './types'

const POSITION_EVENTS = new Set(['Position', 'BotPosition'])

export function computePlaybackFrame(
  events: MatchEvent[],
  mapId: MapId,
  atTs: number,
  trailWindowMs: number = 5000
): PlaybackFrame {
  const byUser = new Map<string, MatchEvent[]>()
  for (const e of events) {
    if (!POSITION_EVENTS.has(e.event)) continue
    if (!byUser.has(e.user_id)) byUser.set(e.user_id, [])
    byUser.get(e.user_id)!.push(e)
  }

  const positions: PlaybackFrame['positions'] = []
  for (const [, userEvents] of byUser) {
    const upToNow = userEvents.filter((e) => e.ts <= atTs)
    if (upToNow.length === 0) continue
    const latest = upToNow[upToNow.length - 1]
    const { x, y } = worldToPixel(latest.x, latest.z, mapId)
    const trail = upToNow
      .filter((e) => e.ts >= atTs - trailWindowMs)
      .map((e) => worldToPixel(e.x, e.z, mapId))
    positions.push({ x, y, isBot: latest.is_bot, trail })
  }

  const discreteEvents = events.filter((e) => e.ts <= atTs)
  const drawEvents = eventsToDrawPoints(discreteEvents, mapId)

  return { positions, events: drawEvents }
}
