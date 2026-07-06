import type { UnitState } from '../state/types.ts'

/**
 * Heat is risk pressure, not a spendable cost: it accumulates from acting, and
 * crossing the capacity vents it back to 0 while damaging stress instead.
 * Pure heat/stress arithmetic only — what happens narratively when a unit survives a
 * stress-box loss is the escalating stress table's job (see stressTable.ts), orchestrated
 * by the caller so it can roll dice.
 */
export function applyHeat(unit: UnitState, amount: number): UnitState {
  const heat = unit.heat + amount

  if (heat >= unit.heatCap) {
    const stress = Math.max(unit.stress - 1, 0)
    return { ...unit, heat: 0, stress }
  }

  return { ...unit, heat }
}
