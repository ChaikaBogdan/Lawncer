import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../../scenarios/demo.ts'
import type { GameState } from '../state/types.ts'
import { chooseAiAction } from './simpleAi.ts'

function withUnit(
  state: GameState,
  id: string,
  patch: Partial<GameState['units'][number]>
): GameState {
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }
}

describe('chooseAiAction', () => {
  it('attacks the nearest in-range enemy over moving', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 } })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit)).toEqual({
      type: 'attack',
      unitId: 'enemy-1',
      targetId: 'player-1',
    })
  })

  it('moves toward the nearest enemy when nothing is in range', () => {
    const state = createDemoScenario()
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    const action = chooseAiAction(state, unit)
    expect(action.type).toBe('move')
  })

  it('ends its activation when it cannot get any closer and nothing is in range', () => {
    const state: GameState = {
      round: 1,
      activeTeam: 'enemy',
      firstTeamThisRound: 'enemy',
      rngSeed: 'test-seed',
      rngCalls: 0,
      map: { width: 5, height: 1, walls: [], cover: [] },
      units: [
        { ...createDemoScenario().units[0], id: 'p1', pos: { x: 0, y: 0 }, moveSpeed: 0 },
        {
          ...createDemoScenario().units[2],
          id: 'e1',
          team: 'enemy',
          pos: { x: 4, y: 0 },
          moveSpeed: 0,
          weapon: { ...createDemoScenario().units[2].weapon, range: 0 },
        },
      ],
    }
    const unit = state.units.find((u) => u.id === 'e1')!
    expect(chooseAiAction(state, unit)).toEqual({ type: 'endActivation', unitId: 'e1' })
  })

  it('invades an in-tech-range enemy when no weapon attack is available', () => {
    // Wraith's Sword has range 1; place the enemy at distance 3 so only Invade (tech range 3) reaches it.
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 0, y: 0 } })
    state = withUnit(state, 'enemy-2', { pos: { x: 0, y: 3 } })
    const unit = state.units.find((u) => u.id === 'enemy-2')!
    expect(chooseAiAction(state, unit)).toEqual({
      type: 'techInvade',
      unitId: 'enemy-2',
      targetId: 'player-1',
    })
  })

  it('shields the most wounded unshielded ally when no attack or invade target is available', () => {
    let state = createDemoScenario()
    // enemy-1 and enemy-2 adjacent, both far from any player unit (out of weapon and tech range of enemies).
    state = withUnit(state, 'enemy-1', { pos: { x: 0, y: 0 }, hp: 4 })
    state = withUnit(state, 'enemy-2', { pos: { x: 1, y: 0 }, hp: 1, moveSpeed: 0 })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit)).toEqual({
      type: 'techShield',
      unitId: 'enemy-1',
      targetId: 'enemy-2',
    })
  })

  it('ends its activation when there are no living enemies left', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { structure: 0 })
    const finalState = withUnit(state, 'player-2', { structure: 0 })
    const unit = finalState.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(finalState, unit)).toEqual({ type: 'endActivation', unitId: 'enemy-1' })
  })
})
