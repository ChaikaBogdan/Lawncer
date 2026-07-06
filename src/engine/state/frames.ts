import { RIFLE, SHOTGUN, SMART_RIFLE, SWORD } from '../combat/weapons.ts'
import type { AiBehavior, StatusType, Weapon } from './types.ts'

/** A reusable unit archetype: stat block + weapon + AI behavior, the way weapons.ts is to Weapon. */
export interface Frame {
  name: string
  maxHp: number
  maxStructure: number
  heatCap: number
  maxStress: number
  evasion: number
  moveSpeed: number
  armor: number
  weapon: Weapon
  aiBehavior: AiBehavior
  /**
   * A second, independent reaction slot (see `UnitState.systemReactionArmed`) — every frame gets
   * one distinctive self-buff, triggered the same way Overwatch is (an enemy starts moving from
   * within threat), applied to whoever armed it instead of firing a shot.
   */
  systemReactionStatus: StatusType
}

/**
 * Every frame shares Structure 4 / Stress 4 — tabletop LANCER fixes both at 4 regardless of
 * chassis; only HP/Armor/Evasion/Heat Cap/Speed vary by frame. HP is deliberately higher on the
 * two player frames than either enemy frame: Sentinel's Smart Rifle auto-hits, so without a
 * toughness edge it can grind a player unit down risk-free.
 */
const SHARED_STRUCTURE_AND_STRESS = { maxStructure: 4, maxStress: 4 }

/** Everest: the balanced generalist. System Reaction: Extend Range (+1 weapon range next activation). */
export const MIDLINE_FRAME: Frame = {
  name: 'Midline',
  maxHp: 6,
  ...SHARED_STRUCTURE_AND_STRESS,
  heatCap: 4,
  evasion: 8,
  moveSpeed: 3,
  armor: 0,
  weapon: RIFLE,
  aiBehavior: 'aggressive',
  systemReactionStatus: 'extendedRange',
}

/**
 * Barbarossa: close-range brawler — heaviest frame, bulkier and slower, leans on armor over
 * dodging. Armor capped at 1 (not 2): this engine's weapon damage is flat and compressed (2-3,
 * not tabletop's dice pools), so Armor 2 fully zeroed out both Rifle and Smart Rifle's 2 damage on
 * every non-crit hit — a hard counter rather than a reduction. System Reaction: Guard (+1 Evasion
 * next activation).
 */
export const BRAWLER_FRAME: Frame = {
  name: 'Brawler',
  maxHp: 8,
  ...SHARED_STRUCTURE_AND_STRESS,
  heatCap: 4,
  evasion: 6,
  moveSpeed: 2,
  armor: 1,
  weapon: SHOTGUN,
  aiBehavior: 'aggressive',
  systemReactionStatus: 'guarded',
}

/**
 * Wraith: fast, nimble melee — presses the attack, never backs off. Speed 3 (not 4) so it doesn't
 * coincide with common player weapons' Threat 4 and leap straight into melee without ever
 * satisfying Overwatch's "starts moving from within threat" trigger; Armor 1 (not 2, see
 * BRAWLER_FRAME's comment on why 2 is broken here) to compensate, since the actual risk this speed
 * cut creates is taking fire while closing distance more slowly, not raw durability. System
 * Reaction: Boost (+1 move speed next activation) directly offsets the cut, in exchange for
 * needing to bait it first.
 */
export const SWORDSMAN_FRAME: Frame = {
  name: 'Swordsman',
  maxHp: 5,
  ...SHARED_STRUCTURE_AND_STRESS,
  heatCap: 4,
  evasion: 9,
  moveSpeed: 3,
  armor: 1,
  weapon: SWORD,
  aiBehavior: 'aggressive',
  systemReactionStatus: 'boosted',
}

/**
 * Sentinel: hardest unit to pin down at range — leans entirely on Evasion to survive, no HP
 * cushion. System Reaction: Entrench (+2 Evasion next activation, matching hard cover's own
 * bonus) — reinforces the "impossible to pin down" identity.
 */
export const SNIPER_FRAME: Frame = {
  name: 'Sniper',
  maxHp: 4,
  ...SHARED_STRUCTURE_AND_STRESS,
  heatCap: 4,
  evasion: 10,
  moveSpeed: 3,
  armor: 0,
  weapon: SMART_RIFLE,
  aiBehavior: 'kiting',
  systemReactionStatus: 'entrenched',
}
