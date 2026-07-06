export type TeamId = 'player' | 'enemy'

export interface Position {
  x: number
  y: number
}

export type WeaponTag = 'smart' | 'knockback' | 'overkill'

export interface Weapon {
  name: string
  range: number
  damage: number
  heat: number
  tags: WeaponTag[]
  /**
   * How far this weapon threatens for Overwatch/melee-modifier purposes — decoupled from `range`
   * (its actual attack distance) so a future reach weapon could threaten further than it can
   * actually strike from. Every current weapon sets this equal to its own `range`.
   */
  threat: number
}

export type StatusType =
  | 'stunned'
  | 'impaired'
  | 'shielded'
  | 'braced'
  | 'exposed'
  | 'lockedOn'
  | 'extendedRange'
  | 'guarded'
  | 'boosted'
  | 'entrenched'

/**
 * How the AI moves when nothing else is available this quick action: 'aggressive' closes distance
 * on the nearest enemy, 'kiting' opens it instead. Unused (but still set) on player-controlled
 * units, since chooseAiAction only ever drives the enemy team.
 */
export type AiBehavior = 'aggressive' | 'kiting'

export interface StatusEffect {
  type: StatusType
  /** Decremented once per round rollover; expires at 0. */
  roundsRemaining: number
}

export interface UnitState {
  id: string
  team: TeamId
  name: string
  pos: Position
  moveSpeed: number
  hasActivated: boolean
  /** Quick actions spent so far this activation. An activation grants 2 — Move doesn't count. */
  quickActionsUsed: number
  /** Whether this unit has used its one free Move this activation — decoupled from quickActionsUsed. */
  hasMoved: boolean
  /** Depletable HP pool. Hitting 0 consumes a structure box and refills (see applyDamage). */
  hp: number
  maxHp: number
  /** Attrition track from damage. Hitting 0 destroys the unit. */
  structure: number
  maxStructure: number
  /** Risk-pressure pool built up by acting. Overflowing it damages stress instead of being a spendable cost. */
  heat: number
  heatCap: number
  /** Attrition track from heat overflow (reactor meltdown). Hitting 0 destroys the unit. */
  stress: number
  maxStress: number
  weapon: Weapon
  /** Defense stat: an attack roll must meet or beat this to land. */
  evasion: number
  /** Flat damage reduction applied to each incoming hit (after crit doubling), floored at 0. */
  armor: number
  /** See AiBehavior. */
  aiBehavior: AiBehavior
  /** The status this unit's frame grants itself via SystemReaction — copied from Frame.systemReactionStatus at creation. */
  systemReactionStatus: StatusType
  /** system malfunctions from taking structural/reactor damage (see applyDamage/applyHeat). */
  statuses: StatusEffect[]
  /** Armed via the Overwatch action; triggers a free reaction attack on an enemy moving into range/LOS. */
  overwatch: boolean
  /** Armed via the Brace action; halves the next incoming attack's damage/heat, then triggers Braced. */
  brace: boolean
  /**
   * Armed via the SystemReaction action — a second, independent reaction slot (doesn't share
   * Overwatch/Brace's one-reaction-at-a-time cap). Triggers on the same "enemy starts moving from
   * within threat" condition as Overwatch, applying the unit's frame-specific buff status instead
   * of a reaction attack.
   */
  systemReactionArmed: boolean
  /**
   * Times System Reaction has been armed this scenario — Limited 2 (real LANCER's convention for
   * a system-granted bonus reaction: a fixed charge count per scene, not a per-round cooldown).
   * Persists across rounds — only a fresh scenario resets it.
   */
  systemReactionUses: number
  /** Times Overcharge has been used this scenario; escalates its heat cost (see overcharge.ts). Persists across rounds — only a fresh scenario resets it. */
  overchargeCount: number
  /** Whether this unit has already used Overcharge this activation — it's once-per-activation, and grants +1 quick action for this activation only. */
  hasOvercharged: boolean
  /** Set by a System Trauma structure-table result; blocks attacking until Stabilize clears it. */
  weaponDisabled: boolean
}

export interface MapState {
  width: number
  height: number
  walls: Position[]
  /** Soft cover terrain: doesn't block LOS or movement, grants a smaller to-hit penalty than a wall (hard cover) when adjacent to the defender. */
  cover: Position[]
}

export interface AttackResult {
  attackerId: string
  targetId: string
  roll: number
  evasion: number
  hit: boolean
  crit: boolean
  damage: number
}

export interface GameState {
  round: number
  activeTeam: TeamId
  firstTeamThisRound: TeamId
  /** Unit currently mid-activation (has spent 1 of its 2 quick actions), if any. */
  activeUnitId?: string
  units: UnitState[]
  map: MapState
  /** Seed for the deterministic RNG; combined with rngCalls so replay reproduces identical rolls. */
  rngSeed: string
  /** Number of random rolls consumed so far this game — advances the RNG stream one call at a time. */
  rngCalls: number
  /** Diagnostic record of the most recent attack roll, for UI display. Not gameplay-relevant. */
  lastAttack?: AttackResult
}

export const QUICK_ACTIONS_PER_ACTIVATION = 2
