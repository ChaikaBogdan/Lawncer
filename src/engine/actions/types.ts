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

/** Arms a reaction: the next enemy to move into this unit's weapon range/LOS eats a free attack. */
export interface OverwatchAction {
  type: 'overwatch'
  unitId: string
}

export type Action =
  | MoveAction
  | AttackAction
  | EndActivationAction
  | TechInvadeAction
  | TechShieldAction
  | OverwatchAction
