import type { ActionLog } from '../engine/state/log.ts'
import type { GameState } from '../engine/state/types.ts'

interface InfoStep {
  kind: 'info'
  title: string
  body: string
}

interface GatedStep {
  kind: 'gated'
  title: string
  body: string
  isSatisfied: (state: GameState, log: ActionLog) => boolean
  highlightSelector?: string
}

type TutorialStep = InfoStep | GatedStep

const STORAGE_KEY = 'lawncer.tutorialDismissed'

const STEPS: TutorialStep[] = [
  {
    kind: 'info',
    title: 'Alternating Activations',
    body: 'Combat alternates one unit at a time between sides — Player, then Enemy, then Player again. Never a full team acting at once.',
  },
  {
    kind: 'gated',
    title: 'Move Everest',
    body: "Click a green-highlighted tile to move. Hover any action button to preview its range as a dashed diamond, then hover a highlighted target on the map to see the arrow you'd fire. Hover any other unit (ally or enemy) anytime to see its range: orange tiles it could move to, a red dashed diamond for its weapon range, and dots marking where it could attack (red) or use tech (violet) from.",
    isSatisfied: (state) =>
      (state.units.find((u) => u.id === 'player-1')?.quickActionsUsed ?? 0) > 0,
  },
  {
    kind: 'gated',
    title: 'Finish the Activation',
    body: 'Click "Attack", then click a red-highlighted enemy to fire if one is in range — or click "End activation" to pass the rest of this turn.',
    isSatisfied: (state) => state.units.find((u) => u.id === 'player-1')?.hasActivated ?? false,
    highlightSelector: '[data-action="end-activation"]',
  },
  {
    kind: 'info',
    title: 'Accuracy',
    body: 'Attacks roll a d20 against the target’s Evasion (shown in the sidebar) to hit — a natural 20 crits for double damage. A miss still builds heat, since you fired either way.',
  },
  {
    kind: 'info',
    title: 'Heat & Structure',
    body: 'HP depletes first; hitting 0 consumes a Structure box and refills HP. Acting builds Heat — overflowing it costs a Stress box instead. Either track hitting 0 destroys the unit.',
  },
  {
    kind: 'info',
    title: 'Tech Actions',
    body: '"Invade" floods an enemy’s systems with heat instead of damage. "Shield" grants an ally (or yourself) reduced incoming damage. Both have a fixed range of 3, independent of your weapon.',
  },
  {
    kind: 'info',
    title: 'Overwatch',
    body: 'Arm Overwatch to spend a quick action watching your weapon’s range. If an enemy moves into it before your next turn, you get a free reaction attack.',
  },
  {
    kind: 'info',
    title: 'Victory & Defeat',
    body: 'Destroy every enemy mech to win. You lose only if your entire team is destroyed — a single casualty never ends the game.',
  },
  {
    kind: 'info',
    title: "You're Ready",
    body: 'The enemy team plays itself automatically. Replay this walkthrough anytime with the "Tutorial" button.',
  },
]

export interface TutorialController {
  /** Call after every state change so gated steps can check whether the player has done the thing. */
  notify(state: GameState, log: ActionLog): void
  restart(): void
  /** Whether the overlay is currently on screen — used to suppress contextual hints during onboarding. */
  isActive(): boolean
}

export function mountTutorial(
  root: HTMLElement,
  onVisibilityChange?: (visible: boolean) => void
): TutorialController {
  let stepIndex = 0
  let visible = typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY) !== 'true'

  const overlay = document.createElement('div')
  overlay.className = 'tutorial-overlay'

  const title = document.createElement('h3')
  const body = document.createElement('p')
  const hint = document.createElement('p')
  hint.className = 'tutorial-hint'

  const nextButton = document.createElement('button')
  nextButton.type = 'button'

  const skipButton = document.createElement('button')
  skipButton.type = 'button'
  skipButton.textContent = 'Skip tutorial'
  skipButton.className = 'tutorial-skip'

  const footer = document.createElement('div')
  footer.className = 'tutorial-footer'
  footer.append(skipButton, nextButton)

  overlay.append(title, body, hint, footer)
  root.append(overlay)

  const clearHighlight = () => {
    document
      .querySelectorAll('.tutorial-target')
      .forEach((el) => el.classList.remove('tutorial-target'))
  }

  const render = () => {
    overlay.style.display = visible ? 'flex' : 'none'
    if (!visible) return

    const step = STEPS[stepIndex]
    title.textContent = step.title
    body.textContent = step.body
    clearHighlight()

    if (step.kind === 'gated') {
      hint.textContent = 'Waiting for you to do this in the game…'
      nextButton.style.display = 'none'
      if (step.highlightSelector) {
        document.querySelector(step.highlightSelector)?.classList.add('tutorial-target')
      }
    } else {
      hint.textContent = ''
      nextButton.style.display = ''
      nextButton.textContent = stepIndex === STEPS.length - 1 ? 'Got it' : 'Next'
    }
  }

  const finish = () => {
    visible = false
    localStorage.setItem(STORAGE_KEY, 'true')
    clearHighlight()
    render()
    onVisibilityChange?.(false)
  }

  const advance = () => {
    if (stepIndex >= STEPS.length - 1) {
      finish()
      return
    }
    stepIndex += 1
    render()
  }

  nextButton.addEventListener('click', advance)
  skipButton.addEventListener('click', finish)

  render()

  return {
    notify(state, log) {
      if (!visible) return
      const step = STEPS[stepIndex]
      if (step.kind === 'gated' && step.isSatisfied(state, log)) advance()
    },
    restart() {
      stepIndex = 0
      visible = true
      localStorage.removeItem(STORAGE_KEY)
      render()
      onVisibilityChange?.(true)
    },
    isActive() {
      return visible
    },
  }
}
