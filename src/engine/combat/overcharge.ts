import type { GameState } from '../state/types.ts'
import { rollDie } from './dice.ts'

/**
 * Overcharge's heat cost escalates each time it's used this activation: flat 1, then 1d3, 1d6,
 * 1d6+4. Using it a 5th+ time (unusual, but not disallowed) just repeats the last tier rather
 * than growing further or throwing.
 */
export function rollOverchargeHeat(
  state: GameState,
  overchargeCount: number
): { amount: number; state: GameState } {
  const tier = Math.min(overchargeCount, 3)

  if (tier === 0) return { amount: 1, state }
  if (tier === 1) {
    const { roll, state: next } = rollDie(state, 3)
    return { amount: roll, state: next }
  }
  if (tier === 2) {
    const { roll, state: next } = rollDie(state, 6)
    return { amount: roll, state: next }
  }
  const { roll, state: next } = rollDie(state, 6)
  return { amount: roll + 4, state: next }
}
