import type { DrawPointKind, HeatmapCategory, MapId } from './types'

export const ALL_EVENT_CATEGORIES: DrawPointKind[] = ['kill', 'death', 'storm', 'loot']

export interface ViewState {
  mapId: MapId
  date: string | null
  matchId: string | null
  entityFilter: 'all' | 'humans' | 'bots'
  eventCategoryFilter: Set<DrawPointKind>
  heatmapCategory: HeatmapCategory | 'off'
}

export type ViewAction =
  | { type: 'SET_MAP'; mapId: MapId }
  | { type: 'SET_DATE'; date: string | null }
  | { type: 'SET_MATCH'; matchId: string | null }
  | { type: 'SET_ENTITY_FILTER'; filter: 'all' | 'humans' | 'bots' }
  | { type: 'TOGGLE_EVENT_CATEGORY'; kind: DrawPointKind }
  | { type: 'SET_HEATMAP_CATEGORY'; category: HeatmapCategory | 'off' }

export const initialViewState: ViewState = {
  mapId: 'AmbroseValley',
  date: null,
  matchId: null,
  entityFilter: 'all',
  eventCategoryFilter: new Set(ALL_EVENT_CATEGORIES),
  heatmapCategory: 'kills',
}

export function viewStateReducer(state: ViewState, action: ViewAction): ViewState {
  switch (action.type) {
    case 'SET_MAP':
      // Changing map invalidates the date/match selection, since both are scoped to a map.
      return { ...state, mapId: action.mapId, date: null, matchId: null }
    case 'SET_DATE':
      // Changing date invalidates the match selection, since matches are scoped to a date.
      return { ...state, date: action.date, matchId: null }
    case 'SET_MATCH':
      return { ...state, matchId: action.matchId }
    case 'SET_ENTITY_FILTER':
      return { ...state, entityFilter: action.filter }
    case 'TOGGLE_EVENT_CATEGORY': {
      const next = new Set(state.eventCategoryFilter)
      if (next.has(action.kind)) next.delete(action.kind)
      else next.add(action.kind)
      return { ...state, eventCategoryFilter: next }
    }
    case 'SET_HEATMAP_CATEGORY':
      return { ...state, heatmapCategory: action.category }
  }
}
