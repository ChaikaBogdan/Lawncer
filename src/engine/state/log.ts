import { resolve } from '../combat/resolve.ts'
import type { Action } from '../actions/types.ts'
import type { GameState } from './types.ts'

export interface LogEntry {
  action: Action
}

export type ActionLog = LogEntry[]

/** Deterministically rebuilds a GameState by replaying a log from an initial state. */
export function replay(initialState: GameState, log: ActionLog): GameState {
  return log.reduce((state, entry) => resolve(state, entry.action), initialState)
}
