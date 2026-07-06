import type { GameState, UnitState } from '../state/types.ts'
import { withStatus } from '../state/unit.ts'
import { rollDie } from './dice.ts'

/**
 * Escalating stress table (adapted from real LANCER's Emergency Shunt/Destabilised Power
 * Plant/Meltdown): roll 1d6 per currently-missing stress box, take the lowest. Only called when
 * a unit survives a stress-box loss.
 *
 * Adaptations: real Meltdown ends in a mech-destroying AoE explosion; we have no blast/burst
 * system (out of scope, same as weapon tags/damage types), so "meltdown" just means the unit is
 * destroyed outright, which our destroy-at-0-stress model already does naturally. The "2
 * remaining" Meltdown tier (real: an ENGINEERING check or delayed meltdown) folds into Exposed,
 * matching the Destabilised Power Plant tier just above it — only the tightest margin (1
 * remaining) risks instant death on a bad roll.
 */
export function rollStressTable(
  state: GameState,
  unit: UnitState
): { unit: UnitState; state: GameState } {
  const missing = unit.maxStress - unit.stress
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
    return { unit: { ...unit, stress: 0 }, state: current } // Irreversible Meltdown
  }
  if (lowest >= 5) {
    return { unit: withStatus(unit, 'impaired', 2), state: current } // Emergency Shunt
  }
  if (lowest >= 2) {
    return { unit: withStatus(unit, 'exposed', 1), state: current } // Destabilised Power Plant
  }
  // Meltdown (lowest === 1)
  if (unit.stress === 1) {
    return { unit: { ...unit, stress: 0 }, state: current }
  }
  return { unit: withStatus(unit, 'exposed', 1), state: current }
}
