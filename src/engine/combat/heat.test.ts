import { describe, expect, it } from 'vitest'
import type { UnitState } from '../state/types.ts'
import { applyHeat } from './heat.ts'
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
    brace: false,
    overchargeCount: 0,
    weaponDisabled: false,
    ...overrides,
  }
}

describe('applyHeat', () => {
  it('accumulates heat below capacity without touching stress', () => {
    const result = applyHeat(baseUnit({ heat: 1 }), 2)
    expect(result.heat).toBe(3)
    expect(result.stress).toBe(3)
  })

  it('vents heat to 0 and costs a stress box once capacity is reached', () => {
    const result = applyHeat(baseUnit({ heat: 3, heatCap: 4 }), 1)
    expect(result.heat).toBe(0)
    expect(result.stress).toBe(2)
  })

  it("does not touch statuses — narrative outcomes are the stress table orchestration's job", () => {
    const result = applyHeat(baseUnit({ heat: 3, heatCap: 4 }), 1)
    expect(result.statuses).toEqual([])
  })

  it('destroys a unit whose last stress box is consumed', () => {
    const result = applyHeat(baseUnit({ heat: 3, heatCap: 4, stress: 1 }), 1)
    expect(result.stress).toBe(0)
  })
})
