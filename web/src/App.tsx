import { useMemo, useState, useEffect, useRef } from 'react'
import { FilterPanel } from './components/FilterPanel'
import { MapCanvas } from './components/MapCanvas'
import { Timeline } from './components/Timeline'
import { Legend } from './components/Legend'
import { useMatchesIndex } from './hooks/useMatchesIndex'
import { useMatchBundle } from './hooks/useMatchBundle'
import { useHeatmap } from './hooks/useHeatmap'
import { useOverviewEvents } from './hooks/useOverviewEvents'
import { eventsToDrawPoints, EVENT_TO_KIND } from './lib/drawCommands'
import type { DrawPointKind } from './lib/drawCommands'
import { computePlaybackFrame } from './lib/playback'
import type { HeatmapCategory, MapId } from './lib/types'
import './App.css'

const ALL_EVENT_CATEGORIES: DrawPointKind[] = ['kill', 'death', 'storm', 'loot']

export default function App() {
  const { data: index, loading: indexLoading } = useMatchesIndex()
  const [mapId, setMapId] = useState<MapId>('AmbroseValley')
  const [date, setDate] = useState<string | null>(null)
  const [matchId, setMatchId] = useState<string | null>(null)
  const [entityFilter, setEntityFilter] = useState<'all' | 'humans' | 'bots'>('all')
  const [eventCategoryFilter, setEventCategoryFilter] = useState<Set<DrawPointKind>>(new Set(ALL_EVENT_CATEGORIES))
  const [heatmapCategory, setHeatmapCategory] = useState<HeatmapCategory | 'off'>('kills')

  const { data: heatmap } = useHeatmap(matchId ? null : mapId)
  const { data: matchEvents } = useMatchBundle(matchId)
  const { data: overviewEvents } = useOverviewEvents(mapId)

  const [currentTs, setCurrentTs] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const rafRef = useRef<number | null>(null)
  const lastFrameTimeRef = useRef<number | null>(null)

  const durationMs = useMemo(() => {
    if (!matchId || !index) return 0
    return index.find((m) => m.match_id === matchId)?.duration_ms ?? 0
  }, [matchId, index])

  useEffect(() => {
    setCurrentTs(0)
    setPlaying(false)
  }, [matchId])

  useEffect(() => {
    if (!playing) {
      lastFrameTimeRef.current = null
      return
    }
    const tick = (now: number) => {
      if (lastFrameTimeRef.current != null) {
        const delta = (now - lastFrameTimeRef.current) * speed
        setCurrentTs((t) => Math.min(durationMs, t + delta))
      }
      lastFrameTimeRef.current = now
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, speed, durationMs])

  useEffect(() => {
    if (currentTs >= durationMs && durationMs > 0) setPlaying(false)
  }, [currentTs, durationMs])

  const overviewPoints = useMemo(() => {
    if (matchId || !overviewEvents) return []
    let scoped = overviewEvents.filter((e) => (date ? e.date === date : true))
    if (entityFilter === 'humans') scoped = scoped.filter((e) => !e.is_bot)
    if (entityFilter === 'bots') scoped = scoped.filter((e) => e.is_bot)
    scoped = scoped.filter((e) => eventCategoryFilter.has(EVENT_TO_KIND[e.event]!))
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

  if (indexLoading || !index) {
    return <div className="app-loading">Loading match data…</div>
  }

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
        onMapChange={(m) => { setMapId(m); setDate(null); setMatchId(null) }}
        onDateChange={(d) => { setDate(d); setMatchId(null) }}
        onMatchChange={setMatchId}
        onEntityFilterChange={setEntityFilter}
        onEventCategoryToggle={(k) => setEventCategoryFilter((prev) => {
          const next = new Set(prev)
          if (next.has(k)) next.delete(k); else next.add(k)
          return next
        })}
        onHeatmapCategoryChange={setHeatmapCategory}
      />
      <main className="app-main">
        <Legend />
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
