import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../../scenarios/demo.ts'
import type { GameState } from '../state/types.ts'
import { chooseAiAction } from './simpleAi.ts'

function withUnit(
  state: GameState,
  id: string,
  patch: Partial<GameState['units'][number]>
): GameState {
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }
}

describe('chooseAiAction', () => {
  it('overcharges first (free bonus action, safe heat) before attacking the nearest in-range enemy', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 } })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit)).toEqual({ type: 'overcharge', unitId: 'enemy-1' })
  })

  it('attacks the nearest in-range enemy over moving, once Overcharge is already spent', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      hasOvercharged: true,
    })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit)).toEqual({
      type: 'attack',
      unitId: 'enemy-1',
      targetId: 'player-1',
    })
  })

  it('moves toward the nearest enemy when nothing is in range', () => {
    const state = createDemoScenario()
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    const action = chooseAiAction(state, unit)
    expect(action.type).toBe('move')
  })

  it('ends its activation when it cannot get any closer and nothing is in range', () => {
    const state: GameState = {
      round: 1,
      activeTeam: 'enemy',
      firstTeamThisRound: 'enemy',
      rngSeed: 'test-seed',
      rngCalls: 0,
      map: { width: 5, height: 1, walls: [], cover: [] },
      units: [
        { ...createDemoScenario().units[0], id: 'p1', pos: { x: 0, y: 0 }, moveSpeed: 0 },
        {
          ...createDemoScenario().units[2],
          id: 'e1',
          team: 'enemy',
          pos: { x: 4, y: 0 },
          moveSpeed: 0,
          weapon: { ...createDemoScenario().units[2].weapon, range: 0 },
          // Already armed, same as Overwatch's own guard — isolates "truly nothing left to do".
          systemReactionArmed: true,
        },
      ],
    }
    const unit = state.units.find((u) => u.id === 'e1')!
    expect(chooseAiAction(state, unit)).toEqual({ type: 'endActivation', unitId: 'e1' })
  })

  it('arms its System Reaction when it cannot get any closer, nothing is in range, and Overwatch is already armed', () => {
    const state: GameState = {
      round: 1,
      activeTeam: 'enemy',
      firstTeamThisRound: 'enemy',
      rngSeed: 'test-seed',
      rngCalls: 0,
      map: { width: 5, height: 1, walls: [], cover: [] },
      units: [
        { ...createDemoScenario().units[0], id: 'p1', pos: { x: 0, y: 0 }, moveSpeed: 0 },
        {
          ...createDemoScenario().units[2],
          id: 'e1',
          team: 'enemy',
          pos: { x: 4, y: 0 },
          moveSpeed: 0,
          weapon: { ...createDemoScenario().units[2].weapon, range: 0 },
          overwatch: true,
        },
      ],
    }
    const unit = state.units.find((u) => u.id === 'e1')!
    expect(chooseAiAction(state, unit)).toEqual({ type: 'systemReaction', unitId: 'e1' })
  })

  it('locks on to an in-tech-range enemy (not yet marked) when no weapon attack is available', () => {
    // Wraith's Sword has range 1; place the enemy at distance 3 so only Invade/Lock On (tech
    // range 3) reach it. Overcharge is pre-spent to isolate this branch.
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 0, y: 0 } })
    state = withUnit(state, 'enemy-2', { pos: { x: 0, y: 3 }, hasOvercharged: true })
    const unit = state.units.find((u) => u.id === 'enemy-2')!
    expect(chooseAiAction(state, unit)).toEqual({
      type: 'lockOn',
      unitId: 'enemy-2',
      targetId: 'player-1',
    })
  })

  it('invades an in-tech-range enemy once it is already Locked On', () => {
    // Barbarossa moved out of tech range too, so player-1 (already marked) is the only
    // reachable target — isolates the "already Locked On, so Invade instead" branch.
    let state = withUnit(createDemoScenario(), 'player-1', {
      pos: { x: 0, y: 0 },
      statuses: [{ type: 'lockedOn', roundsRemaining: 1 }],
    })
    state = withUnit(state, 'player-2', { pos: { x: 10, y: 10 } })
    state = withUnit(state, 'enemy-2', { pos: { x: 0, y: 3 }, hasOvercharged: true })
    const unit = state.units.find((u) => u.id === 'enemy-2')!
    expect(chooseAiAction(state, unit)).toEqual({
      type: 'techInvade',
      unitId: 'enemy-2',
      targetId: 'player-1',
    })
  })

  it('stabilizes first when its weapon is disabled, instead of trying (and failing) to attack', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      weaponDisabled: true,
    })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit)).toEqual({ type: 'stabilize', unitId: 'enemy-1' })
  })

  it('stabilizes to clear Exposed even when it could otherwise attack', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      statuses: [{ type: 'exposed', roundsRemaining: 1 }],
    })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit)).toEqual({ type: 'stabilize', unitId: 'enemy-1' })
  })

  it('does not stabilize mid-activation (Full Action must be the first action)', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      weaponDisabled: true,
      quickActionsUsed: 1,
    })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit).type).not.toBe('stabilize')
  })

  it('braces instead of arming Overwatch when critically wounded', () => {
    const state: GameState = {
      round: 1,
      activeTeam: 'enemy',
      firstTeamThisRound: 'enemy',
      rngSeed: 'test-seed',
      rngCalls: 0,
      map: { width: 5, height: 1, walls: [], cover: [] },
      units: [
        { ...createDemoScenario().units[0], id: 'p1', pos: { x: 0, y: 0 }, moveSpeed: 0 },
        {
          ...createDemoScenario().units[2],
          id: 'e1',
          team: 'enemy',
          pos: { x: 4, y: 0 },
          moveSpeed: 0,
          weapon: { ...createDemoScenario().units[2].weapon, range: 0 },
          hp: 1,
          maxHp: 4,
          // Already shielded so self-Shield (a valid target per the real rule) doesn't preempt
          // the Brace branch this test isolates.
          statuses: [{ type: 'shielded', roundsRemaining: 1 }],
        },
      ],
    }
    const unit = state.units.find((u) => u.id === 'e1')!
    expect(chooseAiAction(state, unit)).toEqual({ type: 'brace', unitId: 'e1' })
  })

  it('shields the most wounded unshielded ally when no attack or invade target is available', () => {
    let state = createDemoScenario()
    // enemy-1 and enemy-2 adjacent, both far from any player unit (out of weapon and tech range of enemies).
    state = withUnit(state, 'enemy-1', { pos: { x: 0, y: 0 }, hp: 4 })
    state = withUnit(state, 'enemy-2', { pos: { x: 1, y: 0 }, hp: 1, moveSpeed: 0 })
    const unit = state.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(state, unit)).toEqual({
      type: 'techShield',
      unitId: 'enemy-1',
      targetId: 'enemy-2',
    })
  })

  it('ends its activation when there are no living enemies left', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { structure: 0 })
    const finalState = withUnit(state, 'player-2', { structure: 0 })
    const unit = finalState.units.find((u) => u.id === 'enemy-1')!
    expect(chooseAiAction(finalState, unit)).toEqual({ type: 'endActivation', unitId: 'enemy-1' })
  })

  it('a kiting unit moves to increase distance from the nearest enemy instead of closing in', () => {
    // Weapon range forced to 0 so only the movement fallback can fire — isolates the
    // aggressive-vs-kiting comparator direction from the attack-priority branch.
    const state: GameState = {
      round: 1,
      activeTeam: 'enemy',
      firstTeamThisRound: 'enemy',
      rngSeed: 'test-seed',
      rngCalls: 0,
      map: { width: 7, height: 1, walls: [], cover: [] },
      units: [
        { ...createDemoScenario().units[0], id: 'p1', pos: { x: 0, y: 0 }, moveSpeed: 0 },
        {
          ...createDemoScenario().units[2],
          id: 'sniper',
          team: 'enemy',
          pos: { x: 5, y: 0 },
          moveSpeed: 2,
          aiBehavior: 'kiting',
          // Range 0 blocks the attack priority; distance 5 is also beyond tech range (3), so only
          // the movement fallback can fire.
          weapon: { ...createDemoScenario().units[2].weapon, range: 0 },
        },
      ],
    }
    const unit = state.units.find((u) => u.id === 'sniper')!
    const action = chooseAiAction(state, unit)
    expect(action.type).toBe('move')
    if (action.type === 'move') {
      expect(action.to.x).toBeGreaterThan(5)
    }
  })

  it('does not try to move again once its one free move is already spent', () => {
    // Regression: chooseAiAction used to always retry the movement fallback regardless of
    // hasMoved, which threw in resolveMove and silently stalled the unit's whole turn forever.
    const state: GameState = {
      round: 1,
      activeTeam: 'enemy',
      firstTeamThisRound: 'enemy',
      rngSeed: 'test-seed',
      rngCalls: 0,
      map: { width: 7, height: 1, walls: [], cover: [] },
      units: [
        { ...createDemoScenario().units[0], id: 'p1', pos: { x: 0, y: 0 }, moveSpeed: 0 },
        {
          ...createDemoScenario().units[2],
          id: 'e1',
          team: 'enemy',
          pos: { x: 5, y: 0 },
          moveSpeed: 2,
          hasMoved: true,
          weapon: { ...createDemoScenario().units[2].weapon, range: 0 },
        },
      ],
    }
    const unit = state.units.find((u) => u.id === 'e1')!
    const action = chooseAiAction(state, unit)
    expect(action.type).not.toBe('move')
  })
})
