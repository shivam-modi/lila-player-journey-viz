import './Timeline.css'

interface TimelineProps {
  durationMs: number
  currentTs: number
  playing: boolean
  speed: number
  onSeek: (ts: number) => void
  onTogglePlay: () => void
  onSpeedChange: (s: number) => void
}

function formatMs(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Timeline({ durationMs, currentTs, playing, speed, onSeek, onTogglePlay, onSpeedChange }: TimelineProps) {
  return (
    <div className="timeline">
      <button onClick={onTogglePlay}>{playing ? 'Pause' : 'Play'}</button>
      <span className="timeline-time">{formatMs(currentTs)} / {formatMs(durationMs)}</span>
      <input
        className="timeline-scrub"
        type="range"
        min={0}
        max={durationMs}
        value={currentTs}
        onChange={(e) => onSeek(Number(e.target.value))}
      />
      <select value={speed} onChange={(e) => onSpeedChange(Number(e.target.value))}>
        <option value={1}>1x</option>
        <option value={2}>2x</option>
        <option value={4}>4x</option>
      </select>
    </div>
  )
}
