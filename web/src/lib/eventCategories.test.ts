import { describe, it, expect } from 'vitest'
import { EVENT_CATEGORIES, MARKER_COLORS } from './eventCategories'
import { ALL_EVENT_CATEGORIES } from './viewStateReducer'

describe('eventCategories', () => {
  it('defines exactly one entry per event category kind', () => {
    expect(EVENT_CATEGORIES.map((c) => c.kind).sort()).toEqual([...ALL_EVENT_CATEGORIES].sort())
  })

  it('gives every category a non-empty label and color', () => {
    for (const c of EVENT_CATEGORIES) {
      expect(c.label.length).toBeGreaterThan(0)
      expect(c.color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it('derives MARKER_COLORS with one color per kind, matching EVENT_CATEGORIES', () => {
    for (const c of EVENT_CATEGORIES) {
      expect(MARKER_COLORS[c.kind]).toBe(c.color)
    }
  })
})
