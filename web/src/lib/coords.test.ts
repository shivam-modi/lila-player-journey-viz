import { describe, it, expect } from 'vitest'
import { worldToPixel } from './coords'

describe('worldToPixel', () => {
  it('matches the README worked example for AmbroseValley', () => {
    const { x, y } = worldToPixel(-301.45, -355.55, 'AmbroseValley')
    expect(Math.round(x)).toBe(78)
    expect(Math.round(y)).toBe(890)
  })

  it('maps the map origin to the bottom-left pixel corner', () => {
    const { x, y } = worldToPixel(-370, -473, 'AmbroseValley')
    expect(x).toBeCloseTo(0, 1)
    expect(y).toBeCloseTo(1024, 1)
  })
})
