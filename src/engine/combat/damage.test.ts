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
    statuses: [],
    overwatch: false,
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

  it('leaves a surviving unit Stunned after a structure box is consumed', () => {
    const result = applyDamage(baseUnit({ hp: 1 }), 2)
    expect(result.statuses).toEqual([{ type: 'stunned', roundsRemaining: 2 }])
  })

  it('does not apply Stunned when the hit only depletes HP without consuming structure', () => {
    const result = applyDamage(baseUnit({ hp: 4 }), 1)
    expect(result.statuses).toEqual([])
  })

  it('does not apply Stunned to a unit destroyed outright', () => {
    const result = applyDamage(baseUnit({ hp: 1, structure: 1 }), 1)
    expect(result.statuses).toEqual([])
  })
})
