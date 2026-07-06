import { describe, expect, it } from 'vitest'
import { RIFLE } from '../combat/weapons.ts'
import type { MapState, UnitState } from '../state/types.ts'
import { knockbackDestination, reachableTiles } from './grid.ts'

function tileSet(tiles: { x: number; y: number }[]): Set<string> {
  return new Set(tiles.map((t) => `${t.x},${t.y}`))
}

const openMap: MapState = { width: 5, height: 5, walls: [], cover: [] }

function unitAt(id: string, x: number, y: number): UnitState {
  return {
    id,
    team: 'player',
    name: id,
    pos: { x, y },
    moveSpeed: 3,
    hasActivated: false,
    hasMoved: false,
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
    armor: 0,
    aiBehavior: 'aggressive',
    systemReactionStatus: 'extendedRange',
    statuses: [],
    overwatch: false,
    systemReactionArmed: false,
    systemReactionUses: 0,
    brace: false,
    overchargeCount: 0,
    hasOvercharged: false,
    weaponDisabled: false,
  }
}

describe('reachableTiles', () => {
  it('reaches every tile within the move-speed Chebyshev square on an open map (8-directional)', () => {
    const tiles = reachableTiles(openMap, [], { x: 2, y: 2 }, 2)
    // Chebyshev-distance <= 2 from (2,2), excluding the origin itself, within a 5x5 map: the whole map.
    expect(tiles).toHaveLength(24)
    expect(tiles).toContainEqual({ x: 2, y: 0 })
    expect(tiles).toContainEqual({ x: 0, y: 0 })
    expect(tiles).not.toContainEqual({ x: 2, y: 2 })
  })

  it('reaches diagonal neighbors in a single step', () => {
    const tiles = reachableTiles(openMap, [], { x: 0, y: 0 }, 1)
    expect(tileSet(tiles)).toEqual(
      tileSet([
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ])
    )
  })

  it('does not path through walls', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 1, y: 0 }], cover: [] }
    const tiles = reachableTiles(map, [], { x: 0, y: 0 }, 1)
    expect(tileSet(tiles)).toEqual(
      tileSet([
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ])
    )
  })

  it('blocks a diagonal step that would cut through a wall corner', () => {
    const map: MapState = {
      width: 5,
      height: 5,
      walls: [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      cover: [],
    }
    const tiles = reachableTiles(map, [], { x: 0, y: 0 }, 1)
    expect(tiles).not.toContainEqual({ x: 1, y: 1 })
  })

  it('treats other units as impassable obstacles', () => {
    const units = [unitAt('blocker', 1, 0)]
    const tiles = reachableTiles(openMap, units, { x: 0, y: 0 }, 1, undefined)
    expect(tileSet(tiles)).toEqual(
      tileSet([
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ])
    )
  })

  it('ignores destroyed units when checking occupancy', () => {
    const destroyed = { ...unitAt('wreck', 1, 0), structure: 0 }
    const tiles = reachableTiles(openMap, [destroyed], { x: 0, y: 0 }, 1)
    expect(tiles).toContainEqual({ x: 1, y: 0 })
  })
})

describe('knockbackDestination', () => {
  it('pushes one tile straight away from the attacker', () => {
    const dest = knockbackDestination(openMap, [], { x: 1, y: 2 }, { x: 2, y: 2 }, 'target')
    expect(dest).toEqual({ x: 3, y: 2 })
  })

  it('pushes diagonally when the attacker-target line is diagonal', () => {
    const dest = knockbackDestination(openMap, [], { x: 1, y: 1 }, { x: 2, y: 2 }, 'target')
    expect(dest).toEqual({ x: 3, y: 3 })
  })

  it('is blocked by a wall at the destination', () => {
    const map: MapState = { width: 5, height: 5, walls: [{ x: 3, y: 2 }], cover: [] }
    const dest = knockbackDestination(map, [], { x: 1, y: 2 }, { x: 2, y: 2 }, 'target')
    expect(dest).toBeUndefined()
  })

  it('is blocked by another unit occupying the destination', () => {
    const units = [unitAt('blocker', 3, 2)]
    const dest = knockbackDestination(openMap, units, { x: 1, y: 2 }, { x: 2, y: 2 }, 'target')
    expect(dest).toBeUndefined()
  })

  it('is blocked when the destination is out of bounds', () => {
    const dest = knockbackDestination(openMap, [], { x: 2, y: 2 }, { x: 4, y: 2 }, 'target')
    expect(dest).toBeUndefined()
  })
})
