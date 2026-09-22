import { describe, it, expect } from 'vitest'
import { computePlaybackFrame } from './playback'
import type { MatchEvent } from './types'

const events: MatchEvent[] = [
  { user_id: 'h1', is_bot: false, x: -370, z: -473, ts: 0, event: 'Position' },
  { user_id: 'h1', is_bot: false, x: -280, z: -400, ts: 2000, event: 'Position' },
  { user_id: 'h1', is_bot: false, x: -280, z: -400, ts: 2100, event: 'Kill' },
  { user_id: 'b1', is_bot: true, x: -300, z: -450, ts: 1000, event: 'BotPosition' },
]

describe('computePlaybackFrame', () => {
  it('places each entity at their most recent position at or before atTs', () => {
    const frame = computePlaybackFrame(events, 'AmbroseValley', 2000)
    expect(frame.positions).toHaveLength(2)
    const human = frame.positions.find((p) => !p.isBot)!
    expect(Math.round(human.x)).toBe(102)
  })

  it('excludes entities with no position sample yet at atTs', () => {
    const frame = computePlaybackFrame(events, 'AmbroseValley', 500)
    expect(frame.positions).toHaveLength(1)
    expect(frame.positions[0].isBot).toBe(false)
  })

  it('includes discrete events that have occurred by atTs and excludes later ones', () => {
    const frameBefore = computePlaybackFrame(events, 'AmbroseValley', 2000)
    expect(frameBefore.events).toHaveLength(0)
    const frameAfter = computePlaybackFrame(events, 'AmbroseValley', 2100)
    expect(frameAfter.events).toHaveLength(1)
    expect(frameAfter.events[0].kind).toBe('kill')
  })

  it('builds a trail of recent positions within the trail window', () => {
    const frame = computePlaybackFrame(events, 'AmbroseValley', 2000, 5000)
    const human = frame.positions.find((p) => !p.isBot)!
    expect(human.trail.length).toBe(2) // ts=0 and ts=2000 both within the 5000ms window
  })
})
