# Assets and Credits

Everything the team did not create itself must be recorded and credited.

This includes:

- libraries
- models
- textures
- audio
- music
- sound effects
- shaders
- code samples
- tutorials
- adapted examples
- external tools where relevant

---

# Rule

When a third-party resource is added to the repository, add its credit entry here immediately.

Do not wait until submission week.

---

# Asset Storage

Runtime assets live under:

```text
public/assets/
```

Suggested structure:

```text
public/assets/
├── models/
│   ├── vehicles/
│   ├── characters/
│   ├── environment/
│   └── props/
├── textures/
├── audio/
└── images/
```

---

# Naming

Use:

- lowercase
- hyphen-separated names
- no spaces
- exact filename case in code

Example:

```text
wits-parking-sign.glb
asphalt-normal.jpg
taxi-horn.mp3
```

---

# Model Format

Prefer compressed `.glb` models for runtime.

Avoid committing large source working files unless the team specifically needs them in the repo.

---

# Texture Rules

Use the smallest resolution that still looks correct.

Avoid unnecessary 4096×4096 textures.

Prefer power-of-two dimensions when practical.

Compress images appropriately.

---

# Credit Template

Copy this section for each external resource.

```md
## Resource Name

Type:
Model / texture / audio / code / library / tutorial / other

Source:
<URL or source description>

Author:
<name>

Licence:
<licence>

Used for:
<where it appears in the game>

Modified:
Yes / No

Added by:
<team member>
```

---

# Current External Dependencies

## Libraries

### Three.js

Type: Library

Source:
https://threejs.org

Licence:
MIT

Used for:
3D rendering, cameras, scene graph, materials and WebGL abstraction.

Modified: No

### Vite

Type: Development / build tooling

Source:
https://vitejs.dev

Licence:
MIT

Used for:
Local development and production bundling.

Modified: No

---

## Models

> **Attribution notice.** Every model below is CC BY 4.0. That licence *requires*
> visible credit to the author wherever the work is distributed. Author, licence
> and source URL for each are also embedded in the `.glb` files themselves
> (`asset.extras`), which is where the details below were read from.

### Whiteboard

Type: Model

Source:
https://sketchfab.com/3d-models/whiteboard-d0b05bd140734a799666f0a29e1fe1bb

Author:
tboiston (https://sketchfab.com/tboiston)

Licence:
CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

Used for:
Level 3 classroom — front-of-room whiteboard, also used as the projector target
and a lighting reference surface.

File:
`public/assets/models/props/whiteboard.glb`

Modified:
Yes — uniformly rescaled and repositioned at load time in `CheatingLevel.js`.

Added by:
Gabriel Razbornik

### Plastic Chair

Type: Model

Source:
https://sketchfab.com/3d-models/plastic-chair-be3d5131e634424e89ffd57ebb19804e

Author:
Jazavac (https://sketchfab.com/Jazavac)

Licence:
CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

Used for:
Level 3 classroom — student seating at every desk.

File:
`public/assets/models/props/plastic-chair.glb`

Modified:
Yes — rescaled and instanced across the desk grid.

Added by:
Gabriel Razbornik

### Paper Tablet

Type: Model

Source:
https://sketchfab.com/3d-models/paper-tablet-f2b7978367164eb38167dd4832978288

Author:
NameSsis (https://sketchfab.com/NameSsis)

Licence:
CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

Used for:
Level 3 — the tablets on surrounding desks that carry the answer words the player
peeks at, and the player's own desk tablet.

File:
`public/assets/models/props/paper_tablet.glb`

Modified:
Yes — rescaled; a dynamic canvas texture is applied at runtime to draw each
tablet's word.

Added by:
Gabriel Razbornik

### Car Scene

Type: Model

Source:
https://sketchfab.com/3d-models/car-scene-b7b32eaca80d460c9338197e2c9d1408

Author:
toivo (https://sketchfab.com/toivo)

Licence:
CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

Used for:
The player's car in Level 1.

File:
`public/assets/models/vehicles/car-scene.glb`

Modified:
Yes — the surrounding authored showcase scene (ground plane and set dressing) is
stripped at load time in `VehicleModelLibrary.js`, keeping the vehicle only.

Added by:
Shayna Unterslak

### Generic Passenger Car Pack

Type: Model

Source:
https://sketchfab.com/3d-models/generic-passenger-car-pack-20f9af9b8a404d5cb022ac6fe87f21f5

Author:
Comrade1280 (https://sketchfab.com/comrade1280)

Licence:
CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

Used for:
Parked cars filling the Level 1 parking bays.

File:
`public/assets/cars/generic-passenger-car-pack.glb`

Modified:
Yes — individual vehicles are extracted from the pack and cloned per bay.

Added by:
Shayna Unterslak

---

## Textures and HDRIs

### Asphalt 02

Type: Texture (PBR set — diffuse, roughness, displacement, OpenGL normal)

Source:
https://polyhaven.com/a/asphalt_02

Author:
Rob Tuytel — Poly Haven

Licence:
CC0 (public domain — attribution not legally required, recorded here anyway)

Used for:
The custom asphalt road shader in Level 1 and Level 2.

Files:
`public/assets/textures/road/asphalt-02-{diff,rough,disp,nor-gl}-2k.{jpg,png,exr}`

Modified:
Yes — taken at 2K rather than 8K and renamed to the project's hyphen-separated
convention. Sampled and blended by `src/shaders/asphaltShader.js`.

Added by:
Shayna Unterslak

### Joburg Central Sunset (HDRI)

Type: HDRI environment map

Source:
https://polyhaven.com/a/sunset_jhbcentral

Author:
Dimitrios Savva (photography) and Greg Zaal (processing) — Poly Haven

Licence:
CC0 (public domain — attribution not legally required, recorded here anyway)

Used for:
Level 3 environment lighting and background — a Johannesburg rooftop sunset,
chosen to match the game's setting.

File:
`public/assets/hdri/sunset-jhbcentral-4k.exr`

Modified:
Yes — taken at 4K and renamed to the project's convention.

Added by:
Shayna Unterslak

---

## AI-Generated Assets

> Generated rather than downloaded. Recorded here because they are not
> hand-authored by the team either, and the distinction should be declared.

### Classroom Brick Wall / Classroom Terrazzo Floor

Type: Texture

Source:
AI image generation.

Author:
Generated by Gabriel Razbornik.

Licence:
Generated output — no third-party licence attaches. Note that the generating
model was trained on third-party data.

Used for:
Level 3 classroom wall and floor surfaces.

Files:
`public/assets/textures/classroom-brick-wall.jpg`,
`public/assets/textures/classroom-terrazzo-floor.jpg`

Modified:
Yes — tiled and repeat-wrapped at load time in `CheatingLevel.js`.

Added by:
Gabriel Razbornik

### Level 3 Zoom Hands (UI)

Type: Image (UI overlay)

Source:
AI image generation — OpenAI `gpt-image` v2.0. Confirmed from the C2PA Content
Credentials embedded in the PNG, which record
`digitalSourceType: trainedAlgorithmicMedia` and a signature from OpenAI Media
Service dated 2026-09-07.

Author:
Generated by Gabriel Razbornik.

Licence:
Generated output — no third-party licence attaches. Note that the generating
model was trained on third-party data.

Used for:
The Level 3 HUD hint image showing the hold-to-zoom gesture.

File:
`public/assets/images/ui/level3-zoom-hands.png`

Modified: No

Added by:
Gabriel Razbornik

### Cartoon Desk

Type: Model

Source:
Authored in Blender with AI assistance (Claude), then exported to glTF via
Three.js. Not a third-party download.

Author:
Gabriel Razbornik, with AI assistance.

Licence:
Project-owned.

Used for:
Level 3 classroom — the student desk repeated across the room grid, including the
player's own desk.

File:
`public/assets/models/props/cartoon-desk.glb`

Modified:
Not applicable — created for this project.

Added by:
Gabriel Razbornik

---

## Unresolved — Action Required

### Normalised Vehicle Pack (aston, byd, honda, nissan, vw, diesel-thomas)

Type: Model

Source:
**Not recorded.** These were converted from uploaded source archives that did not
carry licence metadata — see `public/assets/cars/README.md`. The vehicles are
identified in `car-library-manifest.json` as a 2008 Aston Martin V8 Vantage GT2,
2024 BYD Atto 2, Honda Accord 11th Gen, 2020 Nissan GT-R50, 2022 Volkswagen
Saveiro, and a "Diesel Powered Thomas" easter egg.

Author:
Unknown — **must be traced before submission.**

Licence:
Unknown — **must be traced before submission.**

Used for:
Parked cars and M1 background traffic in Level 1 (`*-game.glb` for near vehicles,
`*-lite.glb` for distant ones).

Files:
`public/assets/cars/{aston,byd,honda,nissan,vw,diesel-thomas-proxy}-{game,lite}.glb`

Modified:
Yes — converted to `.glb`, decimated, textures stripped and replaced with vertex
colours, normalised to a common scale and orientation. The `diesel-thomas-proxy`
files are procedural stand-ins, not a conversion of the original mesh.

Added by:
Dean Feldman — **please supply the original download pages and licences.**

---

# Project-Created Assets

Original assets authored by the team:

- Wits parking blockout and bay layout (Level 1)
- M1 cutting and surrounding road geometry (Level 1)
- Custom car hierarchy and vehicle controller rig
- Custom asphalt shader (`src/shaders/asphaltShader.js`)
- Level 2 crossing grid and traffic layout
- Level 3 classroom layout, desk grid and exam-paper canvas textures
- All UI, menus and HUD styling (`index.html`)

---

# Outstanding Housekeeping

- Trace the source and licence of the normalised vehicle pack (see above).
- `paper_tablet.glb` uses underscores, breaking the hyphen-separated naming rule
  in this document. Renaming it also requires updating `CheatingLevel.js`.
- The in-game credits screen (`Game.js`, `showCredits`) currently names only
  Three.js and the team. CC BY 4.0 requires the five model authors above to be
  credited in the distributed work, so they need to appear there too.
