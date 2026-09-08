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

---

## 2026-09-08 — ACES Filmic Tone Mapping as the Renderer Baseline

**Decision**

`src/core/renderSettings.js` owns the renderer-level settings for all three
levels: `ACESFilmicToneMapping` at exposure 1.0, an explicit
`SRGBColorSpace` output, `PCFSoftShadowMap`, and a device pixel-ratio cap of
2. `Game.js` calls `applyRendererBaseline()` once. The pixel-ratio cap and
the two shadow settings were previously written inline in `Game.js` and keep
the same values; tone mapping and the explicit colour space are new.

Two levels are retuned with it. Level 2: `HemisphereLight` 2.9 to 2.65 and
`DirectionalLight` 4.2 to 3.85 in `src/levels/crossing/CrossingLevel.js`.
Level 1: `HemisphereLight` 0.75 to 1.63 and the dusk `DirectionalLight` 1.8 to
3.91 in `src/levels/ParkingLevel.js`.

Level 1's headlight `SpotLight` is deliberately left at 16, and
`src/shaders/asphaltShader.js` is deliberately not touched at all. Both are
explained below.

**Reason**

Three's default is `NoToneMapping`, which clamps. Any surface whose computed
radiance exceeds 1.0 is cut flat, so a bright surface stops shading and reads
as a cut-out slab, and values above 1.0 are wasted rather than meaningful.
ACES rolls highlights off smoothly instead, so bright surfaces keep their
gradient and headlights and spotlights read as light sources.

**"ACES darkens everything" is wrong, and acting on that assumption misleads.**
Three's implementation is not the bare ACES curve. In
`node_modules/three/src/renderers/shaders/ShaderChunk/tonemapping_pars_fragment.glsl.js`
line 62, immediately before the RRT/ODT fit:

```glsl
color *= toneMappingExposure / 0.6;
```

That is a 1.67x pre-gain at exposure 1.0, present specifically to offset the
RRT's darkening. The net transfer is therefore sub-unity in the shadows,
super-unity through the midtones, and compressive only above roughly 0.8. Which
direction a level moves depends on where its histogram already sits. Measured
viewport luminance:

| Level | Pre-ACES | ACES, no retune | Shipped | Shipped vs pre-ACES |
|---|---|---|---|---|
| 1 — dusk lot | 0.1085 | 0.0633 | 0.1100 | +1.4 % |
| 2 — midday | 0.5979 | 0.6258 | 0.6124 | +2.4 % |
| 3 — classroom | 0.4771 | 0.4782 | 0.4827 | +1.2 % |

All three land inside 5 % of where they were before the curve, which is the
bar this change was held to.

Level 2 got *brighter*, not darker, and lost 18.6 % saturation as its
highlights rolled off — it carried the highest intensities in the game and was
clipping. Hence the trim. Level 3 is unchanged within noise and is not touched.

Level 1 sits at the other end. It is the darkest scene in the game, so it sits
in the sub-unity part of the curve and lost 41.7 %. Its two ambient/key lights
are scaled by 2.172, solved against the measured response rather than guessed:
with the free-bay randomisation pinned so every frame held identical content,
viewport luma read 0.0635 at the old intensities and 0.1019 at double them, and
2.172 interpolates onto the 0.1085 measured before the curve. Measured back
with the pin still in it lands at 0.1079; shipped, without the pin, at 0.1100.
The headlight `SpotLight` is left alone: it was clipping before
and now rolls off, which is the change working rather than a regression.

**A withdrawn finding: the asphalt shader was going to be compensated, and should not have been.**
This is recorded because the reasoning was wrong in an instructive way, and the
next person to look at Level 1's exposure will be tempted by exactly the same
argument.

`createAsphaltMaterial()` is a raw `ShaderMaterial` with no light uniforms, so
no light in the scene reaches the lot and the two constants at
`asphaltShader.js:71` set its brightness outright. From that — which is true —
it was concluded that the lot dominated Level 1's loss and that no light retune
could recover it, so the constants had to be rescaled. The second half did not
follow from the first, and was never checked.

Measurement disproved it. Isolating the shader's own pixels — mask built from
two renders differing only in those constants, with Level 1's free-bay
randomisation temporarily pinned so both frames held identical content —
the lot moved from mean 0.1054 / median 0.0700 before the curve to mean 0.1026
/ median 0.0672 after: **−2.7 % mean, −4.0 % median**, already inside tolerance.
Scaling the constants 2x over-brightened it by +44 %. The shader needs no
compensation and none was applied.

Level 1's −41.7 % is therefore almost entirely its *lit* geometry — the parked
cars, buildings, kerbs and the surrounding street `MeshStandardMaterial`, which
`createRoadMaterial` deliberately tints to match the shader's tone. A diff map
of the chase view makes the same point: the shader changes nothing below
`y = 233`, so the whole foreground the player looks at is lit street material,
not the lot. The fix was a light retune after all, and that is what shipped.

Two earlier attempts at a shader scale — 2.7232 and 2.3096 — were discarded.
The first was derived from a patch that turned out to be the street material
rather than the lot; the second from sky-view samples confounded by the
free-bay randomisation, which changes frame content between runs. Neither
number survives anywhere in the tree. `asphaltShader.js` is byte-for-byte
unchanged.

**Caveat on every percentage above.**
All measurements were taken through headless Chrome rendering with SwiftShader,
a software rasteriser, at 1280x720. The ratios are sound — the same scene
through the same pipeline on both sides, with Level 2's layout seed pinned via
`?level2Seed=` — but the absolute values are not hardware-representative.
Treat the numbers as calibration for a first pass on real hardware, not as
final values.
