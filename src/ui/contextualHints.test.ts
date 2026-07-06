import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../scenarios/demo.ts'
import type { GameState } from '../engine/state/types.ts'
import { evaluateHints } from './contextualHints.ts'

function withUnit(
  state: GameState,
  id: string,
  patch: Partial<GameState['units'][number]>
): GameState {
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }
}

function ids(hints: { id: string }[]): string[] {
  return hints.map((h) => h.id)
}

describe('evaluateHints', () => {
  it('fires the attack hint on the first attack action, regardless of who attacked whom', () => {
    const before = createDemoScenario()
    const after = before
    const hints = evaluateHints(
      before,
      { type: 'attack', unitId: 'enemy-1', targetId: 'player-1' },
      after,
      new Set()
    )
    expect(ids(hints)).toContain('attack')
  })

  it('does not re-fire a hint already in the shown set', () => {
    const before = createDemoScenario()
    const hints = evaluateHints(
      before,
      { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' },
      before,
      new Set(['attack'])
    )
    expect(ids(hints)).not.toContain('attack')
  })

  it('fires a status hint only when the status is newly gained, not already present', () => {
    const before = withUnit(createDemoScenario(), 'enemy-1', {
      statuses: [{ type: 'stunned', roundsRemaining: 2 }],
    })
    const after = before // status already present before this action too
    const hints = evaluateHints(
      before,
      { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' },
      after,
      new Set()
    )
    expect(ids(hints)).not.toContain('status-stunned')
  })

  it('fires a status hint when a unit newly gains it', () => {
    const before = createDemoScenario()
    const after = withUnit(before, 'enemy-1', {
      statuses: [{ type: 'stunned', roundsRemaining: 2 }],
    })
    const hints = evaluateHints(
      before,
      { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' },
      after,
      new Set()
    )
    expect(ids(hints)).toContain('status-stunned')
  })

  it('fires the weapon-disabled hint only on the false-to-true flip', () => {
    const before = createDemoScenario()
    const after = withUnit(before, 'enemy-1', { weaponDisabled: true })
    const hints = evaluateHints(
      before,
      { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' },
      after,
      new Set()
    )
    expect(ids(hints)).toContain('weapon-disabled')

    // Already disabled before this action too — should not re-fire.
    const alreadyDisabled = withUnit(createDemoScenario(), 'enemy-1', { weaponDisabled: true })
    const noChange = evaluateHints(
      alreadyDisabled,
      { type: 'attack', unitId: 'player-1', targetId: 'enemy-2' },
      alreadyDisabled,
      new Set()
    )
    expect(ids(noChange)).not.toContain('weapon-disabled')
  })

  it('can return multiple hints for a single transition (stacking)', () => {
    const before = createDemoScenario()
    const after = withUnit(before, 'enemy-1', {
      statuses: [{ type: 'stunned', roundsRemaining: 2 }],
      weaponDisabled: true,
    })
    const hints = evaluateHints(
      before,
      { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' },
      after,
      new Set()
    )
    expect(ids(hints)).toEqual(
      expect.arrayContaining(['attack', 'status-stunned', 'weapon-disabled'])
    )
    expect(hints.length).toBeGreaterThanOrEqual(3)
  })

  it('fires the invade hint on techInvade regardless of direction', () => {
    const before = createDemoScenario()
    const hints = evaluateHints(
      before,
      { type: 'techInvade', unitId: 'enemy-1', targetId: 'player-1' },
      before,
      new Set()
    )
    expect(ids(hints)).toContain('invade')
  })
})
