interface LegendItem {
  swatch: string
  label: string
}

// Wall/cover tiles are visually self-explanatory now that they use real art (crate/crater), and
// the attack/invade/shield target arrows are already taught by the tutorial and discoverable by
// hovering — trimmed to just the abstract overlay colors that aren't obvious at a glance.
const TILE_ITEMS: LegendItem[] = [
  { swatch: 'legend-swatch-reachable', label: 'Move' },
  { swatch: 'legend-swatch-attackable', label: 'Attack' },
  { swatch: 'legend-swatch-tech', label: 'Tech target' },
  { swatch: 'legend-swatch-enemy-threat', label: 'Unit can move here (hover any other unit)' },
]

const DOT_ITEMS: LegendItem[] = [
  { swatch: 'legend-dot-range', label: 'Ability/threat range (hover a button or unit)' },
]

function renderGroup(items: LegendItem[]): string {
  return items
    .map(
      (item) =>
        `<span class="legend-item"><span class="legend-swatch ${item.swatch}"></span>${item.label}</span>`
    )
    .join('')
}

export function createLegend(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'legend'
  el.innerHTML = `
    <div class="legend-group">${renderGroup(TILE_ITEMS)}</div>
    <div class="legend-group">${renderGroup(DOT_ITEMS)}</div>
  `
  return el
}
