import { expect, test } from '@playwright/test'
import { clickCell, findUnit, getState, manhattan, passUntil } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('canvas.battle-grid')
})

test('moving a unit updates its position and consumes a quick action', async ({ page }) => {
  await clickCell(page, 1, 3)

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  expect(everest.pos).toEqual({ x: 1, y: 3 })
  expect(everest.quickActionsUsed).toBe(1)
  await expect(page.locator('.battle-status')).toContainText('1 quick action')
})

test('clicking an unreachable tile is a no-op', async ({ page }) => {
  await clickCell(page, 7, 0) // far beyond Everest's move speed of 3

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  expect(everest.pos).toEqual({ x: 1, y: 6 })
  expect(everest.quickActionsUsed).toBe(0)
})

test('spending both quick actions hands the turn to the enemy team', async ({ page }) => {
  await clickCell(page, 1, 3)
  await clickCell(page, 0, 3)

  await expect(page.locator('.battle-status')).toContainText('ENEMY')
  const state = await getState(page)
  expect(state.activeTeam).toBe('enemy')
})

test('closing to weapon range and attacking damages the target and builds heat on the attacker', async ({
  page,
}) => {
  await clickCell(page, 1, 3)
  await clickCell(page, 2, 1)

  const state = await passUntil(page, (s, status) => s.round >= 2 && status.includes('Everest'))
  const everest = findUnit(state, 'player-1')
  const enemies = state.units.filter((u) => u.team === 'enemy' && u.structure > 0)
  const nearest = enemies.reduce((a, b) =>
    manhattan(everest.pos, a.pos) < manhattan(everest.pos, b.pos) ? a : b
  )
  expect(manhattan(everest.pos, nearest.pos)).toBeLessThanOrEqual(4)

  const hpBefore = nearest.hp
  await page.click('button:has-text("Attack")')
  await clickCell(page, nearest.pos.x, nearest.pos.y)

  const after = await getState(page)
  expect(findUnit(after, nearest.id).hp).toBeLessThan(hpBefore)
  expect(findUnit(after, 'player-1').heat).toBeGreaterThan(0)
})
