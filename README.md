# Wits Commute Simulator

**Park. Cross. Cheat.**

A three-level browser game built with Three.js and WebGL for  
**COMS3006A / COMS3025A — Computer Graphics and Visualisation**.

Group: **Git Push Pray**

---

## Game Concept

Wits Commute Simulator follows one student's journey to class:

1. **Park at Wits** — precision driving and parking
2. **Cross the Road** — timing and reflex
3. **Don't Get Caught** — stealth

The story connects the three levels, but each level intentionally uses a different mechanic, control scheme, camera, visual identity and failure condition.

---

## Tech Stack

- JavaScript
- Three.js
- WebGL
- Vite
- HTML / CSS
- Git / GitHub

---

## Run Locally

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://localhost:5173/
```

---

## Production Build

Create the production build:

```bash
npm run build
```

Test it locally:

```bash
npm run preview
```

The production output is written to:

```text
dist/
```

The final Wits LAMP deployment must use the production build, not the source tree.

---

## Current Game Structure

### Level 1 — Park at Wits

**Genre:** Precision driving

**Player verb:** Steer and align

**Main systems:**
- arcade vehicle movement
- pothole triggers
- vehicle condition
- parking validation
- third-person chase camera
- dusk lighting
- damaged/wet asphalt shader

**Win condition:**  
Correctly park inside the designated bay.

**Failure condition:**  
Vehicle condition reaches zero.

---

### Level 2 — Cross the Road

**Genre:** Timing / reflex

**Player verb:** Time and hop

**Main systems:**
- discrete grid movement
- moving traffic
- traffic lanes with different speeds and directions
- vehicle collision
- checkpoints
- orthographic / near-isometric camera
- bright midday lighting

**Win condition:**  
Reach the far pavement.

**Failure condition:**  
Contact with a vehicle.

---

### Level 3 — Don't Get Caught

**Genre:** Stealth

**Player verb:** Watch and wait

**Main systems:**
- seated mouse-look
- hold-to-copy interaction
- tutor patrol
- tutor vision cone
- suspicion meter
- answer progress
- indoor lighting
- suspicion post-processing

**Win condition:**  
Fill the answer bar before time expires.

**Failure condition:**  
Suspicion reaches 100%.

---

## Repository Structure

```text
wits-commute-simulator/
├── README.md
├── AGENTS.md
├── CONTRIBUTING.md
├── package.json
├── vite.config.js
├── index.html
├── docs/
│   ├── GAME_DESIGN.md
│   ├── ARCHITECTURE.md
│   ├── DEVELOPMENT.md
│   ├── DEPLOYMENT.md
│   ├── ASSETS_AND_CREDITS.md
│   └── DECISIONS.md
├── public/
│   └── assets/
└── src/
    ├── main.js
    ├── core/
    ├── levels/
    ├── shared/
    ├── shaders/
    └── ui/
```

---

## Important Project Rules

- Keep `main` runnable.
- Use issue branches following the naming convention in `CONTRIBUTING.md`.
- Do not merge broken code into `main`.
- Build the full game with primitive geometry before detailed visual production.
- Keep level-specific code inside its level module.
- Move functionality into `shared/` only when multiple levels genuinely use it.
- Use lowercase, hyphenated asset filenames.
- Use relative asset paths.
- Do not commit `node_modules/`.
- Do not commit `dist/`.
- Credit third-party assets, code, tutorials and libraries as soon as they are added.
- Any AI-assisted or adapted code must be explainable by the team.

---

## Documentation

Start here:

- `AGENTS.md` — instructions for AI coding assistants
- `CONTRIBUTING.md` — Git and collaboration rules
- `docs/GAME_DESIGN.md` — gameplay source of truth
- `docs/ARCHITECTURE.md` — code architecture
- `docs/DEVELOPMENT.md` — development phases and working rules
- `docs/DEPLOYMENT.md` — production build and Wits LAMP deployment
- `docs/ASSETS_AND_CREDITS.md` — asset and crediting rules
- `docs/DECISIONS.md` — important project decisions

---

## Development Principle

> Whole game playable before any level is beautiful.

The team should always prefer a complete playable blockout over isolated polished scenes.
