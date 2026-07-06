import type { Position } from '../state/types.ts'

export interface MoveAction {
  type: 'move'
  unitId: string
  to: Position
}

export interface AttackAction {
  type: 'attack'
  unitId: string
  targetId: string
}

export interface EndActivationAction {
  type: 'endActivation'
  unitId: string
}

/** Hostile tech action: floods a target's systems with junk data, building their heat instead of dealing HP damage. */
export interface TechInvadeAction {
  type: 'techInvade'
  unitId: string
  targetId: string
}

/** Support tech action: raises an ally's (or the caster's own) defenses, reducing incoming damage for a while. */
export interface TechShieldAction {
  type: 'techShield'
  unitId: string
  targetId: string
}

/** Arms a reaction: the next enemy that starts moving from within this unit's weapon range/LOS eats a free attack. */
export interface OverwatchAction {
  type: 'overwatch'
  unitId: string
}

/** Pushes the reactor for a free extra quick action this activation, at an escalating heat cost. */
export interface OverchargeAction {
  type: 'overcharge'
  unitId: string
}

/** Arms a reaction: the next attack or Invade targeting this unit has its damage/heat halved. */
export interface BraceAction {
  type: 'brace'
  unitId: string
}

/** A Full Action: must be the unit's only action this activation. Clears debuffs, vents heat, ends the turn. */
export interface StabilizeAction {
  type: 'stabilize'
  unitId: string
}

/** Marks a target Locked On: the next attack against them (by anyone) gets an accuracy bonus, then it's consumed. */
export interface LockOnAction {
  type: 'lockOn'
  unitId: string
  targetId: string
}

export type Action =
  | MoveAction
  | AttackAction
  | EndActivationAction
  | TechInvadeAction
  | TechShieldAction
  | OverwatchAction
  | OverchargeAction
  | BraceAction
  | StabilizeAction
  | LockOnAction
