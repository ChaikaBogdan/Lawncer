import { describe, expect, it } from 'vitest'
import { BRAWLER_FRAME, MIDLINE_FRAME, SNIPER_FRAME, SWORDSMAN_FRAME } from './frames.ts'

describe('frames', () => {
  it('every frame has a fixed 4/4 Structure/Stress cap, per real tabletop LANCER', () => {
    for (const frame of [MIDLINE_FRAME, BRAWLER_FRAME, SWORDSMAN_FRAME, SNIPER_FRAME]) {
      expect(frame.maxStructure).toBe(4)
      expect(frame.maxStress).toBe(4)
    }
  })

  it('each frame has its own distinct System Reaction status', () => {
    expect(MIDLINE_FRAME.systemReactionStatus).toBe('extendedRange')
    expect(BRAWLER_FRAME.systemReactionStatus).toBe('guarded')
    expect(SWORDSMAN_FRAME.systemReactionStatus).toBe('boosted')
    expect(SNIPER_FRAME.systemReactionStatus).toBe('entrenched')
  })

  it('Swordsman (Wraith) is Speed 3, not the old Speed 4', () => {
    expect(SWORDSMAN_FRAME.moveSpeed).toBe(3)
  })

  it("Barbarossa and Wraith cap Armor at 1, not 2 — 2 would zero out Rifle/Smart Rifle's 2 damage on every non-crit hit", () => {
    expect(BRAWLER_FRAME.armor).toBe(1)
    expect(SWORDSMAN_FRAME.armor).toBe(1)
  })
})
