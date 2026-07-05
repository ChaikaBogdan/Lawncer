import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../../scenarios/demo.ts'
import type { GameState } from '../state/types.ts'
import { getGameOutcome } from './outcome.ts'

function withUnit(
  state: GameState,
  id: string,
  patch: Partial<GameState['units'][number]>
): GameState {
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }
}

describe('getGameOutcome', () => {
  it('is ongoing while both sides have a living unit', () => {
    expect(getGameOutcome(createDemoScenario())).toBe('ongoing')
  })

  it('is ongoing when only one of several units on a side has died', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { structure: 0 })
    expect(getGameOutcome(state)).toBe('ongoing')
  })

  it('is playerWins once every enemy unit is destroyed', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { structure: 0 })
    state = withUnit(state, 'enemy-2', { structure: 0 })
    expect(getGameOutcome(state)).toBe('playerWins')
  })

  it('is enemyWins once every player unit is destroyed', () => {
    let state = withUnit(createDemoScenario(), 'player-1', { structure: 0 })
    state = withUnit(state, 'player-2', { stress: 0 })
    expect(getGameOutcome(state)).toBe('enemyWins')
  })
})
