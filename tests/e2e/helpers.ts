import type { Page } from '@playwright/test'

export const CELL_SIZE = 64

/** Mirrors src/engine/state/types.ts's GameState shape closely enough for assertions in tests. */
export interface DebugUnit {
  id: string
  team: 'player' | 'enemy'
  pos: { x: number; y: number }
  hp: number
  maxHp: number
  structure: number
  stress: number
  heat: number
  heatCap: number
  overwatch: boolean
  statuses: { type: string; roundsRemaining: number }[]
  quickActionsUsed: number
  hasActivated: boolean
}

export interface DebugState {
  round: number
  activeTeam: 'player' | 'enemy'
  activeUnitId?: string
  units: DebugUnit[]
}

export async function getState(page: Page): Promise<DebugState> {
  return page.evaluate(() =>
    (window as unknown as { __LAWNCER__: { getState(): DebugState } }).__LAWNCER__.getState()
  )
}

export async function clickCell(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator('canvas.battle-grid').boundingBox()
  if (!box) throw new Error('battle-grid canvas not found')
  await page.mouse.click(
    box.x + x * CELL_SIZE + CELL_SIZE / 2,
    box.y + y * CELL_SIZE + CELL_SIZE / 2
  )
  await waitForAnimation(page)
}

/**
 * Moves/attacks/invades now animate before committing state (projectile flight / unit slide) —
 * poll the debug hook's `isAnimating` flag instead of a fixed sleep so this stays correct even if
 * the animation durations change later.
 */
export async function waitForAnimation(page: Page, timeoutMs = 5000): Promise<void> {
  await page.waitForFunction(
    () =>
      !(window as unknown as { __LAWNCER__: { isAnimating(): boolean } }).__LAWNCER__.isAnimating(),
    undefined,
    { timeout: timeoutMs }
  )
}

export function findUnit(state: DebugState, id: string): DebugUnit {
  const unit = state.units.find((u) => u.id === id)
  if (!unit) throw new Error(`Unit not found: ${id}`)
  return unit
}

export function manhattan(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

/**
 * Clicks "End activation" whenever it's the player's turn and otherwise just waits — the AI acts
 * on its own timer — until `predicate` is satisfied. Avoids fixed-count loops / arbitrary sleeps.
 */
export async function passUntil(
  page: Page,
  predicate: (state: DebugState, statusText: string) => boolean,
  { timeoutMs = 20000, pollMs = 300 } = {}
): Promise<DebugState> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const state = await getState(page)
    const status = (await page.locator('.battle-status').textContent()) ?? ''
    if (predicate(state, status)) return state
    if (Date.now() > deadline) throw new Error('passUntil: condition not met before timeout')

    if (status.includes('PLAYER')) {
      await page.click('button:has-text("End activation")')
    } else {
      await page.waitForTimeout(pollMs)
    }
  }
}
