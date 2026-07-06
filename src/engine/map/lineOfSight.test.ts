import { describe, expect, it } from 'vitest'
import type { MapState } from '../state/types.ts'
import { hasLineOfSight } from './lineOfSight.ts'

describe('hasLineOfSight', () => {
  it('sees clearly across an open map', () => {
    const map: MapState = { width: 5, height: 5, walls: [], cover: [] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })

  it('is blocked by a wall directly on the line', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 2, y: 0 }], cover: [] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false)
  })

  it('is blocked by a wall on a diagonal line', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 2, y: 2 }], cover: [] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 4 })).toBe(false)
  })

  it('ignores a wall standing on the attacker or target tile itself', () => {
    const map: MapState = {
      width: 5,
      height: 5,
      walls: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
      cover: [],
    }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })

  it('is not blocked by a wall off to the side of the line', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 2, y: 3 }], cover: [] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })

  it('cannot snipe diagonally through the gap between two corner walls', () => {
    // Walls at (1,0) and (0,1) flank the diagonal step from (0,0) to (1,1) — a straight
    // Bresenham trace never visits an intermediate cell here, so without an explicit corner
    // check this diagonal shot would go clean through the gap.
    const map: MapState = {
      width: 5,
      height: 5,
      walls: [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      cover: [],
    }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false)
  })

  it('sees fine diagonally when only one side of the corner is a wall', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 1, y: 0 }], cover: [] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(true)
  })
})
