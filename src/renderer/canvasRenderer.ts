import { isWall } from '../engine/map/grid.ts'
import type { GameState, Position, UnitState } from '../engine/state/types.ts'
import { isAlive } from '../engine/state/unit.ts'
import playerSprite from '../assets/units/player.png'
import enemySprite from '../assets/units/enemy.png'

export const CELL_SIZE = 64

const TEAM_SPRITE_SRC: Record<UnitState['team'], string> = {
  player: playerSprite,
  enemy: enemySprite,
}

const FLOOR_A = '#1a1a19'
const FLOOR_B = '#201f1d'
const WALL_COLOR = '#4b4744'
const WALL_HATCH = 'rgba(255, 255, 255, 0.18)'
const WALL_BORDER = 'rgba(255, 255, 255, 0.25)'
const GRIDLINE = 'rgba(255, 255, 255, 0.06)'
const REACHABLE_FILL = 'rgba(12, 163, 12, 0.35)'
const ATTACKABLE_FILL = 'rgba(230, 103, 103, 0.35)'
const TECH_TARGET_FILL = 'rgba(144, 133, 233, 0.35)'
const ATTACK_PREVIEW_DOT = 'rgba(230, 103, 103, 0.95)'
const TECH_PREVIEW_DOT = 'rgba(144, 133, 233, 0.95)'
const ACTIVE_RING = '#facc15'
const RANGE_DIAMOND_STROKE = 'rgba(250, 204, 21, 0.45)'
const INSPECT_RANGE_DIAMOND_STROKE = 'rgba(230, 103, 103, 0.55)'
const INSPECT_THREAT_FILL = 'rgba(230, 140, 40, 0.28)'
const HP_GOOD = '#0ca30c'
const HP_WARNING = '#fab219'
const HP_CRITICAL = '#d03b3b'

export type ActionArrowKind = 'attack' | 'invade' | 'shield'

const ARROW_COLOR: Record<ActionArrowKind, string> = {
  attack: '#e66767',
  invade: '#9085e9',
  shield: '#3987e5',
}

const spriteCache = new Map<string, HTMLImageElement>()

function getSprite(src: string): HTMLImageElement {
  let img = spriteCache.get(src)
  if (!img) {
    img = new Image()
    img.src = src
    spriteCache.set(src, img)
  }
  return img
}

/** Resolves once both team sprites have finished loading, so the caller can trigger a first correct paint. */
export function preloadSprites(): Promise<void> {
  const loads = Object.values(TEAM_SPRITE_SRC).map(
    (src) =>
      new Promise<void>((res) => {
        const img = getSprite(src)
        if (img.complete) res()
        else img.addEventListener('load', () => res(), { once: true })
      })
  )
  return Promise.all(loads).then(() => undefined)
}

export interface RenderOptions {
  activeUnitId?: string
  reachable: Position[]
  attackable: Position[]
  techTargets: Position[]
  /** Weapon-range boundary to outline around the active unit — a Manhattan-distance diamond, not a circle. */
  weaponRangeDiamond?: { pos: Position; range: number }
  /** Same, but for a hovered non-active unit — shown so the player can size up its range. */
  inspectedRangeDiamond?: { pos: Position; range: number }
  /** Tiles a hovered non-active unit could move to this activation. */
  inspectedReachable?: Position[]
  /** Among an inspected unit's reachable tiles: which ones would let it attack or use a tech action from there. */
  movePreview?: { attack: Position[]; tech: Position[] }
  /** Arrows from the active unit to each valid target for the currently hovered/armed action. */
  actionArrows?: { from: Position; to: Position; kind: ActionArrowKind }[]
  /** Draws this one unit at an interpolated position instead of its state position, for a moving-sprite animation. */
  movingUnit?: { id: string; pos: Position }
  /** In-flight projectiles (attack/invade), drawn as a small orb traveling from `from` to `to`. */
  projectiles?: { from: Position; to: Position; kind: ActionArrowKind; progress: number }[]
}

/** Impassable tiles get a diagonal hatch + border on top of the fill, so they read as an obstacle, not just a darker floor tile. */
function drawWallHatch(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, CELL_SIZE, CELL_SIZE)
  ctx.clip()
  ctx.strokeStyle = WALL_HATCH
  ctx.lineWidth = 2
  for (let offset = -CELL_SIZE; offset < CELL_SIZE * 2; offset += 9) {
    ctx.beginPath()
    ctx.moveTo(x + offset, y)
    ctx.lineTo(x + offset + CELL_SIZE, y + CELL_SIZE)
    ctx.stroke()
  }
  ctx.restore()

  ctx.strokeStyle = WALL_BORDER
  ctx.lineWidth = 2
  ctx.strokeRect(x + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2)
}

/** A colored arrow from one tile's center to another, pulled back from both ends so it doesn't bury itself under the sprites. */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Position,
  to: Position,
  kind: ActionArrowKind
): void {
  const fromX = from.x * CELL_SIZE + CELL_SIZE / 2
  const fromY = from.y * CELL_SIZE + CELL_SIZE / 2
  const toX = to.x * CELL_SIZE + CELL_SIZE / 2
  const toY = to.y * CELL_SIZE + CELL_SIZE / 2

  const angle = Math.atan2(toY - fromY, toX - fromX)
  const pullback = CELL_SIZE * 0.32
  const startX = fromX + Math.cos(angle) * pullback
  const startY = fromY + Math.sin(angle) * pullback
  const endX = toX - Math.cos(angle) * pullback
  const endY = toY - Math.sin(angle) * pullback

  const color = ARROW_COLOR[kind]
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(startX, startY)
  ctx.lineTo(endX, endY)
  ctx.stroke()

  const headLength = 9
  ctx.beginPath()
  ctx.moveTo(endX, endY)
  ctx.lineTo(
    endX - headLength * Math.cos(angle - Math.PI / 6),
    endY - headLength * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    endX - headLength * Math.cos(angle + Math.PI / 6),
    endY - headLength * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/** A small traveling orb with a fading trail, interpolated between two tile centers by `progress` (0..1). */
function drawProjectile(
  ctx: CanvasRenderingContext2D,
  from: Position,
  to: Position,
  kind: ActionArrowKind,
  progress: number
): void {
  const fromX = from.x * CELL_SIZE + CELL_SIZE / 2
  const fromY = from.y * CELL_SIZE + CELL_SIZE / 2
  const toX = to.x * CELL_SIZE + CELL_SIZE / 2
  const toY = to.y * CELL_SIZE + CELL_SIZE / 2
  const x = fromX + (toX - fromX) * progress
  const y = fromY + (toY - fromY) * progress
  const color = ARROW_COLOR[kind]

  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(fromX, fromY)
  ctx.lineTo(x, y)
  ctx.stroke()

  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()
}

const STATUS_EMOJI: Record<string, string> = {
  stunned: '💫',
  impaired: '🔥',
  shielded: '🛡️',
}

/** Small emoji badges stacked in the sprite's top-left corner for each active status + Overwatch. */
function drawStatusEmojis(
  ctx: CanvasRenderingContext2D,
  unit: UnitState,
  cx: number,
  cy: number,
  spriteSize: number
): void {
  const emojis = [
    ...unit.statuses.map((s) => STATUS_EMOJI[s.type]).filter(Boolean),
    ...(unit.overwatch ? ['👁️'] : []),
  ]
  if (emojis.length === 0) return

  ctx.textAlign = 'left'
  ctx.font = '13px system-ui, sans-serif'
  const startX = cx - spriteSize / 2 - 2
  const y = cy - spriteSize / 2 + 4
  emojis.forEach((emoji, i) => ctx.fillText(emoji, startX + i * 14, y))
}

function hpBarColor(ratio: number): string {
  if (ratio <= 0.34) return HP_CRITICAL
  if (ratio <= 0.67) return HP_WARNING
  return HP_GOOD
}

/** Small dot centered in the tile; `slot` nudges it left/right so attack + tech dots can coexist on one tile. */
function drawCenterDot(
  ctx: CanvasRenderingContext2D,
  pos: Position,
  color: string,
  slot: 0 | 1 = 0
): void {
  const cx = pos.x * CELL_SIZE + CELL_SIZE / 2 + (slot === 0 ? -8 : 8)
  const cy = pos.y * CELL_SIZE + CELL_SIZE / 2

  ctx.beginPath()
  ctx.arc(cx, cy, 5, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawRangeDiamond(
  ctx: CanvasRenderingContext2D,
  pos: Position,
  range: number,
  color: string = RANGE_DIAMOND_STROKE
): void {
  if (range <= 0) return

  const cx = pos.x * CELL_SIZE + CELL_SIZE / 2
  const cy = pos.y * CELL_SIZE + CELL_SIZE / 2
  const r = range * CELL_SIZE

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 2
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  ctx.moveTo(cx + r, cy)
  ctx.lineTo(cx, cy + r)
  ctx.lineTo(cx - r, cy)
  ctx.lineTo(cx, cy - r)
  ctx.closePath()
  ctx.stroke()
  ctx.restore()
}

export function drawState(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  options: RenderOptions
): void {
  const { map, units } = state
  ctx.clearRect(0, 0, map.width * CELL_SIZE, map.height * CELL_SIZE)

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const pos = { x, y }
      const wall = isWall(map, pos)
      ctx.fillStyle = wall ? WALL_COLOR : (x + y) % 2 === 0 ? FLOOR_A : FLOOR_B
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
      if (wall) drawWallHatch(ctx, x * CELL_SIZE, y * CELL_SIZE)
    }
  }

  ctx.fillStyle = REACHABLE_FILL
  for (const pos of options.reachable) {
    ctx.fillRect(pos.x * CELL_SIZE, pos.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
  }

  ctx.fillStyle = ATTACKABLE_FILL
  for (const pos of options.attackable) {
    ctx.fillRect(pos.x * CELL_SIZE, pos.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
  }

  ctx.fillStyle = TECH_TARGET_FILL
  for (const pos of options.techTargets) {
    ctx.fillRect(pos.x * CELL_SIZE, pos.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
  }

  if (options.inspectedReachable) {
    ctx.fillStyle = INSPECT_THREAT_FILL
    for (const pos of options.inspectedReachable) {
      ctx.fillRect(pos.x * CELL_SIZE, pos.y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
    }
  }

  ctx.strokeStyle = GRIDLINE
  for (let x = 0; x <= map.width; x++) {
    ctx.beginPath()
    ctx.moveTo(x * CELL_SIZE, 0)
    ctx.lineTo(x * CELL_SIZE, map.height * CELL_SIZE)
    ctx.stroke()
  }
  for (let y = 0; y <= map.height; y++) {
    ctx.beginPath()
    ctx.moveTo(0, y * CELL_SIZE)
    ctx.lineTo(map.width * CELL_SIZE, y * CELL_SIZE)
    ctx.stroke()
  }

  if (options.weaponRangeDiamond) {
    drawRangeDiamond(ctx, options.weaponRangeDiamond.pos, options.weaponRangeDiamond.range)
  }

  if (options.inspectedRangeDiamond) {
    drawRangeDiamond(
      ctx,
      options.inspectedRangeDiamond.pos,
      options.inspectedRangeDiamond.range,
      INSPECT_RANGE_DIAMOND_STROKE
    )
  }

  if (options.movePreview) {
    for (const pos of options.movePreview.attack) {
      drawCenterDot(ctx, pos, ATTACK_PREVIEW_DOT, 0)
    }
    for (const pos of options.movePreview.tech) {
      drawCenterDot(ctx, pos, TECH_PREVIEW_DOT, 1)
    }
  }

  for (const unit of units) {
    if (!isAlive(unit)) continue

    const drawPos = unit.id === options.movingUnit?.id ? options.movingUnit.pos : unit.pos
    const cx = drawPos.x * CELL_SIZE + CELL_SIZE / 2
    const cy = drawPos.y * CELL_SIZE + CELL_SIZE / 2
    const spriteSize = CELL_SIZE * 0.7

    ctx.save()
    if (unit.hasActivated) ctx.globalAlpha = 0.45
    const sprite = getSprite(TEAM_SPRITE_SRC[unit.team])
    if (sprite.complete && sprite.naturalWidth > 0) {
      ctx.drawImage(sprite, cx - spriteSize / 2, cy - spriteSize / 2, spriteSize, spriteSize)
    }
    ctx.restore()

    if (unit.id === options.activeUnitId) {
      ctx.strokeStyle = ACTIVE_RING
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(cx, cy, spriteSize / 2 + 4, 0, Math.PI * 2)
      ctx.stroke()
    }

    drawStatusEmojis(ctx, unit, cx, cy, spriteSize)

    ctx.fillStyle = unit.hasActivated ? 'rgba(255, 255, 255, 0.4)' : '#ffffff'
    ctx.font = '600 11px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(unit.name, cx, cy - spriteSize / 2 - 8)

    const barWidth = spriteSize
    const barY = cy + spriteSize / 2 + 8
    const hpRatio = unit.maxHp > 0 ? unit.hp / unit.maxHp : 0
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.fillRect(cx - barWidth / 2, barY, barWidth, 4)
    ctx.fillStyle = hpBarColor(hpRatio)
    ctx.fillRect(cx - barWidth / 2, barY, barWidth * hpRatio, 4)
  }

  if (options.actionArrows) {
    for (const arrow of options.actionArrows) {
      drawArrow(ctx, arrow.from, arrow.to, arrow.kind)
    }
  }

  if (options.projectiles) {
    for (const projectile of options.projectiles) {
      drawProjectile(ctx, projectile.from, projectile.to, projectile.kind, projectile.progress)
    }
  }
}
