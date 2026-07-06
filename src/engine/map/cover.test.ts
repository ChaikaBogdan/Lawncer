import { describe, expect, it } from 'vitest'
import type { MapState } from '../state/types.ts'
import { coverBonus, HARD_COVER_BONUS, SOFT_COVER_BONUS } from './cover.ts'

describe('coverBonus', () => {
  it('is 0 on open ground', () => {
    const map: MapState = { width: 5, height: 5, walls: [], cover: [] }
    expect(coverBonus(map, { x: 4, y: 0 }, { x: 0, y: 0 })).toBe(0)
  })

  it('grants hard cover when a wall sits between defender and attacker', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 1, y: 0 }], cover: [] }
    expect(coverBonus(map, { x: 4, y: 0 }, { x: 0, y: 0 })).toBe(HARD_COVER_BONUS)
  })

  it('grants soft cover when cover terrain sits between defender and attacker', () => {
    const map: MapState = { width: 5, height: 5, walls: [], cover: [{ x: 1, y: 0 }] }
    expect(coverBonus(map, { x: 4, y: 0 }, { x: 0, y: 0 })).toBe(SOFT_COVER_BONUS)
  })

  it('probes the diagonal tile toward the attacker when they are off-axis', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 1, y: 1 }], cover: [] }
    expect(coverBonus(map, { x: 4, y: 4 }, { x: 0, y: 0 })).toBe(HARD_COVER_BONUS)
  })

  it('is 0 when attacker and defender share the same tile', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 1, y: 0 }], cover: [] }
    expect(coverBonus(map, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0)
  })
})
