import type {
  Action,
  AttackAction,
  EndActivationAction,
  MoveAction,
  OverwatchAction,
  TechInvadeAction,
  TechShieldAction,
} from '../actions/types.ts'
import { manhattanDistance, reachableTiles } from '../map/grid.ts'
import { hasLineOfSight } from '../map/lineOfSight.ts'
import { advanceTurn } from '../rules/turnOrder.ts'
import type { GameState, UnitState } from '../state/types.ts'
import { effectiveDamageAgainst, isAlive, quickActionBudget, withStatus } from '../state/unit.ts'
import { applyDamage } from './damage.ts'
import { rollD20 } from './dice.ts'
import { applyHeat } from './heat.ts'
import { INVADE_HEAT, SHIELD_DURATION, TECH_RANGE } from './tech.ts'

function requireActingUnit(state: GameState, unitId: string): UnitState {
  const unit = state.units.find((u) => u.id === unitId)
  if (!unit) throw new Error(`Unknown unit: ${unitId}`)
  if (!isAlive(unit)) throw new Error(`Unit ${unit.id} is destroyed and cannot act`)
  if (unit.team !== state.activeTeam) throw new Error(`It is not ${unit.team}'s turn`)
  if (unit.hasActivated) throw new Error(`Unit ${unit.id} has already activated this round`)
  if (state.activeUnitId && state.activeUnitId !== unit.id) {
    throw new Error(`Unit ${state.activeUnitId} is still mid-activation`)
  }
  return unit
}

/**
 * Ends the acting unit's activation once it has spent both quick actions, otherwise keeps it active.
 * Also ends it immediately if the unit destroyed itself mid-action (own heat overflow, or an
 * Overwatch reaction while moving) — a corpse can't keep spending its remaining quick actions.
 */
function finishQuickAction(state: GameState, units: UnitState[], actingUnitId: string): GameState {
  const acting = units.find((u) => u.id === actingUnitId)!

  if (!isAlive(acting) || acting.quickActionsUsed >= quickActionBudget(acting)) {
    const finalUnits = units.map((u) => (u.id === actingUnitId ? { ...u, hasActivated: true } : u))
    return advanceTurn({ ...state, units: finalUnits, activeUnitId: undefined })
  }

  return { ...state, units, activeUnitId: actingUnitId }
}

/** A weapon attack roll: d20 meeting or beating the target's Evasion hits; a natural 20 also crits (double damage). */
function rollAttack(state: GameState, attacker: UnitState, target: UnitState) {
  const { roll, state: rolledState } = rollD20(state)
  const hit = roll >= target.evasion
  const crit = roll === 20
  const damage = hit ? effectiveDamageAgainst(attacker, target) * (crit ? 2 : 1) : 0
  return {
    state: rolledState,
    result: {
      attackerId: attacker.id,
      targetId: target.id,
      roll,
      evasion: target.evasion,
      hit,
      crit,
      damage,
    },
  }
}

/**
 * Any enemy of the mover that is currently on Overwatch and can see the mover's
 * new position within its weapon range fires a free reaction attack, then stands down.
 */
function applyOverwatchReactions(state: GameState, moverId: string): GameState {
  return state.units.reduce((current, watcherSnapshot) => {
    const watcher = current.units.find((u) => u.id === watcherSnapshot.id)!
    if (watcher.id === moverId || !watcher.overwatch || !isAlive(watcher)) return current

    const mover = current.units.find((u) => u.id === moverId)!
    if (watcher.team === mover.team || !isAlive(mover)) return current
    if (manhattanDistance(watcher.pos, mover.pos) > watcher.weapon.range) return current
    if (!hasLineOfSight(current.map, watcher.pos, mover.pos)) return current

    const { state: rolledState, result } = rollAttack(current, watcher, mover)
    const units = rolledState.units.map((u) => {
      if (u.id === watcher.id) return { ...applyHeat(u, watcher.weapon.heat), overwatch: false }
      if (u.id === moverId && result.hit) return applyDamage(u, result.damage)
      return u
    })

    return { ...rolledState, units, lastAttack: result }
  }, state)
}

function resolveMove(state: GameState, action: MoveAction): GameState {
  const unit = requireActingUnit(state, action.unitId)

  const reachable = reachableTiles(state.map, state.units, unit.pos, unit.moveSpeed, unit.id)
  if (!reachable.some((pos) => pos.x === action.to.x && pos.y === action.to.y)) {
    throw new Error(`Destination (${action.to.x}, ${action.to.y}) is not reachable`)
  }

  const movedUnits = state.units.map((u) =>
    u.id === unit.id ? { ...u, pos: action.to, quickActionsUsed: u.quickActionsUsed + 1 } : u
  )
  const reacted = applyOverwatchReactions({ ...state, units: movedUnits }, unit.id)

  return finishQuickAction(reacted, reacted.units, unit.id)
}

function resolveAttack(state: GameState, action: AttackAction): GameState {
  const unit = requireActingUnit(state, action.unitId)

  const target = state.units.find((u) => u.id === action.targetId)
  if (!target) throw new Error(`Unknown target: ${action.targetId}`)
  if (target.team === unit.team) throw new Error('Cannot attack your own team')
  if (!isAlive(target)) throw new Error(`Target ${target.id} is already destroyed`)
  if (manhattanDistance(unit.pos, target.pos) > unit.weapon.range) {
    throw new Error(`Target ${target.id} is out of weapon range`)
  }
  if (!hasLineOfSight(state.map, unit.pos, target.pos)) {
    throw new Error(`No line of sight to target ${target.id}`)
  }

  const { state: rolledState, result } = rollAttack(state, unit, target)
  const units = rolledState.units.map((u) => {
    if (u.id === unit.id)
      return applyHeat({ ...u, quickActionsUsed: u.quickActionsUsed + 1 }, unit.weapon.heat)
    if (u.id === target.id && result.hit) return applyDamage(u, result.damage)
    return u
  })

  return finishQuickAction({ ...rolledState, units, lastAttack: result }, units, unit.id)
}

function requireTechTarget(state: GameState, unit: UnitState, targetId: string): UnitState {
  const target = state.units.find((u) => u.id === targetId)
  if (!target) throw new Error(`Unknown target: ${targetId}`)
  if (!isAlive(target)) throw new Error(`Target ${target.id} is already destroyed`)
  if (manhattanDistance(unit.pos, target.pos) > TECH_RANGE) {
    throw new Error(`Target ${target.id} is out of tech range`)
  }
  if (!hasLineOfSight(state.map, unit.pos, target.pos)) {
    throw new Error(`No line of sight to target ${target.id}`)
  }
  return target
}

function resolveTechInvade(state: GameState, action: TechInvadeAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  const target = requireTechTarget(state, unit, action.targetId)
  if (target.team === unit.team) throw new Error('Cannot invade your own team')

  const units = state.units.map((u) => {
    if (u.id === unit.id) return { ...u, quickActionsUsed: u.quickActionsUsed + 1 }
    if (u.id === target.id) return applyHeat(u, INVADE_HEAT)
    return u
  })

  return finishQuickAction(state, units, unit.id)
}

function resolveTechShield(state: GameState, action: TechShieldAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  const target = requireTechTarget(state, unit, action.targetId)
  if (target.team !== unit.team) throw new Error('Can only shield an ally')

  const units = state.units.map((u) => {
    if (u.id !== unit.id && u.id !== target.id) return u
    let next = u
    if (u.id === unit.id) next = { ...next, quickActionsUsed: next.quickActionsUsed + 1 }
    if (u.id === target.id) next = withStatus(next, 'shielded', SHIELD_DURATION)
    return next
  })

  return finishQuickAction(state, units, unit.id)
}

function resolveOverwatch(state: GameState, action: OverwatchAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  const units = state.units.map((u) =>
    u.id === unit.id ? { ...u, overwatch: true, quickActionsUsed: u.quickActionsUsed + 1 } : u
  )
  return finishQuickAction(state, units, unit.id)
}

function resolveEndActivation(state: GameState, action: EndActivationAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  const units = state.units.map((u) => (u.id === unit.id ? { ...u, hasActivated: true } : u))
  return advanceTurn({ ...state, units, activeUnitId: undefined })
}

export function resolve(state: GameState, action: Action): GameState {
  switch (action.type) {
    case 'move':
      return resolveMove(state, action)
    case 'attack':
      return resolveAttack(state, action)
    case 'techInvade':
      return resolveTechInvade(state, action)
    case 'techShield':
      return resolveTechShield(state, action)
    case 'overwatch':
      return resolveOverwatch(state, action)
    case 'endActivation':
      return resolveEndActivation(state, action)
  }
}
