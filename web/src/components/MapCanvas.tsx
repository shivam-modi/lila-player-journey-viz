import { useEffect, useRef } from 'react'
import { MAP_CONFIGS, MINIMAP_SIZE } from '../lib/mapConfig'
import { MARKER_COLORS } from '../lib/eventCategories'
import type { DrawPoint, HeatmapCategory, HeatmapGrids, MapId, PlaybackFrame } from '../lib/types'
import './MapCanvas.css'

interface MapCanvasProps {
  mapId: MapId
  heatmap?: HeatmapGrids | null
  heatmapCategory?: HeatmapCategory | 'off'
  overviewPoints?: DrawPoint[]
  playbackFrame?: PlaybackFrame | null
}

function drawHeatmap(ctx: CanvasRenderingContext2D, grid: number[][]) {
  const bins = grid.length
  const cellSize = MINIMAP_SIZE / bins
  let max = 1
  for (const row of grid) for (const v of row) if (v > max) max = v
  for (let row = 0; row < bins; row++) {
    for (let col = 0; col < bins; col++) {
      const v = grid[row][col]
      if (v === 0) continue
      const alpha = Math.min(0.85, 0.15 + (v / max) * 0.7)
      ctx.fillStyle = `rgba(255, 80, 0, ${alpha})`
      ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
    }
  }
}

function drawPoint(ctx: CanvasRenderingContext2D, p: DrawPoint) {
  ctx.beginPath()
  ctx.fillStyle = MARKER_COLORS[p.kind]
  ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = 1
  ctx.strokeStyle = '#000'
  ctx.stroke()
}

export function MapCanvas({ mapId, heatmap, heatmapCategory, overviewPoints, playbackFrame }: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE)

    if (heatmap && heatmapCategory && heatmapCategory !== 'off') {
      drawHeatmap(ctx, heatmap[heatmapCategory])
    }

    if (overviewPoints) {
      for (const p of overviewPoints) drawPoint(ctx, p)
    }

    if (playbackFrame) {
      for (const pos of playbackFrame.positions) {
        if (pos.trail.length > 1) {
          ctx.beginPath()
          ctx.strokeStyle = pos.isBot ? 'rgba(150,150,150,0.5)' : 'rgba(80,180,255,0.7)'
          ctx.lineWidth = pos.isBot ? 1 : 2
          ctx.moveTo(pos.trail[0].x, pos.trail[0].y)
          for (const t of pos.trail.slice(1)) ctx.lineTo(t.x, t.y)
          ctx.stroke()
        }
        ctx.beginPath()
        if (pos.isBot) {
          ctx.strokeStyle = '#aaaaaa'
          ctx.lineWidth = 2
          ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.fillStyle = '#50b4ff'
          ctx.arc(pos.x, pos.y, 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      for (const p of playbackFrame.events) drawPoint(ctx, p)
    }
  }, [mapId, heatmap, heatmapCategory, overviewPoints, playbackFrame])

  return (
    <div className="map-canvas-wrap">
      <img className="map-canvas-bg" src={MAP_CONFIGS[mapId].minimapSrc} alt={`${mapId} minimap`} width={MINIMAP_SIZE} height={MINIMAP_SIZE} />
      <canvas ref={canvasRef} width={MINIMAP_SIZE} height={MINIMAP_SIZE} className="map-canvas-overlay" />
    </div>
  )
}
