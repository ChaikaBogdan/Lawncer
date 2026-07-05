import type { Action } from '../actions/types.ts'
import { manhattanDistance, reachableTiles } from '../map/grid.ts'
import { attackableTargets, techInvadeTargets, techShieldTargets } from '../rules/targeting.ts'
import type { GameState, Position, UnitState } from '../state/types.ts'
import { hasStatus, isAlive } from '../state/unit.ts'

function closestBy<T>(items: T[], distanceTo: (item: T) => number): T {
  return items.reduce((closest, item) => (distanceTo(item) < distanceTo(closest) ? item : closest))
}

/**
 * Greedy single-step policy, in priority order: attack an in-range enemy; failing that,
 * Invade an enemy within tech range; failing that, Shield the most wounded unshielded ally
 * in range; failing that, close the distance to the nearest enemy; failing that (nothing
 * left to usefully do this activation), arm Overwatch so it still threatens a reaction shot.
 * Called once per quick action, so a full activation naturally chains actions
 * (e.g. move-then-attack, or Shield-then-attack) via repeated calls.
 */
export function chooseAiAction(state: GameState, unit: UnitState): Action {
  const attackTargets = attackableTargets(state, unit)
  if (attackTargets.length > 0) {
    const target = closestBy(attackTargets, (t) => manhattanDistance(unit.pos, t.pos))
    return { type: 'attack', unitId: unit.id, targetId: target.id }
  }

  const invadeTargets = techInvadeTargets(state, unit)
  if (invadeTargets.length > 0) {
    const target = closestBy(invadeTargets, (t) => manhattanDistance(unit.pos, t.pos))
    return { type: 'techInvade', unitId: unit.id, targetId: target.id }
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

  const nearestEnemy = closestBy(enemies, (e) => manhattanDistance(unit.pos, e.pos))
  const currentDistance = manhattanDistance(unit.pos, nearestEnemy.pos)

  const reachable = reachableTiles(state.map, state.units, unit.pos, unit.moveSpeed, unit.id)
  const best = reachable.reduce<{ pos: Position; distance: number } | undefined>((closest, pos) => {
    const distance = manhattanDistance(pos, nearestEnemy.pos)
    return !closest || distance < closest.distance ? { pos, distance } : closest
  }, undefined)

  if (best && best.distance < currentDistance) {
    return { type: 'move', unitId: unit.id, to: best.pos }
  }

  if (!unit.overwatch && unit.weapon.range > 0) {
    return { type: 'overwatch', unitId: unit.id }
  }

  return { type: 'endActivation', unitId: unit.id }
}
