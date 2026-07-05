import type { GameState } from '../state/types.ts'
import { isAlive } from '../state/unit.ts'

export type GameOutcome = 'ongoing' | 'playerWins' | 'enemyWins'

/**
 * The game only ends when an entire side is wiped out — never on a single casualty.
 * If both sides are somehow wiped in the same resolution, the player losing their
 * last unit takes precedence (an enemy-wipe tie-break, not a modeled draw state).
 */
export function getGameOutcome(state: GameState): GameOutcome {
  const playerAlive = state.units.some((u) => u.team === 'player' && isAlive(u))
  const enemyAlive = state.units.some((u) => u.team === 'enemy' && isAlive(u))

  if (!playerAlive) return 'enemyWins'
  if (!enemyAlive) return 'playerWins'
  return 'ongoing'
}
