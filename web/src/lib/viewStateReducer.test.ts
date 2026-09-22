import { describe, it, expect } from 'vitest'
import { viewStateReducer, initialViewState, ALL_EVENT_CATEGORIES } from './viewStateReducer'

describe('viewStateReducer', () => {
  it('SET_MAP changes the map and resets date and match', () => {
    const state = { ...initialViewState, date: '2026-02-10', matchId: 'm1' }
    const next = viewStateReducer(state, { type: 'SET_MAP', mapId: 'GrandRift' })
    expect(next.mapId).toBe('GrandRift')
    expect(next.date).toBeNull()
    expect(next.matchId).toBeNull()
  })

  it('SET_DATE changes the date and resets match, but keeps the map', () => {
    const state = { ...initialViewState, mapId: 'Lockdown' as const, matchId: 'm1' }
    const next = viewStateReducer(state, { type: 'SET_DATE', date: '2026-02-11' })
    expect(next.mapId).toBe('Lockdown')
    expect(next.date).toBe('2026-02-11')
    expect(next.matchId).toBeNull()
  })

  it('SET_MATCH sets the match without touching map or date', () => {
    const state = { ...initialViewState, mapId: 'GrandRift' as const, date: '2026-02-12' }
    const next = viewStateReducer(state, { type: 'SET_MATCH', matchId: 'm2' })
    expect(next.matchId).toBe('m2')
    expect(next.mapId).toBe('GrandRift')
    expect(next.date).toBe('2026-02-12')
  })

  it('SET_ENTITY_FILTER sets the entity filter', () => {
    const next = viewStateReducer(initialViewState, { type: 'SET_ENTITY_FILTER', filter: 'bots' })
    expect(next.entityFilter).toBe('bots')
  })

  it('TOGGLE_EVENT_CATEGORY removes a category that is present', () => {
    const next = viewStateReducer(initialViewState, { type: 'TOGGLE_EVENT_CATEGORY', kind: 'kill' })
    expect(next.eventCategoryFilter.has('kill')).toBe(false)
    expect(next.eventCategoryFilter.has('death')).toBe(true)
  })

  it('TOGGLE_EVENT_CATEGORY adds a category that is absent', () => {
    const state = { ...initialViewState, eventCategoryFilter: new Set<(typeof ALL_EVENT_CATEGORIES)[number]>() }
    const next = viewStateReducer(state, { type: 'TOGGLE_EVENT_CATEGORY', kind: 'loot' })
    expect(next.eventCategoryFilter.has('loot')).toBe(true)
  })

  it('SET_HEATMAP_CATEGORY sets the heatmap category', () => {
    const next = viewStateReducer(initialViewState, { type: 'SET_HEATMAP_CATEGORY', category: 'traffic' })
    expect(next.heatmapCategory).toBe('traffic')
  })

  it('initialViewState starts with all event categories enabled and no match selected', () => {
    expect(initialViewState.matchId).toBeNull()
    expect(initialViewState.date).toBeNull()
    expect(ALL_EVENT_CATEGORIES.every((k) => initialViewState.eventCategoryFilter.has(k))).toBe(true)
  })
})
