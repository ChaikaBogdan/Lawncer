import type { Weapon, WeaponTag } from '../state/types.ts'

export const RIFLE: Weapon = { name: 'Rifle', range: 4, damage: 2, heat: 1, tags: [], threat: 4 }
/** Smart-targeting rounds: this attack always hits, ignoring the target's Evasion roll. */
export const SMART_RIFLE: Weapon = {
  name: 'Smart Rifle',
  range: 4,
  damage: 2,
  heat: 1,
  tags: ['smart'],
  threat: 4,
}
/** Knockback: shoves its target back a tile on a landed hit. */
export const SHOTGUN: Weapon = {
  name: 'Shotgun',
  range: 2,
  damage: 3,
  heat: 1,
  tags: ['knockback'],
  threat: 2,
}
/**
 * Melee weapons run cold: no heat generated, but the attacker must close to point-blank range.
 * Overkill: a landed crit deals triple damage instead of double.
 */
export const SWORD: Weapon = {
  name: 'Sword',
  range: 1,
  damage: 3,
  heat: 0,
  tags: ['overkill'],
  threat: 1,
}

export function hasWeaponTag(weapon: Weapon, tag: WeaponTag): boolean {
  return weapon.tags.includes(tag)
}
