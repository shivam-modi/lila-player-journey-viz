import { MAP_CONFIGS, MINIMAP_SIZE } from './mapConfig'
import type { MapId } from './types'

export function worldToPixel(x: number, z: number, mapId: MapId): { x: number; y: number } {
  const cfg = MAP_CONFIGS[mapId]
  const u = (x - cfg.originX) / cfg.scale
  const v = (z - cfg.originZ) / cfg.scale
  return {
    x: u * MINIMAP_SIZE,
    y: (1 - v) * MINIMAP_SIZE,
  }
}
