import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../../scenarios/demo.ts'
import { getActiveUnit } from '../rules/turnOrder.ts'
import { isAlive } from '../state/unit.ts'
import type { GameState } from '../state/types.ts'
import { resolve } from './resolve.ts'
import { SWORD } from './weapons.ts'

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
    let state = resolve(createDemoScenario(), { type: 'overcharge', unitId: 'player-1' })
    expect(unit(state, 'player-1').overchargeCount).toBe(1)
    expect(unit(state, 'player-1').heat).toBe(1)
    expect(state.activeTeam).toBe('player')

    state = resolve(state, { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } })
    expect(state.activeTeam).toBe('player')
    state = resolve(state, { type: 'move', unitId: 'player-1', to: { x: 1, y: 4 } })
    expect(state.activeTeam).toBe('player') // without Overcharge this 2nd move would already hand off

    state = resolve(state, { type: 'move', unitId: 'player-1', to: { x: 1, y: 3 } })
    expect(state.activeTeam).toBe('enemy') // 3rd (Overcharge-granted) quick action now spent
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
    expect(target.hp).toBe(3) // Barbarossa's Shotgun deals 2; halved (floored) to 1
    expect(target.brace).toBe(false)
    expect(target.statuses).toEqual([{ type: 'braced', roundsRemaining: 2 }])
  })

  it('Brace halves incoming heat from techInvade, then leaves the unit Braced', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 }, brace: true })
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
    expect(mover.hp).toBe(3) // Sword deals 2; halved (floored) to 1
    expect(mover.brace).toBe(false)
    expect(mover.statuses).toEqual([{ type: 'braced', roundsRemaining: 2 }])
  })

  it('an unarmed Brace has no effect', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 2, y: 6 }, evasion: 0 })
    const after = resolve(state, { type: 'attack', unitId: 'player-2', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').hp).toBe(2) // full, un-halved Shotgun damage
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
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 }, evasion: 21 })
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

  it('Exposed doubles incoming weapon damage', () => {
    const state = withUnit(createDemoScenario(), 'enemy-1', {
      pos: { x: 1, y: 3 },
      evasion: 0,
      statuses: [{ type: 'exposed', roundsRemaining: 1 }],
    })
    const after = resolve(state, { type: 'attack', unitId: 'player-1', targetId: 'enemy-1' })
    expect(unit(after, 'enemy-1').hp).toBe(2) // Rifle's 1 damage doubled by Exposed
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
    expect(target.structure).toBe(2)
    expect(target.weaponDisabled).toBe(true)
  })

  it('a survived stress loss can roll Destabilised Power Plant, applying Exposed', () => {
    // techInvade doesn't roll to-hit, so the stress table's single d6 is the very first roll —
    // rngCalls 7 lands on 2, the Destabilised Power Plant tier.
    let state = withUnit(createDemoScenario(), 'enemy-1', { pos: { x: 1, y: 4 }, heat: 3 })
    state = { ...state, rngCalls: 7 }
    const after = resolve(state, { type: 'techInvade', unitId: 'player-1', targetId: 'enemy-1' })
    const target = unit(after, 'enemy-1')
    expect(target.stress).toBe(2)
    expect(target.statuses).toEqual([{ type: 'exposed', roundsRemaining: 1 }])
  })
})
