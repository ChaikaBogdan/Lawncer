interface LegendItem {
  swatch: string
  label: string
}

const TILE_ITEMS: LegendItem[] = [
  { swatch: 'legend-swatch-reachable', label: 'Move' },
  { swatch: 'legend-swatch-attackable', label: 'Attack' },
  { swatch: 'legend-swatch-tech', label: 'Tech target' },
  { swatch: 'legend-swatch-wall', label: 'Impassable' },
  { swatch: 'legend-swatch-cover', label: 'Cover (harder to hit at range)' },
  { swatch: 'legend-swatch-enemy-threat', label: 'Unit can move here (hover any other unit)' },
]

const DOT_ITEMS: LegendItem[] = [
  { swatch: 'legend-dot-attack', label: 'Can attack from here' },
  { swatch: 'legend-dot-tech', label: 'Can use tech from here' },
  { swatch: 'legend-dot-range', label: 'Ability/threat range (hover a button or unit)' },
  { swatch: 'legend-arrow-attack', label: 'Attack target (hover it on the map)' },
  { swatch: 'legend-arrow-invade', label: 'Invade target (hover it on the map)' },
  { swatch: 'legend-arrow-shield', label: 'Shield target (hover it on the map)' },
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
