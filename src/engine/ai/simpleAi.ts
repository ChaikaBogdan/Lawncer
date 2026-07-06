import type { Action } from '../actions/types.ts'
import { SYSTEM_REACTION_CHARGES } from '../combat/resolve.ts'
import { chebyshevDistance, reachableTiles } from '../map/grid.ts'
import { attackableTargets, techInvadeTargets, techShieldTargets } from '../rules/targeting.ts'
import type { AiBehavior, GameState, Position, UnitState } from '../state/types.ts'
import { effectiveMoveSpeed, hasStatus, isAlive } from '../state/unit.ts'

function closestBy<T>(items: T[], distanceTo: (item: T) => number): T {
  return items.reduce((closest, item) => (distanceTo(item) < distanceTo(closest) ? item : closest))
}

/** 'aggressive' wants a smaller distance to the nearest enemy; 'kiting' wants a bigger one. */
function isBetterDistance(behavior: AiBehavior, candidate: number, current: number): boolean {
  return behavior === 'kiting' ? candidate > current : candidate < current
}

/** Below this HP ratio, the AI prefers defense (Brace) over offense-adjacent reactions (Overwatch). */
const CRITICAL_HP_RATIO = 0.3
/** Only Overcharge if there's heat headroom to spare — avoids routinely cooking itself into Stress. */
const OVERCHARGE_SAFE_HEAT_RATIO = 0.5

/**
 * Greedy single-step policy, in priority order:
 * 1. Stabilize (Full Action, only legal as the unit's first action this activation) if its
 *    weapon is disabled (otherwise Attack would just throw) or it's Exposed (doubles incoming
 *    damage and never wears off on its own — the one status worth interrupting offense to clear).
 * 2. Overcharge — free (no quick-action cost, see resolveOvercharge) whenever there's something
 *    to spend the bonus action on and heat has headroom to spare.
 * 3. Attack an in-range enemy.
 * 4. Lock On an unmarked enemy in tech range (support fire when nothing's marked yet), otherwise
 *    Invade it.
 * 5. Shield the most wounded unshielded ally in range.
 * 6. Move toward the nearest enemy ('aggressive') or away from it ('kiting', see
 *    `unit.aiBehavior`).
 * 7. Arm a reaction: Brace if critically wounded, otherwise Overwatch — then its frame's System
 *    Reaction (an independent slot — see `resolveSystemReaction`), so it still threatens
 *    something on its way out.
 * Called once per quick action, so a full activation naturally chains actions (e.g.
 * move-then-attack, or Shield-then-attack) via repeated calls.
 */
export function chooseAiAction(state: GameState, unit: UnitState): Action {
  if (unit.quickActionsUsed === 0 && (unit.weaponDisabled || hasStatus(unit, 'exposed'))) {
    return { type: 'stabilize', unitId: unit.id }
  }

  const attackTargets = attackableTargets(state, unit)
  const invadeTargets = techInvadeTargets(state, unit)

  if (
    !unit.hasOvercharged &&
    !hasStatus(unit, 'braced') &&
    unit.heat < unit.heatCap * OVERCHARGE_SAFE_HEAT_RATIO &&
    (attackTargets.length > 0 || invadeTargets.length > 0)
  ) {
    return { type: 'overcharge', unitId: unit.id }
  }

  if (attackTargets.length > 0) {
    const target = closestBy(attackTargets, (t) => chebyshevDistance(unit.pos, t.pos))
    return { type: 'attack', unitId: unit.id, targetId: target.id }
  }

  if (invadeTargets.length > 0) {
    // Lock On is a one-shot mark, cleared only by an actual Attack against the target (Invade
    // never applies or consumes the bonus — see resolveTechInvade) — filtering to unmarked
    // targets means it naturally fires once per target, then falls through to repeated Invade
    // on later calls, without re-marking every time and wasting the slot on itself.
    const unmarked = invadeTargets.filter((t) => !hasStatus(t, 'lockedOn'))
    const pool = unmarked.length > 0 ? unmarked : invadeTargets
    const target = closestBy(pool, (t) => chebyshevDistance(unit.pos, t.pos))
    return unmarked.length > 0
      ? { type: 'lockOn', unitId: unit.id, targetId: target.id }
      : { type: 'techInvade', unitId: unit.id, targetId: target.id }
  }

  const shieldCandidates = techShieldTargets(state, unit).filter(
    (ally) => !hasStatus(ally, 'shielded') && ally.hp < ally.maxHp
  )
  if (shieldCandidates.length > 0) {
    const target = closestBy(shieldCandidates, (a) => a.hp / a.maxHp)
    return { type: 'techShield', unitId: unit.id, targetId: target.id }
  }

  const enemies = state.units.filter((u) => u.team !== unit.team && isAlive(u))
  if (enemies.length === 0) return { type: 'endActivation', unitId: unit.id }

  const nearestEnemy = closestBy(enemies, (e) => chebyshevDistance(unit.pos, e.pos))

  // Move is a once-per-activation free action (see resolveMove) — once it's spent, or while
  // Braced (real rule: no actions of any type next turn besides the one Quick Action), retrying
  // it would just throw and stall the unit's turn forever, so fall straight through to
  // Overwatch/end.
  if (!unit.hasMoved && !hasStatus(unit, 'braced')) {
    const currentDistance = chebyshevDistance(unit.pos, nearestEnemy.pos)
    const reachable = reachableTiles(
      state.map,
      state.units,
      unit.pos,
      effectiveMoveSpeed(unit),
      unit.id
    )
    const best = reachable.reduce<{ pos: Position; distance: number } | undefined>(
      (closest, pos) => {
        const distance = chebyshevDistance(pos, nearestEnemy.pos)
        return !closest || isBetterDistance(unit.aiBehavior, distance, closest.distance)
          ? { pos, distance }
          : closest
      },
      undefined
    )

    if (best && isBetterDistance(unit.aiBehavior, best.distance, currentDistance)) {
      return { type: 'move', unitId: unit.id, to: best.pos }
    }
  }

  // Only one reaction (Overwatch or Brace) can be armed at a time, and neither can be re-armed
  // while still Braced (see requireReactionAvailable) — mirror that guard here so a unit that's
  // already committed to one doesn't keep proposing the other and stalling on the thrown error.
  const reactionAvailable = !unit.overwatch && !unit.brace && !hasStatus(unit, 'braced')
  if (reactionAvailable) {
    const criticallyHurt = unit.hp / unit.maxHp < CRITICAL_HP_RATIO
    if (criticallyHurt) {
      return { type: 'brace', unitId: unit.id }
    }
    if (unit.weapon.range > 0) {
      return { type: 'overwatch', unitId: unit.id }
    }
  }

  // Limited 2 per scenario (see resolveSystemReaction) — once exhausted, retrying it would just
  // throw and stall the unit's turn forever, same reasoning as the hasMoved/Braced guard above.
  if (!unit.systemReactionArmed && unit.systemReactionUses < SYSTEM_REACTION_CHARGES) {
    return { type: 'systemReaction', unitId: unit.id }
  }

  return { type: 'endActivation', unitId: unit.id }
}
