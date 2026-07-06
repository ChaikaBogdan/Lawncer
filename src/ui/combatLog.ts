import type { Action } from '../engine/actions/types.ts'
import type { GameState } from '../engine/state/types.ts'
import { isAlive } from '../engine/state/unit.ts'

function unitName(state: GameState, id: string): string {
  return state.units.find((u) => u.id === id)?.name ?? id
}

function describeAttackResult(state: GameState): string {
  const result = state.lastAttack
  if (!result) return ''
  const outcome = result.hit ? (result.crit ? 'CRITICAL HIT' : 'HIT') : 'MISS'
  const damage = result.hit ? ` for ${result.damage} dmg` : ''
  return `rolled ${result.roll} vs Evasion ${result.evasion} — ${outcome}${damage}`
}

function describeDeaths(before: GameState, after: GameState): string {
  const died = after.units.filter((unit) => {
    const prior = before.units.find((u) => u.id === unit.id)
    return prior && isAlive(prior) && !isAlive(unit)
  })
  return died.map((unit) => ` 💀 ${unit.name} destroyed`).join('')
}

function describeBase(before: GameState, action: Action, after: GameState): string {
  const actorName = unitName(before, action.unitId)

  switch (action.type) {
    case 'move': {
      const moveLine = `🏃 ${actorName} moves to (${action.to.x}, ${action.to.y})`
      const reacted = before.lastAttack !== after.lastAttack && after.lastAttack
      if (reacted && after.lastAttack) {
        return `${moveLine} — ⚠️ ${unitName(after, after.lastAttack.attackerId)} reacts: ${describeAttackResult(after)}`
      }
      return moveLine
    }
    case 'attack':
      return `⚔️ ${actorName} attacks ${unitName(before, action.targetId)} — ${describeAttackResult(after)}`
    case 'techInvade':
      return `🛰️ ${actorName} invades ${unitName(before, action.targetId)} — reactor overload`
    case 'techShield':
      return `🛡️ ${actorName} shields ${unitName(before, action.targetId)}`
    case 'overwatch':
      return `👁️ ${actorName} arms Overwatch`
    case 'overcharge':
      return `🔥 ${actorName} overcharges the reactor`
    case 'brace':
      return `🛑 ${actorName} braces for impact`
    case 'stabilize':
      return `🔧 ${actorName} stabilizes`
    case 'lockOn':
      return `🎯 ${actorName} locks on to ${unitName(before, action.targetId)}`
    case 'endActivation':
      return `⏭️ ${actorName} ends activation`
  }
}

export function describeAction(before: GameState, action: Action, after: GameState): string {
  return describeBase(before, action, after) + describeDeaths(before, after)
}

export interface CombatLogController {
  record(before: GameState, action: Action, after: GameState): void
  clear(): void
}

export function mountCombatLog(root: HTMLElement): CombatLogController {
  const container = document.createElement('div')
  container.className = 'combat-log'

  const header = document.createElement('h4')
  header.textContent = 'Combat Log'

  const lines = document.createElement('div')

  container.append(header, lines)
  root.append(container)

  return {
    record(before, action, after) {
      const line = document.createElement('p')
      line.textContent = `Round ${after.round} — ${describeAction(before, action, after)}`
      lines.append(line)
      container.scrollTop = container.scrollHeight
    },
    clear() {
      lines.innerHTML = ''
    },
  }
}
