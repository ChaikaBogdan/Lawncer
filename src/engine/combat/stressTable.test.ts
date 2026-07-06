import { describe, expect, it } from 'vitest'
import type { GameState, UnitState } from '../state/types.ts'
import { rollStressTable } from './stressTable.ts'
import { RIFLE } from './weapons.ts'

// Same brute-forced rngCalls indices as structureTable.test.ts — die rolls are generic, only the
// table interpreting them differs.
const SEED = 'lawncer-demo-2'

function baseState(rngCalls: number): GameState {
  return {
    round: 1,
    activeTeam: 'player',
    firstTeamThisRound: 'player',
    units: [],
    map: { width: 5, height: 5, walls: [], cover: [] },
    rngSeed: SEED,
    rngCalls,
  }
}

function unit(overrides: Partial<UnitState> = {}): UnitState {
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
    stress: 2,
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

describe('rollStressTable', () => {
  it('Emergency Shunt (roll 5-6): applies Impaired', () => {
    const { unit: result } = rollStressTable(baseState(2), unit({ stress: 2, maxStress: 3 }))
    expect(result.statuses).toEqual([{ type: 'impaired', roundsRemaining: 2 }])
  })

  it('Destabilised Power Plant (roll 2-4): applies Exposed', () => {
    const { unit: result } = rollStressTable(baseState(7), unit({ stress: 2, maxStress: 3 }))
    expect(result.statuses).toEqual([{ type: 'exposed', roundsRemaining: 1 }])
  })

  it('Meltdown (roll 1) with 2+ stress remaining: also applies Exposed', () => {
    const { unit: result } = rollStressTable(baseState(15), unit({ stress: 2, maxStress: 3 }))
    expect(result.statuses).toEqual([{ type: 'exposed', roundsRemaining: 1 }])
    expect(result.stress).toBe(2)
  })

  it('Meltdown (roll 1) with only 1 stress remaining: destroys the unit outright', () => {
    const { unit: result } = rollStressTable(baseState(15), unit({ stress: 1, maxStress: 3 }))
    expect(result.stress).toBe(0)
  })

  it('Irreversible Meltdown (2+ dice show 1): destroys the unit regardless of remaining stress', () => {
    const { unit: result } = rollStressTable(baseState(76), unit({ stress: 2, maxStress: 4 }))
    expect(result.stress).toBe(0)
  })
})
