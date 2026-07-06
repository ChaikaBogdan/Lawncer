import { isCornerCut, isWall } from './grid.ts'
import type { MapState, Position } from '../state/types.ts'

/** Grid cells crossed by the straight line from `a` to `b`, inclusive of both ends. */
function bresenhamLine(a: Position, b: Position): Position[] {
  const points: Position[] = []
  let x = a.x
  let y = a.y
  const dx = Math.abs(b.x - x)
  const dy = -Math.abs(b.y - y)
  const stepX = x < b.x ? 1 : -1
  const stepY = y < b.y ? 1 : -1
  let err = dx + dy

  for (;;) {
    points.push({ x, y })
    if (x === b.x && y === b.y) break
    const doubledErr = 2 * err
    if (doubledErr >= dy) {
      err += dy
      x += stepX
    }
    if (doubledErr <= dx) {
      err += dx
      y += stepY
    }
  }

  return points
}

/**
 * Walls fully block sight; the attacker's and target's own tiles never count as blockers. A
 * diagonal step in the traced line is also blocked if both flanking orthogonal tiles are walls —
 * otherwise a shooter could snipe diagonally through a solid wall corner, the same gap movement
 * already closes via `isCornerCut`.
 */
export function hasLineOfSight(map: MapState, from: Position, to: Position): boolean {
  const points = bresenhamLine(from, to)
  return points.every((pos, i) => {
    const isEndpoint = (pos.x === from.x && pos.y === from.y) || (pos.x === to.x && pos.y === to.y)
    if (!isEndpoint && isWall(map, pos)) return false
    if (i === 0) return true
    const prev = points[i - 1]
    const offset = { x: pos.x - prev.x, y: pos.y - prev.y }
    return !isCornerCut(map, prev, offset)
  })
}
