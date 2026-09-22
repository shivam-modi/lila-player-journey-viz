import { useMemo, useReducer } from 'react'
import { FilterPanel } from './components/FilterPanel'
import { MapCanvas } from './components/MapCanvas'
import { Timeline } from './components/Timeline'
import { Legend } from './components/Legend'
import { useMatchesIndex } from './hooks/useMatchesIndex'
import { useMatchBundle } from './hooks/useMatchBundle'
import { useHeatmap } from './hooks/useHeatmap'
import { useOverviewEvents } from './hooks/useOverviewEvents'
import { usePlaybackClock } from './hooks/usePlaybackClock'
import { eventsToDrawPoints, EVENT_TO_KIND } from './lib/drawCommands'
import { computePlaybackFrame } from './lib/playback'
import { viewStateReducer, initialViewState } from './lib/viewStateReducer'
import './App.css'

export default function App() {
  const { data: index, loading: indexLoading, error: indexError } = useMatchesIndex()
  const [view, dispatch] = useReducer(viewStateReducer, initialViewState)
  const { mapId, date, matchId, entityFilter, eventCategoryFilter, heatmapCategory } = view

  const { data: heatmap, error: heatmapError } = useHeatmap(matchId ? null : mapId)
  const { data: matchEvents, error: matchEventsError } = useMatchBundle(matchId)
  const { data: overviewEvents, error: overviewError } = useOverviewEvents(mapId)

  const durationMs = useMemo(() => {
    if (!matchId || !index) return 0
    return index.find((m) => m.match_id === matchId)?.duration_ms ?? 0
  }, [matchId, index])

  const { currentTs, playing, speed, setCurrentTs, setPlaying, setSpeed } = usePlaybackClock(durationMs, matchId)

  const overviewPoints = useMemo(() => {
    if (matchId || !overviewEvents) return []
    let scoped = overviewEvents.filter((e) => (date ? e.date === date : true))
    if (entityFilter === 'humans') scoped = scoped.filter((e) => !e.is_bot)
    if (entityFilter === 'bots') scoped = scoped.filter((e) => e.is_bot)
    scoped = scoped.filter((e) => {
      const kind = EVENT_TO_KIND[e.event]
      return kind !== undefined && eventCategoryFilter.has(kind)
    })
    return eventsToDrawPoints(scoped, mapId)
  }, [matchId, overviewEvents, date, entityFilter, eventCategoryFilter, mapId])

  const playbackFrame = useMemo(() => {
    if (!matchId || !matchEvents) return null
    let scoped = matchEvents
    if (entityFilter === 'humans') scoped = scoped.filter((e) => !e.is_bot)
    if (entityFilter === 'bots') scoped = scoped.filter((e) => e.is_bot)
    // Position/BotPosition always pass through (needed to place the dots each frame);
    // discrete event categories are gated by the eventCategoryFilter checkboxes.
    scoped = scoped.filter((e) => {
      const kind = EVENT_TO_KIND[e.event]
      return !kind || eventCategoryFilter.has(kind)
    })
    return computePlaybackFrame(scoped, mapId, currentTs)
  }, [matchId, matchEvents, mapId, currentTs, entityFilter, eventCategoryFilter])

  if (indexLoading) {
    return <div className="app-loading">Loading match data…</div>
  }

  if (indexError || !index) {
    return (
      <div className="app-loading">
        Failed to load match data{indexError ? `: ${indexError.message}` : ''}. Try reloading the page.
      </div>
    )
  }

  const nonFatalError = matchEventsError ?? heatmapError ?? overviewError

  return (
    <div className="app">
      <FilterPanel
        index={index}
        mapId={mapId}
        date={date}
        matchId={matchId}
        entityFilter={entityFilter}
        eventCategoryFilter={eventCategoryFilter}
        heatmapCategory={heatmapCategory}
        onMapChange={(m) => dispatch({ type: 'SET_MAP', mapId: m })}
        onDateChange={(d) => dispatch({ type: 'SET_DATE', date: d })}
        onMatchChange={(m) => dispatch({ type: 'SET_MATCH', matchId: m })}
        onEntityFilterChange={(f) => dispatch({ type: 'SET_ENTITY_FILTER', filter: f })}
        onEventCategoryToggle={(k) => dispatch({ type: 'TOGGLE_EVENT_CATEGORY', kind: k })}
        onHeatmapCategoryChange={(c) => dispatch({ type: 'SET_HEATMAP_CATEGORY', category: c })}
      />
      <main className="app-main">
        <Legend />
        {nonFatalError && (
          <div className="app-error-banner">Failed to load some data: {nonFatalError.message}</div>
        )}
        <div className="app-canvas-area">
          <MapCanvas
            mapId={mapId}
            heatmap={heatmap}
            heatmapCategory={matchId ? 'off' : heatmapCategory}
            overviewPoints={matchId ? undefined : overviewPoints}
            playbackFrame={playbackFrame}
          />
        </div>
        {matchId && (
          <Timeline
            durationMs={durationMs}
            currentTs={currentTs}
            playing={playing}
            speed={speed}
            onSeek={setCurrentTs}
            onTogglePlay={() => setPlaying((p) => !p)}
            onSpeedChange={setSpeed}
          />
        )}
      </main>
    </div>
  )
}
