import { expect, test } from '@playwright/test'
import { chebyshevDistance, clickCell, findUnit, getState } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('canvas.battle-grid')
})

test('a free move updates position without spending a quick action', async ({ page }) => {
  await clickCell(page, 1, 3)

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  expect(everest.pos).toEqual({ x: 1, y: 3 })
  expect(everest.quickActionsUsed).toBe(0)
  await expect(page.locator('.battle-status')).toContainText('2 quick actions')
  await expect(page.locator('.battle-status')).toContainText('move used')
})

test('clicking an unreachable tile is a no-op', async ({ page }) => {
  await clickCell(page, 7, 0) // far beyond Everest's move speed of 3

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  expect(everest.pos).toEqual({ x: 1, y: 6 })
  expect(everest.quickActionsUsed).toBe(0)
})

test('a second move in the same activation is a no-op', async ({ page }) => {
  await clickCell(page, 1, 3)
  await clickCell(page, 1, 0) // would otherwise be reachable from (1,3)

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  expect(everest.pos).toEqual({ x: 1, y: 3 })
})

test('spending both quick actions hands the turn to the enemy team', async ({ page }) => {
  await page.click('button:has-text("Shield")')
  await clickCell(page, 1, 6) // Everest's own tile
  await page.click('button:has-text("Shield")')
  await clickCell(page, 3, 6) // Barbarossa's tile

  await expect(page.locator('.battle-status')).toContainText('ENEMY')
  const state = await getState(page)
  expect(state.activeTeam).toBe('enemy')
})

test('closing to weapon range and attacking damages the target and builds heat on the attacker', async ({
  page,
}) => {
  // One free move is enough to bring Sentinel within weapon range — no need to wait out a whole
  // round (and no need to linger in its guaranteed-hit Smart Rifle range for several idle turns).
  await clickCell(page, 2, 3)

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  const enemies = state.units.filter((u) => u.team === 'enemy' && u.structure > 0)
  const nearest = enemies.reduce((a, b) =>
    chebyshevDistance(everest.pos, a.pos) < chebyshevDistance(everest.pos, b.pos) ? a : b
  )
  expect(chebyshevDistance(everest.pos, nearest.pos)).toBeLessThanOrEqual(4)

  const hpBefore = nearest.hp
  // Sentinel is quite evasive (10) — attack with both quick actions if the first roll misses,
  // rather than asserting on a single roll's luck.
  let after = state
  for (let i = 0; i < 2 && findUnit(after, nearest.id).hp >= hpBefore; i++) {
    await page.click('button:has-text("Attack")')
    await clickCell(page, nearest.pos.x, nearest.pos.y)
    after = await getState(page)
  }

  expect(findUnit(after, nearest.id).hp).toBeLessThan(hpBefore)
  expect(findUnit(after, 'player-1').heat).toBeGreaterThan(0)
})
