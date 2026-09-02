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
