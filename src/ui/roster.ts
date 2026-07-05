import type { GameState, UnitState } from '../engine/state/types.ts'
import { isAlive } from '../engine/state/unit.ts'

/** Traffic-light coloring: bar fill is "good" when the ratio is on the safe side, "critical" when it's on the danger side. */
function dangerColor(ratio: number, dangerAtHigh: boolean): string {
  const value = dangerAtHigh ? ratio : 1 - ratio
  if (value >= 0.67) return 'var(--status-critical)'
  if (value >= 0.34) return 'var(--status-warning)'
  return 'var(--status-good)'
}

function statBar(value: number, max: number, dangerAtHigh: boolean): string {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0
  const color = dangerColor(ratio, dangerAtHigh)
  return `<div class="stat-bar"><div class="stat-bar-fill" style="width:${ratio * 100}%;background:${color}"></div></div>`
}

function pipRow(value: number, max: number): string {
  return `<div class="pip-row">${Array.from({ length: max }, (_, i) => `<span class="pip${i < value ? ' filled' : ''}"></span>`).join('')}</div>`
}

function unitCard(unit: UnitState, isActive: boolean): string {
  const badges = [
    ...unit.statuses.map((s) => `<span class="badge ${s.type}">${s.type}</span>`),
    ...(unit.overwatch ? ['<span class="badge overwatch">overwatch</span>'] : []),
  ].join('')

  return `
    <div class="unit-card" data-team="${unit.team}" data-active="${isActive}" data-destroyed="${!isAlive(unit)}">
      <div class="unit-card-header">
        <span class="unit-name">${unit.name}</span>
        <span class="unit-weapon">${unit.weapon.name}</span>
      </div>
      <div class="unit-combat-stats">
        <span>RNG ${unit.weapon.range}</span>
        <span>DMG ${unit.weapon.damage}</span>
        <span>SPD ${unit.moveSpeed}</span>
        <span>EVA ${unit.evasion}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">HP</span>
        ${statBar(unit.hp, unit.maxHp, false)}
        <span class="stat-value">${unit.hp}/${unit.maxHp}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">STR</span>
        ${pipRow(unit.structure, unit.maxStructure)}
        <span class="stat-value">${unit.structure}/${unit.maxStructure}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">HEAT</span>
        ${statBar(unit.heat, unit.heatCap, true)}
        <span class="stat-value">${unit.heat}/${unit.heatCap}</span>
      </div>
      <div class="stat-row">
        <span class="stat-label">STRESS</span>
        ${pipRow(unit.stress, unit.maxStress)}
        <span class="stat-value">${unit.stress}/${unit.maxStress}</span>
      </div>
      ${badges ? `<div class="badges">${badges}</div>` : ''}
    </div>
  `
}

export function renderRoster(
  container: HTMLElement,
  state: GameState,
  activeUnitId: string | undefined
): void {
  const player = state.units.filter((u) => u.team === 'player')
  const enemy = state.units.filter((u) => u.team === 'enemy')

  container.innerHTML = `
    <div class="roster-team" data-team="player">
      <h4>Player</h4>
      ${player.map((u) => unitCard(u, u.id === activeUnitId)).join('')}
    </div>
    <div class="roster-team" data-team="enemy">
      <h4>Enemy</h4>
      ${enemy.map((u) => unitCard(u, u.id === activeUnitId)).join('')}
    </div>
  `
}
