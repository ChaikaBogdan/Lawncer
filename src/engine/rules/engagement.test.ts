import { describe, expect, it } from 'vitest'
import { RIFLE } from '../combat/weapons.ts'
import type { GameState, UnitState } from '../state/types.ts'
import { isEngaged } from './engagement.ts'

function unit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 'u1',
    team: 'player',
    name: 'u1',
    pos: { x: 0, y: 0 },
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
    ...overrides,
  }
}

function stateWith(units: UnitState[]): GameState {
  return {
    round: 1,
    activeTeam: 'player',
    firstTeamThisRound: 'player',
    units,
    map: { width: 5, height: 5, walls: [], cover: [] },
    rngSeed: 'test-seed',
    rngCalls: 0,
  }
}

describe('isEngaged', () => {
  it('is true when a living hostile is orthogonally adjacent', () => {
    const me = unit({ id: 'me', pos: { x: 1, y: 1 } })
    const foe = unit({ id: 'foe', team: 'enemy', pos: { x: 1, y: 2 } })
    expect(isEngaged(stateWith([me, foe]), me)).toBe(true)
  })

  it('is false when the adjacent unit is an ally', () => {
    const me = unit({ id: 'me', pos: { x: 1, y: 1 } })
    const ally = unit({ id: 'ally', pos: { x: 1, y: 2 } })
    expect(isEngaged(stateWith([me, ally]), me)).toBe(false)
  })

  it('is false when the adjacent hostile is destroyed', () => {
    const me = unit({ id: 'me', pos: { x: 1, y: 1 } })
    const foe = unit({ id: 'foe', team: 'enemy', pos: { x: 1, y: 2 }, structure: 0 })
    expect(isEngaged(stateWith([me, foe]), me)).toBe(false)
  })

  it('is false when the nearest hostile is 2+ tiles away', () => {
    const me = unit({ id: 'me', pos: { x: 0, y: 0 } })
    const foe = unit({ id: 'foe', team: 'enemy', pos: { x: 2, y: 0 } })
    expect(isEngaged(stateWith([me, foe]), me)).toBe(false)
  })

  it('counts a diagonal neighbor as adjacent (8-directional grid)', () => {
    const me = unit({ id: 'me', pos: { x: 1, y: 1 } })
    const foe = unit({ id: 'foe', team: 'enemy', pos: { x: 2, y: 2 } })
    expect(isEngaged(stateWith([me, foe]), me)).toBe(true)
  })
})
