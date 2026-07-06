import { chebyshevDistance } from '../map/grid.ts'
import { hasLineOfSight } from '../map/lineOfSight.ts'
import { TECH_RANGE } from '../combat/tech.ts'
import type { GameState, UnitState } from '../state/types.ts'
import { effectiveRange, isAlive } from '../state/unit.ts'

function inSight(state: GameState, from: UnitState, to: UnitState, range: number): boolean {
  return chebyshevDistance(from.pos, to.pos) <= range && hasLineOfSight(state.map, from.pos, to.pos)
}

export function attackableTargets(state: GameState, unit: UnitState): UnitState[] {
  return state.units.filter(
    (other) =>
      other.team !== unit.team &&
      isAlive(other) &&
      inSight(state, unit, other, effectiveRange(unit))
  )
}

export function techInvadeTargets(state: GameState, unit: UnitState): UnitState[] {
  return state.units.filter(
    (other) => other.team !== unit.team && isAlive(other) && inSight(state, unit, other, TECH_RANGE)
  )
}

export function techShieldTargets(state: GameState, unit: UnitState): UnitState[] {
  return state.units.filter(
    (other) => other.team === unit.team && isAlive(other) && inSight(state, unit, other, TECH_RANGE)
  )
}
