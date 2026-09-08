# Project Decisions

This file records important technical and design decisions so future team members and AI assistants understand why the project is structured the way it is.

Do not remove old decisions simply because the implementation changes.

If a decision is reversed, add a new dated entry.

---

## 2026-09 — Three Separate Level Modules

**Decision**

Each level is implemented independently behind the same basic lifecycle.

**Reason**

The levels use intentionally different gameplay and the team needs to develop in parallel.

Expected lifecycle:

```js
load()
update(dt)
dispose()
```

---

## 2026-09 — Shared Systems Underneath Distinct Levels

**Decision**

Reuse internal systems where practical without making the player experiences similar.

Examples:

- vehicles
- waypoint movement
- collision helpers
- camera helpers
- UI shell

**Reason**

The project should avoid duplicated technical work while still satisfying the requirement that all three levels are genuinely different.

---

## 2026-09 — Primitive Blockout Before Detailed Wits Assets

**Decision**

All three levels should become playable using primitive geometry before major visual production.

**Reason**

Environment modelling is one of the project's largest schedule risks.

---

## 2026-09 — Level 1 Custom Asphalt Shader

**Decision**

The primary custom shader is integrated into the damaged / wet road surface in Level 1.

**Reason**

The shader should be visible, mechanically relevant and easy to explain during the demonstration.

---

## 2026-09 — Simple Purpose-Built Physics First

**Decision**

Start with simple custom movement and collision rather than immediately adding a full physics engine.

**Reason**

The MVP mechanics do not currently require a complex general-purpose physics engine.

This decision can be revisited if the gameplay genuinely requires one.

---

## 2026-09 — Relative Asset Paths

**Decision**

Use relative runtime asset paths.

Example:

```text
./assets/models/car.glb
```

Do not use:

```text
/assets/models/car.glb
```

**Reason**

The final game is deployed below the server root.

---

## 2026-09 — Lowercase Hyphenated Asset Filenames

**Decision**

Runtime asset filenames must be lowercase and hyphen-separated.

**Reason**

The final deployment environment is Linux and filename case matters.

---

## 2026-09 — Keep Main Demonstrable

**Decision**

Feature work happens on branches and `main` should remain runnable.

**Reason**

The project has six contributors and frequent demonstrations / mentor feedback.

---

## 2026-09-08 — Level 3 Uses Peek, Recall, and Desk Entry

**Decision**

Replace continuous hold-to-copy progress with a spatial observation loop. The seated player holds left click to zoom at one of seven nearby answer tablets, reads the targeted hologram, releases zoom, looks down at their own paper, types the word, and submits it with Enter.

The six left/right neighbours plus the tablet directly behind the player are functional. Other classroom tablets are decorative. Correct answers reroll the answered tablet, and suspicion is accumulated only while the tutor sees an active tablet peek.

Zoom uses a semi-transparent heart-shaped hand overlay that rises from below the screen, sways slightly, and is anchored to the centre of the viewing opening. The HTML overlay remains hidden until Level 3 initializes to prevent refresh flashing.

**Reason**

The new mechanic makes the player deliberately look around the classroom, remember a specific answer, return to their own desk, and balance observation time against tutor attention. It is more spatial and readable than passive progress from holding Space while preserving Level 3's seated stealth identity.

Detailed invariants are recorded in `docs/LEVEL_3_CHEATING_MECHANICS.md`.

---

## 2026-09-04 — Repository and Branch Conventions

**Decision**

Issue branches use:

```text
<area>/<issue-number>-<short-description>
```

Supported areas are:

```text
level-1
level-2
level-3
engine
gfx
docs
chore
```

Level-specific code remains under `src/levels/`.

A single-module level may live directly under `src/levels/`. When a level develops multiple level-specific support modules, those modules and the main level module are grouped in a lowercase level subdirectory.

Imported JavaScript shader modules belong under `src/shaders/`. Static runtime assets belong under `public/assets/`.

JavaScript classes and major modules use PascalCase, utilities use camelCase, and shader modules use camelCase ending in `Shader.js`.

**Reason**

The project has six contributors working in parallel. Explicit branch, naming and placement rules reduce merge conflicts, duplicated structures and uncertainty about where new work belongs.

The convention preserves the current repository structure without unnecessary file moves while active feature branches may depend on those paths.
