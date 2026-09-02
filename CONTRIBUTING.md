# Contributing

This project is developed by a six-person team.

The goal of the workflow is to allow people to work in parallel without breaking the shared game.

---

## Branch Strategy

`main` should always:

- build
- run
- remain demonstrable

Do not develop large features directly on `main`.

Create a feature branch:

```bash
git checkout main
git pull
git checkout -b feature/your-feature
```

Examples:

```text
feature/wits-assets
feature/parking-physics
feature/crossing-traffic
feature/tutor-vision
feature/asphalt-shader
feature/game-state
```

---

## Before Starting Work

Always update first:

```bash
git checkout main
git pull
```

Then create or update your feature branch.

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

Level-specific code belongs in:

```text
src/levels/
```

Reusable code belongs in:

```text
src/shared/
```

Core engine / application code belongs in:

```text
src/core/
```

Do not move code into `shared/` simply because it might be reused someday.

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

Use:

- lowercase filenames
- hyphen-separated filenames
- relative paths
- compressed `.glb` where practical

Third-party assets must be recorded in:

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
