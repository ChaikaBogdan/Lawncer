import { describe, expect, it } from 'vitest'
import type { UnitState } from '../state/types.ts'
import { applyDamage } from './damage.ts'
import { RIFLE } from './weapons.ts'

function baseUnit(overrides: Partial<UnitState> = {}): UnitState {
  return {
    id: 'u1',
    team: 'player',
    name: 'u1',
    pos: { x: 0, y: 0 },
    moveSpeed: 3,
    hasActivated: false,
    hasMoved: false,
    quickActionsUsed: 0,
    hp: 4,
    maxHp: 4,
    structure: 3,
    maxStructure: 3,
    heat: 0,
    heatCap: 4,
    stress: 3,
    maxStress: 3,
    weapon: RIFLE,
    evasion: 8,
    armor: 0,
    aiBehavior: 'aggressive',
    systemReactionStatus: 'extendedRange',
    statuses: [],
    overwatch: false,
    systemReactionArmed: false,
    systemReactionUses: 0,
    brace: false,
    overchargeCount: 0,
    hasOvercharged: false,
    weaponDisabled: false,
    ...overrides,
  }
}

describe('applyDamage', () => {
  it('subtracts from HP without touching structure while HP stays positive', () => {
    const result = applyDamage(baseUnit({ hp: 4 }), 1)
    expect(result.hp).toBe(3)
    expect(result.structure).toBe(3)
  })

  it('consumes one structure box and refills HP when HP would drop to 0 or below', () => {
    const result = applyDamage(baseUnit({ hp: 1 }), 2)
    expect(result.hp).toBe(4)
    expect(result.structure).toBe(2)
  })

  it('leaves HP at 0 when the last structure box is consumed', () => {
    const result = applyDamage(baseUnit({ hp: 1, structure: 1 }), 1)
    expect(result.hp).toBe(0)
    expect(result.structure).toBe(0)
  })

  it('never consumes more than one structure box per hit, even with overkill damage', () => {
    const result = applyDamage(baseUnit({ hp: 4, structure: 3 }), 999)
    expect(result.structure).toBe(2)
    expect(result.hp).toBe(4)
  })

  it("does not touch statuses — narrative outcomes are the structure table orchestration's job", () => {
    const result = applyDamage(baseUnit({ hp: 1 }), 2)
    expect(result.statuses).toEqual([])
  })
})
