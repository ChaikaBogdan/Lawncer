import { describe, expect, it } from 'vitest'
import { RIFLE } from '../combat/weapons.ts'
import type { GameState, UnitState } from '../state/types.ts'
import { advanceTurn, getActiveUnit } from './turnOrder.ts'

function unit(id: string, team: UnitState['team']): UnitState {
  return {
    id,
    team,
    name: id,
    pos: { x: 0, y: 0 },
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
  }
}

function baseState(units: UnitState[]): GameState {
  return {
    round: 1,
    activeTeam: 'player',
    firstTeamThisRound: 'player',
    units,
    map: { width: 5, height: 5, walls: [] },
    rngSeed: 'test-seed',
    rngCalls: 0,
  }
}

describe('turn order', () => {
  it('alternates sides between activations while both have ready units', () => {
    let state = baseState([unit('p1', 'player'), unit('e1', 'enemy')])

    expect(getActiveUnit(state)?.id).toBe('p1')

    state = advanceTurn({
      ...state,
      units: state.units.map((u) => (u.id === 'p1' ? { ...u, hasActivated: true } : u)),
    })
    expect(state.activeTeam).toBe('enemy')
    expect(getActiveUnit(state)?.id).toBe('e1')
  })

  it('lets a team continue activating when the other side is out of ready units', () => {
    let state = baseState([unit('p1', 'player'), unit('p2', 'player'), unit('e1', 'enemy')])
    state = {
      ...state,
      units: state.units.map((u) => (u.id === 'e1' ? { ...u, hasActivated: true } : u)),
    }

    state = advanceTurn({
      ...state,
      units: state.units.map((u) => (u.id === 'p1' ? { ...u, hasActivated: true } : u)),
    })

    expect(state.activeTeam).toBe('player')
    expect(getActiveUnit(state)?.id).toBe('p2')
  })

  it('starts a new round and flips the first-activating team once everyone has acted', () => {
    let state = baseState([unit('p1', 'player'), unit('e1', 'enemy')])
    state = {
      ...state,
      units: state.units.map((u) => ({ ...u, hasActivated: true })),
    }

    state = advanceTurn(state)

    expect(state.round).toBe(2)
    expect(state.firstTeamThisRound).toBe('enemy')
    expect(state.activeTeam).toBe('enemy')
    expect(state.units.every((u) => !u.hasActivated)).toBe(true)
  })
})
