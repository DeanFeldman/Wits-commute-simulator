# Contributing

This project is developed by a six-person team.

The goal of the workflow is to allow people to work in parallel without breaking the shared game.

---

## Sources of Truth

Use the following documents for their respective concerns:

- `CONTRIBUTING.md` - Git workflow, branches, commits and pull requests
- `docs/ARCHITECTURE.md` - source-code placement, module boundaries and naming
- `docs/GAME_DESIGN.md` - gameplay behaviour and intended mechanics
- `docs/DEVELOPMENT.md` - phases, MVP scope and definition of done
- `docs/ASSETS_AND_CREDITS.md` - runtime assets, naming and attribution
- `docs/DEPLOYMENT.md` - production build and LAMP deployment
- `docs/DECISIONS.md` - important technical and architectural decisions

The README is an overview. If it conflicts with one of the detailed documents above, follow the detailed document and fix the contradiction.

---

## Branch Strategy

All development happens on an issue branch.

Use:

```text
<area>/<issue-number>-<short-description>
```

Allowed area prefixes:

```text
level-1/
level-2/
level-3/
engine/
gfx/
docs/
chore/
```

Examples:

```text
level-1/12-parking-validation
level-2/27-crossing-traffic
level-3/60-stealth-challenge
engine/18-game-state
gfx/34-suspicion-post-processing
docs/42-deployment-guide
chore/59-repository-conventions
```

Do not use a generic `feature/*` prefix when one of the project areas above applies.

Choose the area that owns most of the change. Where practical, keep one issue per branch.

`main` should always:

- build
- run
- remain demonstrable

Do not develop directly on `main`.

---

## Before Starting Work

Always update `main` before creating a branch:

```bash
git switch main
git pull
git switch -c <area>/<issue-number>-<short-description>
```

If your Git version does not support `switch`, the equivalent `checkout` commands are acceptable.

Before substantial work, check whether another team member already has a branch or PR touching the same files.

---

## Commit Style

Prefer small, descriptive commits.

Good:

```text
Add parking bay containment check
Add crossing lane direction support
Implement tutor suspicion decay
Add road shader uniforms
```

Avoid:

```text
update
changes
stuff
final
```

---

## Pull Requests

Before opening a PR:

1. run the project locally
2. test the changed feature
3. run the production build
4. check the browser console
5. make sure unrelated files were not changed

Commands:

```bash
npm install
npm run dev
npm run build
```

No self-merges when a reviewer is available.

---

## Module Ownership

Planned workstreams:

1. World and assets
2. Driving and parking
3. Traffic and crossing
4. Stealth and NPCs
5. Graphics and shaders
6. Integration and build

Each level should have one primary owner.

Cross-cutting systems should have a clear owner as well.

---

## Cover Pairs

Suggested cover pairs:

- World & Assets ↔ Graphics & Shaders
- Driving & Parking ↔ Traffic & Crossing
- Stealth & NPCs ↔ Integration & Build

Pairs should review one another's work and be able to explain the major systems.

---

## Shared Rules

Nobody owns these alone:

- blockout sprint
- playtesting
- credits and licensing
- code review
- understanding AI-assisted code

Everyone should regularly play the full game from Level 1 to Level 3.

---

## Code Placement

Detailed placement rules live in `docs/ARCHITECTURE.md`.

In summary:

```text
src/core/       application and engine orchestration
src/levels/     level-specific gameplay
src/shared/     systems genuinely reused across levels
src/shaders/    JavaScript shader and post-processing modules
src/ui/         reusable UI modules when needed
public/assets/  runtime models, textures, audio and other static assets
```

Do not create a new top-level source directory when an existing category already fits.

Do not move code into `shared/` simply because it might be reused someday.

## JavaScript File Naming

Classes and major modules use PascalCase:

```text
Game.js
InputManager.js
ParkingLevel.js
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

Directories use lowercase names, with hyphens where a multi-word directory is needed.

Do not rename existing modules purely for style in an unrelated feature PR.

---

## Dependencies

Do not add new npm dependencies without discussing them with the team.

If adding one:

- explain why it is needed
- document it
- credit it if required
- verify it works in the production build

---

## Assets

Runtime assets belong under:

```text
public/assets/
```

Use:

- lowercase filenames
- hyphen-separated filenames
- relative paths
- compressed `.glb` where practical

Imported JavaScript shader modules belong under:

```text
src/shaders/
```

A shader belongs under `public/assets/` only when it is intentionally loaded as a runtime static file rather than imported as source code.

Third-party assets and external resources must be recorded in:

```text
docs/ASSETS_AND_CREDITS.md
```

the same day they are added.

---

## Definition of Ready for Merge

A change is ready to merge when:

- the feature works
- the project still runs
- the production build succeeds
- there are no new console errors
- the code is understandable
- the change does not duplicate an existing system
- any third-party resource is credited
