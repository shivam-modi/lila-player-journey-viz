import type { DrawPointKind } from './types'

export interface EventCategoryMeta {
  kind: DrawPointKind
  label: string
  color: string
}

/**
 * Single source of truth for the 4 event marker categories: their label
 * (filter checkboxes, legend) and color (map markers, legend swatches).
 * Add a new category here and it appears everywhere it's used.
 */
export const EVENT_CATEGORIES: EventCategoryMeta[] = [
  { kind: 'kill', label: 'Kill', color: '#ff4d4d' },
  { kind: 'death', label: 'Death', color: '#ffffff' },
  { kind: 'storm', label: 'Storm death', color: '#b060ff' },
  { kind: 'loot', label: 'Loot', color: '#4dff88' },
]

export const MARKER_COLORS: Record<DrawPointKind, string> = Object.fromEntries(
  EVENT_CATEGORIES.map((c) => [c.kind, c.color])
) as Record<DrawPointKind, string>
