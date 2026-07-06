import type { GameState, UnitState } from '../state/types.ts'
import { withStatus } from '../state/unit.ts'
import { rollDie } from './dice.ts'

/**
 * Escalating structure table (adapted from real LANCER's Glancing Blow/System Trauma/Direct
 * Hit/Crushing Hit): roll 1d6 per currently-missing structure box, take the lowest. Only called
 * when a unit survives a structure-box loss (dead units don't need a table roll).
 *
 * Adaptations from the real table, since we lack the subsystems it assumes:
 * - System Trauma destroys a specific mount/system; we have one weapon per unit, so it just
 *   disables the unit's weapon (`weaponDisabled`) until a Stabilize action repairs it.
 * - Direct Hit's "2 remaining structure" tier is a HULL check-or-destroyed in real rules; we have
 *   no pilot skill-check subsystem, so it's folded into the safer Stunned outcome instead — only
 *   the tightest margin (1 remaining) risks instant death on a bad roll.
 */
export function rollStructureTable(
  state: GameState,
  unit: UnitState
): { unit: UnitState; state: GameState } {
  const missing = unit.maxStructure - unit.structure
  let current = state
  const rolls: number[] = []
  for (let i = 0; i < missing; i++) {
    const { roll, state: next } = rollDie(current, 6)
    rolls.push(roll)
    current = next
  }

  const lowest = Math.min(...rolls)
  const onesCount = rolls.filter((r) => r === 1).length

  if (onesCount >= 2) {
    return { unit: { ...unit, structure: 0 }, state: current } // Crushing Hit
  }
  if (lowest >= 5) {
    return { unit: withStatus(unit, 'impaired', 2), state: current } // Glancing Blow
  }
  if (lowest >= 2) {
    return { unit: { ...unit, weaponDisabled: true }, state: current } // System Trauma
  }
  // Direct Hit (lowest === 1)
  if (unit.structure === 1) {
    return { unit: { ...unit, structure: 0 }, state: current }
  }
  return { unit: withStatus(unit, 'stunned', 2), state: current }
}
