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

function baseState(units: UnitState[]): GameState {
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

  it('clears an unused armed Brace and resets the per-activation Overcharge flag at round rollover', () => {
    let state = baseState([
      { ...unit('p1', 'player'), brace: true, overchargeCount: 2, hasOvercharged: true },
      unit('e1', 'enemy'),
    ])
    state = {
      ...state,
      units: state.units.map((u) => ({ ...u, hasActivated: true })),
    }

    state = advanceTurn(state)

    const p1 = state.units.find((u) => u.id === 'p1')!
    expect(p1.brace).toBe(false)
    expect(p1.hasOvercharged).toBe(false)
    // The scene-wide escalation count is untouched by round rollover — only a fresh scenario
    // (Reset scenario) zeroes it, so the heat cost keeps escalating across the whole battle.
    expect(p1.overchargeCount).toBe(2)
  })

  it('resets the per-activation System Reaction flag but not its Limited-2 scenario-wide use count', () => {
    let state = baseState([
      { ...unit('p1', 'player'), systemReactionArmed: true, systemReactionUses: 1 },
      unit('e1', 'enemy'),
    ])
    state = {
      ...state,
      units: state.units.map((u) => ({ ...u, hasActivated: true })),
    }

    state = advanceTurn(state)

    const p1 = state.units.find((u) => u.id === 'p1')!
    expect(p1.systemReactionArmed).toBe(false)
    // Limited 2 is a per-scenario charge count, not a per-round cooldown — round rollover must not
    // refill it, or Wraith's Boost (and every other frame's System Reaction) could be spammed.
    expect(p1.systemReactionUses).toBe(1)
  })

  it('a status granted mid-round with roundsRemaining 2 survives round rollover so it is still active for its next activation', () => {
    let state = baseState([
      { ...unit('p1', 'player'), statuses: [{ type: 'extendedRange', roundsRemaining: 2 }] },
      unit('e1', 'enemy'),
    ])
    state = {
      ...state,
      units: state.units.map((u) => ({ ...u, hasActivated: true })),
    }

    state = advanceTurn(state)

    const p1 = state.units.find((u) => u.id === 'p1')!
    expect(p1.statuses).toEqual([{ type: 'extendedRange', roundsRemaining: 1 }])
  })
})
