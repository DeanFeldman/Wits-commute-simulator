# Architecture

## Goal

Keep level-specific systems isolated while allowing genuinely reusable systems to be shared.

The intended dependency direction is:

```text
Core / Engine
    ↓
Shared Systems
    ↓
Level Modules
```

---

## Suggested Structure

```text
src/
├── main.js
├── core/
│   ├── Game.js
│   ├── InputManager.js
│   ├── StateMachine.js
│   └── AssetManager.js
├── levels/
│   ├── ParkingLevel.js
│   ├── crossing/
│   │   ├── CrossingLevel.js
│   │   ├── CrossingStrip.js
│   │   ├── Level2StripGenerator.js
│   │   └── Level2StripLibrary.js
│   └── CheatingLevel.js
├── shared/
│   ├── VehicleController.js
│   ├── WaypointMover.js
│   ├── Collider.js
│   └── CameraRig.js
├── shaders/
└── ui/
```

The actual repo may begin simpler than this.

Do not create files until the code needs them.

---

## Placement Rules

- `src/core/` - renderer, application lifecycle, game state, level switching and other engine-level orchestration.
- `src/levels/` - mechanics, scene content, objectives and behaviour belonging to one level.
- `src/shared/` - systems genuinely reused by more than one level or subsystem.
- `src/shaders/` - imported JavaScript shader definitions and post-processing shader modules.
- `src/ui/` - reusable UI or HUD modules when the code is large or reused enough to justify them.
- `public/assets/` - static runtime assets such as models, textures, audio and files intentionally fetched at runtime.

If an existing location fits, use it rather than creating another top-level source directory.

---

## Level Organisation

Level organisation is based on complexity rather than forced symmetry.

A level that only needs one main module may live directly under:

```text
src/levels/
```

For example:

```text
src/levels/ParkingLevel.js
src/levels/CheatingLevel.js
```

When a level develops multiple support modules that belong only to that level, group them in a lowercase level directory:

```text
src/levels/crossing/
├── CrossingLevel.js
├── CrossingStrip.js
├── Level2StripGenerator.js
└── Level2StripLibrary.js
```

This means the current flat Level 1 and Level 3 modules and the Level 2 `crossing/` directory are not inherently inconsistent.

Do not create empty `parking/` or `cheating/` directories merely for symmetry.

If a single-module level later develops several level-specific support modules, moving it into its own directory should be a focused refactor rather than part of unrelated feature work.

---

## Source File Naming

Classes and major modules use PascalCase:

```text
Game.js
InputManager.js
ParkingLevel.js
CrossingStrip.js
VehicleController.js
```

Utilities and function-only modules use camelCase:

```text
math.js
disposeObject3D.js
```

Shader modules use camelCase ending in `Shader.js`:

```text
asphaltShader.js
suspicionShader.js
```

Directories use lowercase names, with hyphens for multi-word names where needed.

Runtime assets use the separate lowercase, hyphenated naming rules documented in `ASSETS_AND_CREDITS.md`.

---

## Shaders and Runtime Assets

Imported JavaScript shader modules belong under:

```text
src/shaders/
```

Static runtime assets belong under:

```text
public/assets/
```

Do not create a parallel source directory such as `src/gfx/` for shader modules when `src/shaders/` already expresses that responsibility.

A shader belongs under `public/assets/` only when it is deliberately loaded as a static runtime file rather than imported as JavaScript source.

---

## main.js

Responsibilities:

- create the game
- start the game

It should remain very small.

It should not become the location for gameplay logic.

---

## Game

Responsibilities may include:

- renderer
- main animation loop
- active level
- level switching
- global input
- global UI
- active camera
- shared asset manager

Game should not contain:

- pothole behaviour
- parking validation
- lane generation
- tutor suspicion logic
- level-specific objectives

---

## Level Lifecycle

All level modules should expose roughly the same lifecycle:

```js
load()
update(dt)
dispose()
```

Possible responsibilities:

### load()

- create level scene content
- configure camera
- create lights
- create HUD state
- initialise gameplay state

### update(dt)

- update gameplay
- update AI
- update animation
- check success / failure
- update camera
- update HUD

### dispose()

- remove / dispose level resources
- remove event listeners
- dispose textures
- dispose materials
- dispose geometry

---

## Shared Systems

A shared system should exist when multiple levels actually need the same concept.

Possible systems:

### VehicleController

May be used by:

- player car in Level 1
- traffic vehicles in Level 2

### WaypointMover

May be used by:

- traffic
- pedestrians
- tutor patrol

### ColliderSet

May support:

- blocking collisions
- trigger collisions
- lethal collisions

### CameraRig

May provide common camera utility while still allowing each level to have a different viewing style.

---

## Dependency Direction

Allowed:

```text
ParkingLevel -> VehicleController
CrossingLevel -> WaypointMover
CheatingLevel -> WaypointMover
```

Avoid:

```text
ParkingLevel -> CrossingLevel
CrossingLevel -> CheatingLevel
```

Levels should remain independently loadable.

---

## State Flow

Target high-level flow:

```text
MENU
  ↓
LEVEL 1
  ↓
LEVEL 2
  ↓
LEVEL 3
  ↓
RESULTS
```

A restart should not require refreshing the page.

---

## Design Rule

> A level module may call shared systems, but should not call sideways into another level.
