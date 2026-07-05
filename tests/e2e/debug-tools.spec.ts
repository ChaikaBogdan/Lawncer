import { expect, test } from '@playwright/test'
import { clickCell, findUnit, getState } from './helpers.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForSelector('canvas.battle-grid')
})

test('window.__LAWNCER__.replay() deterministically reproduces the live state', async ({
  page,
}) => {
  await clickCell(page, 1, 3)

  const matches = await page.evaluate(() => {
    const dbg = (window as unknown as { __LAWNCER__: { getState(): unknown; replay(): unknown } })
      .__LAWNCER__
    return JSON.stringify(dbg.replay()) === JSON.stringify(dbg.getState())
  })

  expect(matches).toBe(true)
})

test('Reset scenario restores the original unit positions and clears the log', async ({ page }) => {
  await clickCell(page, 1, 3)
  let state = await getState(page)
  expect(findUnit(state, 'player-1').pos).toEqual({ x: 1, y: 3 })

  await page.click('button:has-text("Reset scenario")')

  state = await getState(page)
  expect(findUnit(state, 'player-1').pos).toEqual({ x: 1, y: 6 })
  await expect(page.locator('.battle-status')).toContainText('Round 1')

  const logLength = await page.evaluate(
    () =>
      (window as unknown as { __LAWNCER__: { getLog(): unknown[] } }).__LAWNCER__.getLog().length
  )
  expect(logLength).toBe(0)
})

test('window.__LAWNCER__ console hook exposes state, log, and replay', async ({ page }) => {
  await clickCell(page, 1, 3)

  const result = await page.evaluate(() => {
    const dbg = (window as unknown as { __LAWNCER__: Record<string, () => unknown> }).__LAWNCER__
    const log = dbg.getLog() as unknown[]
    return {
      hasGetState: typeof dbg.getState === 'function',
      hasReplay: typeof dbg.replay === 'function',
      logLength: log.length,
    }
  })

  expect(result).toEqual({ hasGetState: true, hasReplay: true, logLength: 1 })
})
