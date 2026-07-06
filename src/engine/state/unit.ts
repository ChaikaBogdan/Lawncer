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

/**
 * A system-shocked (stunned) or braced unit only gets 1 quick action instead of the usual
 * budget; Overcharge grants +1 on top of that base for each time it's been used this activation.
 */
export function quickActionBudget(unit: UnitState): number {
  const base =
    hasStatus(unit, 'stunned') || hasStatus(unit, 'braced') ? 1 : QUICK_ACTIONS_PER_ACTIVATION
  return base + unit.overchargeCount
}

/**
 * Consumes an armed Brace, leaving the unit Braced (reduced quick actions next activation) —
 * used by any incoming attack/Invade so the caller can halve the damage/heat it's about to apply.
 */
export function consumeBraceIfArmed(unit: UnitState): { unit: UnitState; halved: boolean } {
  if (!unit.brace) return { unit, halved: false }
  return { unit: withStatus({ ...unit, brace: false }, 'braced', 2), halved: true }
}

/** Reactor instability (impaired) blunts weapon damage, to a minimum of 1. */
export function effectiveWeaponDamage(unit: UnitState): number {
  return hasStatus(unit, 'impaired') ? Math.max(1, unit.weapon.damage - 1) : unit.weapon.damage
}

/**
 * Combines the attacker's Impaired penalty with the defender's Shielded reduction (floored at 0),
 * then doubles the result if the defender is Exposed (a Destabilised Power Plant stress-table
 * outcome — real rule doubles Kinetic/Energy/Explosive damage; we have no damage types, so it
 * doubles all weapon damage).
 */
export function effectiveDamageAgainst(attacker: UnitState, target: UnitState): number {
  const base = effectiveWeaponDamage(attacker)
  const shielded = hasStatus(target, 'shielded') ? Math.max(0, base - 1) : base
  return hasStatus(target, 'exposed') ? shielded * 2 : shielded
}

/**
 * Decrements every status's remaining duration except Exposed, which real rules describe as
 * lasting "until cleared" rather than decaying on its own — only Stabilize (a Full Action)
 * removes it, making it a deliberately dangerous, hard-to-shake status.
 */
export function decayStatuses(unit: UnitState): UnitState {
  const statuses = unit.statuses
    .map((status) =>
      status.type === 'exposed'
        ? status
        : { ...status, roundsRemaining: status.roundsRemaining - 1 }
    )
    .filter((status) => status.type === 'exposed' || status.roundsRemaining > 0)
  return { ...unit, statuses }
}
