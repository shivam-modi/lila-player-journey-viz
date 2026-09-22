import type { MapId } from './types'

export const MAP_CONFIGS: Record<MapId, { scale: number; originX: number; originZ: number; minimapSrc: string }> = {
  AmbroseValley: { scale: 900, originX: -370, originZ: -473, minimapSrc: '/minimaps/AmbroseValley.jpg' },
  GrandRift: { scale: 581, originX: -290, originZ: -290, minimapSrc: '/minimaps/GrandRift.jpg' },
  Lockdown: { scale: 1000, originX: -500, originZ: -500, minimapSrc: '/minimaps/Lockdown.jpg' },
}

export const MINIMAP_SIZE = 1024
