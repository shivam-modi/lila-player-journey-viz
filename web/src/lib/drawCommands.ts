import { worldToPixel } from './coords'
import type { DrawPoint, DrawPointKind, EventType, MapId } from './types'

export const EVENT_TO_KIND: Partial<Record<EventType, DrawPointKind>> = {
  Kill: 'kill',
  BotKill: 'kill',
  Killed: 'death',
  BotKilled: 'death',
  KilledByStorm: 'storm',
  Loot: 'loot',
}

export function eventsToDrawPoints(
  events: { x: number; z: number; event: EventType; is_bot: boolean }[],
  mapId: MapId
): DrawPoint[] {
  const points: DrawPoint[] = []
  for (const e of events) {
    const kind = EVENT_TO_KIND[e.event]
    if (!kind) continue
    const { x, y } = worldToPixel(e.x, e.z, mapId)
    points.push({ x, y, kind, isBot: e.is_bot })
  }
  return points
}
