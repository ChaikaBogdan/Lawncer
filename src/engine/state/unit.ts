import { QUICK_ACTIONS_PER_ACTIVATION, type StatusType, type UnitState } from './types.ts'

export function isAlive(unit: UnitState): boolean {
  return unit.structure > 0 && unit.stress > 0
}

export function hasStatus(unit: UnitState, type: StatusType): boolean {
  return unit.statuses.some((status) => status.type === type)
}

/** Replaces any existing status of the same type rather than stacking duplicates. */
export function withStatus(unit: UnitState, type: StatusType, roundsRemaining: number): UnitState {
  return {
    ...unit,
    statuses: [...unit.statuses.filter((s) => s.type !== type), { type, roundsRemaining }],
  }
}

/** A system-shocked (stunned) unit only gets 1 quick action instead of the usual budget. */
export function quickActionBudget(unit: UnitState): number {
  return hasStatus(unit, 'stunned') ? 1 : QUICK_ACTIONS_PER_ACTIVATION
}

/** Reactor instability (impaired) blunts weapon damage, to a minimum of 1. */
export function effectiveWeaponDamage(unit: UnitState): number {
  return hasStatus(unit, 'impaired') ? Math.max(1, unit.weapon.damage - 1) : unit.weapon.damage
}

/** Combines the attacker's Impaired penalty with the defender's Shielded reduction, floored at 0. */
export function effectiveDamageAgainst(attacker: UnitState, target: UnitState): number {
  const base = effectiveWeaponDamage(attacker)
  return hasStatus(target, 'shielded') ? Math.max(0, base - 1) : base
}

export function decayStatuses(unit: UnitState): UnitState {
  const statuses = unit.statuses
    .map((status) => ({ ...status, roundsRemaining: status.roundsRemaining - 1 }))
    .filter((status) => status.roundsRemaining > 0)
  return { ...unit, statuses }
}
