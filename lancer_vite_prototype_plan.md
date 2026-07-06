# LANCER-Like Combat Prototype Plan (Claude Code)

## Stack: Vite + TypeScript

## Goal

Build a LANCER-inspired tactical combat sandbox in the browser using Vite + TypeScript with a pure rules engine and simple renderer.

## Rule References

- https://lancer-rules.carrd.co/
- https://hackmd.io/I7LgkhH2S7S2uvesYuhKNA
- https://heliospectral.itch.io/lancer-action-reference-sheet
- https://massif-press.itch.io/

## Architecture

src/
engine/
combat/
actions/
rules/
state/
map/

renderer/
ui/
scenarios/

## Core Loop

GameState -> Actions -> resolve() -> New GameState -> Render

## Milestones

1. Engine skeleton (pure logic only)
2. Canvas renderer (grid + units)
3. Turn system (alternating activations)
4. Action economy (Move, Skirmish, Barrage, Boost, Brace, Overcharge, Stabilize, Lock On)
5. Weapons (rifle, shotgun, sword)
6. Map system (walls, cover, empty)
7. Status effects
8. Heat + structure system
9. Simple AI
10. Extensions (tech, overwatch)

## Principles

- No engine/UI coupling
- Deterministic state
- JSON-driven simulation
- Claude edits only one milestone at a time

---

# 🧠 Core LANCER Identity Rules (What makes it LANCER, not generic mech combat)

These rules define the _identity layer_ of LANCER. They MUST be implemented early or the prototype will drift into generic tactics.

---

## ⚙️ 1. Alternating Activations (NOT initiative)

- Combat is structured by **side-based alternating turns**
- A team activates one unit at a time
- No full initiative order per unit

Flow:

- Player activates 1 mech
- Enemy activates 1 mech
- Repeat until all units act

Key effect:

> Prevents "alpha strike deletion" gameplay and enforces tactical reaction play

---

Before milestone 2 (renderer), add:

1.5 — JSON Replay System

Every action is appended to a log.
Game can replay from turn 1.
Deterministic random number generator.
Save/load from JSON.

This pays off enormously later for debugging AI and combat logic.

## 🔥 2. Heat System (core resource pressure)

Heat is NOT mana. It is **risk pressure**.

- Actions generate heat
- Taking too much heat causes:
  - impaired systems
  - instability
  - meltdown risk

Important identity:

- Heat is a _failure state mechanic_, not a cost system
- Players are encouraged to “push reactor limits”

Must include:

- Heat capacity
- Overheat thresholds
- Stress consequences

---

## 🧩 3. Structure & Stress (mech durability model)

Mechs do NOT use HP as primary identity.

Instead:

- HP = structure layer abstraction
- Structure damage causes:
  - system loss
  - weapon destruction
  - critical failure

Stress system:

- Represents pilot/mech integrity under strain
- Failing stress → catastrophic outcomes

Key identity:

> LANCER is about _degradation_, not simple HP reduction

---

## 🎯 4. Action Economy (2-Action system)

Each activation:

- 1 Move
- - 2 Quick Actions
    OR
- 1 Full Action

Plus:

- Free actions
- Reactions (later milestone)
- Overcharge (risk-based extra action)

Key identity:

> Overcharging is intentionally dangerous and tied to Heat

---

## 🛰️ 5. Range, Zones, and Positioning Matter More Than DPS

LANCER is not DPS racing.

Core tactical identity:

- Range bands matter
- Line of sight matters
- Cover matters
- Engagement control matters

No “stand still and trade hits” meta should exist.

---

## 🧠 6. Systems > Weapons

Weapons are NOT the main identity.

Instead:

- Mechs are defined by SYSTEMS
- Systems are modular abilities:
  - shields
  - teleport
  - drones
  - hacking
  - overwatch control

Weapons are just one subsystem.

---

## 🧬 7. Mech Frames Define Playstyle

Each mech frame should define:

- stat profile
- core passive traits
- hard limits
- role identity

Frames are NOT cosmetic:

> They are gameplay archetypes

---

## ⚡ 8. Limited, Meaningful Power Usage (not spam skills)

Abilities are:

- cooldown-like OR heat-gated
- not spam rotation

Identity:

> Tactical timing > mechanical APM

---

## ☠️ 9. Combat is Attrition + Position + Risk

Winning is not:

- damage race

Winning is:

- position control
- heat management
- attrition over multiple rounds

---

## 🧾 10. Everything must be legible in JSON state

To support simulation + Claude iteration:

Must include:

- heat
- stress
- structure
- statuses
- activation state
- per-unit action history

---

## 🧭 Design Warning

If any of these are missing:

- heat risk loop
- structure degradation
- alternating activation

→ the system will become "generic mech tactics" and lose LANCER identity.

---

# 📋 Plan — 2026-07-06: Close PC-combat rule gaps vs real LANCER

Compared current engine (`src/engine/`) against real LANCER core rules ([lancer-rules.carrd.co](https://lancer-rules.carrd.co/), [combat cheatsheet](https://hackmd.io/@hohouyj/SJ2vwUDWt)), scoped to small PC-adoptable combat only (no licensing/mission/downtime).

## Current state summary

- Action economy is a flat 2-quick-action pool; no Full Action tier, no Overcharge.
- Turn structure (alternating single-unit activation) already matches real LANCER. ✅
- No cover concept at all (`src/engine/map/lineOfSight.ts` is binary blocked/not-blocked).
- Structure loss (`src/engine/combat/damage.ts`) and stress/heat overflow (`src/engine/combat/heat.ts`) each have one fixed deterministic outcome (Stunned / Impaired), not real LANCER's escalating random tables.
- Only 3 statuses exist (`stunned`, `impaired`, `shielded`) vs real LANCER's 13+; missing **Engaged** and **Exposed** in particular.
- Only 1 reaction (Overwatch); missing **Brace**.

## Priority order for today

1. **Cover (soft/hard)** — biggest missing mechanic; undermines design doc's own rule #5 (positioning > DPS). Add cover level lookup between attacker/defender line, apply to-hit modifier for ranged attacks only (melee ignores cover per real rules).
2. **Overcharge** — free extra quick action paid in heat, escalating cost (1 → 1d3 → 1d6 → 1d6+4), resets each activation. Explicitly named in this doc's own "Core Identity" section as required.
3. **Engaged status** — moving adjacent to a hostile marks both Engaged; ranged attacks while Engaged take an accuracy penalty. Creates real melee threat/commit-or-disengage tension.
4. **Brace reaction** — halve incoming damage/heat on a triggered attack, costs your next turn's action budget (only 1 quick action, no reactions until next round). Pairs naturally with Exposed/stress work.

Lower priority (do only if time remains): convert structure/stress fixed outcomes into real escalating d6-per-missing-box tables with System Trauma (destroy random weapon/system) and Exposed-on-destabilized-power-plant.

## Out of scope today

Full tech/system suite (drones, deployables, hacking beyond Invade), non-Overwatch/Brace reactions — reasonable to defer per the design doc's own milestone ordering.

---

# 📋 Next up: Weapon Tags/Mounts + Mech Frames (generic, non-IP)

Both scoped as **generic mechanics with original names/stats** — no LANCER frame/weapon proper nouns, just the underlying gameplay systems, consistent with how `RIFLE`/`SHOTGUN`/`SWORD` are already original names for existing mechanics.

## Weapon tags & mounts

- **Tags** (modifiers on a `Weapon`): Accurate/Inaccurate (to-hit bonus/penalty, stacking with our existing flat evasion-modifier system rather than real LANCER's accuracy dice pool), AP (ignores cover's to-hit bonus, since we have no armor/resistance system to "ignore" otherwise), Knockback (pushes the target back N tiles post-hit, clamped to map bounds/blocked by walls/units).
- **Mounts**: gives a unit more than one weapon slot (Main + Aux, or a single Heavy). Unlocks a genuine **Barrage** full action (attack with multiple mounts at once) — currently impossible since every unit has exactly one weapon.
- Needs: `Weapon.tags`, `UnitState.mounts: Weapon[]` (or similar) replacing the single `weapon` field, targeting/AI updates for multi-weapon choice, and a real Full Action (Barrage) to spend the whole turn firing every mount.

## Mech frames

- A small roster of **generic frame archetypes** (e.g. a tanky brawler, a glass-cannon sniper, a mobile skirmisher) — each a named stat/trait bundle (HP/structure/heat-cap/evasion/moveSpeed profile + starting mounts), not just ad-hoc `mech()` calls in `demo.ts`.
- Gives the roster real identity (design doc's Core Identity Rule #7) instead of interchangeable stat bags, and is the natural home for weapon-tag/mount variety above.
- Needs: a `Frame` type + a small catalog (3-4 frames), `demo.ts` building units from frames instead of inline stats.
