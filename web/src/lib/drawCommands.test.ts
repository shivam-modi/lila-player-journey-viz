import { describe, it, expect } from 'vitest'
import { eventsToDrawPoints } from './drawCommands'

describe('eventsToDrawPoints', () => {
  it('drops Position/BotPosition events and keeps discrete event categories', () => {
    const events = [
      { x: -301.45, z: -355.55, event: 'Position' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'Kill' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'BotKilled' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'KilledByStorm' as const, is_bot: false },
      { x: -301.45, z: -355.55, event: 'Loot' as const, is_bot: false },
    ]
    const points = eventsToDrawPoints(events, 'AmbroseValley')
    expect(points.map((p) => p.kind)).toEqual(['kill', 'death', 'storm', 'loot'])
    expect(Math.round(points[0].x)).toBe(78)
    expect(Math.round(points[0].y)).toBe(890)
  })

  it('maps BotKill to kind kill and Killed to kind death', () => {
    const events = [
      { x: -370, z: -473, event: 'BotKill' as const, is_bot: false },
      { x: -370, z: -473, event: 'Killed' as const, is_bot: false },
    ]
    const points = eventsToDrawPoints(events, 'AmbroseValley')
    expect(points.map((p) => p.kind)).toEqual(['kill', 'death'])
  })
})
