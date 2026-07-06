import { chooseAiAction } from '../engine/ai/simpleAi.ts'
import { resolve, SYSTEM_REACTION_CHARGES } from '../engine/combat/resolve.ts'
import { TECH_RANGE } from '../engine/combat/tech.ts'
import { reachableTiles } from '../engine/map/grid.ts'
import {
  attackableTargets,
  techInvadeTargets,
  techShieldTargets,
} from '../engine/rules/targeting.ts'
import { getGameOutcome } from '../engine/rules/outcome.ts'
import { getActiveUnit } from '../engine/rules/turnOrder.ts'
import { replay, type ActionLog } from '../engine/state/log.ts'
import type { GameState, Position, UnitState } from '../engine/state/types.ts'
import {
  effectiveMoveSpeed,
  effectiveRange,
  hasStatus,
  isAlive,
  quickActionBudget,
} from '../engine/state/unit.ts'
import {
  CELL_SIZE,
  drawState,
  preloadSprites,
  type ActionArrowKind,
} from '../renderer/canvasRenderer.ts'
import { mountCombatLog } from './combatLog.ts'
import { mountContextualHints } from './contextualHints.ts'
import { createLegend } from './legend.ts'
import {
  describeUnit,
  renderRoster,
  SYSTEM_REACTION_DESCRIPTIONS,
  SYSTEM_REACTION_LABELS,
} from './roster.ts'
import { mountTooltip } from './tooltip.ts'
import { mountTutorial } from './tutorial.ts'

const AI_MOVE_DELAY_MS = 500
const MOVE_DURATION_MS = 260
const PROJECTILE_DURATION_MS = 320

type PendingAction = 'attack' | 'invade' | 'shield' | 'lockOn' | null
type HoveredAction =
  'attack' | 'overwatch' | 'systemReaction' | 'invade' | 'shield' | 'lockOn' | null

interface Projectile {
  from: Position
  to: Position
  kind: ActionArrowKind
  startedAt: number
}

function makeButton(label: string, action: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = label
  button.dataset.action = action
  return button
}

export function mountGame(root: HTMLElement, initialState: GameState): void {
  const initialSnapshot = structuredClone(initialState)
  let state = initialState
  let log: ActionLog = []
  let pendingAction: PendingAction = null
  let hoveredAction: HoveredAction = null
  let animationLock = false
  let hoveredTile: Position | null = null
  let lastHoveredUnit: UnitState | undefined
  let movingUnit: { id: string; pos: Position } | null = null
  let projectiles: Projectile[] = []
  let animLoopRunning = false
  // Bumped on Reset so in-flight rAF callbacks scheduled before it (slideUnit/fireProjectile
  // completions) recognize they're stale and skip committing against the just-reset state.
  let generation = 0

  const shell = document.createElement('div')
  shell.className = 'game-shell'

  const battlefieldColumn = document.createElement('div')
  battlefieldColumn.className = 'battlefield-column'

  const battlefieldStage = document.createElement('div')
  battlefieldStage.className = 'battlefield-stage'

  const canvas = document.createElement('canvas')
  canvas.width = state.map.width * CELL_SIZE
  canvas.height = state.map.height * CELL_SIZE
  canvas.className = 'battle-grid'
  // The stage/column are unstyled-width containers; size them here so they track the canvas's
  // actual pixel dimensions (which scale with the map) instead of a fixed 8x8-sized layout. The
  // column needs a hard pixel width, not fit-content — otherwise the legend's long unwrapped
  // labels (with nothing else constraining line width) stretch it wider than the canvas, which
  // then drags the actions column/roster off to the right and stretches the full-width combat log.
  battlefieldStage.style.width = `${canvas.width + 2}px`
  battlefieldStage.style.height = `${canvas.height + 2}px`
  battlefieldColumn.style.width = `${canvas.width + 2}px`

  const hitFlash = document.createElement('div')
  hitFlash.className = 'hit-flash'

  battlefieldStage.append(canvas, hitFlash)

  const status = document.createElement('p')
  status.className = 'battle-status'

  const gameOverBanner = document.createElement('p')
  gameOverBanner.className = 'game-over-banner'

  const controls = document.createElement('div')
  controls.className = 'controls'

  const attackButton = makeButton('⚔️ Attack', 'attack')
  const overwatchButton = makeButton('👁️ Overwatch', 'overwatch')
  const systemReactionButton = makeButton('⚙️ System Reaction', 'systemReaction')
  const overchargeButton = makeButton('🔥 Overcharge', 'overcharge')
  const braceButton = makeButton('🛑 Brace', 'brace')
  const stabilizeButton = makeButton('🔧 Stabilize', 'stabilize')
  const lockOnButton = makeButton('🎯 Lock On', 'lockOn')
  const invadeButton = makeButton('🛰️ Invade', 'invade')
  const shieldButton = makeButton('🛡️ Shield', 'shield')
  const endActivationButton = makeButton('⏭️ End activation', 'end-activation')

  const divider = document.createElement('div')
  divider.className = 'divider'

  const resetButton = makeButton('🔄 Reset scenario', 'reset')
  const tutorialButton = makeButton('🎓 Tutorial', 'tutorial')

  controls.append(
    attackButton,
    overwatchButton,
    systemReactionButton,
    overchargeButton,
    braceButton,
    stabilizeButton,
    lockOnButton,
    invadeButton,
    shieldButton,
    endActivationButton,
    divider,
    resetButton,
    tutorialButton
  )

  battlefieldColumn.append(battlefieldStage, status, gameOverBanner, createLegend())

  const roster = document.createElement('aside')
  roster.className = 'roster'

  shell.append(battlefieldColumn, controls, roster)

  root.append(shell)
  const combatLog = mountCombatLog(battlefieldColumn)
  const contextualHints = mountContextualHints(root)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context unavailable')

  const tutorial = mountTutorial(root, (visible) => contextualHints.setPaused(visible))
  const tooltip = mountTooltip(root)

  const buttonTooltip: Record<string, string> = {}
  tooltip.attach(attackButton, () => buttonTooltip.attack ?? '')
  tooltip.attach(overwatchButton, () => buttonTooltip.overwatch ?? '')
  tooltip.attach(systemReactionButton, () => buttonTooltip.systemReaction ?? '')
  tooltip.attach(overchargeButton, () => buttonTooltip.overcharge ?? '')
  tooltip.attach(braceButton, () => buttonTooltip.brace ?? '')
  tooltip.attach(stabilizeButton, () => buttonTooltip.stabilize ?? '')
  tooltip.attach(lockOnButton, () => buttonTooltip.lockOn ?? '')
  tooltip.attach(invadeButton, () => buttonTooltip.invade ?? '')
  tooltip.attach(shieldButton, () => buttonTooltip.shield ?? '')
  tooltip.attach(endActivationButton, () => 'Passes the rest of this activation’s quick actions.')
  tooltip.attach(resetButton, () => 'Restarts the scenario from its initial setup.')
  tooltip.attach(tutorialButton, () => 'Replays the onboarding walkthrough.')

  // Hovering a targeted-action button previews its range (and, for attack/invade/shield, arrows to valid targets).
  const withHoverPreview = (button: HTMLButtonElement, action: Exclude<HoveredAction, null>) => {
    button.addEventListener('mouseenter', () => {
      hoveredAction = action
      render()
    })
    button.addEventListener('mouseleave', () => {
      hoveredAction = null
      render()
    })
  }

  function actionRange(
    action: Exclude<HoveredAction, null>,
    activeUnit: NonNullable<ReturnType<typeof getActiveUnit>>
  ): number {
    return action === 'invade' || action === 'shield' || action === 'lockOn'
      ? TECH_RANGE
      : effectiveRange(activeUnit)
  }

  const render = () => {
    const outcome = getGameOutcome(state)
    const activeUnit = outcome === 'ongoing' ? getActiveUnit(state) : undefined
    if (!activeUnit || activeUnit.team !== 'player') pendingAction = null

    if (outcome !== 'ongoing') {
      gameOverBanner.textContent =
        outcome === 'playerWins'
          ? '🎉 Victory — all enemies destroyed!'
          : '💀 Defeat — your mech team was wiped out.'
      gameOverBanner.dataset.outcome = outcome
    } else {
      gameOverBanner.textContent = ''
      delete gameOverBanner.dataset.outcome
    }

    // While something is mid-animation, hide decision overlays — nothing to decide until it settles.
    const isAnimating = !!movingUnit || projectiles.length > 0

    const reachable =
      activeUnit && !isAnimating && !activeUnit.hasMoved && !hasStatus(activeUnit, 'braced')
        ? reachableTiles(
            state.map,
            state.units,
            activeUnit.pos,
            activeUnit.moveSpeed,
            activeUnit.id
          )
        : []
    const attackable = activeUnit && !isAnimating ? attackableTargets(state, activeUnit) : []
    // Computed unconditionally (not just while Invade/Lock On is armed) so the buttons can be
    // disabled when nothing is in tech range yet — same reasoning as Attack below.
    const invadeable = activeUnit && !isAnimating ? techInvadeTargets(state, activeUnit) : []
    const techTargets =
      !activeUnit || isAnimating
        ? []
        : pendingAction === 'invade' || pendingAction === 'lockOn'
          ? techInvadeTargets(state, activeUnit)
          : pendingAction === 'shield'
            ? techShieldTargets(state, activeUnit)
            : []

    // Hovering any unit other than the one currently deciding shows its threat/support range
    // (move cells + weapon/tech reach) instead of our own decision overlays — more useful than
    // previewing our own already-visible move/attack tiles.
    const hoveredUnit = hoveredTile
      ? state.units.find(
          (u) => isAlive(u) && u.pos.x === hoveredTile!.x && u.pos.y === hoveredTile!.y
        )
      : undefined
    const inspectedUnit = hoveredUnit && hoveredUnit.id !== activeUnit?.id ? hoveredUnit : undefined

    const inspectedReachable =
      inspectedUnit && !isAnimating
        ? reachableTiles(
            state.map,
            state.units,
            inspectedUnit.pos,
            inspectedUnit.moveSpeed,
            inspectedUnit.id
          )
        : []

    const previewAction: HoveredAction = hoveredAction ?? pendingAction
    // Only the target tile actually under the cursor gets an arrow — showing every valid target
    // at once forked into an unreadable spray of arrows.
    const hoveredTarget =
      activeUnit && !isAnimating && hoveredTile && previewAction
        ? (previewAction === 'attack'
            ? attackableTargets(state, activeUnit)
            : previewAction === 'invade' || previewAction === 'lockOn'
              ? techInvadeTargets(state, activeUnit)
              : previewAction === 'shield'
                ? techShieldTargets(state, activeUnit).filter((ally) => ally.id !== activeUnit.id)
                : []
          ).find((target) => target.pos.x === hoveredTile!.x && target.pos.y === hoveredTile!.y)
        : undefined

    const actionArrows =
      activeUnit && hoveredTarget && previewAction
        ? [
            {
              from: activeUnit.pos,
              to: hoveredTarget.pos,
              kind: previewAction as 'attack' | 'invade' | 'shield' | 'lockOn',
            },
          ]
        : []

    const now = performance.now()

    drawState(ctx, state, {
      activeUnitId: activeUnit?.id,
      reachable,
      attackable: attackable.map((u) => u.pos),
      techTargets: techTargets.map((u) => u.pos),
      weaponRangeDiamond:
        activeUnit && !isAnimating
          ? { pos: activeUnit.pos, range: actionRange(previewAction ?? 'attack', activeUnit) }
          : undefined,
      inspectedRangeDiamond: inspectedUnit
        ? { pos: inspectedUnit.pos, range: inspectedUnit.weapon.range }
        : undefined,
      inspectedReachable,
      actionArrows,
      moveRange:
        activeUnit &&
        !isAnimating &&
        activeUnit.team === 'player' &&
        !activeUnit.hasMoved &&
        !hasStatus(activeUnit, 'braced')
          ? { pos: activeUnit.pos, speed: effectiveMoveSpeed(activeUnit) }
          : undefined,
      movingUnit: movingUnit ?? undefined,
      projectiles: projectiles.map((p) => ({
        from: p.from,
        to: p.to,
        kind: p.kind,
        progress: Math.min(1, (now - p.startedAt) / PROJECTILE_DURATION_MS),
      })),
    })

    renderRoster(roster, state, activeUnit?.id, tooltip)

    lastHoveredUnit = hoveredUnit

    const isPlayerTurn = !!activeUnit && activeUnit.team === 'player' && !isAnimating
    const reactionLocked = !!activeUnit && hasStatus(activeUnit, 'braced')
    attackButton.disabled = !isPlayerTurn || attackable.length === 0
    overwatchButton.disabled =
      !isPlayerTurn || !!activeUnit?.overwatch || !!activeUnit?.brace || reactionLocked
    systemReactionButton.disabled =
      !isPlayerTurn ||
      !!activeUnit?.systemReactionArmed ||
      (activeUnit?.systemReactionUses ?? 0) >= SYSTEM_REACTION_CHARGES
    systemReactionButton.textContent = activeUnit
      ? (SYSTEM_REACTION_LABELS[activeUnit.systemReactionStatus] ?? '⚙️ System Reaction')
      : '⚙️ System Reaction'
    overchargeButton.disabled = !isPlayerTurn || !!activeUnit?.hasOvercharged || reactionLocked
    braceButton.disabled =
      !isPlayerTurn || !!activeUnit?.brace || !!activeUnit?.overwatch || reactionLocked
    stabilizeButton.disabled = !isPlayerTurn || activeUnit?.quickActionsUsed !== 0
    lockOnButton.disabled = !isPlayerTurn || invadeable.length === 0
    invadeButton.disabled = !isPlayerTurn || invadeable.length === 0
    shieldButton.disabled = !isPlayerTurn
    endActivationButton.disabled = !isPlayerTurn
    attackButton.classList.toggle('armed', pendingAction === 'attack')
    invadeButton.classList.toggle('armed', pendingAction === 'invade')
    shieldButton.classList.toggle('armed', pendingAction === 'shield')
    lockOnButton.classList.toggle('armed', pendingAction === 'lockOn')

    buttonTooltip.attack = !activeUnit
      ? ''
      : attackable.length === 0
        ? `Attack — Range ${activeUnit.weapon.range}. No target in range yet — move closer first.`
        : `Attack — Range ${activeUnit.weapon.range}. Rolls a d20 against the target's Evasion.`
    buttonTooltip.overwatch = !activeUnit
      ? ''
      : activeUnit.overwatch
        ? 'Already watching this activation'
        : activeUnit.brace || reactionLocked
          ? 'Only one reaction can be armed at a time'
          : `Overwatch — Watches Range ${activeUnit.weapon.range}. Free reaction attack if an enemy moves out of it.`
    buttonTooltip.systemReaction = !activeUnit
      ? ''
      : activeUnit.systemReactionArmed
        ? 'Already armed this activation'
        : activeUnit.systemReactionUses >= SYSTEM_REACTION_CHARGES
          ? 'No charges left this battle (Limited 2)'
          : `${SYSTEM_REACTION_DESCRIPTIONS[activeUnit.systemReactionStatus] ?? ''} Limited ${SYSTEM_REACTION_CHARGES} — ${SYSTEM_REACTION_CHARGES - activeUnit.systemReactionUses} left this battle.`
    buttonTooltip.invade =
      activeUnit && invadeable.length === 0
        ? `Invade — Range ${TECH_RANGE}. No enemy in tech range yet — move closer first.`
        : `Invade — Range ${TECH_RANGE}. Rolls a d20 against the target's Evasion; a hit floods them with heat instead of damage.`
    buttonTooltip.shield = `Shield — Range ${TECH_RANGE}. Reduces incoming damage to an ally (or yourself) for a couple of rounds.`
    buttonTooltip.overcharge = activeUnit?.hasOvercharged
      ? 'Already overcharged this activation'
      : reactionLocked
        ? 'Braced — no Overcharge until it wears off'
        : 'Overcharge — Free +1 quick action this activation only. Once per activation; heat cost escalates the more times you use it this battle.'
    buttonTooltip.brace = activeUnit?.brace
      ? 'Already bracing'
      : activeUnit?.overwatch || reactionLocked
        ? 'Only one reaction can be armed at a time'
        : "Brace — Halves the next hit/Invade against you, but locks out your next activation's move, Overcharge, and reactions, and caps it to 1 quick action."
    buttonTooltip.stabilize =
      activeUnit && activeUnit.quickActionsUsed !== 0
        ? 'Must be your only action this activation'
        : 'Stabilize — Full Action: clears Stunned/Impaired/Braced/weapon damage, vents half your heat, ends your turn.'
    buttonTooltip.lockOn =
      activeUnit && invadeable.length === 0
        ? `Lock On — Range ${TECH_RANGE}. No enemy in tech range yet — move closer first.`
        : `Lock On — Range ${TECH_RANGE}. Next attack on the target (by anyone) gets an accuracy bonus.`

    tutorial.notify(state, log)
    contextualHints.setPaused(tutorial.isActive())

    if (outcome !== 'ongoing') {
      status.textContent = `Round ${state.round} — game over`
      return
    }

    if (!activeUnit) {
      status.textContent = `Round ${state.round} — no units left to activate`
      return
    }

    const remaining = quickActionBudget(activeUnit) - activeUnit.quickActionsUsed
    const moveSuffix = activeUnit.hasMoved ? ' · move used' : ''
    status.textContent = `Round ${state.round} — ${activeUnit.team.toUpperCase()} activating ${activeUnit.name} (${remaining} quick action${remaining === 1 ? '' : 's'} left)${moveSuffix}`
  }

  withHoverPreview(attackButton, 'attack')
  withHoverPreview(overwatchButton, 'overwatch')
  withHoverPreview(systemReactionButton, 'systemReaction')
  withHoverPreview(invadeButton, 'invade')
  withHoverPreview(shieldButton, 'shield')
  withHoverPreview(lockOnButton, 'lockOn')

  // Drives both the sliding-move animation and in-flight projectiles off a single rAF loop.
  function ensureAnimLoop() {
    if (animLoopRunning) return
    animLoopRunning = true
    const tick = () => {
      const now = performance.now()
      const landed = projectiles.filter((p) => now - p.startedAt >= PROJECTILE_DURATION_MS)
      if (landed.length > 0) {
        projectiles = projectiles.filter((p) => now - p.startedAt < PROJECTILE_DURATION_MS)
        for (const p of landed) onProjectileLanded(p)
      }
      render()
      if (movingUnit || projectiles.length > 0) {
        requestAnimationFrame(tick)
      } else {
        animLoopRunning = false
      }
    }
    requestAnimationFrame(tick)
  }

  const projectileCallbacks = new Map<Projectile, () => void>()
  function onProjectileLanded(projectile: Projectile) {
    projectileCallbacks.get(projectile)?.()
    projectileCallbacks.delete(projectile)
  }

  function fireProjectile(
    from: Position,
    to: Position,
    kind: ActionArrowKind,
    onLanded: () => void
  ) {
    const projectile: Projectile = { from, to, kind, startedAt: performance.now() }
    projectiles = [...projectiles, projectile]
    projectileCallbacks.set(projectile, onLanded)
    ensureAnimLoop()
  }

  function slideUnit(unitId: string, from: Position, to: Position, onArrived: () => void) {
    const startedAt = performance.now()
    movingUnit = { id: unitId, pos: from }
    const step = () => {
      const t = Math.min(1, (performance.now() - startedAt) / MOVE_DURATION_MS)
      movingUnit = {
        id: unitId,
        pos: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
      }
      render()
      if (t < 1) {
        requestAnimationFrame(step)
      } else {
        movingUnit = null
        onArrived()
      }
    }
    requestAnimationFrame(step)
  }

  const FLASH_COLOR: Record<'weapon' | 'tech' | 'shield', string> = {
    weapon: 'var(--status-critical)',
    tech: 'var(--tech-accent)',
    shield: 'var(--status-good)',
  }

  // Restarting a CSS animation requires forcing a reflow between removing and re-adding the class.
  const triggerImpact = (variant: 'weapon' | 'tech' | 'shield') => {
    hitFlash.style.background = FLASH_COLOR[variant]
    hitFlash.classList.remove('flash')
    void hitFlash.offsetWidth
    hitFlash.classList.add('flash')

    if (variant === 'weapon') {
      canvas.classList.remove('shake')
      void canvas.offsetWidth
      canvas.classList.add('shake')
    }
  }

  const applyAction = (action: Parameters<typeof resolve>[1]) => {
    if (animationLock) return
    const before = state
    const startGen = generation

    let after: GameState
    try {
      after = resolve(before, action)
    } catch {
      // Invalid click target (unreachable tile / out-of-range attack) — ignore, keep current activation.
      return
    }

    const commit = () => {
      state = after
      log = [...log, { action }]
      combatLog.record(before, action, state)
      contextualHints.notify(before, action, state)
      render()
      scheduleAiTurnIfNeeded()
    }

    if (action.type === 'attack' || action.type === 'techInvade') {
      const attacker = before.units.find((u) => u.id === action.unitId)!
      const target = before.units.find((u) => u.id === action.targetId)!
      const kind = action.type === 'attack' ? 'attack' : 'invade'
      animationLock = true
      fireProjectile(attacker.pos, target.pos, kind, () => {
        if (startGen !== generation) return
        commit()
        if (action.type === 'attack' && state.lastAttack?.hit) triggerImpact('weapon')
        if (action.type === 'techInvade' && state.lastAttack?.hit) triggerImpact('tech')
        animationLock = false
      })
      return
    }

    if (action.type === 'move') {
      const mover = before.units.find((u) => u.id === action.unitId)!
      animationLock = true
      slideUnit(mover.id, mover.pos, action.to, () => {
        if (startGen !== generation) return
        commit()
        // A move can trigger an Overwatch reaction mid-flight — show it as a quick follow-up shot.
        if (before.lastAttack !== state.lastAttack && state.lastAttack) {
          const watcher = state.units.find((u) => u.id === state.lastAttack!.attackerId)
          const movedUnit = state.units.find((u) => u.id === action.unitId)
          if (watcher && movedUnit) {
            fireProjectile(watcher.pos, movedUnit.pos, 'attack', () => {
              if (startGen !== generation) return
              if (state.lastAttack?.hit) triggerImpact('weapon')
              animationLock = false
            })
            return
          }
        }
        animationLock = false
      })
      return
    }

    commit()
    if (action.type === 'techShield') triggerImpact('shield')
  }

  function scheduleAiTurnIfNeeded() {
    if (getGameOutcome(state) !== 'ongoing') return
    const activeUnit = getActiveUnit(state)
    if (activeUnit?.team !== 'enemy') return
    setTimeout(() => applyAction(chooseAiAction(state, activeUnit)), AI_MOVE_DELAY_MS)
  }

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect()
    const tile: Position = {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * state.map.width),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * state.map.height),
    }
    if (!hoveredTile || hoveredTile.x !== tile.x || hoveredTile.y !== tile.y) {
      hoveredTile = tile
      render()
    }
    if (lastHoveredUnit) tooltip.show(describeUnit(lastHoveredUnit), event.clientX, event.clientY)
    else tooltip.hide()
  })

  canvas.addEventListener('mouseleave', () => {
    tooltip.hide()
    if (!hoveredTile) return
    hoveredTile = null
    render()
  })

  canvas.addEventListener('click', (event) => {
    if (getGameOutcome(state) !== 'ongoing') return
    const activeUnit = getActiveUnit(state)
    if (!activeUnit || activeUnit.team !== 'player') return

    const rect = canvas.getBoundingClientRect()
    const clicked: Position = {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * state.map.width),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * state.map.height),
    }

    const clickedUnit = state.units.find(
      (u) => isAlive(u) && u.pos.x === clicked.x && u.pos.y === clicked.y
    )

    if (pendingAction === 'attack') {
      if (clickedUnit && clickedUnit.team !== activeUnit.team) {
        pendingAction = null
        applyAction({ type: 'attack', unitId: activeUnit.id, targetId: clickedUnit.id })
      }
      return
    }

    if (pendingAction === 'invade') {
      if (clickedUnit && clickedUnit.team !== activeUnit.team) {
        pendingAction = null
        applyAction({ type: 'techInvade', unitId: activeUnit.id, targetId: clickedUnit.id })
      }
      return
    }

    if (pendingAction === 'shield') {
      if (clickedUnit && clickedUnit.team === activeUnit.team) {
        pendingAction = null
        applyAction({ type: 'techShield', unitId: activeUnit.id, targetId: clickedUnit.id })
      }
      return
    }

    if (pendingAction === 'lockOn') {
      if (clickedUnit && clickedUnit.team !== activeUnit.team) {
        pendingAction = null
        applyAction({ type: 'lockOn', unitId: activeUnit.id, targetId: clickedUnit.id })
      }
      return
    }

    if (!clickedUnit) {
      applyAction({ type: 'move', unitId: activeUnit.id, to: clicked })
    }
  })

  endActivationButton.addEventListener('click', () => {
    const activeUnit = getActiveUnit(state)
    if (!activeUnit || activeUnit.team !== 'player') return
    applyAction({ type: 'endActivation', unitId: activeUnit.id })
  })

  overwatchButton.addEventListener('click', () => {
    const activeUnit = getActiveUnit(state)
    if (!activeUnit || activeUnit.team !== 'player') return
    applyAction({ type: 'overwatch', unitId: activeUnit.id })
  })

  systemReactionButton.addEventListener('click', () => {
    const activeUnit = getActiveUnit(state)
    if (!activeUnit || activeUnit.team !== 'player') return
    applyAction({ type: 'systemReaction', unitId: activeUnit.id })
  })

  overchargeButton.addEventListener('click', () => {
    const activeUnit = getActiveUnit(state)
    if (!activeUnit || activeUnit.team !== 'player') return
    applyAction({ type: 'overcharge', unitId: activeUnit.id })
  })

  braceButton.addEventListener('click', () => {
    const activeUnit = getActiveUnit(state)
    if (!activeUnit || activeUnit.team !== 'player') return
    applyAction({ type: 'brace', unitId: activeUnit.id })
  })

  stabilizeButton.addEventListener('click', () => {
    const activeUnit = getActiveUnit(state)
    if (!activeUnit || activeUnit.team !== 'player') return
    applyAction({ type: 'stabilize', unitId: activeUnit.id })
  })

  attackButton.addEventListener('click', () => {
    pendingAction = pendingAction === 'attack' ? null : 'attack'
    render()
  })

  invadeButton.addEventListener('click', () => {
    pendingAction = pendingAction === 'invade' ? null : 'invade'
    render()
  })

  lockOnButton.addEventListener('click', () => {
    pendingAction = pendingAction === 'lockOn' ? null : 'lockOn'
    render()
  })

  shieldButton.addEventListener('click', () => {
    pendingAction = pendingAction === 'shield' ? null : 'shield'
    render()
  })

  resetButton.addEventListener('click', () => {
    generation += 1
    state = structuredClone(initialSnapshot)
    log = []
    pendingAction = null
    movingUnit = null
    projectiles = []
    animationLock = false
    combatLog.clear()
    render()
    scheduleAiTurnIfNeeded()
  })

  tutorialButton.addEventListener('click', () => {
    tutorial.restart()
    contextualHints.reset()
  })

  render()
  void preloadSprites().then(render)
  scheduleAiTurnIfNeeded()

  Object.assign(window, {
    __LAWNCER__: {
      getState: () => state,
      getLog: () => log,
      replay: () => replay(structuredClone(initialSnapshot), log),
      isAnimating: () => animationLock,
    },
  })
}
