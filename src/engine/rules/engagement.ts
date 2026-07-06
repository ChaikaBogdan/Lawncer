import { manhattanDistance } from '../map/grid.ts'
import type { GameState, UnitState } from '../state/types.ts'
import { isAlive } from '../state/unit.ts'

/**
 * Accuracy penalty applied to an Engaged unit's ranged attacks — melee ignores it entirely.
 * Matches real LANCER's weighting: Engaged is the same 1[-] tier as Soft Cover, not Hard Cover's 2[-].
 */
export const ENGAGED_PENALTY = 1

/**
 * Engaged is a live positional fact, not a durable status: a unit is Engaged whenever a living
 * hostile is adjacent, and stops being Engaged the instant that's no longer true. Computed on
 * demand rather than stored, so it can never go stale after a move.
 */
export function isEngaged(state: GameState, unit: UnitState): boolean {
  return state.units.some(
    (other) =>
      other.team !== unit.team && isAlive(other) && manhattanDistance(unit.pos, other.pos) === 1
  )
}
