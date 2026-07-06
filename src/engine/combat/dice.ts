import { createRng } from '../state/rng.ts'
import type { GameState } from '../state/types.ts'

/**
 * Rolls an n-sided die deterministically from the state's seed and call counter, then
 * advances the counter. Replaying the same action log reproduces the same
 * rolls because it re-runs resolve() in the same order from the same seed.
 */
export function rollDie(state: GameState, sides: number): { roll: number; state: GameState } {
  const rng = createRng(`${state.rngSeed}:${state.rngCalls}`)
  const roll = Math.floor(rng.next() * sides) + 1
  return { roll, state: { ...state, rngCalls: state.rngCalls + 1 } }
}

export function rollD20(state: GameState): { roll: number; state: GameState } {
  return rollDie(state, 20)
}
