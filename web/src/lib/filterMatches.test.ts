import { describe, it, expect } from 'vitest'
import { filterMatches, uniqueDates } from './filterMatches'
import type { MatchIndexEntry } from './types'

const index: MatchIndexEntry[] = [
  { match_id: 'm1', map_id: 'AmbroseValley', date: '2026-02-10', human_count: 2, bot_count: 8, duration_ms: 1000, kills: 1, deaths: 1, storm_deaths: 0, loot: 2 },
  { match_id: 'm2', map_id: 'AmbroseValley', date: '2026-02-11', human_count: 1, bot_count: 9, duration_ms: 1000, kills: 0, deaths: 0, storm_deaths: 1, loot: 0 },
  { match_id: 'm3', map_id: 'GrandRift', date: '2026-02-10', human_count: 3, bot_count: 7, duration_ms: 1000, kills: 2, deaths: 2, storm_deaths: 0, loot: 1 },
]

describe('filterMatches', () => {
  it('filters by map', () => {
    expect(filterMatches(index, 'AmbroseValley', null).map((m) => m.match_id)).toEqual(['m1', 'm2'])
  })

  it('filters by map and date', () => {
    expect(filterMatches(index, 'AmbroseValley', '2026-02-11').map((m) => m.match_id)).toEqual(['m2'])
  })
})

describe('uniqueDates', () => {
  it('returns sorted unique dates for a map', () => {
    expect(uniqueDates(index, 'AmbroseValley')).toEqual(['2026-02-10', '2026-02-11'])
  })
})
