import { describe, expect, it } from 'vitest'
import { hasWeaponTag, RIFLE, SHOTGUN, SWORD } from './weapons.ts'

describe('hasWeaponTag', () => {
  it('is false for an untagged weapon', () => {
    expect(hasWeaponTag(RIFLE, 'smart')).toBe(false)
  })

  it('is true when the weapon carries the tag', () => {
    expect(hasWeaponTag(SHOTGUN, 'knockback')).toBe(true)
    expect(hasWeaponTag(SWORD, 'overkill')).toBe(true)
  })

  it('is false for a tag the weapon does not carry', () => {
    expect(hasWeaponTag(SHOTGUN, 'overkill')).toBe(false)
    expect(hasWeaponTag(SWORD, 'knockback')).toBe(false)
  })
})
