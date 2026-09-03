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
