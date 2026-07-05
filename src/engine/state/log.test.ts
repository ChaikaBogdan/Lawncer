import { describe, expect, it } from 'vitest'
import { createDemoScenario } from '../../scenarios/demo.ts'
import { replay, type ActionLog } from './log.ts'

describe('replay', () => {
  it('deterministically reproduces the same state from the same log', () => {
    const initial = createDemoScenario()
    const log: ActionLog = [{ action: { type: 'move', unitId: 'player-1', to: { x: 1, y: 5 } } }]

    const first = replay(initial, log)
    const second = replay(initial, log)

    expect(first).toEqual(second)
    expect(first.units.find((u) => u.id === 'player-1')?.pos).toEqual({ x: 1, y: 5 })
  })
})
