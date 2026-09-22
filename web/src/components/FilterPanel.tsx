import type { HeatmapCategory, MapId, MatchIndexEntry } from '../lib/types'
import type { DrawPointKind } from '../lib/drawCommands'
import { filterMatches, uniqueDates } from '../lib/filterMatches'
import './FilterPanel.css'

const MAPS: MapId[] = ['AmbroseValley', 'GrandRift', 'Lockdown']
const EVENT_CATEGORIES: { kind: DrawPointKind; label: string }[] = [
  { kind: 'kill', label: 'Kill' },
  { kind: 'death', label: 'Death' },
  { kind: 'storm', label: 'Storm death' },
  { kind: 'loot', label: 'Loot' },
]
const HEATMAP_CATEGORIES: (HeatmapCategory | 'off')[] = ['off', 'kills', 'deaths', 'storm_deaths', 'loot', 'traffic']

interface FilterPanelProps {
  index: MatchIndexEntry[]
  mapId: MapId
  date: string | null
  matchId: string | null
  entityFilter: 'all' | 'humans' | 'bots'
  eventCategoryFilter: Set<DrawPointKind>
  heatmapCategory: HeatmapCategory | 'off'
  onMapChange: (m: MapId) => void
  onDateChange: (d: string | null) => void
  onMatchChange: (m: string | null) => void
  onEntityFilterChange: (f: 'all' | 'humans' | 'bots') => void
  onEventCategoryToggle: (k: DrawPointKind) => void
  onHeatmapCategoryChange: (c: HeatmapCategory | 'off') => void
}

export function FilterPanel(props: FilterPanelProps) {
  const dates = uniqueDates(props.index, props.mapId)
  const matches = filterMatches(props.index, props.mapId, props.date)

  return (
    <aside className="filter-panel">
      <section>
        <h3>Map</h3>
        <select value={props.mapId} onChange={(e) => props.onMapChange(e.target.value as MapId)}>
          {MAPS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>

      <section>
        <h3>Date</h3>
        <select value={props.date ?? ''} onChange={(e) => props.onDateChange(e.target.value || null)}>
          <option value="">All dates</option>
          {dates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </section>

      <section>
        <h3>Match ({matches.length})</h3>
        <select value={props.matchId ?? ''} onChange={(e) => props.onMatchChange(e.target.value || null)}>
          <option value="">Overview (no match selected)</option>
          {matches.map((m) => (
            <option key={m.match_id} value={m.match_id}>
              {m.match_id.slice(0, 8)} — {m.human_count}H/{m.bot_count}B — {Math.round(m.duration_ms / 1000)}s
            </option>
          ))}
        </select>
      </section>

      <section>
        <h3>Players</h3>
        {(['all', 'humans', 'bots'] as const).map((f) => (
          <label key={f}>
            <input type="radio" name="entity" checked={props.entityFilter === f} onChange={() => props.onEntityFilterChange(f)} />
            {f}
          </label>
        ))}
      </section>

      <section>
        <h3>Event types</h3>
        {EVENT_CATEGORIES.map(({ kind, label }) => (
          <label key={kind}>
            <input type="checkbox" checked={props.eventCategoryFilter.has(kind)} onChange={() => props.onEventCategoryToggle(kind)} />
            {label}
          </label>
        ))}
      </section>

      {!props.matchId && (
        <section>
          <h3>Heatmap</h3>
          <select value={props.heatmapCategory} onChange={(e) => props.onHeatmapCategoryChange(e.target.value as HeatmapCategory | 'off')}>
            {HEATMAP_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </section>
      )}
    </aside>
  )
}
