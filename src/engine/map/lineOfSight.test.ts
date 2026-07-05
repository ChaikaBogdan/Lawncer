import { describe, expect, it } from 'vitest'
import type { MapState } from '../state/types.ts'
import { hasLineOfSight } from './lineOfSight.ts'

describe('hasLineOfSight', () => {
  it('sees clearly across an open map', () => {
    const map: MapState = { width: 5, height: 5, walls: [] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })

  it('is blocked by a wall directly on the line', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 2, y: 0 }] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(false)
  })

  it('is blocked by a wall on a diagonal line', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 2, y: 2 }] }
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
    }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })

  it('is not blocked by a wall off to the side of the line', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 2, y: 3 }] }
    expect(hasLineOfSight(map, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true)
  })
})
