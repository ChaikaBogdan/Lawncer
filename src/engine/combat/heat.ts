import type { UnitState } from '../state/types.ts'
import { withStatus } from '../state/unit.ts'

/**
 * Heat is risk pressure, not a spendable cost: it accumulates from acting, and
 * crossing the capacity vents it back to 0 while damaging stress instead.
 * Surviving a stress loss leaves the unit Impaired (reactor instability).
 */
export function applyHeat(unit: UnitState, amount: number): UnitState {
  const heat = unit.heat + amount

  if (heat >= unit.heatCap) {
    const stress = Math.max(unit.stress - 1, 0)
    const vented = { ...unit, heat: 0, stress }
    return stress > 0 ? withStatus(vented, 'impaired', 2) : vented
  }

  return { ...unit, heat }
}
