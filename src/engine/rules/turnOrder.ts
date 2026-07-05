import type { GameState, TeamId, UnitState } from '../state/types.ts'
import { decayStatuses, isAlive } from '../state/unit.ts'

function isReady(unit: UnitState, team: TeamId): boolean {
  return unit.team === team && !unit.hasActivated && isAlive(unit)
}

export function getActiveUnit(state: GameState): UnitState | undefined {
  if (state.activeUnitId) {
    const current = state.units.find((unit) => unit.id === state.activeUnitId)
    if (current && isReady(current, state.activeTeam)) return current
  }
  return state.units.find((unit) => isReady(unit, state.activeTeam))
}

function teamHasReadyUnit(state: GameState, team: TeamId): boolean {
  return state.units.some((unit) => isReady(unit, team))
}

function otherTeam(team: TeamId): TeamId {
  return team === 'player' ? 'enemy' : 'player'
}

/** Alternating activation: after a unit acts, priority passes to the other team if it still has units to act. */
export function advanceTurn(state: GameState): GameState {
  const nextTeam = otherTeam(state.activeTeam)

  if (teamHasReadyUnit(state, nextTeam)) {
    return { ...state, activeTeam: nextTeam, activeUnitId: undefined }
  }

  if (teamHasReadyUnit(state, state.activeTeam)) {
    return { ...state, activeUnitId: undefined }
  }

  const nextFirstTeam = otherTeam(state.firstTeamThisRound)
  return {
    ...state,
    round: state.round + 1,
    firstTeamThisRound: nextFirstTeam,
    activeTeam: nextFirstTeam,
    activeUnitId: undefined,
    units: state.units.map((unit) =>
      decayStatuses({ ...unit, hasActivated: false, quickActionsUsed: 0, overwatch: false })
    ),
  }
}
