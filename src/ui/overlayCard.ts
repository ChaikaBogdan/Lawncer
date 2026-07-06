/**
 * Shared centered "step card" UI used by both the onboarding tutorial and contextual hints, so
 * they read as one visual system instead of two (a bottom-right panel vs. a dead-center stack).
 */

export interface OverlayCardOptions {
  /** Muted italic line under the body, e.g. a gated tutorial step's "waiting on you" text. */
  hint?: string
  /** Renders a large `×` in the top-right corner; omit for a step with only footer navigation. */
  onClose?: () => void
  primary?: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void }
}

export function createOverlayCard(
  title: string,
  body: string,
  options: OverlayCardOptions = {}
): HTMLElement {
  const card = document.createElement('div')
  card.className = 'overlay-card'

  if (options.onClose) {
    const closeButton = document.createElement('button')
    closeButton.type = 'button'
    closeButton.className = 'overlay-card-close'
    closeButton.textContent = '×'
    closeButton.setAttribute('aria-label', 'Dismiss')
    closeButton.addEventListener('click', options.onClose)
    card.append(closeButton)
  }

  const titleEl = document.createElement('h4')
  titleEl.textContent = title
  card.append(titleEl)

  const bodyEl = document.createElement('p')
  bodyEl.textContent = body
  card.append(bodyEl)

  if (options.hint) {
    const hintEl = document.createElement('p')
    hintEl.className = 'overlay-card-hint'
    hintEl.textContent = options.hint
    card.append(hintEl)
  }

  if (options.primary || options.secondary) {
    const footer = document.createElement('div')
    footer.className = 'overlay-card-footer'

    if (options.secondary) {
      const secondaryButton = document.createElement('button')
      secondaryButton.type = 'button'
      secondaryButton.className = 'overlay-card-secondary'
      secondaryButton.textContent = options.secondary.label
      secondaryButton.addEventListener('click', options.secondary.onClick)
      footer.append(secondaryButton)
    }

    if (options.primary) {
      const primaryButton = document.createElement('button')
      primaryButton.type = 'button'
      primaryButton.textContent = options.primary.label
      primaryButton.addEventListener('click', options.primary.onClick)
      footer.append(primaryButton)
    }

    card.append(footer)
  }

  return card
}

/** Appends the shared centered container both the tutorial and contextual hints render cards into. */
export function createOverlayStack(root: HTMLElement): HTMLElement {
  const stack = document.createElement('div')
  stack.className = 'overlay-stack'
  root.append(stack)
  return stack
}
