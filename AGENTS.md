# AI Development Instructions

This file is the primary context document for AI coding assistants working on **Wits Commute Simulator**.

Read this file before changing code.

---

# 1. Project Summary

Wits Commute Simulator is a Three.js browser game built for the Wits
COMS3006A / COMS3025A Computer Graphics and Visualisation group project.

The game contains three deliberately different levels connected by one story:

1. Park at Wits
2. Cross the Road
3. Don't Get Caught

The three levels must remain genuinely distinct.

---

# 2. Level Definitions

## Level 1 — Park at Wits

**Player role:** Driver  
**Core mechanic:** Precision driving and parking  
**Movement:** Continuous  
**Camera:** Third-person chase perspective  
**Threat:** Potholes, parked cars, kerbs and tight geometry  
**Failure:** Vehicle condition reaches zero  
**Success:** Correctly park inside the target bay

Planned parking validation checks:

1. sufficient vehicle containment
2. acceptable vehicle alignment
3. near-zero vehicle speed

Graphics focus:

- dusk lighting
- headlights
- hierarchical vehicle model
- normal/roughness variation
- damaged / wet asphalt
- custom shader

---

## Level 2 — Cross the Road

**Player role:** Pedestrian  
**Core mechanic:** Timing gaps in traffic  
**Movement:** Discrete grid steps  
**Camera:** Orthographic / near-isometric  
**Threat:** Moving vehicles  
**Failure:** Vehicle collision  
**Success:** Reach the far pavement

Traffic lanes may vary by:

- direction
- speed
- spacing

Graphics focus:

- bright midday lighting
- traffic animation
- character hop / walk animation
- orthographic viewing

---

## Level 3 — Don't Get Caught

**Player role:** Seated student  
**Core mechanic:** Copy answers while avoiding tutor detection  
**Movement:** No locomotion  
**Camera:** Near-first-person seated perspective  
**Threat:** Tutor attention  
**Failure:** Suspicion reaches 100%  
**Success:** Fill the answer progress bar

Core loop:

1. copy
2. monitor tutor
3. stop copying
4. suspicion decreases
5. copy again

Tutor detection should eventually use:

- angle
- distance
- player copying state
- raycast visibility / occlusion

Graphics focus:

- interior lighting
- tutor spotlight
- vision cone
- suspicion-driven post-processing

---

# 3. Core Design Requirement

Do not homogenise the three levels.

The intended distinction is:

| Level | Player verb | Movement | Camera | Failure |
|---|---|---|---|---|
| Park | steer and align | continuous | chase perspective | condition meter |
| Cross | time and hop | discrete | orthographic | instant hit |
| Cheat | watch and wait | none | seated perspective | suspicion meter |

Shared implementation is encouraged internally, but the player experience must remain different.

---

# 4. Architecture

The intended architecture is:

```text
Core / Engine
    ↓
Shared Systems
    ↓
Level Modules
```

Typical source structure:

```text
src/
├── core/
├── levels/
├── shared/
├── shaders/
└── ui/
```

Each level should expose a lifecycle similar to:

```js
load()
update(dt)
dispose()
```

The central Game object decides which level is active.

A level may call shared systems.

A level should not directly depend on another level.

Bad:

```text
ParkingLevel -> CrossingLevel
```

Good:

```text
ParkingLevel -> VehicleController
CrossingLevel -> VehicleController
```

---

# 5. Core Responsibilities

The core layer may own:

- renderer
- animation loop
- state / level switching
- global input
- asset loading
- global UI shell
- active camera

The core layer should not contain:

- parking validation
- traffic lane rules
- tutor suspicion logic
- pothole mechanics
- level-specific win / loss rules

---

# 6. Shared Systems

Shared systems may eventually include:

- InputManager
- AssetManager
- CameraRig
- VehicleController
- WaypointMover
- ColliderSet
- TriggerVolume
- UI shell
- StateMachine

Do not create abstractions only because they may be useful later.

Move code into `shared/` when at least two systems genuinely need it.

---

# 7. Development Philosophy

The highest priority is:

> Whole game playable before any level is beautiful.

Development order:

1. setup
2. primitive blockout
3. mechanics
4. AI and animation
5. visual production
6. polish and release

When choosing between visual polish and functioning gameplay, implement the gameplay first.

---

# 8. Performance Rules

The game runs in a browser and will be assessed on university lab hardware.

Prefer:

- reused geometry
- reused materials
- instanced meshes for repeated objects
- compressed GLB models
- sensible texture resolutions
- minimal dynamic shadow casters

Avoid:

- creating geometry inside update loops
- creating materials inside update loops
- unnecessary object allocation every frame
- excessive dynamic lights
- excessive dynamic shadows
- very large textures
- very high-poly models

When a level is removed, dispose of:

- geometry
- materials
- textures

---

# 9. Asset Rules

Runtime assets live under:

```text
public/assets/
```

Use relative paths such as:

```js
"./assets/models/car.glb"
```

Never use:

```js
"/assets/models/car.glb"
```

The final game is hosted from a subdirectory.

Asset filenames should be:

- lowercase
- hyphen-separated
- without spaces

Good:

```text
wits-parking-wall.glb
road-normal-map.jpg
student-character.glb
```

Avoid:

```text
Parking Wall FINAL.glb
RoadTexture.PNG
Student Character.glb
```

The final server runs on Linux, so filename case matters.

---

# 10. Git Rules

Do not commit:

```text
node_modules/
dist/
```

Keep `main` runnable.

Use feature branches.

Suggested branch names:

```text
feature/wits-assets
feature/parking-physics
feature/crossing-traffic
feature/tutor-vision
feature/asphalt-shader
feature/game-state
```

Prefer descriptive commits.

Good:

```text
Add grid movement to crossing level
Implement parking angle validation
Add tutor waypoint patrol
```

Avoid:

```text
update
stuff
changes
final
```

---

# 11. AI Rules

When generating or modifying code:

1. Inspect existing code before changing architecture.
2. Prefer modifying existing systems over creating duplicate systems.
3. Do not rewrite working systems without a clear reason.
4. Keep changes scoped to the requested feature.
5. Preserve the three-level architecture.
6. Do not silently introduce new third-party dependencies.
7. Explain why a new dependency is needed before adding it.
8. Never introduce absolute asset paths.
9. Do not put level-specific behaviour inside `Game.js`.
10. Do not put unrelated gameplay logic inside `main.js`.
11. Avoid giant files.
12. Prefer readable code over clever code.
13. Keep code understandable to third-year CS students.
14. Any AI-generated code must be explainable during the CGV demo.

AI-generated code is not considered finished until a team member understands it.

---

# 12. Shader Requirement

The project requires meaningful custom shader work.

Primary planned shader:

**Damaged / wet asphalt in Level 1**

Possible inputs include:

```text
uTime
uCarPosition
uHeadlightDirection
uWetness
uRoadTexture
uNoiseTexture
```

The custom shader must be integrated with the game rather than existing as an isolated demo.

Do not replace the shader requirement with only built-in Three.js materials.

---

# 13. Deployment Rules

Build:

```bash
npm run build
```

Test:

```bash
npm run preview
```

Production output:

```text
dist/
```

Vite must remain configured with:

```js
base: "./"
```

The final deployable archive must have `index.html` at its top level.

All runtime paths must be relative.

---

# 14. Before Completing a Significant Change

Check:

- Does `npm run dev` still work?
- Does `npm run build` still work?
- Does Level 1 still load?
- Does Level 2 still load?
- Does Level 3 still load?
- Are there console errors?
- Were absolute paths introduced?
- Was a new dependency added?
- Was duplicated code introduced?

If gameplay changed, test it in the browser.
