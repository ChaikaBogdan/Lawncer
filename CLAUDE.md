# Lawncer — dev notes

## Architecture

LANCER-flavored tactics skirmish, rendered on a single HTML canvas (no game framework).

- `src/engine/` — pure logic, no DOM: `state/` (GameState, UnitState, `frames.ts` reusable mech
  archetypes, deterministic seeded RNG), `combat/` (dice, damage, heat, overcharge, structure/stress
  tables, weapons + tags, tech), `map/` (grid, cover, line of sight), `rules/` (turn order,
  targeting, engagement, outcome), `ai/` (single-step enemy policy, behavior-driven). Everything
  here is unit-tested and framework-agnostic.
- `src/renderer/canvasRenderer.ts` — draws the map, units, and range/target overlays.
- `src/ui/` — DOM sidebar/roster/combat log plus `tutorial.ts` (first-run walkthrough) and
  `contextualHints.ts` (one-off explainer popups triggered by action type); both are dismissible via
  localStorage flags. `game.ts` wires player clicks to engine actions.
- `src/scenarios/demo.ts` — the one starting map/unit layout used today: two player frames
  (Everest/Midline, Barbarossa/Brawler) vs. two enemy frames (Sentinel/Sniper, Wraith/Swordsman).

## Action economy

Move is a **free action**, capped at one hop per activation (`hasMoved`) — matches tabletop, not
folded into your 2 Quick Actions. Quick Actions (Attack, Invade, Shield, Overwatch, Brace,
Overcharge, Stabilize) still cost from the 2-per-activation budget. Overcharge grants +1 Quick
Action for that activation only (`hasOvercharged`, resets every round), usable once per activation;
its heat cost escalates across the whole scenario (`overchargeCount`, persists across rounds —
1 → 1d3 → 1d6 → 1d6+4).

Brace matches the real rule on both ends: the +1 difficulty bonus applies to _anyone attacking the
braced unit_ (`BRACED_DEFENSE_BONUS` in `attackDifficulty`), not a penalty on whoever landed the
triggering hit; and the braced unit's next activation is locked down — no move, no Overcharge, no
reactions, and only 1 Quick Action (`resolveMove`/`resolveOvercharge` both throw on a `'braced'`
unit, on top of the existing quick-action cap in `quickActionBudget`).

## Frames and weapon tags

`src/engine/state/frames.ts` defines reusable stat blocks (HP/Armor/Evasion/Heat Cap/Speed +
weapon + `AiBehavior` + `systemReactionStatus`) analogous to how `weapons.ts` provides reusable
`Weapon` presets. Per real tabletop LANCER, Structure and Stress caps are fixed at 4 for every
frame regardless of chassis — only HP and the other stats vary by role. `AiBehavior`
(`'aggressive' | 'kiting'`) only affects the AI's movement-fallback direction (close distance vs.
maximize it); attack/invade/shield priorities are behavior-agnostic. Weapons carry
`tags: WeaponTag[]` (`'smart'` auto-hits, `'knockback'` shoves the target back a tile on hit,
`'overkill'` triples instead of doubles crit damage) plus a separate `threat` stat that governs
Overwatch-reaction range and melee/cover checks independently of the weapon's actual attack
`range`. Wraith (Swordsman) is Speed 3 (not 4) — used to coincide with several player weapons'
Threat 4 and let it leap straight into melee without ever satisfying Overwatch's "starts moving
from within threat" trigger. Wraith and Barbarossa both cap Armor at 1, not 2 — this engine's
weapon damage is flat and compressed (2-3, not tabletop's dice pools), so Armor 2 fully zeroed out
Rifle/Smart Rifle's 2 damage on every non-crit hit, a hard counter rather than a reduction.

## System Reaction

A second, independent reaction slot per unit (`systemReactionArmed`) — doesn't share
Overwatch/Brace's real "1 reaction per turn" cap, since it models a system-granted _additional_
reaction (real LANCER precedent: some mech systems grant an extra reaction beyond the base one).
Same trigger as Overwatch (enemy starts moving from within threat — see `reactionTriggered` in
`resolve.ts`), but grants the unit its own frame-specific buff status instead of an attack: Everest
→ `extendedRange` (+1 weapon range), Barbarossa → `guarded` (+1 Evasion), Wraith → `boosted` (+1
move speed), Sentinel → `entrenched` (+2 Evasion, matching hard cover). **Limited 2** per scenario
(`systemReactionUses`, persists across rounds like `overchargeCount`) — real LANCER's convention
for a system-granted bonus reaction is a fixed scene-wide charge count, not a per-round cooldown.
The AI arms and uses it too (see `simpleAi.ts`'s fallback priority, after Overwatch) — its guard
must check `systemReactionUses < SYSTEM_REACTION_CHARGES` before proposing it, same as the
`hasMoved`/Braced guards, or an exhausted unit's turn stalls forever retrying a throwing action.

## Testing

- `pnpm test` — vitest unit tests for the engine (`src/**/*.test.ts`). Fast, pure logic, no browser. Run constantly.
- `pnpm test:e2e` — Playwright browser tests (`tests/e2e/*.spec.ts`) that drive the actual rendered game (canvas clicks, AI turns, overwatch reactions) via headless Chromium.
  - **Not** wired into lefthook pre-commit or any CI — deliberately manual only, since they're slow (spin up a dev server + real browser) and some take 20-30s waiting on AI turns.
  - Run them manually after finishing a big feature or milestone, not after every small change.
- `pnpm tsc -p tsconfig.vitest.json --noEmit` type-checks both `src` and `tests` (this is what lefthook's pre-commit type-check hook runs).
