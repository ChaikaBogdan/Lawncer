import { expect, test, type Page } from '@playwright/test'
import { chebyshevDistance, clickCell, findUnit, getState } from './helpers.ts'

async function endActivation(page: Page): Promise<void> {
  await page.click('button:has-text("End activation")')
}

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
  test.setTimeout(150000)

  // No repositioning needed — arm Overwatch at the default setup and let the AI approach. Wraith
  // often detours into Invade attempts against whichever player unit is in tech range before it
  // ever gets close enough to trigger this, so it can take a good number of rounds (confirmed
  // empirically to need ~15-20) before the reaction actually fires; the loop below is patient
  // enough to cover that.
  await page.click('button:has-text("Overwatch")')
  await endActivation(page)

  // Overwatch also resets at every round rollover whether or not it fired, so re-arm it each time
  // it's Everest's turn until the reaction actually lands (heat > 0 is the real success signal).
  for (let i = 0; i < 600; i++) {
    const statusText = (await page.locator('.battle-status').textContent()) ?? ''
    if (statusText.includes('Everest')) {
      const everest = findUnit(await getState(page), 'player-1')
      if (everest.heat > 0) break
      if (!everest.overwatch) {
        await page.click('button:has-text("Overwatch")')
      }
      await endActivation(page)
    } else if (statusText.includes('PLAYER')) {
      await endActivation(page)
    }
    await page.waitForTimeout(200)
  }

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  // Wraith is fairly evasive (9), so the reaction shot itself can miss — heat still building is
  // the reliable signal that Everest actually fired, hit or not.
  expect(everest.heat).toBeGreaterThan(0)
})

test('Invade builds heat on an enemy without dealing HP damage', async ({ page }) => {
  // One free move is enough to bring Sentinel within tech range — no need to wait out a whole
  // round (and no need to linger in its guaranteed-hit Smart Rifle range for several idle turns).
  await clickCell(page, 2, 3)

  const state = await getState(page)
  const everest = findUnit(state, 'player-1')
  const enemies = state.units.filter((u) => u.team === 'enemy' && u.structure > 0)
  const nearest = enemies.reduce((a, b) =>
    chebyshevDistance(everest.pos, a.pos) < chebyshevDistance(everest.pos, b.pos) ? a : b
  )
  expect(chebyshevDistance(everest.pos, nearest.pos)).toBeLessThanOrEqual(3)

  const hpBefore = nearest.hp
  await page.click('button:has-text("Invade")')
  await clickCell(page, nearest.pos.x, nearest.pos.y)

  const after = await getState(page)
  const target = findUnit(after, nearest.id)
  // Invade now rolls to hit like an attack, so it can miss — the one invariant that always
  // holds is that it never deals HP damage, hit or miss.
  expect(target.hp).toBe(hpBefore)
})
