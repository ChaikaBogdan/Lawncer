import type {
  Action,
  AttackAction,
  BraceAction,
  EndActivationAction,
  LockOnAction,
  MoveAction,
  OverchargeAction,
  OverwatchAction,
  StabilizeAction,
  SystemReactionAction,
  TechInvadeAction,
  TechShieldAction,
} from '../actions/types.ts'
import { coverBonus } from '../map/cover.ts'
import { chebyshevDistance, knockbackDestination, reachableTiles } from '../map/grid.ts'
import { hasLineOfSight } from '../map/lineOfSight.ts'
import { ENGAGED_PENALTY, isEngaged } from '../rules/engagement.ts'
import { advanceTurn } from '../rules/turnOrder.ts'
import type { GameState, MapState, Position, UnitState, Weapon } from '../state/types.ts'
import {
  consumeBraceIfArmed,
  effectiveDamageAgainst,
  effectiveMoveSpeed,
  effectiveRange,
  hasStatus,
  isAlive,
  quickActionBudget,
  systemReactionEvasionBonus,
  withStatus,
} from '../state/unit.ts'
import { applyDamage } from './damage.ts'
import { rollD20 } from './dice.ts'
import { applyHeat } from './heat.ts'
import { rollOverchargeHeat } from './overcharge.ts'
import { rollStressTable } from './stressTable.ts'
import { rollStructureTable } from './structureTable.ts'
import { INVADE_HEAT, SHIELD_DURATION, TECH_RANGE } from './tech.ts'
import { hasWeaponTag } from './weapons.ts'

/**
 * Real rule: a Braced unit makes "all other attacks against you" harder by +1 difficulty until
 * Braced wears off — a defense bonus for the unit that braced, not a penalty on whoever hit them.
 */
const BRACED_DEFENSE_BONUS = 1
/** Accuracy bonus an attacker gets against a Locked On target — our first to-hit bonus rather than penalty. */
const LOCK_ON_BONUS = 1

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

/**
 * Only one reaction (Overwatch or Brace) can be armed at a time, and neither can be re-armed
 * while still Braced (real rule: no more reactions until the end of your next turn).
 */
function requireReactionAvailable(unit: UnitState): void {
  if (unit.overwatch) throw new Error(`Unit ${unit.id} already has Overwatch armed`)
  if (unit.brace) throw new Error(`Unit ${unit.id} already has Brace armed`)
  if (hasStatus(unit, 'braced')) {
    throw new Error(`Unit ${unit.id} is Braced and cannot arm another reaction yet`)
  }
}

/**
 * A Braced target's defense bonus and Locked On's bonus (for the attacker) both apply regardless
 * of range. Cover and Engaged only affect ranged attacks (threat > 1); melee ignores both per the
 * real rules. Keyed off `threat`, not `range` — a weapon's attack distance and its melee/reach
 * classification are separate concepts (see `Weapon.threat`).
 */
function attackDifficulty(state: GameState, attacker: UnitState, target: UnitState): number {
  const bracedDefense = hasStatus(target, 'braced') ? BRACED_DEFENSE_BONUS : 0
  const systemReaction = systemReactionEvasionBonus(target)
  const lockOn = hasStatus(target, 'lockedOn') ? LOCK_ON_BONUS : 0
  if (attacker.weapon.threat <= 1) return bracedDefense + systemReaction - lockOn
  const cover = coverBonus(state.map, attacker.pos, target.pos)
  const engaged = isEngaged(state, attacker) ? ENGAGED_PENALTY : 0
  return bracedDefense + systemReaction - lockOn + cover + engaged
}

/** Applies damage, then rolls the structure table if a box was lost and the unit survived. */
function damageAndRollStructureTable(
  state: GameState,
  unit: UnitState,
  amount: number
): { unit: UnitState; state: GameState } {
  const before = unit.structure
  const damaged = applyDamage(unit, amount)
  if (damaged.structure < before && isAlive(damaged)) {
    return rollStructureTable(state, damaged)
  }
  return { unit: damaged, state }
}

/** Applies heat, then rolls the stress table if a box was lost and the unit survived. */
function heatAndRollStressTable(
  state: GameState,
  unit: UnitState,
  amount: number
): { unit: UnitState; state: GameState } {
  const before = unit.stress
  const heated = applyHeat(unit, amount)
  if (heated.stress < before && isAlive(heated)) {
    return rollStressTable(state, heated)
  }
  return { unit: heated, state }
}

/**
 * A weapon attack roll: d20 meeting or beating the target's (modified) Evasion hits, unless the
 * weapon is Smart (always hits regardless of roll); a natural 20 also crits — double damage, or
 * triple for an Overkill weapon.
 */
function rollAttack(state: GameState, attacker: UnitState, target: UnitState) {
  const { roll, state: rolledState } = rollD20(state)
  const evasion = target.evasion + attackDifficulty(state, attacker, target)
  const hit = hasWeaponTag(attacker.weapon, 'smart') || roll >= evasion
  const crit = roll === 20
  const critMultiplier = crit ? (hasWeaponTag(attacker.weapon, 'overkill') ? 3 : 2) : 1
  const rawDamage = effectiveDamageAgainst(attacker, target) * critMultiplier
  const damage = hit ? Math.max(0, rawDamage - target.armor) : 0
  return {
    state: rolledState,
    result: {
      attackerId: attacker.id,
      targetId: target.id,
      roll,
      evasion,
      hit,
      crit,
      damage,
    },
  }
}

/**
 * Knockback: on a landed hit against a target that survived it, shove the target one tile
 * straight back along the attacker-target line — silently skipped if the destination is blocked
 * (wall, occupied, or out of bounds).
 */
function applyKnockbackIfHit(
  map: MapState,
  units: UnitState[],
  attackerWeapon: Weapon,
  attackerPos: Position,
  hit: boolean,
  target: UnitState
): UnitState {
  if (!hit || !isAlive(target) || !hasWeaponTag(attackerWeapon, 'knockback')) return target
  const dest = knockbackDestination(map, units, attackerPos, target.pos, target.id)
  return dest ? { ...target, pos: dest } : target
}

/** Shared by Overwatch and System Reaction: did this watcher just see the mover start moving from within its threat? */
function reactionTriggered(
  state: GameState,
  watcher: UnitState,
  mover: UnitState,
  fromPos: Position
): boolean {
  if (watcher.id === mover.id || !isAlive(watcher) || !isAlive(mover)) return false
  if (watcher.team === mover.team) return false
  if (chebyshevDistance(watcher.pos, fromPos) > watcher.weapon.threat) return false
  return hasLineOfSight(state.map, watcher.pos, fromPos)
}

/**
 * A watcher with System Reaction armed (an independent slot from Overwatch/Brace — see
 * `UnitState.systemReactionArmed`) grants itself its frame's buff status instead of a reaction
 * attack, then stands down. No attack roll, no heat — a pure self-buff.
 */
function applySystemReactionIfTriggered(
  state: GameState,
  watcher: UnitState,
  moverId: string,
  fromPos: Position
): GameState {
  const mover = state.units.find((u) => u.id === moverId)!
  if (!watcher.systemReactionArmed || !reactionTriggered(state, watcher, mover, fromPos)) {
    return state
  }
  const buffed = withStatus(
    { ...watcher, systemReactionArmed: false },
    watcher.systemReactionStatus,
    1
  )
  return { ...state, units: state.units.map((u) => (u.id === watcher.id ? buffed : u)) }
}

/**
 * Any enemy of the mover that is currently on Overwatch and could already see/reach the mover's
 * *starting* position fires a free reaction attack, then stands down — this punishes repositioning
 * or retreating out of a threatened zone, not approaching into one (real rule: the reaction
 * triggers on a hostile starting movement from within your threat, not on them entering it).
 * System Reaction (a separate, independent slot) checks the exact same trigger and can fire
 * alongside Overwatch off the same move.
 */
function applyOverwatchReactions(state: GameState, moverId: string, fromPos: Position): GameState {
  return state.units.reduce((current, watcherSnapshot) => {
    const withSystemReaction = applySystemReactionIfTriggered(
      current,
      current.units.find((u) => u.id === watcherSnapshot.id)!,
      moverId,
      fromPos
    )
    const watcher = withSystemReaction.units.find((u) => u.id === watcherSnapshot.id)!
    const mover = withSystemReaction.units.find((u) => u.id === moverId)!
    if (!watcher.overwatch || !reactionTriggered(withSystemReaction, watcher, mover, fromPos)) {
      return withSystemReaction
    }

    const { state: afterRoll, result } = rollAttack(withSystemReaction, watcher, mover)
    const { unit: watcherAfterHeat, state: afterWatcherHeat } = heatAndRollStressTable(
      afterRoll,
      watcher,
      watcher.weapon.heat
    )

    let currentState = afterWatcherHeat
    const finalWatcher = { ...watcherAfterHeat, overwatch: false }
    // Lock On is consumed by the next attack against the target, hit or miss.
    let moverUnit = currentState.units.find((u) => u.id === moverId)!
    moverUnit = { ...moverUnit, statuses: moverUnit.statuses.filter((s) => s.type !== 'lockedOn') }

    if (result.hit) {
      const { unit: braced, halved } = consumeBraceIfArmed(moverUnit)
      const dmg = halved ? Math.floor(result.damage / 2) : result.damage
      const { unit: damaged, state: afterDamage } = damageAndRollStructureTable(
        currentState,
        braced,
        dmg
      )
      moverUnit = damaged
      currentState = afterDamage
      moverUnit = applyKnockbackIfHit(
        currentState.map,
        currentState.units,
        watcher.weapon,
        watcher.pos,
        result.hit,
        moverUnit
      )
    }

    const units = currentState.units.map((u) => {
      if (u.id === watcher.id) return finalWatcher
      if (u.id === moverId) return moverUnit
      return u
    })

    return { ...currentState, units, lastAttack: result }
  }, state)
}

/**
 * Move is a free action (matches tabletop) — capped at one hop per activation, not a quick action.
 * A Braced unit skips its move entirely this activation (real rule: no actions of any type next
 * turn besides the one allotted Quick Action).
 */
function resolveMove(state: GameState, action: MoveAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  if (unit.hasMoved) {
    throw new Error(`Unit ${unit.id} has already moved this activation`)
  }
  if (hasStatus(unit, 'braced')) {
    throw new Error(`Unit ${unit.id} is Braced and cannot move this activation`)
  }

  const reachable = reachableTiles(
    state.map,
    state.units,
    unit.pos,
    effectiveMoveSpeed(unit),
    unit.id
  )
  if (!reachable.some((pos) => pos.x === action.to.x && pos.y === action.to.y)) {
    throw new Error(`Destination (${action.to.x}, ${action.to.y}) is not reachable`)
  }

  const movedUnits = state.units.map((u) =>
    u.id === unit.id ? { ...u, pos: action.to, hasMoved: true } : u
  )
  const reacted = applyOverwatchReactions({ ...state, units: movedUnits }, unit.id, unit.pos)

  return finishQuickAction(reacted, reacted.units, unit.id)
}

function resolveAttack(state: GameState, action: AttackAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  if (unit.weaponDisabled) {
    throw new Error(`Unit ${unit.id}'s weapon is disabled (System Trauma) until Stabilized`)
  }

  const target = state.units.find((u) => u.id === action.targetId)
  if (!target) throw new Error(`Unknown target: ${action.targetId}`)
  if (target.team === unit.team) throw new Error('Cannot attack your own team')
  if (!isAlive(target)) throw new Error(`Target ${target.id} is already destroyed`)
  if (chebyshevDistance(unit.pos, target.pos) > effectiveRange(unit)) {
    throw new Error(`Target ${target.id} is out of weapon range`)
  }
  if (!hasLineOfSight(state.map, unit.pos, target.pos)) {
    throw new Error(`No line of sight to target ${target.id}`)
  }

  const { state: afterRoll, result } = rollAttack(state, unit, target)
  const attackerSnapshot = afterRoll.units.find((u) => u.id === unit.id)!
  const { unit: attackerAfterHeat, state: afterAttackerHeat } = heatAndRollStressTable(
    afterRoll,
    { ...attackerSnapshot, quickActionsUsed: attackerSnapshot.quickActionsUsed + 1 },
    unit.weapon.heat
  )

  let currentState = afterAttackerHeat
  const finalAttacker = attackerAfterHeat
  // Lock On is consumed by the next attack against the target, hit or miss.
  let targetUnit = currentState.units.find((u) => u.id === target.id)!
  targetUnit = { ...targetUnit, statuses: targetUnit.statuses.filter((s) => s.type !== 'lockedOn') }

  if (result.hit) {
    const { unit: braced, halved } = consumeBraceIfArmed(targetUnit)
    const dmg = halved ? Math.floor(result.damage / 2) : result.damage
    const { unit: damaged, state: afterDamage } = damageAndRollStructureTable(
      currentState,
      braced,
      dmg
    )
    targetUnit = damaged
    currentState = afterDamage
    targetUnit = applyKnockbackIfHit(
      currentState.map,
      currentState.units,
      unit.weapon,
      unit.pos,
      result.hit,
      targetUnit
    )
  }

  const units = currentState.units.map((u) => {
    if (u.id === unit.id) return finalAttacker
    if (u.id === target.id) return targetUnit
    return u
  })

  return finishQuickAction({ ...currentState, units, lastAttack: result }, units, unit.id)
}

function requireTechTarget(state: GameState, unit: UnitState, targetId: string): UnitState {
  const target = state.units.find((u) => u.id === targetId)
  if (!target) throw new Error(`Unknown target: ${targetId}`)
  if (!isAlive(target)) throw new Error(`Target ${target.id} is already destroyed`)
  if (chebyshevDistance(unit.pos, target.pos) > TECH_RANGE) {
    throw new Error(`Target ${target.id} is out of tech range`)
  }
  if (!hasLineOfSight(state.map, unit.pos, target.pos)) {
    throw new Error(`No line of sight to target ${target.id}`)
  }
  return target
}

/**
 * Invade rolls like an attack — a d20 vs. the target's plain Evasion — but skips the
 * cover/Engaged/Braced-defense/Lock-On modifiers `attackDifficulty` applies to physical attacks,
 * since it's a systems intrusion rather than a shot that can be blocked or thrown off by
 * positioning. Never crits: real LANCER tech attacks can't critically hit at all (only ranged and
 * melee attack rolls can), so a natural 20 here is just a guaranteed hit for flat `INVADE_HEAT`.
 */
function resolveTechInvade(state: GameState, action: TechInvadeAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  const target = requireTechTarget(state, unit, action.targetId)
  if (target.team === unit.team) throw new Error('Cannot invade your own team')

  const { roll, state: rolledState } = rollD20(state)
  const hit = roll >= target.evasion
  const result = {
    attackerId: unit.id,
    targetId: target.id,
    roll,
    evasion: target.evasion,
    hit,
    crit: false,
    damage: 0,
  }

  let currentState = rolledState
  const finalAttacker = { ...unit, quickActionsUsed: unit.quickActionsUsed + 1 }
  // Invade doesn't clear Lock On: it skips attackDifficulty entirely (see the doc comment above)
  // so it never benefits from the bonus in the first place — burning a mark it doesn't use would
  // deny it to whichever ally's actual Attack could still capitalize on it.
  let targetUnit = currentState.units.find((u) => u.id === target.id)!

  if (hit) {
    const { unit: braced, halved } = consumeBraceIfArmed(targetUnit)
    const heatAmount = halved ? Math.floor(INVADE_HEAT / 2) : INVADE_HEAT
    const { unit: heated, state: afterHeat } = heatAndRollStressTable(
      currentState,
      braced,
      heatAmount
    )
    targetUnit = heated
    currentState = afterHeat
    result.damage = heatAmount
  }

  const units = currentState.units.map((u) => {
    if (u.id === unit.id) return finalAttacker
    if (u.id === target.id) return targetUnit
    return u
  })

  return finishQuickAction({ ...currentState, units, lastAttack: result }, units, unit.id)
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

/** Marks a target Locked On: their next attacker (any unit) gets an accuracy bonus, then it's consumed. */
function resolveLockOn(state: GameState, action: LockOnAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  const target = requireTechTarget(state, unit, action.targetId)
  if (target.team === unit.team) throw new Error('Cannot lock on to your own team')

  const units = state.units.map((u) => {
    if (u.id === unit.id) return { ...u, quickActionsUsed: u.quickActionsUsed + 1 }
    if (u.id === target.id) return withStatus(u, 'lockedOn', 1)
    return u
  })

  return finishQuickAction(state, units, unit.id)
}

function resolveOverwatch(state: GameState, action: OverwatchAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  requireReactionAvailable(unit)
  const units = state.units.map((u) =>
    u.id === unit.id ? { ...u, overwatch: true, quickActionsUsed: u.quickActionsUsed + 1 } : u
  )
  return finishQuickAction(state, units, unit.id)
}

/**
 * Arms a unit's frame-specific System Reaction — a second, independent reaction slot that doesn't
 * share Overwatch/Brace's one-at-a-time cap (see UnitState.systemReactionArmed), so no
 * requireReactionAvailable guard here. Limited 2 per scenario (real LANCER's convention for a
 * system-granted bonus reaction — a fixed charge count, not a per-round cooldown), tracked via
 * `systemReactionUses`, which persists across rounds same as Overcharge's own scene-wide counter.
 */
export const SYSTEM_REACTION_CHARGES = 2

function resolveSystemReaction(state: GameState, action: SystemReactionAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  if (unit.systemReactionArmed) {
    throw new Error(`Unit ${unit.id} already has its System Reaction armed`)
  }
  if (unit.systemReactionUses >= SYSTEM_REACTION_CHARGES) {
    throw new Error(`Unit ${unit.id} has no System Reaction charges left this scenario`)
  }
  const units = state.units.map((u) =>
    u.id === unit.id
      ? {
          ...u,
          systemReactionArmed: true,
          systemReactionUses: u.systemReactionUses + 1,
          quickActionsUsed: u.quickActionsUsed + 1,
        }
      : u
  )
  return finishQuickAction(state, units, unit.id)
}

/**
 * Free (no quick-action cost) reactor push: grants +1 quick action this activation only, once per
 * activation, at a heat cost that escalates the more times it's been used this whole scenario.
 */
function resolveOvercharge(state: GameState, action: OverchargeAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  if (unit.hasOvercharged) {
    throw new Error(`Unit ${unit.id} has already overcharged this activation`)
  }
  if (hasStatus(unit, 'braced')) {
    throw new Error(`Unit ${unit.id} is Braced and cannot Overcharge this activation`)
  }
  const { amount, state: afterRoll } = rollOverchargeHeat(state, unit.overchargeCount)
  const { unit: heated, state: afterHeat } = heatAndRollStressTable(
    afterRoll,
    { ...unit, overchargeCount: unit.overchargeCount + 1, hasOvercharged: true },
    amount
  )
  const units = afterHeat.units.map((u) => (u.id === unit.id ? heated : u))
  return finishQuickAction({ ...afterHeat, units }, units, unit.id)
}

function resolveBrace(state: GameState, action: BraceAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  requireReactionAvailable(unit)
  const units = state.units.map((u) =>
    u.id === unit.id ? { ...u, brace: true, quickActionsUsed: u.quickActionsUsed + 1 } : u
  )
  return finishQuickAction(state, units, unit.id)
}

/**
 * A Full Action: must be the unit's only action this activation (real rule's "Move + 2 Quick OR
 * 1 Full" — Full Actions can't be mixed with other quick actions). Clears Stunned/Impaired/Braced
 * and repairs a disabled weapon, vents half current heat, and is the *only* way to clear Exposed
 * (which otherwise never decays on its own — see decayStatuses), then ends the activation
 * outright by consuming the entire quick-action budget.
 */
function resolveStabilize(state: GameState, action: StabilizeAction): GameState {
  const unit = requireActingUnit(state, action.unitId)
  if (unit.quickActionsUsed !== 0) {
    throw new Error(`Unit ${unit.id} must Stabilize as their only action this activation`)
  }

  const units = state.units.map((u) => {
    if (u.id !== unit.id) return u
    const cleaned: UnitState = {
      ...u,
      statuses: u.statuses.filter(
        (s) =>
          s.type !== 'stunned' &&
          s.type !== 'impaired' &&
          s.type !== 'braced' &&
          s.type !== 'exposed'
      ),
      weaponDisabled: false,
      heat: Math.floor(u.heat / 2),
    }
    return { ...cleaned, quickActionsUsed: quickActionBudget(cleaned) }
  })

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
    case 'lockOn':
      return resolveLockOn(state, action)
    case 'overwatch':
      return resolveOverwatch(state, action)
    case 'systemReaction':
      return resolveSystemReaction(state, action)
    case 'overcharge':
      return resolveOvercharge(state, action)
    case 'brace':
      return resolveBrace(state, action)
    case 'stabilize':
      return resolveStabilize(state, action)
    case 'endActivation':
      return resolveEndActivation(state, action)
  }
}
