import type { MapState, Position, UnitState } from '../state/types.ts'
import { isAlive } from '../state/unit.ts'

export function key(pos: Position): string {
  return `${pos.x},${pos.y}`
}

export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/** Chessboard distance: allows diagonal steps to count the same as orthogonal ones. */
export function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y))
}

export function inBounds(map: MapState, pos: Position): boolean {
  return pos.x >= 0 && pos.y >= 0 && pos.x < map.width && pos.y < map.height
}

export function isWall(map: MapState, pos: Position): boolean {
  return map.walls.some((wall) => wall.x === pos.x && wall.y === pos.y)
}

export function isOccupied(units: UnitState[], pos: Position, excludeUnitId?: string): boolean {
  return units.some(
    (unit) =>
      unit.id !== excludeUnitId && isAlive(unit) && unit.pos.x === pos.x && unit.pos.y === pos.y
  )
}

/** One tile directly away from `from`, on the far side of `target` — undefined if blocked. */
export function knockbackDestination(
  map: MapState,
  units: UnitState[],
  from: Position,
  target: Position,
  excludeUnitId: string
): Position | undefined {
  const dest = {
    x: target.x + Math.sign(target.x - from.x),
    y: target.y + Math.sign(target.y - from.y),
  }
  if (!inBounds(map, dest) || isWall(map, dest) || isOccupied(units, dest, excludeUnitId)) {
    return undefined
  }
  return dest
}

const NEIGHBOR_OFFSETS: Position[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: 1 },
  { x: -1, y: -1 },
]

/**
 * A diagonal step is blocked if both flanking orthogonal tiles are walls — otherwise a unit could
 * cut through a solid wall corner, which no tactics grid allows.
 */
export function isCornerCut(map: MapState, current: Position, offset: Position): boolean {
  if (offset.x === 0 || offset.y === 0) return false
  return (
    isWall(map, { x: current.x + offset.x, y: current.y }) &&
    isWall(map, { x: current.x, y: current.y + offset.y })
  )
}

/** Tiles reachable within `moveSpeed` steps (8-directional), blocked by walls and other units. */
export function reachableTiles(
  map: MapState,
  units: UnitState[],
  from: Position,
  moveSpeed: number,
  excludeUnitId?: string
): Position[] {
  const visited = new Map<string, number>([[key(from), 0]])
  const queue: Position[] = [from]
  const result: Position[] = []

  while (queue.length > 0) {
    const current = queue.shift()!
    const cost = visited.get(key(current))!

    if (cost >= moveSpeed) continue

    for (const offset of NEIGHBOR_OFFSETS) {
      const next = { x: current.x + offset.x, y: current.y + offset.y }
      const nextKey = key(next)

      if (visited.has(nextKey)) continue
      if (!inBounds(map, next)) continue
      if (isWall(map, next)) continue
      if (isOccupied(units, next, excludeUnitId)) continue
      if (isCornerCut(map, current, offset)) continue

      visited.set(nextKey, cost + 1)
      queue.push(next)
      result.push(next)
    }
  }

  return result
}
