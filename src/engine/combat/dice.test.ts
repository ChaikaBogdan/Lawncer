import { describe, expect, it } from 'vitest'
import type { GameState } from '../state/types.ts'
import { rollD20, rollDie } from './dice.ts'

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

describe('rollD20', () => {
  it('rolls within [1, 20] and advances the call counter', () => {
    const { roll, state } = rollD20(baseState())
    expect(roll).toBeGreaterThanOrEqual(1)
    expect(roll).toBeLessThanOrEqual(20)
    expect(state.rngCalls).toBe(1)
  })

  it('is deterministic for the same seed and call index', () => {
    const a = rollD20(baseState({ rngCalls: 5 }))
    const b = rollD20(baseState({ rngCalls: 5 }))
    expect(a.roll).toBe(b.roll)
  })

  it('produces different rolls for different call indices', () => {
    const rolls = Array.from({ length: 20 }, (_, i) => rollD20(baseState({ rngCalls: i })).roll)
    expect(new Set(rolls).size).toBeGreaterThan(1)
  })
})

describe('rollDie', () => {
  it('rolls within [1, sides] and advances the call counter', () => {
    const { roll, state } = rollDie(baseState(), 6)
    expect(roll).toBeGreaterThanOrEqual(1)
    expect(roll).toBeLessThanOrEqual(6)
    expect(state.rngCalls).toBe(1)
  })

  it('is deterministic for the same seed and call index', () => {
    const a = rollDie(baseState({ rngCalls: 5 }), 3)
    const b = rollDie(baseState({ rngCalls: 5 }), 3)
    expect(a.roll).toBe(b.roll)
  })
})
