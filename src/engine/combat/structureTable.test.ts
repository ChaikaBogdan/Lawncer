import { describe, expect, it } from 'vitest'
import type { GameState, UnitState } from '../state/types.ts'
import { rollStructureTable } from './structureTable.ts'
import { RIFLE } from './weapons.ts'

// All rngCalls indices below were brute-forced against this exact seed/sides to land on a known
// die value — same approach as the existing "known crit roll" trick in resolve.test.ts.
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
    structure: 2,
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

describe('rollStructureTable', () => {
  it('Glancing Blow (roll 5-6): applies Impaired', () => {
    // Single d6 = 5 at rngCalls 2, one missing box (maxStructure 3, structure 2).
    const { unit: result } = rollStructureTable(
      baseState(2),
      unit({ structure: 2, maxStructure: 3 })
    )
    expect(result.statuses).toEqual([{ type: 'impaired', roundsRemaining: 2 }])
    expect(result.weaponDisabled).toBe(false)
  })

  it('System Trauma (roll 2-4): disables the weapon', () => {
    // Single d6 = 2 at rngCalls 7.
    const { unit: result } = rollStructureTable(
      baseState(7),
      unit({ structure: 2, maxStructure: 3 })
    )
    expect(result.weaponDisabled).toBe(true)
    expect(result.statuses).toEqual([])
  })

  it('Direct Hit (roll 1) with 2+ structure remaining: applies Stunned', () => {
    // Single d6 = 1 at rngCalls 15.
    const { unit: result } = rollStructureTable(
      baseState(15),
      unit({ structure: 2, maxStructure: 3 })
    )
    expect(result.statuses).toEqual([{ type: 'stunned', roundsRemaining: 2 }])
    expect(result.structure).toBe(2)
  })

  it('Direct Hit (roll 1) with only 1 structure remaining: destroys the unit outright', () => {
    const { unit: result } = rollStructureTable(
      baseState(15),
      unit({ structure: 1, maxStructure: 3 })
    )
    expect(result.structure).toBe(0)
  })

  it('Crushing Hit (2+ dice show 1): destroys the unit regardless of remaining structure', () => {
    // Two missing boxes both roll 1 at rngCalls 76-77; remaining structure (2) would normally
    // only be a Stunned-tier Direct Hit, but Crushing Hit overrides that.
    const { unit: result } = rollStructureTable(
      baseState(76),
      unit({ structure: 2, maxStructure: 4 })
    )
    expect(result.structure).toBe(0)
  })

  it('advances rngCalls by one roll per missing structure box', () => {
    const { state } = rollStructureTable(baseState(2), unit({ structure: 1, maxStructure: 4 }))
    expect(state.rngCalls).toBe(5) // 3 missing boxes -> 3 rolls
  })
})
