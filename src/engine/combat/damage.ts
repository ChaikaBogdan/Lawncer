import type { UnitState } from '../state/types.ts'
import { withStatus } from '../state/unit.ts'

/**
 * Depletes HP; a hit that would take HP to 0 or below instead consumes one
 * structure box and refills HP (unless that was the last box, which destroys the unit).
 * A single hit can only consume one structure box, regardless of overkill damage.
 * Surviving a structure loss leaves the unit Stunned (system shock from the hit).
 */
export function applyDamage(unit: UnitState, amount: number): UnitState {
  let hp = unit.hp - amount
  let structure = unit.structure
  let structureLost = false

  if (hp <= 0 && structure > 0) {
    structure -= 1
    structureLost = true
    hp = structure > 0 ? unit.maxHp : 0
  }

  const damaged = { ...unit, hp: Math.max(hp, 0), structure }
  return structureLost && structure > 0 ? withStatus(damaged, 'stunned', 2) : damaged
}
