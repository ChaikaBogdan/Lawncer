import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../scenarios/demo.ts'
import { describeAction } from './combatLog.ts'

describe('describeAction', () => {
  it('describes a hit attack using the resulting lastAttack roll', () => {
    const before = createDemoScenario()
    const after = {
      ...before,
      lastAttack: {
        attackerId: 'player-1',
        targetId: 'enemy-1',
        roll: 14,
        evasion: 8,
        hit: true,
        crit: false,
        damage: 1,
      },
    }
    expect(
      describeAction(before, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' }, after)
    ).toBe('⚔️ Everest attacks Sentinel — rolled 14 vs Evasion 8 — HIT for 1 dmg')
  })

  it('describes a miss without a damage suffix', () => {
    const before = createDemoScenario()
    const after = {
      ...before,
      lastAttack: {
        attackerId: 'player-1',
        targetId: 'enemy-1',
        roll: 3,
        evasion: 8,
        hit: false,
        crit: false,
        damage: 0,
      },
    }
    expect(
      describeAction(before, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' }, after)
    ).toBe('⚔️ Everest attacks Sentinel — rolled 3 vs Evasion 8 — MISS')
  })

  it('appends a destroyed suffix when the action kills a unit', () => {
    const before = createDemoScenario()
    const after = {
      ...before,
      units: before.units.map((u) => (u.id === 'enemy-1' ? { ...u, structure: 0 } : u)),
      lastAttack: {
        attackerId: 'player-1',
        targetId: 'enemy-1',
        roll: 20,
        evasion: 8,
        hit: true,
        crit: true,
        damage: 6,
      },
    }
    expect(
      describeAction(before, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' }, after)
    ).toBe(
      '⚔️ Everest attacks Sentinel — rolled 20 vs Evasion 8 — CRITICAL HIT for 6 dmg 💀 Sentinel destroyed'
    )
  })

  it('describes a hit techInvade using the resulting lastAttack roll', () => {
    const before = createDemoScenario()
    const after = {
      ...before,
      lastAttack: {
        attackerId: 'player-1',
        targetId: 'enemy-1',
        roll: 14,
        evasion: 8,
        hit: true,
        crit: false,
        damage: 2,
      },
    }
    expect(
      describeAction(before, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' }, after)
    ).toBe('🛰️ Everest invades Sentinel — rolled 14 vs Evasion 8 — HIT for 2 heat')
  })

  it('describes a missed techInvade without a heat suffix', () => {
    const before = createDemoScenario()
    const after = {
      ...before,
      lastAttack: {
        attackerId: 'player-1',
        targetId: 'enemy-1',
        roll: 3,
        evasion: 8,
        hit: false,
        crit: false,
        damage: 0,
      },
    }
    expect(
      describeAction(before, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' }, after)
    ).toBe('🛰️ Everest invades Sentinel — rolled 3 vs Evasion 8 — MISS')
  })

  it('describes a plain move with no reaction', () => {
    const before = createDemoScenario()
    const after = { ...before }
    expect(
      describeAction(before, { type: 'move', unitId: 'player-1', to: { x: 1, y: 3 } }, after)
    ).toBe('🏃 Everest moves to (1, 3)')
  })
})
