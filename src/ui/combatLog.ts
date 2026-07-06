import type { Action } from '../engine/actions/types.ts'
import type { GameState } from '../engine/state/types.ts'
import { isAlive } from '../engine/state/unit.ts'
import { SYSTEM_REACTION_LABELS } from './roster.ts'

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

function describeInvadeResult(state: GameState): string {
  const result = state.lastAttack
  if (!result) return ''
  const outcome = result.hit ? (result.crit ? 'CRITICAL HIT' : 'HIT') : 'MISS'
  const heat = result.hit ? ` for ${result.damage} heat` : ''
  return `rolled ${result.roll} vs Evasion ${result.evasion} — ${outcome}${heat}`
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
    case 'attack': {
      const priorPos = before.units.find((u) => u.id === action.targetId)?.pos
      const newPos = after.units.find((u) => u.id === action.targetId)?.pos
      const knockedBack =
        priorPos && newPos && (priorPos.x !== newPos.x || priorPos.y !== newPos.y)
          ? ' — knocked back'
          : ''
      return `⚔️ ${actorName} attacks ${unitName(before, action.targetId)} — ${describeAttackResult(after)}${knockedBack}`
    }
    case 'techInvade':
      return `🛰️ ${actorName} invades ${unitName(before, action.targetId)} — ${describeInvadeResult(after)}`
    case 'techShield':
      return `🛡️ ${actorName} shields ${unitName(before, action.targetId)}`
    case 'overwatch':
      return `👁️ ${actorName} arms Overwatch`
    case 'systemReaction': {
      const acted = after.units.find((u) => u.id === action.unitId)
      const label = acted
        ? (SYSTEM_REACTION_LABELS[acted.systemReactionStatus] ?? 'System Reaction')
        : 'System Reaction'
      return `⚙️ ${actorName} arms ${label}`
    }
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
