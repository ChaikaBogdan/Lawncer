import type { UnitState } from '../state/types.ts'

/**
 * Depletes HP; a hit that would take HP to 0 or below instead consumes one
 * structure box and refills HP (unless that was the last box, which destroys the unit).
 * A single hit can only consume one structure box, regardless of overkill damage.
 * Pure hp/structure arithmetic only — what happens narratively when a unit survives a
 * structure-box loss is the escalating structure table's job (see structureTable.ts),
 * orchestrated by the caller so it can roll dice.
 */
export function applyDamage(unit: UnitState, amount: number): UnitState {
  let hp = unit.hp - amount
  let structure = unit.structure

  if (hp <= 0 && structure > 0) {
    structure -= 1
    hp = structure > 0 ? unit.maxHp : 0
  }

  return { ...unit, hp: Math.max(hp, 0), structure }
}
