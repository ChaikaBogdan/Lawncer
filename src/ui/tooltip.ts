/**
 * A single floating tooltip shared by every hoverable element (roster cards, action buttons, and
 * canvas-hovered units) — a `<canvas>` can't host per-region native tooltips, so this is a
 * cursor-following DOM element instead of relying on `title` attributes.
 */
export interface TooltipController {
  /** Attaches hover listeners to a DOM element; `content` is read lazily on each hover. */
  attach(el: HTMLElement, content: () => string): void
  /** Manual control for non-DOM hover targets, e.g. a unit hovered on the canvas. */
  show(content: string, clientX: number, clientY: number): void
  hide(): void
}

const CURSOR_OFFSET = 16

export function mountTooltip(root: HTMLElement): TooltipController {
  const tooltip = document.createElement('div')
  tooltip.className = 'tooltip'
  tooltip.style.display = 'none'
  root.append(tooltip)

  function position(clientX: number, clientY: number) {
    const maxLeft = window.innerWidth - tooltip.offsetWidth - CURSOR_OFFSET
    const maxTop = window.innerHeight - tooltip.offsetHeight - CURSOR_OFFSET
    tooltip.style.left = `${Math.min(clientX + CURSOR_OFFSET, Math.max(0, maxLeft))}px`
    tooltip.style.top = `${Math.min(clientY + CURSOR_OFFSET, Math.max(0, maxTop))}px`
  }

  function show(content: string, clientX: number, clientY: number) {
    tooltip.textContent = content
    tooltip.style.display = 'block'
    position(clientX, clientY)
  }

  function hide() {
    tooltip.style.display = 'none'
  }

  return {
    attach(el, content) {
      el.addEventListener('mouseenter', (event) => show(content(), event.clientX, event.clientY))
      el.addEventListener('mousemove', (event) => {
        if (tooltip.style.display === 'none') return
        position(event.clientX, event.clientY)
      })
      el.addEventListener('mouseleave', hide)
    },
    show,
    hide,
  }
}
