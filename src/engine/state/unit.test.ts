import { describe, expect, it } from 'vitest'
import { RIFLE } from '../combat/weapons.ts'
import type { UnitState } from './types.ts'
import { decayStatuses, effectiveWeaponDamage, quickActionBudget, withStatus } from './unit.ts'

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

describe('withStatus', () => {
  it('replaces an existing status of the same type instead of stacking', () => {
    const withOne = withStatus(baseUnit(), 'stunned', 2)
    const withTwo = withStatus(withOne, 'stunned', 1)
    expect(withTwo.statuses).toEqual([{ type: 'stunned', roundsRemaining: 1 }])
  })
})

describe('quickActionBudget', () => {
  it('is 2 for an unaffected unit and 1 while stunned', () => {
    expect(quickActionBudget(baseUnit())).toBe(2)
    expect(quickActionBudget(withStatus(baseUnit(), 'stunned', 1))).toBe(1)
  })
})

describe('effectiveWeaponDamage', () => {
  it('is the base weapon damage normally, reduced by 1 (min 1) while impaired', () => {
    expect(effectiveWeaponDamage(baseUnit())).toBe(RIFLE.damage)
    const impaired = withStatus(baseUnit({ weapon: { ...RIFLE, damage: 1 } }), 'impaired', 1)
    expect(effectiveWeaponDamage(impaired)).toBe(1)
  })
})

describe('decayStatuses', () => {
  it('decrements roundsRemaining and drops statuses that reach 0', () => {
    const twoRoundsLeft = withStatus(baseUnit(), 'stunned', 2)
    const oneRoundLeft = decayStatuses(twoRoundsLeft)
    expect(oneRoundLeft.statuses).toEqual([{ type: 'stunned', roundsRemaining: 1 }])

    const expired = decayStatuses(oneRoundLeft)
    expect(expired.statuses).toEqual([])
  })

  it('never decays Exposed — only an explicit Stabilize clears it', () => {
    const exposed = withStatus(baseUnit(), 'exposed', 1)
    const afterManyRounds = decayStatuses(decayStatuses(decayStatuses(exposed)))
    expect(afterManyRounds.statuses).toEqual([{ type: 'exposed', roundsRemaining: 1 }])
  })
})
