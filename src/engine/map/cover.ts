import { isWall } from './grid.ts'
import type { MapState, Position } from '../state/types.ts'

/** Hard cover (a wall) is a bigger to-hit penalty than soft cover (rubble/low terrain). */
export const HARD_COVER_BONUS = 2
export const SOFT_COVER_BONUS = 1

function isCoverTile(map: MapState, pos: Position): boolean {
  return map.cover.some((tile) => tile.x === pos.x && tile.y === pos.y)
}

/**
 * The to-hit bonus a defender gets from terrain between them and the attacker: the probe tile is
 * the one step from the defender toward the attacker. A wall there grants hard cover; cover
 * terrain grants soft cover; anything else (open ground) grants none.
 */
export function coverBonus(map: MapState, attackerPos: Position, defenderPos: Position): number {
  const dx = Math.sign(attackerPos.x - defenderPos.x)
  const dy = Math.sign(attackerPos.y - defenderPos.y)
  if (dx === 0 && dy === 0) return 0

  const probe = { x: defenderPos.x + dx, y: defenderPos.y + dy }
  if (isWall(map, probe)) return HARD_COVER_BONUS
  if (isCoverTile(map, probe)) return SOFT_COVER_BONUS
  return 0
}
