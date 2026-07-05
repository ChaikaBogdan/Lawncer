import { expect, test } from '@playwright/test'
import { clickCell, findUnit, getState, manhattan, passUntil } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('canvas.battle-grid')
})

test('Shield grants an ally the shielded status without spending its own action budget twice', async ({
  page,
}) => {
  await page.click('button:has-text("Shield")')
  await clickCell(page, 3, 6) // Barbarossa's own tile

  const state = await getState(page)
  const barbarossa = findUnit(state, 'player-2')
  expect(barbarossa.statuses).toEqual([{ type: 'shielded', roundsRemaining: 2 }])
})

test('Overwatch arms a reaction that fires automatically when an enemy AI unit moves into range', async ({
  page,
}) => {
  test.setTimeout(60000)

  await page.click('button:has-text("Overwatch")')
  let state = await getState(page)
  expect(findUnit(state, 'player-1').overwatch).toBe(true)

  await clickCell(page, 1, 3) // spend the remaining quick action closing distance

  state = await passUntil(page, (s) => !findUnit(s, 'player-1').overwatch, { timeoutMs: 30000 })

  const everest = findUnit(state, 'player-1')
  expect(everest.heat).toBeGreaterThan(0) // it fired its weapon as a reaction
  const damagedEnemy = state.units.find((u) => u.team === 'enemy' && u.hp < u.maxHp)
  expect(damagedEnemy).toBeDefined()
})

test('Invade builds heat on an enemy without dealing HP damage', async ({ page }) => {
  await clickCell(page, 1, 3)
  await clickCell(page, 2, 1)

  const state = await passUntil(page, (s, status) => s.round >= 2 && status.includes('Everest'))
  const everest = findUnit(state, 'player-1')
  const enemies = state.units.filter((u) => u.team === 'enemy' && u.structure > 0)
  const nearest = enemies.reduce((a, b) =>
    manhattan(everest.pos, a.pos) < manhattan(everest.pos, b.pos) ? a : b
  )
  expect(manhattan(everest.pos, nearest.pos)).toBeLessThanOrEqual(3)

  const hpBefore = nearest.hp
  await page.click('button:has-text("Invade")')
  await clickCell(page, nearest.pos.x, nearest.pos.y)

  const after = await getState(page)
  const target = findUnit(after, nearest.id)
  expect(target.hp).toBe(hpBefore)
  expect(target.heat).toBeGreaterThan(0)
})
