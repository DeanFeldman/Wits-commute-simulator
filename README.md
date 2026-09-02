# Wits Commute Simulator — Starter Repo

A minimal Three.js + Vite starter for the COMS3006A / COMS3025A CGV group project.

It contains three primitive, runnable level modules:

1. **Park at Wits** — simple driving blockout
2. **Cross the Road** — orthographic grid-hop crossing
3. **Don't Get Caught** — seated mouse-look + hold-to-copy stealth prototype

The purpose of this repo is to give the team a working skeleton **before** adding Wits models, textures, sound, shaders and polish.

## Requirements

Install a recent Node.js LTS release.

Check:

```bash
node --version
npm --version
```

## Run locally

From this folder:

```bash
npm install
npm run dev
```

Vite will print a local URL, usually:

```text
http://localhost:5173/
```

Open it in Chrome.

## Production build

```bash
npm run build
npm run preview
```

The production files are written to:

```text
dist/
```

For the Wits LAMP deployment, zip the **contents** of `dist/` so that `index.html`
is at the top level of the zip.

## Controls

### Global
- `1` — Level 1
- `2` — Level 2
- `3` — Level 3
- `R` — restart current level

### Level 1 — Park
- `W/S` or `Up/Down` — move forward/back
- `A/D` or `Left/Right` — steer

This is intentionally arcade-like and primitive.

### Level 2 — Cross
- `WASD` / arrow keys — one grid step per key press

Reach the green far pavement without touching a car.

### Level 3 — Don't Get Caught
- Click the game to enable mouse-look
- Move mouse — look around
- Hold `Space` — copy answers
- Release `Space` — stop copying

If the tutor is looking at you while you copy, suspicion rises.

## Starting architecture

```text
src/
├── main.js
├── style.css
├── core/
│   ├── Game.js
│   └── InputManager.js
├── levels/
│   ├── ParkingLevel.js
│   ├── CrossingLevel.js
│   └── CheatingLevel.js
└── shared/
    ├── disposeObject3D.js
    └── math.js
```

Each level implements the same basic lifecycle:

```js
load()
update(dt)
dispose()
```

Keep level-specific code inside its level module. Move code into `shared/` only
when at least two levels genuinely use it.

## Asset rules for this project

Place future files under `public/assets/` and use paths such as:

```js
"./assets/models/car.glb"
"./assets/textures/road/asphalt.jpg"
```

Use:
- lowercase filenames
- hyphen-separated names
- relative paths
- compressed `.glb` models where possible

Do **not** use root-relative paths such as:

```js
"/assets/models/car.glb"
```

because the final game is hosted from a subdirectory.

## Suggested first team milestone

Before adding real Wits assets:

- all three levels load
- each has its real control style
- each can be won/lost in primitive form
- switching/restarting works
- `npm run build` succeeds

Then begin visual production.
