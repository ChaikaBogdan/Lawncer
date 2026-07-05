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
10. Debug tools
11. Extensions (tech, overwatch, multiplayer prep)

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
