import { describe, expect, it } from 'vitest'
import type { GameState } from '../state/types.ts'
import { rollOverchargeHeat } from './overcharge.ts'

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    round: 1,
    activeTeam: 'player',
    firstTeamThisRound: 'player',
    units: [],
    map: { width: 5, height: 5, walls: [], cover: [] },
    rngSeed: 'test-seed',
    rngCalls: 0,
    ...overrides,
  }
}

describe('rollOverchargeHeat', () => {
  it('costs a flat 1 heat on the first use', () => {
    const { amount, state } = rollOverchargeHeat(baseState(), 0)
    expect(amount).toBe(1)
    expect(state.rngCalls).toBe(0)
  })

  it('rolls 1d3 (1-3) on the second use, advancing the rng counter', () => {
    const { amount, state } = rollOverchargeHeat(baseState(), 1)
    expect(amount).toBeGreaterThanOrEqual(1)
    expect(amount).toBeLessThanOrEqual(3)
    expect(state.rngCalls).toBe(1)
  })

  it('rolls 1d6 (1-6) on the third use', () => {
    const { amount, state } = rollOverchargeHeat(baseState(), 2)
    expect(amount).toBeGreaterThanOrEqual(1)
    expect(amount).toBeLessThanOrEqual(6)
    expect(state.rngCalls).toBe(1)
  })

  it('rolls 1d6+4 (5-10) on the fourth use', () => {
    const { amount } = rollOverchargeHeat(baseState(), 3)
    expect(amount).toBeGreaterThanOrEqual(5)
    expect(amount).toBeLessThanOrEqual(10)
  })

  it('caps at the 1d6+4 tier for a 5th+ use rather than growing further', () => {
    const { amount } = rollOverchargeHeat(baseState(), 10)
    expect(amount).toBeGreaterThanOrEqual(5)
    expect(amount).toBeLessThanOrEqual(10)
  })
})
