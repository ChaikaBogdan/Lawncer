# Lawncer

🌱🤖🔥📐🎲

Tactical lawn care with suspiciously familiar mechanics.

[![Quality Checks](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/quality.yml/badge.svg)](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/quality.yml)
[![Tests](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/test.yml/badge.svg)](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/test.yml)
[![Deploy](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/deploy.yml/badge.svg)](https://github.com/ChaikaBogdan/Lawncer/actions/workflows/deploy.yml)

---

<div align="center">

## 🎮 [PLAY NOW](https://chaikabogdan.github.io/Lawncer/)

</div>

---

A browser-based tactics skirmish engine (LANCER-flavored: mechs, heat, structure/stress attrition)
rendered on a single HTML canvas, no game framework. You control a squad on a grid map against an
AI-controlled opposing team, alternating single-unit activations rather than whole-team turns.

## Gameplay

- **Alternating activations** — one unit acts at a time, turn order flips between sides each round;
  never a full team moving in one block.
- **Move is a free action** — one hop per activation, separate from your two Quick Actions (Attack,
  Invade, Shield, Overwatch, Brace, Overcharge, Stabilize), matching tabletop LANCER's economy.
- **Overcharge** grants an extra Quick Action for that activation only, once per activation; its
  heat cost escalates across the whole battle (not just that turn) the more times you use it.
- **Four mech frames** — two player (Everest/Midline, a generalist; Barbarossa/Brawler, an armored
  shotgunner) and two enemy (Sentinel/Sniper, evasive and keeps its distance; Wraith/Swordsman, a
  fast, armored melee brawler) — each with its own HP/Armor/Evasion/Speed and AI behavior.
- **System Reaction** — every frame also has its own second, independent reaction (doesn't share
  Overwatch/Brace's one-at-a-time slot): Everest extends its range, Barbarossa and Sentinel gain
  Evasion, Wraith gets a speed boost. Limited 2 per battle, not once per round — real LANCER's
  convention for a system-granted bonus reaction.
- **Weapon tags** — Smart weapons auto-hit, Knockback shoves the target back a tile on a hit,
  Overkill triples (instead of doubles) crit damage.
- **Attacks** roll a d20 against the target's Evasion; a natural 20 crits for double damage. Misses
  still build heat.
- **HP / Structure** — HP depletes first; hitting 0 consumes a Structure box and refills HP.
  Structure hitting 0 destroys the unit. Every frame has 4 Structure boxes, per tabletop rules.
- **Heat / Stress** — acting builds Heat; overflowing it damages a Stress box instead. Stress hitting
  0 also destroys the unit (reactor meltdown), independent of Structure. Every frame has 4 Stress
  boxes, per tabletop rules.
- **Tech actions** — Invade rolls a d20 against the target's Evasion, just like an attack, but floods
  their systems with heat instead of dealing damage; Shield grants reduced incoming damage to an
  ally or self.
- **Overwatch / Brace** — arm Overwatch to get a free reaction attack when an enemy starts moving
  from within your weapon's threat range; Brace halves the next incoming hit, but locks out your
  next activation's move/Overcharge/reactions and caps it to 1 quick action, and makes you harder
  for anyone to hit until it wears off — all matching the real tabletop rule.
- **Cover & line of sight** — hard cover (walls) blocks LOS entirely, including diagonally past a
  wall corner; soft cover gives a smaller to-hit penalty without blocking movement or sight.
- **Deterministic RNG** — every roll is derived from a seed + call count, so a given seed replays
  identically.
- **In-game tutorial and contextual hints** walk a new player through the above the first time each
  mechanic comes up; both are dismissible and replayable.

## Getting Started

### Prerequisites

- Node.js 24+ (LTS)
- pnpm

### Installation

```bash
pnpm install
```

### Development

Start the development server:

```bash
pnpm dev
```

The app will be available at `http://localhost:5173`

### Building

Build for production:

```bash
pnpm build
```

Preview the production build:

```bash
pnpm preview
```

## Testing

- `pnpm test` — Vitest unit tests for the engine (`src/**/*.test.ts`): combat math, dice, heat/stress,
  structure table, map/LOS, turn order, AI, etc. Fast, pure logic, no browser.
- `pnpm test:e2e` — Playwright tests (`tests/e2e/*.spec.ts`) that drive the actual rendered game
  (canvas clicks, AI turns, overwatch reactions) in headless Chromium. Manual only — not wired into
  the pre-commit hook or CI, since they're slower and some wait 20-30s on AI turns.

## Deployment

This project automatically deploys to GitHub Pages when:

1. ✅ Quality checks pass (linting, formatting, type checking)
2. ✅ Tests pass
3. 📦 Code is pushed to `main` branch

The deployment is protected by required status checks to ensure only quality code goes live.

## Development Workflow

### Local Checks

When you commit, [Lefthook](https://lefthook.dev/) automatically runs:

- **Linting** — ESLint with auto-fix
- **Formatting** — Prettier
- **Type checking** — TypeScript
- **Tests** — Vitest unit tests

Commits are blocked if checks fail.

### CI/CD Pipeline

GitHub Actions runs on every push and PR:

- **Quality Workflow** — lint, format, type-check
- **Test Workflow** — run unit tests
- **Deploy Workflow** — deploy to GitHub Pages (only after quality passes)

## Architecture

- `src/engine/` — pure game logic (state, mech frames, combat math, map/LOS, rules, AI), no DOM
  dependency. Fully unit-tested.
- `src/renderer/` — canvas rendering of the map, units, and range/target overlays.
- `src/ui/` — DOM-based sidebar, roster, combat log, tutorial, and contextual hints; wires player
  input to engine actions.
- `src/scenarios/` — starting map/unit layouts (currently a single demo scenario: two player frames
  vs. two enemy frames).

## Tech Stack

- **Vite** - Fast build tool
- **TypeScript** - Type-safe JavaScript
- **pnpm** - Package manager
- **Vitest** - Unit testing
- **Playwright** - End-to-end browser testing
