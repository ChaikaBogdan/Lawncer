import { describe, expect, it } from 'vitest'
import { RIFLE } from '../combat/weapons.ts'
import type { MapState, UnitState } from '../state/types.ts'
import { reachableTiles } from './grid.ts'

const openMap: MapState = { width: 5, height: 5, walls: [], cover: [] }

function unitAt(id: string, x: number, y: number): UnitState {
  return {
    id,
    team: 'player',
    name: id,
    pos: { x, y },
    moveSpeed: 3,
    hasActivated: false,
    quickActionsUsed: 0,
    hp: 4,
    maxHp: 4,
    structure: 3,
    maxStructure: 3,
    heat: 0,
    heatCap: 4,
    stress: 3,
    maxStress: 3,
    weapon: RIFLE,
    evasion: 8,
    statuses: [],
    overwatch: false,
    brace: false,
    overchargeCount: 0,
    weaponDisabled: false,
  }
}

describe('reachableTiles', () => {
  it('reaches every tile within the orthogonal move-speed diamond on an open map', () => {
    const tiles = reachableTiles(openMap, [], { x: 2, y: 2 }, 2)
    // Manhattan-distance <= 2 from (2,2), excluding the origin itself, within a 5x5 map.
    expect(tiles).toHaveLength(12)
    expect(tiles).toContainEqual({ x: 2, y: 0 })
    expect(tiles).not.toContainEqual({ x: 2, y: 2 })
  })

  it('does not path through walls', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 1, y: 0 }], cover: [] }
    const tiles = reachableTiles(map, [], { x: 0, y: 0 }, 1)
    expect(tiles).toEqual([{ x: 0, y: 1 }])
  })

  it('treats other units as impassable obstacles', () => {
    const units = [unitAt('blocker', 1, 0)]
    const tiles = reachableTiles(openMap, units, { x: 0, y: 0 }, 1, undefined)
    expect(tiles).toEqual([{ x: 0, y: 1 }])
  })

  it('ignores destroyed units when checking occupancy', () => {
    const destroyed = { ...unitAt('wreck', 1, 0), structure: 0 }
    const tiles = reachableTiles(openMap, [destroyed], { x: 0, y: 0 }, 1)
    expect(tiles).toContainEqual({ x: 1, y: 0 })
  })
})
