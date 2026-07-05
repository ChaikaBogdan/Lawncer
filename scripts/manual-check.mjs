// Scratch script for one-off manual browser verification during development.
// Not a test suite (see tests/e2e/ for the committed Playwright suite) — this file
// is expected to be rewritten per task: edit the steps below, run it, read the output.
//
// Prerequisites:
//   1. A dev server running at http://localhost:5173/Lawncer/ (pnpm dev --port 5173 --strictPort)
//   2. Chromium available via @playwright/test (already installed as a project devDependency)
//
// Run with: node scripts/manual-check.mjs

import { chromium } from '@playwright/test'

const BASE_URL = 'http://localhost:5173/Lawncer/'
const CELL_SIZE = 64

async function hoverCell(page, x, y) {
  const box = await page.locator('canvas.battle-grid').boundingBox()
  if (!box) throw new Error('battle-grid canvas not found')
  await page.mouse.move(
    box.x + x * CELL_SIZE + CELL_SIZE / 2,
    box.y + y * CELL_SIZE + CELL_SIZE / 2
  )
}

const browser = await chromium.launch({ args: ['--no-sandbox'] })
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } })
const errors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text())
})
page.on('pageerror', (err) => errors.push(String(err)))

await page.goto(BASE_URL)
await page.waitForSelector('canvas.battle-grid')
await page.waitForTimeout(200)
await page.click('.tutorial-footer button:not(.tutorial-skip)') // dismiss welcome step

// player-1 (Everest) activates first in round 1; hover player-2 (Barbarossa), the non-active ally.
const state = await page.evaluate(() => window.__LAWNCER__.getState())
const active = state.units.find((u) => u.id === 'player-1')
const otherAlly = state.units.find((u) => u.id === 'player-2')
console.log('active unit:', active.id, 'other ally:', otherAlly.id, otherAlly.pos)
await hoverCell(page, otherAlly.pos.x, otherAlly.pos.y)
await page.waitForTimeout(150)
await page.screenshot({ path: '/tmp/manual-check-ally-hover.png' })

// Hover the active unit itself — should NOT show inspection overlay (it's already the decision-maker).
await hoverCell(page, active.pos.x, active.pos.y)
await page.waitForTimeout(150)
await page.screenshot({ path: '/tmp/manual-check-active-hover-noop.png' })

console.log('console errors:', errors)
await browser.close()
