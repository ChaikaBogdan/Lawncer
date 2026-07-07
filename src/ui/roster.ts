import { SYSTEM_REACTION_CHARGES } from '../engine/combat/resolve.ts'
import { isEngaged } from '../engine/rules/engagement.ts'
import type {
  AiBehavior,
  GameState,
  StatusType,
  UnitState,
  WeaponTag,
} from '../engine/state/types.ts'
import { isAlive } from '../engine/state/unit.ts'
import type { TooltipController } from './tooltip.ts'

const WEAPON_BLURBS: Record<string, string> = {
  Rifle: 'a balanced ranged weapon — solid range, modest damage and heat.',
  'Smart Rifle': 'a guided ranged weapon — same as the Rifle, but the attack always hits.',
  Shotgun: 'a short-range burst weapon — heavy damage up close.',
  Sword: 'a melee striker — no heat cost, but must close to point-blank range.',
}

const AI_BEHAVIOR_BLURBS: Record<AiBehavior, string> = {
  aggressive: 'Presses the attack — always closes distance rather than holding back.',
  kiting: 'Tries to keep its distance when it can’t get a clean shot.',
}

const WEAPON_TAG_LABELS: Record<WeaponTag, string> = {
  smart: 'Smart',
  knockback: 'Knockback',
  overkill: 'Overkill',
}

const WEAPON_TAG_DESCRIPTIONS: Record<WeaponTag, string> = {
  smart: 'Smart — this attack always hits, ignoring the target’s Evasion roll.',
  knockback: 'Knockback — a landed hit shoves the target one tile straight back.',
  overkill: 'Overkill — a landed crit deals triple damage instead of double.',
}

/** Frame.systemReactionStatus is always one of these four — see frames.ts. */
export const SYSTEM_REACTION_LABELS: Partial<Record<StatusType, string>> = {
  extendedRange: '📡 Extend Range',
  guarded: '🛡️ Guard',
  boosted: '💨 Boost',
  entrenched: '⛰️ Entrench',
}

export const SYSTEM_REACTION_DESCRIPTIONS: Partial<Record<StatusType, string>> = {
  extendedRange:
    'Extend Range — a second, independent reaction: the next enemy that starts moving from within your threat grants +1 weapon range for your next activation.',
  guarded:
    'Guard — a second, independent reaction: the next enemy that starts moving from within your threat grants +1 Evasion for your next activation.',
  boosted:
    'Boost — a second, independent reaction: the next enemy that starts moving from within your threat grants +1 move speed for your next activation.',
  entrenched:
    'Entrench — a second, independent reaction: the next enemy that starts moving from within your threat grants +2 Evasion for your next activation (matches hard cover).',
}

/** Hover-card description for a unit: its weapon, defenses, a one-line role blurb, and (for enemies) its AI behavior. */
export function describeUnit(unit: UnitState): string {
  const blurb = WEAPON_BLURBS[unit.weapon.name] ?? `wields a ${unit.weapon.name}.`
  const behavior = unit.team === 'enemy' ? ` ${AI_BEHAVIOR_BLURBS[unit.aiBehavior]}` : ''
  const systemReaction = SYSTEM_REACTION_DESCRIPTIONS[unit.systemReactionStatus]
    ? `${SYSTEM_REACTION_DESCRIPTIONS[unit.systemReactionStatus]} Limited ${SYSTEM_REACTION_CHARGES} (${unit.systemReactionUses}/${SYSTEM_REACTION_CHARGES} used).`
    : ''
  return (
    `${unit.name} — ${unit.weapon.name} (Range ${unit.weapon.range}, Dmg ${unit.weapon.damage}, Heat ${unit.weapon.heat}). ` +
    `Evasion ${unit.evasion}, Armor ${unit.armor}. ` +
    blurb +
    behavior +
    (systemReaction ? ` ${systemReaction}` : '')
  )
}

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

function unitCard(state: GameState, unit: UnitState, isActive: boolean): string {
  const badges = [
    ...unit.statuses.map((s) => `<span class="badge ${s.type}">${s.type}</span>`),
    ...(unit.overwatch ? ['<span class="badge overwatch">overwatch</span>'] : []),
    ...(unit.brace ? ['<span class="badge brace">bracing</span>'] : []),
    ...(unit.weaponDisabled ? ['<span class="badge weaponDisabled">weapon disabled</span>'] : []),
    ...(isAlive(unit) && isEngaged(state, unit)
      ? ['<span class="badge engaged">engaged</span>']
      : []),
  ].join('')

  const tags = unit.weapon.tags
    .map((tag) => `<span class="tag-badge" data-tag="${tag}">${WEAPON_TAG_LABELS[tag]}</span>`)
    .join('')

  return `
    <div class="unit-card" data-team="${unit.team}" data-active="${isActive}" data-destroyed="${!isAlive(unit)}" data-unit-id="${unit.id}">
      <div class="unit-card-header">
        <span class="unit-name">${unit.name}</span>
      </div>
      <div class="unit-weapon-block">
        <div class="unit-weapon-name">${unit.weapon.name}</div>
        <div class="unit-weapon-stats">
          <span>RNG ${unit.weapon.range}</span>
          <span>DMG ${unit.weapon.damage}</span>
          <span>HEAT ${unit.weapon.heat}</span>
        </div>
        ${tags ? `<div class="weapon-tags">${tags}</div>` : ''}
      </div>
      <div class="unit-combat-stats">
        <span>SPD ${unit.moveSpeed}</span>
        <span>EVA ${unit.evasion}</span>
        <span>ARM ${unit.armor}</span>
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
  activeUnitId: string | undefined,
  tooltip?: TooltipController
): void {
  const player = state.units.filter((u) => u.team === 'player')
  const enemy = state.units.filter((u) => u.team === 'enemy')

  container.innerHTML = `
    <div class="roster-team" data-team="player">
      <h4>Player</h4>
      ${player.map((u) => unitCard(state, u, u.id === activeUnitId)).join('')}
    </div>
    <div class="roster-team" data-team="enemy">
      <h4>Enemy</h4>
      ${enemy.map((u) => unitCard(state, u, u.id === activeUnitId)).join('')}
    </div>
  `

  if (!tooltip) return
  for (const unit of state.units) {
    const card = container.querySelector<HTMLElement>(`.unit-card[data-unit-id="${unit.id}"]`)
    if (!card) continue
    tooltip.attach(card, () => describeUnit(unit))
    for (const tag of unit.weapon.tags) {
      const badge = card.querySelector<HTMLElement>(`.tag-badge[data-tag="${tag}"]`)
      if (badge) tooltip.attach(badge, () => WEAPON_TAG_DESCRIPTIONS[tag])
    }
  }
}
