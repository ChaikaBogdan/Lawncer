import type { Weapon } from '../state/types.ts'

export const RIFLE: Weapon = { name: 'Rifle', range: 4, damage: 1, heat: 1 }
export const SHOTGUN: Weapon = { name: 'Shotgun', range: 2, damage: 2, heat: 1 }
/** Melee weapons run cold: no heat generated, but the attacker must close to point-blank range. */
export const SWORD: Weapon = { name: 'Sword', range: 1, damage: 2, heat: 0 }
