import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../../scenarios/demo.ts'
import { getActiveUnit } from '../rules/turnOrder.ts'
import { isAlive } from '../state/unit.ts'
import type { GameState } from '../state/types.ts'
import { resolve } from './resolve.ts'
import { RIFLE, SWORD } from './weapons.ts'

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
  it('a free move consumes no quick action and does not end the activation', () => {
    const initial = createDemoScenario()

    const afterMove = resolve(initial, { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } })
    expect(getActiveUnit(afterMove)?.id).toBe('player-1')
    expect(afterMove.activeTeam).toBe('player')
    expect(unit(afterMove, 'player-1').quickActionsUsed).toBe(0)
    expect(unit(afterMove, 'player-1').hasMoved).toBe(true)

    const afterEnd = resolve(afterMove, { type: 'endActivation', unitId: 'player-1' })
    expect(afterEnd.activeTeam).toBe('enemy')
    expect(getActiveUnit(afterEnd)?.id).not.toBe('player-1')
  })

  it('rejects a second move in the same activation', () => {
    const initial = createDemoScenario()
    const afterMove = resolve(initial, { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } })
    expect(() =>
      resolve(afterMove, { type: 'move', unitId: 'player-1', to: { x: 1, y: 4 } })
    ).toThrow(/already moved/)
  })

  it('damages HP and builds heat on the attacker, then hands off after 2 quick actions', () => {
    // hp/maxHp bumped well above 2x Rifle damage so this stays a simple depletion demo, not a
    // structure-box consumption (see the dedicated structure-box tests below for that).
    let state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      evasion: 0,
      hp: 10,
      maxHp: 10,
    })
    state = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(state.activeTeam).toBe('player')
    expect(unit(state, 'enemy-1').hp).toBe(8)
    expect(unit(state, 'player-1').heat).toBe(1)

    state = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(state.activeTeam).toBe('enemy')
    expect(unit(state, 'enemy-1').hp).toBe(6)
  })

  it('consumes a structure box and refills HP once HP is depleted', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      hp: 1,
      evasion: 0,
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.structure).toBe(3)
    expect(target.hp).toBe(target.maxHp)
    expect(isAlive(target)).toBe(true)
  })

  it('destroys a unit whose last structure box is consumed', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      hp: 1,
      structure: 1,
      evasion: 0,
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
    expect(attacker.stress).toBe(3)
  })

  it('deals reduced damage while Impaired', () => {
    // Barbarossa's Shotgun does 3 damage normally; Impaired knocks that down by 1, to 2.
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 5, y: 6 }, evasion: 0 })
    state = withUnit(state, 'player-1', { hasActivated: true })
    state = withUnit(state, 'player-2', { statuses: [{ type: 'impaired', roundsRemaining: 1 }] })
    state = { ...state, activeUnitId: 'player-2' }
    state = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(unit(state, 'enemy-1').hp).toBe(2)
  })

  it('gives a Stunned unit only 1 quick action instead of 2', () => {
    const state = withUnit(createDemoScenario(), 'player-1', {
      statuses: [{ type: 'stunned', roundsRemaining: 1 }],
    })
    const after = resolve(state, { type: 'overwatch', unitId: 'player-1' })
    expect(after.activeTeam).toBe('enemy')
  })

  it('techInvade rolls to hit, then builds heat on the target instead of dealing HP damage', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 }, evasion: 0 })
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(true)
    expect(unit(after, 'enemy-1').heat).toBe(2)
    expect(unit(after, 'enemy-1').hp).toBe(4)
    expect(unit(after, 'player-1').quickActionsUsed).toBe(1)
  })

  it('techInvade builds no heat and deals no HP damage on a miss', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 }, evasion: 25 })
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(false)
    expect(unit(after, 'enemy-1').heat).toBe(0)
    expect(unit(after, 'enemy-1').hp).toBe(4)
  })

  it('a natural 20 on techInvade is just a guaranteed hit, not a crit — tech attacks cannot crit', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 4 },
      evasion: 0,
      heatCap: 10,
    })
    // Known crit roll for this seed at this call index (verified via rollD20 directly).
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, crit: false, hit: true, damage: 2 })
    expect(unit(after, 'enemy-1').heat).toBe(2)
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
    // Forced down to a 1-damage weapon so Shielded's -1 actually floors at 0 rather than just
    // reducing a bigger hit — demonstrating the floor, not the general reduction.
    let state = withUnit(createDemoScenario(), 'player-1', { weapon: { ...RIFLE, damage: 1 } })
    state = withUnit(state, 'enemy-1', { pos: { x: 1, y: 3 } })
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
    expect(mover.hp).toBe(2)
    expect(watcher.overwatch).toBe(false)
    expect(watcher.heat).toBe(1)
  })

  it("ends the mover's activation immediately if an overwatch reaction destroys it mid-move", () => {
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 1, y: 3 }, overwatch: true })
    state = withUnit(state, 'enemy-1', { pos: { x: 2, y: 1 }, hp: 1, structure: 1, evasion: 0 })
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
    // hp/maxHp bumped above 2x the crit damage so this stays a simple doubling demo, not a
    // structure-box consumption.
    let state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      hp: 10,
      maxHp: 10,
    })
    // Known crit roll for this seed at this call index (verified via rollD20 directly).
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, crit: true, hit: true, damage: 4 })
    expect(unit(after, 'enemy-1').hp).toBe(6)
  })

  it('armor reduces incoming damage', () => {
    // Rifle now deals 2; 2 armor floors the hit at exactly 0 rather than going negative.
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      armor: 2,
      evasion: 0,
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ hit: true, damage: 0 })
    expect(unit(after, 'enemy-1').hp).toBe(4)
  })

  it('armor reduces a crit after doubling, not before', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 }, armor: 1 })
    // Known crit roll for this seed at this call index (verified via rollD20 directly).
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    // Rifle's 2 damage doubled to 4 by the crit, then reduced by 1 armor to 3.
    expect(after.lastAttack).toMatchObject({ roll: 20, crit: true, hit: true, damage: 3 })
    expect(unit(after, 'enemy-1').hp).toBe(1)
  })

  it('a Smart weapon always hits, even against unbeatable evasion', () => {
    let state = withUnit(createDemoScenario(), 'player-1', {
      weapon: { ...RIFLE, tags: ['smart'] },
    })
    state = withUnit(state, 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 25 })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(true)
  })

  it('an Overkill crit deals triple damage instead of double', () => {
    // hp/maxHp bumped above 3x the Sword's damage so this stays a simple tripling demo, not a
    // structure-box consumption.
    let state = withUnit(createDemoScenario(), 'player-1', {
      pos: { x: 2, y: 6 },
      weapon: SWORD,
    })
    state = withUnit(state, 'enemy-1', { pos: { x: 2, y: 5 }, hp: 20, maxHp: 20 })
    // Known crit roll for this seed at this call index (verified via rollD20 directly).
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    // Sword's 3 damage tripled to 9 by Overkill's crit bonus.
    expect(after.lastAttack).toMatchObject({ roll: 20, crit: true, hit: true, damage: 9 })
    expect(unit(after, 'enemy-1').hp).toBe(11)
  })

  it('a Knockback hit pushes the target one tile straight back on open ground', () => {
    let state = withUnit(createDemoScenario(), 'player-2', { pos: { x: 6, y: 9 } })
    state = withUnit(state, 'enemy-1', {
      pos: { x: 6, y: 8 },
      evasion: 0,
      hp: 20,
      maxHp: 20,
    })
    state = { ...state, activeUnitId: 'player-2' }
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(true)
    expect(unit(after, 'enemy-1').pos).toEqual({ x: 6, y: 7 })
  })

  it('Knockback is silently skipped when the push destination is blocked', () => {
    // Demo map has a wall at (6,6); pushing enemy-1 north from (6,7) would land there.
    let state = withUnit(createDemoScenario(), 'player-2', { pos: { x: 6, y: 8 } })
    state = withUnit(state, 'enemy-1', {
      pos: { x: 6, y: 7 },
      evasion: 0,
      hp: 20,
      maxHp: 20,
    })
    state = { ...state, activeUnitId: 'player-2' }
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(true)
    expect(unit(after, 'enemy-1').pos).toEqual({ x: 6, y: 7 })
  })

  it('Knockback does not trigger on a miss', () => {
    let state = withUnit(createDemoScenario(), 'player-2', { pos: { x: 6, y: 9 } })
    state = withUnit(state, 'enemy-1', { pos: { x: 6, y: 8 }, evasion: 25 })
    state = { ...state, activeUnitId: 'player-2' }
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(false)
    expect(unit(after, 'enemy-1').pos).toEqual({ x: 6, y: 8 })
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

  it('a natural 20 hits an evasion-20 target with no obstruction in the way', () => {
    // Default player-1 position (1,6) -> (1,3) doesn't probe either of the demo map's cover tiles.
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 20 })
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, hit: true, evasion: 20 })
  })

  it('soft cover (map.cover tile) raises effective evasion enough to block that same natural 20', () => {
    // Demo map has soft cover at (2,4), which sits one step toward (2,6) from defender (1,3) —
    // adjacent to the defender, but off the direct attacker-defender line, so LOS is unaffected.
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 2, y: 6 } })
    state = withUnit(state, 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 20 })
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, hit: false, evasion: 21 })
  })

  it('hard cover (a wall) raises effective evasion even more, also blocking that natural 20', () => {
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 2, y: 6 } })
    state = withUnit(state, 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 20 })
    state = { ...state, map: { ...state.map, walls: [...state.map.walls, { x: 2, y: 4 }] } }
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, hit: false, evasion: 22 })
  })

  it('melee ignores cover entirely', () => {
    // Wall at (2,4) would grant hard cover for a ranged shot from (2,6); with a Sword (range 1)
    // the target has to be adjacent anyway, and the modifier is skipped regardless.
    let state = withUnit(createDemoScenario(), 'player-1', { pos: { x: 2, y: 6 }, weapon: SWORD })
    state = withUnit(state, 'enemy-1', { pos: { x: 2, y: 5 }, evasion: 20 })
    state = { ...state, map: { ...state.map, walls: [...state.map.walls, { x: 2, y: 4 }] } }
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, hit: true, evasion: 20 })
  })

  it('being Engaged (adjacent to a hostile) penalizes a ranged attack', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 3 }, evasion: 20 })
    // enemy-2 adjacent to player-1 (default pos (1,6)) engages the attacker, even though it isn't the target.
    state = withUnit(state, 'enemy-2', { pos: { x: 1, y: 5 } })
    state = { ...state, rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack).toMatchObject({ roll: 20, hit: false, evasion: 21 })
  })

  it('Engaged does not penalize a melee attack', () => {
    // enemy-2 (Wraith) ships with a Sword by default; attacking its adjacent target makes it
    // Engaged with that very unit, but melee ignores the penalty regardless.
    let state = withUnit(createDemoScenario(), 'enemy-2', { pos: { x: 3, y: 5 } })
    state = withUnit(state, 'player-2', { pos: { x: 3, y: 6 }, evasion: 20 })
    state = { ...state, activeTeam: 'enemy', rngCalls: 43 }
    const after = resolve(state, { type: 'attack', unitId: 'enemy-2', targetId: 'player-2' })
    expect(after.lastAttack).toMatchObject({ roll: 20, hit: true, evasion: 20 })
  })

  it('Overcharge is free (no quick-action cost) and grants a 3rd quick action this activation', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 } })
    state = resolve(state, { type: 'overcharge', unitId: 'player-1' })
    expect(unit(state, 'player-1').overchargeCount).toBe(1)
    expect(unit(state, 'player-1').heat).toBe(1)
    expect(state.activeTeam).toBe('player')

    // The free move doesn't touch the quick-action budget at all.
    state = resolve(state, { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } })
    expect(state.activeTeam).toBe('player')
    expect(unit(state, 'player-1').quickActionsUsed).toBe(0)

    state = resolve(state, { type: 'lockOn', unitId: 'player-1', targetId: 'enemy-1' })
    expect(state.activeTeam).toBe('player')
    state = resolve(state, { type: 'lockOn', unitId: 'player-1', targetId: 'enemy-1' })
    expect(state.activeTeam).toBe('player') // without Overcharge this 2nd quick action would already hand off

    state = resolve(state, { type: 'lockOn', unitId: 'player-1', targetId: 'enemy-1' })
    expect(state.activeTeam).toBe('enemy') // 3rd (Overcharge-granted) quick action now spent
  })

  it('rejects a second Overcharge in the same activation', () => {
    const state = resolve(createDemoScenario(), { type: 'overcharge', unitId: 'player-1' })
    expect(() => resolve(state, { type: 'overcharge', unitId: 'player-1' })).toThrow(
      /already overcharged/
    )
  })

  it("Overcharge's heat-cost tier persists across activations instead of resetting to flat 1", () => {
    // player-1 already overcharged once earlier this scenario (count 1) but not yet this fresh
    // activation (hasOvercharged false) — this use should roll the 2nd tier's 1d3 (consuming an
    // RNG call), not repeat the flat-1, no-roll first tier.
    const state = withUnit(createDemoScenario(), 'player-1', { overchargeCount: 1 })
    const after = resolve(state, { type: 'overcharge', unitId: 'player-1' })
    expect(unit(after, 'player-1').overchargeCount).toBe(2)
    expect(after.rngCalls).toBe(state.rngCalls + 1)
  })

  it('Overcharge heat that overflows can destroy the unit via stress, ending its activation immediately', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { heat: 3, stress: 1 })
    const after = resolve(state, { type: 'overcharge', unitId: 'player-1' })
    const acting = unit(after, 'player-1')
    expect(acting.stress).toBe(0)
    expect(acting.hasActivated).toBe(true)
    expect(after.activeTeam).toBe('enemy')
  })

  it('Brace halves incoming damage from a direct attack, then leaves the unit Braced', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 2, y: 6 },
      evasion: 0,
      brace: true,
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.hp).toBe(3) // Barbarossa's Shotgun deals 3; halved (floored) to 1
    expect(target.brace).toBe(false)
    expect(target.statuses).toEqual([{ type: 'braced', roundsRemaining: 2 }])
  })

  it('Brace halves incoming heat from techInvade, then leaves the unit Braced', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 4 },
      brace: true,
      evasion: 0,
    })
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.heat).toBe(1) // Invade deals 2 heat; halved (floored) to 1
    expect(target.brace).toBe(false)
    expect(target.statuses).toEqual([{ type: 'braced', roundsRemaining: 2 }])
  })

  it('Brace also halves damage from an Overwatch reaction shot', () => {
    // Sword's range is 1, so under the fixed (start-position) Overwatch trigger the mover must
    // *start* adjacent to the watcher — this models a melee reach threatening a disengage.
    let state = withUnit(createDemoScenario(), 'player-1', {
      pos: { x: 1, y: 3 },
      overwatch: true,
      weapon: SWORD,
    })
    state = withUnit(state, 'enemy-1', { pos: { x: 1, y: 4 }, evasion: 0, brace: true })
    state = { ...state, activeTeam: 'enemy' }

    const after = resolve(state, { type: 'move', unitId: 'enemy-1', to: { x: 1, y: 5 } })

    const mover = unit(after, 'enemy-1')
    expect(mover.hp).toBe(3) // Sword deals 3; halved (floored) to 1
    expect(mover.brace).toBe(false)
    expect(mover.statuses).toEqual([{ type: 'braced', roundsRemaining: 2 }])
  })

  it('an unarmed Brace has no effect', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 2, y: 6 }, evasion: 0 })
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').hp).toBe(1) // full, un-halved Shotgun damage (3)
  })

  it('cannot arm Overwatch while Brace is already armed', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { brace: true })
    expect(() => resolve(state, { type: 'overwatch', unitId: 'player-1' })).toThrow(
      /already has Brace armed/
    )
  })

  it('cannot arm Brace while Overwatch is already armed', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { overwatch: true })
    expect(() => resolve(state, { type: 'brace', unitId: 'player-1' })).toThrow(
      /already has Overwatch armed/
    )
  })

  it('cannot arm a reaction while still Braced', () => {
    const state = withUnit(createDemoScenario(), 'player-1', {
      statuses: [{ type: 'braced', roundsRemaining: 2 }],
    })
    expect(() => resolve(state, { type: 'overwatch', unitId: 'player-1' })).toThrow(/Braced/)
  })

  it('a Braced unit cannot move on its next activation', () => {
    const state = withUnit(createDemoScenario(), 'player-1', {
      statuses: [{ type: 'braced', roundsRemaining: 2 }],
    })
    expect(() => resolve(state, { type: 'move', unitId: 'player-1', to: { x: 2, y: 6 } })).toThrow(
      /Braced and cannot move/
    )
  })

  it('a Braced unit cannot Overcharge on its next activation', () => {
    const state = withUnit(createDemoScenario(), 'player-1', {
      statuses: [{ type: 'braced', roundsRemaining: 2 }],
    })
    expect(() => resolve(state, { type: 'overcharge', unitId: 'player-1' })).toThrow(
      /Braced and cannot Overcharge/
    )
  })

  it("Braced gives the braced unit's defenders a bonus (harder for anyone to hit them), not a penalty on whoever hit them", () => {
    // Distance 2, no cover, attacker not Engaged — isolates the Braced defense bonus alone.
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 5, y: 6 },
      statuses: [{ type: 'braced', roundsRemaining: 2 }],
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(after.lastAttack?.evasion).toBe(unit(after, 'enemy-1').evasion + 1)
    expect(unit(after, 'player-2').statuses).toEqual([])
  })

  it("Barbarossa's Guard System Reaction status adds +1 Evasion", () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 5, y: 6 },
      statuses: [{ type: 'guarded', roundsRemaining: 1 }],
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(after.lastAttack?.evasion).toBe(unit(after, 'enemy-1').evasion + 1)
  })

  it("Sentinel's Entrench System Reaction status adds +2 Evasion", () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 5, y: 6 },
      statuses: [{ type: 'entrenched', roundsRemaining: 1 }],
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(after.lastAttack?.evasion).toBe(unit(after, 'enemy-1').evasion + 2)
  })

  it("Everest's Extend Range System Reaction lets it attack 1 tile beyond its weapon's normal range", () => {
    const base = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 11 }, evasion: 0 })
    expect(() =>
      resolve(base, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    ).toThrow(/out of weapon range/)
    const extended = withUnit(base, 'player-1', {
      statuses: [{ type: 'extendedRange', roundsRemaining: 1 }],
    })
    const after = resolve(extended, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(true)
  })

  it('cannot re-arm System Reaction while already armed this activation', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { systemReactionArmed: true })
    expect(() => resolve(state, { type: 'systemReaction', unitId: 'player-1' })).toThrow(
      /already has its System Reaction armed/
    )
  })

  it('System Reaction is Limited 2 per scenario, not a per-round cooldown', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { systemReactionUses: 2 })
    expect(() => resolve(state, { type: 'systemReaction', unitId: 'player-1' })).toThrow(
      /no System Reaction charges left/
    )
  })

  it('arming System Reaction increments its scenario-wide use counter', () => {
    const after = resolve(createDemoScenario(), {
      type: 'systemReaction',
      unitId: 'player-1',
    })
    expect(unit(after, 'player-1').systemReactionUses).toBe(1)
  })

  it("System Reaction grants the watcher's frame-specific buff when an enemy starts moving from within threat, independent of Overwatch", () => {
    let state = withUnit(createDemoScenario(), 'player-1', {
      pos: { x: 1, y: 3 },
      systemReactionArmed: true,
    })
    state = withUnit(state, 'enemy-1', { pos: { x: 2, y: 1 }, evasion: 21 })
    state = { ...state, activeTeam: 'enemy' }

    const after = resolve(state, { type: 'move', unitId: 'enemy-1', to: { x: 2, y: 3 } })

    const watcher = unit(after, 'player-1')
    expect(watcher.systemReactionArmed).toBe(false)
    expect(watcher.statuses).toEqual([{ type: 'extendedRange', roundsRemaining: 2 }])
    // No attack rolled — evasion 21 would otherwise guarantee a miss and heat build from Overwatch.
    expect(watcher.heat).toBe(0)
  })

  it('both Overwatch and System Reaction fire off the same enemy move when a unit has both armed', () => {
    let state = withUnit(createDemoScenario(), 'player-1', {
      pos: { x: 1, y: 3 },
      overwatch: true,
      systemReactionArmed: true,
    })
    state = withUnit(state, 'enemy-1', { pos: { x: 2, y: 1 }, evasion: 0 })
    state = { ...state, activeTeam: 'enemy' }

    const after = resolve(state, { type: 'move', unitId: 'enemy-1', to: { x: 2, y: 3 } })

    const watcher = unit(after, 'player-1')
    const mover = unit(after, 'enemy-1')
    expect(watcher.overwatch).toBe(false)
    expect(watcher.systemReactionArmed).toBe(false)
    expect(watcher.statuses).toEqual([{ type: 'extendedRange', roundsRemaining: 2 }])
    expect(mover.hp).toBeLessThan(mover.maxHp) // Overwatch's reaction attack still landed
  })

  it('Stabilize clears Stunned/Impaired/Braced/Exposed/weaponDisabled, halves heat, and ends the activation', () => {
    const state = withUnit(createDemoScenario(), 'player-1', {
      statuses: [
        { type: 'stunned', roundsRemaining: 2 },
        { type: 'impaired', roundsRemaining: 2 },
        { type: 'braced', roundsRemaining: 2 },
        { type: 'exposed', roundsRemaining: 1 },
      ],
      weaponDisabled: true,
      heat: 3,
    })
    const after = resolve(state, { type: 'stabilize', unitId: 'player-1' })
    const self = unit(after, 'player-1')
    expect(self.statuses).toEqual([])
    expect(self.weaponDisabled).toBe(false)
    expect(self.heat).toBe(1)
    expect(after.activeTeam).toBe('enemy')
  })

  it('rejects Stabilize if the unit already spent a quick action this activation', () => {
    const state = resolve(createDemoScenario(), { type: 'overwatch', unitId: 'player-1' })
    expect(state.activeTeam).toBe('player') // overwatch used 1 of 2 quick actions, still mid-activation
    expect(() => resolve(state, { type: 'stabilize', unitId: 'player-1' })).toThrow(/only action/)
  })

  it('rejects attacking with a disabled weapon (System Trauma)', () => {
    const state = withUnit(createDemoScenario(), 'player-1', { weaponDisabled: true })
    expect(() =>
      resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    ).toThrow(/disabled/)
  })

  it('Lock On grants an accuracy bonus to the next attack against the target, then is consumed', () => {
    // hp/maxHp bumped so the crit below doesn't cross a structure-box boundary and roll an
    // unrelated structure-table status onto the target — this test is only about Lock On.
    let state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 4 },
      evasion: 21,
      hp: 10,
      maxHp: 10,
    })
    state = resolve(state, { type: 'lockOn', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(state, 'enemy-1').statuses).toEqual([{ type: 'lockedOn', roundsRemaining: 1 }])
    expect(state.activeTeam).toBe('player') // lockOn used 1 of 2 quick actions

    state = { ...state, rngCalls: 43 } // known roll-20 trick (see the crit test above)
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    // evasion 21 - Lock On's +1 bonus = 20; roll 20 hits exactly because of the bonus.
    expect(after.lastAttack).toMatchObject({ roll: 20, hit: true, evasion: 20 })
    expect(unit(after, 'enemy-1').statuses).toEqual([])
  })

  it('Lock On is consumed even if the attack misses', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 }, evasion: 25 })
    state = resolve(state, { type: 'lockOn', unitId: 'player-1', targetId: 'enemy-1' })
    // evasion 25 - 1 = 24, unbeatable by any roll — a guaranteed miss regardless of the bonus.
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(after.lastAttack?.hit).toBe(false)
    expect(unit(after, 'enemy-1').statuses).toEqual([])
  })

  it('Invade does not consume Lock On — it never applies the bonus in the first place, so it should not burn a mark an ally could still use', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 } })
    state = resolve(state, { type: 'lockOn', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(state, 'enemy-1').statuses).toEqual([{ type: 'lockedOn', roundsRemaining: 1 }])

    // Same unit's 2nd quick action this activation — mirrors how the AI actually chains these.
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').statuses).toEqual([{ type: 'lockedOn', roundsRemaining: 1 }])
  })

  it('Exposed doubles incoming weapon damage', () => {
    // hp/maxHp bumped above 2x the doubled damage so this stays a simple doubling demo, not a
    // structure-box consumption.
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      evasion: 0,
      hp: 10,
      maxHp: 10,
      statuses: [{ type: 'exposed', roundsRemaining: 1 }],
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').hp).toBe(6) // Rifle's 2 damage doubled by Exposed
  })

  it('a survived structure loss can roll System Trauma, disabling the target weapon', () => {
    let state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      hp: 1,
      evasion: 0,
    })
    // d20 at rngCalls 6 (irrelevant — evasion 0 always hits); structure table's single d6 at
    // rngCalls 7 rolls 2, landing in the System Trauma tier.
    state = { ...state, rngCalls: 6 }
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.structure).toBe(3)
    expect(target.weaponDisabled).toBe(true)
  })

  it('a survived stress loss can roll Destabilised Power Plant, applying Exposed', () => {
    // techInvade now rolls to hit first (rngCalls 6); evasion 0 guarantees the hit regardless of
    // that roll. The stress table's single d6 then falls at rngCalls 7, landing on 2 — the
    // Destabilised Power Plant tier.
    let state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 4 },
      heat: 3,
      evasion: 0,
    })
    state = { ...state, rngCalls: 6 }
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.stress).toBe(3)
    expect(target.statuses).toEqual([{ type: 'exposed', roundsRemaining: 1 }])
  })
})
