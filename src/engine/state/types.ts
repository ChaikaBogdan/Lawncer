export type TeamId = 'player' | 'enemy'

export interface Position {
  x: number
  y: number
}

export interface Weapon {
  name: string
  range: number
  damage: number
  heat: number
}

export type StatusType =
  'stunned' | 'impaired' | 'shielded' | 'braced' | 'rattled' | 'exposed' | 'lockedOn'

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
  /** Quick actions spent so far this activation. An activation grants 2 (e.g. Move + Attack). */
  quickActionsUsed: number
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
  /** system malfunctions from taking structural/reactor damage (see applyDamage/applyHeat). */
  statuses: StatusEffect[]
  /** Armed via the Overwatch action; triggers a free reaction attack on an enemy moving into range/LOS. */
  overwatch: boolean
  /** Armed via the Brace action; halves the next incoming attack's damage/heat, then triggers Braced. */
  brace: boolean
  /** Times Overcharge has been used this activation; escalates its heat cost (see overcharge.ts) and grants +1 quick action each use. */
  overchargeCount: number
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
