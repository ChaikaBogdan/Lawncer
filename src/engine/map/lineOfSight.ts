import { isWall } from './grid.ts'
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

/** Walls fully block sight; the attacker's and target's own tiles never count as blockers. */
export function hasLineOfSight(map: MapState, from: Position, to: Position): boolean {
  return bresenhamLine(from, to).every((pos) => {
    const isEndpoint = (pos.x === from.x && pos.y === from.y) || (pos.x === to.x && pos.y === to.y)
    return isEndpoint || !isWall(map, pos)
  })
}
