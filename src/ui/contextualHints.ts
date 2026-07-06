import type { Action } from '../engine/actions/types.ts'
import type { GameState, StatusType } from '../engine/state/types.ts'
import { createOverlayCard, createOverlayStack } from './overlayCard.ts'

interface HintDefinition {
  id: string
  title: string
  body: string
  trigger: (before: GameState, action: Action, after: GameState) => boolean
}

export const HINTS_STORAGE_KEY = 'lawncer.hintsShown'

/** True if any unit newly has `type` in `after` that it didn't have in `before` (either side). */
function newlyGainedStatus(before: GameState, after: GameState, type: StatusType): boolean {
  return after.units.some((unit) => {
    const prior = before.units.find((u) => u.id === unit.id)
    const had = prior?.statuses.some((s) => s.type === type) ?? false
    const has = unit.statuses.some((s) => s.type === type)
    return !had && has
  })
}

function ofType(type: Action['type']) {
  return (_before: GameState, action: Action) => action.type === type
}

const HINTS: HintDefinition[] = [
  {
    id: 'attack',
    title: 'Attacks',
    body: "An attack rolls a d20 against the target's Evasion (shown in the roster) — meet or beat it to hit; a natural 20 crits for double damage. Your weapon's Range and Damage are on the Attack button and roster card.",
    trigger: ofType('attack'),
  },
  {
    id: 'invade',
    title: 'Invade',
    body: "Invade rolls a d20 against the target's Evasion, just like an attack — but a hit floods their systems with heat instead of dealing damage.",
    trigger: ofType('techInvade'),
  },
  {
    id: 'shield',
    title: 'Shield',
    body: 'Shield reduces incoming damage by 1 for the target (an ally, or yourself) for a couple of rounds.',
    trigger: ofType('techShield'),
  },
  {
    id: 'overwatch',
    title: 'Overwatch',
    body: "Arms a free reaction attack against any enemy that starts moving from within your weapon's range — it punishes repositioning or retreating, not approaching.",
    trigger: ofType('overwatch'),
  },
  {
    id: 'systemReaction',
    title: 'System Reaction',
    body: "A second, independent reaction — doesn't share Overwatch/Brace's one-at-a-time slot. Each frame's is different: instead of a shot, it buffs the frame's signature stat for its next activation when an enemy starts moving from within your threat. Limited 2 — only 2 charges for the whole battle, not once per round.",
    trigger: ofType('systemReaction'),
  },
  {
    id: 'overcharge',
    title: 'Overcharge',
    body: 'A free extra quick action this turn, paid for in heat. Only once per activation — the cost escalates the more times you use it across the whole battle.',
    trigger: ofType('overcharge'),
  },
  {
    id: 'brace',
    title: 'Brace',
    body: 'Halves the next hit or Invade against you, but locks out your next activation almost entirely: no move, no Overcharge, no reactions, and only 1 quick action.',
    trigger: ofType('brace'),
  },
  {
    id: 'stabilize',
    title: 'Stabilize',
    body: 'A Full Action — your only move this turn. Clears Stunned/Impaired/Braced/Exposed and a disabled weapon, and vents half your heat.',
    trigger: ofType('stabilize'),
  },
  {
    id: 'lockOn',
    title: 'Lock On',
    body: 'Marks the target — the next attack against them, by anyone, gets an accuracy bonus, then the mark is used up.',
    trigger: ofType('lockOn'),
  },
  {
    id: 'status-stunned',
    title: 'Stunned',
    body: 'A unit knocked into Stunned only gets 1 quick action on its next activation — system shock from a solid hit.',
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'stunned'),
  },
  {
    id: 'status-impaired',
    title: 'Impaired',
    body: 'An Impaired unit deals 1 less weapon damage (minimum 1) — its heat overflowed and cost a Stress box.',
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'impaired'),
  },
  {
    id: 'status-shielded',
    title: 'Shielded',
    body: 'Shielded reduces incoming damage by 1 for a couple of rounds.',
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'shielded'),
  },
  {
    id: 'status-braced',
    title: 'Braced',
    body: 'This unit used Brace and took a halved hit. Anyone attacking it is at +1 difficulty until Braced wears off, but its own next activation is locked down: no move, no Overcharge, no reactions, and only 1 quick action.',
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'braced'),
  },
  {
    id: 'status-extendedRange',
    title: 'Extend Range',
    body: "Everest's System Reaction just fired — +1 weapon range for its next activation.",
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'extendedRange'),
  },
  {
    id: 'status-guarded',
    title: 'Guard',
    body: "Barbarossa's System Reaction just fired — +1 Evasion for its next activation.",
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'guarded'),
  },
  {
    id: 'status-boosted',
    title: 'Boost',
    body: "Wraith's System Reaction just fired — +1 move speed for its next activation.",
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'boosted'),
  },
  {
    id: 'status-entrenched',
    title: 'Entrench',
    body: "Sentinel's System Reaction just fired — +2 Evasion for its next activation (matches hard cover).",
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'entrenched'),
  },
  {
    id: 'status-exposed',
    title: 'Exposed',
    body: "Incoming weapon damage is doubled, and this doesn't wear off on its own — only Stabilize clears it.",
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'exposed'),
  },
  {
    id: 'status-lockedOn',
    title: 'Locked On',
    body: 'The next attacker against this unit gets an accuracy bonus, then the mark is used up.',
    trigger: (before, _action, after) => newlyGainedStatus(before, after, 'lockedOn'),
  },
  {
    id: 'weapon-disabled',
    title: 'Weapon Disabled',
    body: "A structural hit knocked out this unit's weapon (System Trauma) — it can't attack until Stabilize repairs it.",
    trigger: (before, _action, after) =>
      after.units.some((unit) => {
        const prior = before.units.find((u) => u.id === unit.id)
        return !!prior && !prior.weaponDisabled && unit.weaponDisabled
      }),
  },
]

/**
 * Pure evaluation, no DOM: which not-yet-shown hints newly trigger for this (before, action,
 * after) transition. Exported separately from `mountContextualHints` so the trigger logic can be
 * unit-tested without a DOM (this project's vitest environment is plain `node`, no jsdom — same
 * reason `combatLog.ts` only exports its pure `describeAction` for testing, not `mountCombatLog`).
 */
export function evaluateHints(
  before: GameState,
  action: Action,
  after: GameState,
  shown: ReadonlySet<string>
): { id: string; title: string; body: string }[] {
  return HINTS.filter((hint) => !shown.has(hint.id) && hint.trigger(before, action, after))
}

export interface ContextualHintsController {
  /** Call after every state change; shows any not-yet-seen hint whose trigger just became true. */
  notify(before: GameState, action: Action, after: GameState): void
  /** Clears every hint's "already shown" record so they can fire again (paired with a tutorial restart). */
  reset(): void
  /**
   * While paused (the linear tutorial overlay is on screen), newly-triggered hints are marked
   * shown but queued instead of displayed immediately — a player who tries Brace mid-tutorial
   * still gets the card once the tutorial closes, rather than losing that hint opportunity
   * forever. Unpausing flushes the queue.
   */
  setPaused(paused: boolean): void
}

function loadShown(): Set<string> {
  if (typeof localStorage === 'undefined') return new Set()
  try {
    const raw = localStorage.getItem(HINTS_STORAGE_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

export function mountContextualHints(root: HTMLElement): ContextualHintsController {
  const shown = loadShown()
  let paused = false
  let pending: { id: string; title: string; body: string }[] = []

  const stack = createOverlayStack(root)

  function persist() {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify([...shown]))
  }

  function show(hint: { id: string; title: string; body: string }) {
    const card = createOverlayCard(hint.title, hint.body, { onClose: () => card.remove() })
    stack.append(card)
  }

  return {
    notify(before, action, after) {
      for (const hint of evaluateHints(before, action, after, shown)) {
        shown.add(hint.id)
        persist()
        if (paused) pending.push(hint)
        else show(hint)
      }
    },
    reset() {
      shown.clear()
      pending = []
      persist()
    },
    setPaused(next) {
      const wasPaused = paused
      paused = next
      if (wasPaused && !next) {
        for (const hint of pending) show(hint)
        pending = []
      }
    },
  }
}
