import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../../scenarios/demo.ts'
import { getActiveUnit } from '../rules/turnOrder.ts'
import { isAlive } from '../state/unit.ts'
import type { GameState } from '../state/types.ts'
import { resolve } from './resolve.ts'

function withUnit(
  state: GameState,
  id: string,
  patch: Partial<GameState['units'][number]>
): GameState {
  return { ...state, units: state.units.map((u) => (u.id === id ? { ...u, ...patch } : u)) }
}

function unit(state: GameState, id: string) {
  return state.units.find((u) => u.id === id)!
}

describe('resolve', () => {
  it('keeps the same unit active after its first quick action, then hands off after the second', () => {
    const initial = createDemoScenario()

    const afterMove = resolve(initial, { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } })
    expect(getActiveUnit(afterMove)?.id).toBe('player-1')
    expect(afterMove.activeTeam).toBe('player')

    const afterEnd = resolve(afterMove, { type: 'endActivation', unitId: 'player-1' })
    expect(afterEnd.activeTeam).toBe('enemy')
    expect(getActiveUnit(afterEnd)?.id).not.toBe('player-1')
  })

  it('damages HP and builds heat on the attacker, then hands off after 2 quick actions', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 0 })
    state = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(state.activeTeam).toBe('player')
    expect(unit(state, 'enemy-1').hp).toBe(3)
    expect(unit(state, 'player-1').heat).toBe(1)

    state = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(state.activeTeam).toBe('enemy')
    expect(unit(state, 'enemy-1').hp).toBe(2)
  })

  it('consumes a structure box and refills HP once HP is depleted', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 }, hp: 1 })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.structure).toBe(2)
    expect(target.hp).toBe(target.maxHp)
    expect(isAlive(target)).toBe(true)
  })

  it('destroys a unit whose last structure box is consumed', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      hp: 1,
      structure: 1,
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.structure).toBe(0)
    expect(isAlive(target)).toBe(false)
  })

  it('vents heat and costs a stress box once heat reaches capacity', () => {
    const state = withUnit(
      withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 } }),
      'player-1',
      {
        heat: 3,
      }
    )
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    const attacker = unit(after, 'player-1')
    expect(attacker.heat).toBe(0)
    expect(attacker.stress).toBe(2)
  })

  it('deals reduced damage while Impaired', () => {
    // Barbarossa's Shotgun does 2 damage normally; Impaired should knock that down to 1.
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 5, y: 6 }, evasion: 0 })
    state = withUnit(state, 'player-1', { hasActivated: true })
    state = withUnit(state, 'player-2', { statuses: [{ type: 'impaired', roundsRemaining: 1 }] })
    state = { ...state, activeUnitId: 'player-2' }
    state = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(unit(state, 'enemy-1').hp).toBe(3)
  })

  it('gives a Stunned unit only 1 quick action instead of 2', () => {
    let state = withUnit(createDemoScenario(), 'player-1', {
      statuses: [{ type: 'stunned', roundsRemaining: 1 }],
    })
    state = resolve(state, { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } })
    expect(state.activeTeam).toBe('enemy')
  })

  it('techInvade builds heat on the target instead of dealing HP damage', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 } })
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').heat).toBe(2)
    expect(unit(after, 'enemy-1').hp).toBe(4)
    expect(unit(after, 'player-1').quickActionsUsed).toBe(1)
  })

  it('rejects techInvade against your own team', () => {
    const state = createDemoScenario()
    expect(() =>
      resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'player-2' })
    ).toThrow(/own team/)
  })

  it('techShield grants an ally the Shielded status', () => {
    const after = resolve(createDemoScenario(), {
      type: 'techShield',
      unitId: 'player-1',
      targetId: 'player-2',
    })
    expect(unit(after, 'player-2').statuses).toEqual([{ type: 'shielded', roundsRemaining: 2 }])
  })

  it('techShield can target the caster itself, applying both effects to the same unit', () => {
    const after = resolve(createDemoScenario(), {
      type: 'techShield',
      unitId: 'player-1',
      targetId: 'player-1',
    })
    const self = unit(after, 'player-1')
    expect(self.statuses).toEqual([{ type: 'shielded', roundsRemaining: 2 }])
    expect(self.quickActionsUsed).toBe(1)
  })

  it('rejects techShield against an enemy', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 } })
    expect(() =>
      resolve(state, { type: 'techShield', unitId: 'player-1', targetId: 'enemy-1' })
    ).toThrow(/ally/)
  })

  it('Shielded reduces incoming damage, floored at 0', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 } })
    state = withUnit(state, 'enemy-1', { statuses: [{ type: 'shielded', roundsRemaining: 1 }] })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').hp).toBe(4)
  })

  it('overwatch fires a reaction attack when an enemy moves into range and LOS', () => {
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 1, y: 3 }, overwatch: true })
    state = withUnit(state, 'enemy-1', { pos: { x: 2, y: 1 }, evasion: 0 })
    state = { ...state, activeTeam: 'enemy' }

    const after = resolve(state, { type: 'move', unitId: 'enemy-1', to: { x: 2, y: 3 } })

    const mover = unit(after, 'enemy-1')
    const watcher = unit(after, 'player-1')
    expect(mover.pos).toEqual({ x: 2, y: 3 })
    expect(mover.hp).toBe(3)
    expect(watcher.overwatch).toBe(false)
    expect(watcher.heat).toBe(1)
  })

  it("ends the mover's activation immediately if an overwatch reaction destroys it mid-move", () => {
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 1, y: 3 }, overwatch: true })
    state = withUnit(state, 'enemy-1', { pos: { x: 2, y: 1 }, hp: 1, structure: 1 })
    state = { ...state, activeTeam: 'enemy' }

    const after = resolve(state, { type: 'move', unitId: 'enemy-1', to: { x: 2, y: 3 } })

    const mover = unit(after, 'enemy-1')
    expect(isAlive(mover)).toBe(false)
    expect(mover.hasActivated).toBe(true)
    expect(after.activeUnitId).toBeUndefined()
  })

  it('ends the activation immediately if the attacker destroys itself via its own heat overflow', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 } })
    // Rifle heat is 1; heat=3 + 1 hits heatCap(4), venting the attacker's last stress box.
    state = withUnit(state, 'player-1', { heat: 3, stress: 1 })

    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })

    const attacker = unit(after, 'player-1')
    expect(attacker.stress).toBe(0)
    expect(attacker.hasActivated).toBe(true)
    expect(after.activeTeam).toBe('enemy')
    expect(() => resolve(after, { type: 'endActivation', unitId: 'player-1' })).toThrow()
  })

  it('misses and deals no damage when evasion is unbeatable, but still builds heat', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 21 })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').hp).toBe(4)
    expect(unit(after, 'player-1').heat).toBe(1)
    expect(after.lastAttack).toMatchObject({ hit: false, crit: false, damage: 0 })
  })

  it('always hits when evasion is 0, regardless of the roll', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 0 })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(true)
  })

  it('a natural 20 crits for double damage', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 } })
    // Known crit roll for this seed at this call index (verified via rollD20 directly).
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, crit: true, hit: true, damage: 2 })
    expect(unit(after, 'enemy-1').hp).toBe(2)
  })

  it('rejects an attack beyond weapon range', () => {
    const state = createDemoScenario()
    expect(() =>
      resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    ).toThrow(/range/)
  })

  it('rejects an attack blocked by a wall, even within weapon range', () => {
    // Demo map has walls at (3,3), (3,4), (4,4); (2,3) -> (4,3) passes straight through (3,3).
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 2, y: 3 } })
    state = withUnit(state, 'enemy-1', { pos: { x: 4, y: 3 } })
    expect(() =>
      resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    ).toThrow(/line of sight/)
  })

  it('rejects acting with a unit other than the one mid-activation', () => {
    const initial = createDemoScenario()
    const afterMove = resolve(initial, { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } })
    expect(() => resolve(afterMove, { type: 'endActivation', unitId: 'player-2' })).toThrow(
      /mid-activation/
    )
  })
})
