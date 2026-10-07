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

### Pixelify Sans

Type: Font

Source:
https://fonts.google.com/specimen/Pixelify+Sans

Author:
Stefie Justprince

Licence:
SIL Open Font License 1.1

Used for:
Display text, headings and buttons throughout the UI.

Modified: No

### Inter

Type: Font

Source:
https://fonts.google.com/specimen/Inter

Author:
Rasmus Andersson

Licence:
SIL Open Font License 1.1

Used for:
General UI/body text loaded through Google Fonts.

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
Gabriel Raz

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
Gabriel Raz

### Paper Tablet

Type: Model

Source:
https://sketchfab.com/3d-models/paper-tablet-f2b7978367164eb38167dd4832978288

Author:
NameSsis (https://sketchfab.com/NameSsis)

Licence:
CC BY 4.0 (http://creativecommons.org/licenses/by/4.0/)

Used for:
Level 3 — the seven functional surrounding tablets carry shuffled possible answers
for the active question; decorative tablets use the same model without interaction.

File:
`public/assets/models/props/paper-tablet.glb`

Modified:
Yes — rescaled; a dynamic canvas texture is applied at runtime to draw each
functional tablet's assigned answer.

Added by:
Gabriel Raz

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

## Sound Effects

### Level 2 Vehicle Impact

Type:
Sound effect

Source:
https://freesound.org/people/avakas/sounds/144113/

Author:
avakas

Licence:
CC BY 4.0

Used for:
Level 2 vehicle-to-player collision feedback.

Runtime file:
`public/assets/audio/level2/vehicle-impact.opus`

Modified:
Yes — converted from the supplied recording to Opus for runtime delivery and
gain-controlled by the game's SFX bus.

Added by:
Nadav Sundy

### Level 2 Shield Pop

Type:
Sound effect

Source:
https://pixabay.com/sound-effects/film-special-effects-pop-402324/

Author:
DRAGON-STUDIO

Licence:
Pixabay Content License

Used for:
Level 2 shield consumption feedback.

Runtime file:
`public/assets/audio/level2/interaction-sprite.opus`

Modified:
Yes — converted to Opus and packed into a short interaction audio sprite.

Added by:
Nadav Sundy

### Level 2 Pencil Mark

Type:
Sound effect

Source:
https://freesound.org/people/NoisyRedFox/sounds/742353/

Author:
NoisyRedFox

Licence:
CC0 (creator states their uploaded sounds are released under CC0)

Used for:
Level 2 psychology questionnaire answer selections.

Runtime file:
`public/assets/audio/level2/interaction-sprite.opus`

Modified:
Yes — converted to Opus and packed into a short interaction audio sprite.

Added by:
Nadav Sundy

### Level 3 Tutor Footsteps

Type:
Sound effects

Sources:
- https://pixabay.com/sound-effects/film-special-effects-indoor-footsteps-100664/
- https://pixabay.com/sound-effects/household-footsteps-in-a-hallway-47842/

Authors:
- Yin_Yang_Jake007 (Freesound)
- derjuli (Freesound)

Licence:
Pixabay Content License

Used for:
Level 3 tutor footsteps. Individual step events are selected randomly and panned
according to the tutor's position relative to the player.

Runtime file:
`public/assets/audio/level3/tutor-steps.opus`

Modified:
Yes — individual footsteps were cropped from the supplied sequences, normalised
for gameplay use and packed into an Opus audio sprite.

Added by:
Nadav Sundy

### Level 3 Desk / Chair Foley

Type:
Sound effect

Source:
https://freesound.org/people/Anakronizm/sounds/494616/

Author:
Anakronizm

Licence:
CC0

Used for:
Subtle Level 3 peek-enter / peek-exit desk and chair movement. The source is a
short walk-to-desk / chair / writing-surface foley sequence; it is not used as
classroom ambience.

Runtime file:
`public/assets/audio/level3/interaction-sprite.opus`

Modified:
Yes — two short foley moments were cropped and packed into an Opus audio sprite.

Added by:
Nadav Sundy

### Level 3 Correct Answer

Type:
Sound effect

Source:
https://pixabay.com/sound-effects/film-special-effects-game-show-correct-tick-sound-416167/

Author:
DRAGON-STUDIO

Licence:
Pixabay Content License

Used for:
Immediate Level 3 correct-answer confirmation.

Runtime file:
`public/assets/audio/level3/correct-tick.opus`

Modified:
Yes — the supplied MP3 was trimmed by 10 ms, downmixed to mono, normalised with
headroom and encoded to Opus. The runtime file is preloaded before gameplay.

Added by:
Nadav Sundy

### Level 2 Pavement Footsteps

Type:
Sound effect

Source:
https://freesound.org/people/PeteBarry/sounds/647403/

Author:
PeteBarry

Licence:
CC BY 4.0

Used for:
Level 2 player footsteps on pavement.

Runtime file:
`public/assets/audio/level2/footsteps-pavement.opus`

Modified:
Yes — individual steps were cropped, downmixed and packed into an Opus audio
sprite; playback rate is varied slightly at runtime.

Added by:
Nadav Sundy

### Level 2 Traffic Ambience

Type:
Ambience

Source:
https://freesound.org/people/pawsound/sounds/154858/

Author:
pawsound

Licence:
CC0

Used for:
Quiet continuous exterior road ambience in Level 2.

Runtime file:
`public/assets/audio/level2/traffic-ambience.opus`

Modified:
Yes — the supplied multichannel recording was downmixed and shortened into a
lightweight runtime loop.

Added by:
Nadav Sundy

### Level 2 Vehicle Pass-bys

Type:
Sound effect

Source:
https://freesound.org/people/Bakstad/sounds/823549/

Author:
Bakstad

Licence:
CC0

Used for:
Nearby Level 2 traffic pass-bys. The source contains one left-to-right and one
right-to-left pass; the game rate-limits and pans them based on nearby traffic.

Runtime file:
`public/assets/audio/level2/vehicle-passbys.opus`

Modified:
Yes — the two pass-bys were isolated, downmixed and packed into one Opus sprite.

Added by:
Nadav Sundy

### Level 2 Paper Foley

Type:
Sound effect

Source:
https://freesound.org/people/ssugg/sounds/588320/

Author:
ssugg

Licence:
CC0

Used for:
Opening and submitting Level 2 survey/quiz forms.

Runtime file:
`public/assets/audio/level2/paper-sprite.opus`

Modified:
Yes — short paper movements were cropped and packed into an Opus audio sprite.

Added by:
Nadav Sundy

### Level 3 Classroom Room Tone

Type:
Ambience

Source:
https://freesound.org/people/klankbeeld/sounds/212137/

Author:
klankbeeld

Licence:
CC BY 4.0

Used for:
Continuous Level 3 classroom ambience / hall air-conditioning room tone.

Runtime file:
`public/assets/audio/level3/classroom-ambience.opus`

Modified:
Yes — a clean speech-free section was downmixed and shortened into a lightweight
runtime loop.

Added by:
Nadav Sundy

### Level 3 Heartbeat

Type:
Sound effect / ambience loop

Source:
https://freesound.org/people/Cloud-10/sounds/688735/

Author:
Cloud-10

Licence:
CC0

Used for:
Adaptive Level 3 tension. Heartbeat gain and playback rate increase with
suspicion and late-test urgency.

Runtime file:
`public/assets/audio/level3/heartbeat.opus`

Modified:
Yes — converted to mono Opus for runtime looping.

Added by:
Nadav Sundy

### Level 3 Classroom Clock

Type:
Sound effect / ambience loop

Source:
https://freesound.org/people/giddster/sounds/434841/

Author:
giddster

Licence:
CC0

Used for:
Subtle Level 3 wall-clock ticking. It stays almost inaudible early in the test
and becomes more noticeable during the final 30, 15 and 5 seconds.

Runtime file:
`public/assets/audio/level3/clock-tick.opus`

Modified:
Yes — a clean section was cropped, downmixed and encoded to Opus for looping.

Added by:
Nadav Sundy

### Level 1 Collision / Pothole Impact

Type:
Sound effects

Sources:
- https://pixabay.com/sound-effects/film-special-effects-combat-impact-352458/
- https://pixabay.com/sound-effects/technology-low-thumpy-kick-reverb-hit-494833/

Authors:
- Universfield
- Black_Kumizhi

Licence:
Pixabay Content License

Used for:
Immediate Level 1 car/kerb impacts and the low suspension thump when entering a
pothole.

Runtime file:
`public/assets/audio/level1/impact-sprite.opus`

Modified:
Yes — leading silence was removed, the useful transients were cropped and the
effects were packed into a preloaded Opus sprite.

Added by:
Nadav Sundy

### Level 1 Puddle Splash

Type:
Sound effect

Source:
https://freesound.org/people/cookies%2Bpolicy/sounds/563021/

Author:
cookies+policy

Licence:
CC0

Used for:
Wet-pothole tyre splash layered over the pothole suspension impact.

Runtime file:
`public/assets/audio/level1/impact-sprite.opus`

Modified:
Yes — substantial leading silence was removed and a short useful splash section
was packed into the Level 1 impact sprite.

Added by:
Nadav Sundy

### Level 1 Parking-Lot Ambience

Type:
Environmental ambience

Source:
https://freesound.org/people/FunWithSound/sounds/406096/

Author:
FunWithSound

Licence:
CC0

Used for:
The continuous Level 1 parking/campus ambience bed. The source already contains
a parking lot, nearby roadway traffic, faint machinery hum and light wind, so it
replaces the temporary reuse of Level 2 traffic ambience/pass-bys.

Runtime file:
`public/assets/audio/level1/406096__funwithsound__roadside-parking-lot-2.mp3`

Modified:
No — the supplied MP3 is streamed as a long-form loop rather than decoded into
a large Web Audio buffer.

Added by:
Nadav Sundy

### Level 1 Car Start

Type:
Vehicle sound effect

Source:
https://freesound.org/people/GiocoSound/sounds/401558/

Author:
GiocoSound

Licence:
CC0

Used for:
A one-shot exterior engine-start cue when the Level 1 player car becomes active.

Runtime file:
`public/assets/audio/level1/401558__giocosound__sfx_car_engine_outside_start.wav`

Modified:
No — the short supplied WAV is preloaded/decoded for immediate playback.

Added by:
Nadav Sundy

### Level 1 Damaged Engine

Type:
Vehicle loop

Source:
https://freesound.org/people/LHermanns/sounds/557214/

Author:
LHermanns

Licence:
CC BY 4.0

Used for:
A progressive high-damage engine layer in Level 1. It begins fading in below
35% vehicle condition and becomes dominant toward 10% condition.

Runtime file:
`public/assets/audio/level1/557214__lhermanns__enginewarmup_1-loop.wav`

Modified:
Runtime playback rate and gain vary with vehicle speed/damage; the source file
itself is unchanged.

Added by:
Nadav Sundy

### Level 2 Taxi Horn

Type:
Sound effect

Source:
https://pixabay.com/sound-effects/film-special-effects-automobile-horn-02-352065/

Author:
Universfield

Licence:
Pixabay Content License

Used for:
Taxi stops in Level 2.

Runtime file:
`public/assets/audio/level2/extra-sprite.opus`

Modified:
Yes — leading silence was removed and the cue was packed into an Opus sprite.

Added by:
Nadav Sundy

### Level 2 Person Bump

Type:
Sound effect

Source:
https://pixabay.com/sound-effects/film-special-effects-people-colliding-43479/

Author:
freesound_community

Licence:
Pixabay Content License

Used for:
Player-to-pedestrian bumps in Level 2.

Runtime file:
`public/assets/audio/level2/extra-sprite.opus`

Modified:
Yes — the useful collision section was cropped and packed into an Opus sprite.

Added by:
Nadav Sundy

### Level 2 Vida Cup Pickup

Type:
Sound effect

Source:
https://pixabay.com/sound-effects/film-special-effects-achievement-badge-pop-sound-1-547860/

Author:
Vadim_Makes_Sound

Licence:
Pixabay Content License

Source disclosure:
Pixabay marks this source as AI modified or generated.

Used for:
Vida cup collection in Level 2.

Runtime file:
`public/assets/audio/level2/extra-sprite.opus`

Modified:
Yes — cropped and packed into an Opus sprite.

Added by:
Nadav Sundy

### Level 3 Incorrect Answer

Type:
Sound effect

Source:
https://pixabay.com/sound-effects/film-special-effects-wrong-47985/

Author:
TheBuilder15 (Freesound), distributed via Pixabay freesound_community

Licence:
Pixabay Content License

Used for:
Audible incorrect-answer feedback in Level 3.

Runtime file:
`public/assets/audio/shared/result-sprite.opus`

Modified:
Yes — cropped to the useful error cue, encoded to Opus and played at a stronger
gain than the previous incorrect sound.

Added by:
Nadav Sundy

---

## AI-Generated Assets

> Generated rather than downloaded. Recorded here because they are not
> hand-authored by the team either, and the distinction should be declared.

### Level 1 Story Loading Screen

File:

`public/assets/images/ui/level1-story-loading-screen.png`

Source:

Generated with OpenAI image generation on 2026-09-08, using the team-provided
driver-checking-a-watch concept image as a visual reference.

Author:

Generated by Codex at the project team's request.

Licence:

Generated output — no third-party licence attaches. Note that the generating
model was trained on third-party data.

Used for:

The pre-Level 1 story and asset-loading screen.

### Original Level Soundtrack

Type:
Music / project-authored procedural composition rendered to WAV

Source:
Recomposed with OpenAI/ChatGPT on 2026-10-05 for Issue #233. The replacement
score was generated specifically for Wits Commute Simulator from a shared
D-major / B-minor commute motif. No downloaded music, third-party samples, or
external loops are used.

Files:
- `menu-commute-theme.wav` — **"Commute Motif"**, 84 BPM
- `level1-dusk-drive.wav` — **"After Class"**, 76 BPM
- `level2-empire-rush.wav` — **"Crossing Rush"**, 116 BPM
- `level3-dont-get-caught.wav` — **"Eyes Down"**, 88 BPM

Author:
OpenAI-assisted original composition generated for the Wits Commute Simulator
team.

Licence:
Project-created generated output — no third-party audio licence attaches.

Used for:
A single musical identity carried across the menu and all three levels:

- **Menu:** warm electric-piano statement of the main commute motif.
- **Level 1 / Parking:** slower, warmer and more spacious interpretation with
  soft pads, restrained bass and very light percussion.
- **Level 2 / Walking:** quicker plucked interpretation with syncopated chord
  stabs and a clearer rhythmic pulse.
- **Level 3 / Cheating:** sparse fragmented interpretation designed to leave
  room for tutor footsteps, classroom ambience, heartbeat and clock audio.

Mix direction:
The tracks intentionally avoid the previous loud, continuously dense
"game soundtrack" feel. They are designed to sit behind environmental audio,
with the Level 3 score additionally ducked as suspicion and time pressure rise.

Modified:
The original 2026-09-25 soundtrack was completely replaced on 2026-10-05 as
part of Issue #233.

### Classroom Brick Wall / Classroom Terrazzo Floor

Type: Texture

Source:
AI image generation.

Author:
Generated by Gabriel Raz.

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
Gabriel Raz

### Level 3 Zoom Hands (UI)

Type: Image (UI overlay)

Source:
AI image generation — OpenAI `gpt-image` v2.0. Confirmed from the C2PA Content
Credentials embedded in the PNG, which record
`digitalSourceType: trainedAlgorithmicMedia` and a signature from OpenAI Media
Service dated 2026-09-07.

Author:
Generated by Gabriel Raz.

Licence:
Generated output — no third-party licence attaches. Note that the generating
model was trained on third-party data.

Used for:
The Level 3 HUD hint image showing the hold-to-zoom gesture.

File:

`public/assets/images/ui/level3-zoom-hands.png`

Modified: No

Added by:
Gabriel Raz

### Cartoon Desk

Type: Model

Source:
Authored in Blender with AI assistance (Claude), then exported to glTF via
Three.js. Not a third-party download.

Author:
Gabriel Raz, with AI assistance.

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
Gabriel Raz

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

- Trace or replace the unresolved assets listed in the current Issue #245 audit below.
- The in-game Credits screen now includes the verified library, font, CC BY 4.0,
  CC0, music and recorded AI/project-created acknowledgements from the current
  registry. Do not mark the credits work complete until the remaining provenance
  gaps are resolved and the final production build is re-audited.

---

## Runtime Asset Provenance Gate (Issue #160)

This is the earlier provenance gate created under Issue #160 and is retained as
historical audit context. It captured the known blockers at that point in the
project, but it is **not the complete current inventory**. The broader Issue #245
audit below supersedes it for final-submission checking.

The following files identified during that earlier pass could not be credited
truthfully from the repository evidence available at the time and remain blockers
unless their source records are supplied or the files are replaced with
team-authored or properly licensed alternatives.

| Runtime asset(s) | Current evidence | Required before submission |
| --- | --- | --- |
| `cars/{aston,byd,honda,nissan,vw}-{game,lite}.glb` | Converted from uploaded archives with no preserved metadata. | Original download URL, author and licence for each vehicle. |
| `cars/diesel-thomas-proxy-{game,lite}.glb` | Procedural project proxy; uploaded Blender source was not converted. | Rights clearance for the character reference, or remove the easter egg. |
| `audio/level1/idle-car.wav` | No embedded or repository source record. | Source URL, author and licence, or replacement. |
| `models/characters/wits-shark.glb`, `models/characters/wits-shark.png` | Added without an attribution record. | Source/licence or team-authorship record. |
| `textures/road/amic-fence.png`, `textures/road/amic-fence-reference.png`, `textures/2695c241-17bb-416d-9d1d-7f061ccf7976.png` | Added without an attribution record. | Source/licence or team-authorship record. |
| `images/ui/main-menu-background.png`, `images/ui/level2-story-loading-screen.png`, `images/ui/level3-story-loading-screen.png` | Added without a generation or source record. | Generation record or source/licence. |

The in-game Credits screen mirrors this gate so an exported build does not imply
that these resources have been cleared. The documented CC BY 4.0 models, CC0
textures/HDRI, libraries and recorded AI-generated assets remain credited there
with their authors, sources and licences.


---

# Final Credits Audit — Issue #245

This section records the **current** audit state against the repository on 7 October 2026.
It is intentionally not marked final because the project is still changing and the production
submission has not yet been frozen.

## What has been checked

The repository asset tree and the code paths that load runtime assets have been reviewed across:

- libraries and fonts;
- Level 1 vehicles, foliage, ground/road textures and recorded audio;
- Level 2 player/NPC models, animation files and accessories;
- Level 3 tutor/student models, props, classroom textures, HDRI and UI assets;
- shared UI/story artwork;
- original soundtrack files;
- known AI-generated / AI-assisted assets.

The in-game credits registry now includes every attribution that can currently be stated
truthfully from repository evidence and explicitly lists unresolved provenance instead of
silently omitting it.

## Provenance currently complete enough to credit

The following resources have a recorded source/author/licence or a project-authorship record:

- Three.js — MIT.
- Vite — MIT.
- Pixelify Sans — SIL Open Font License 1.1.
- Inter — SIL Open Font License 1.1.
- Whiteboard — tboiston — CC BY 4.0.
- Paper Tablet — NameSsis — CC BY 4.0.
- Car Scene — toivo — CC BY 4.0.
- Generic Passenger Car Pack — Comrade1280 — CC BY 4.0.
- Asphalt 02 PBR set — Rob Tuytel / Poly Haven — CC0.
- Joburg Central Sunset HDRI — Dimitrios Savva and Greg Zaal / Poly Haven — CC0.
- Original menu / level soundtrack — OpenAI-assisted project-created audio.
  Continuous gameplay music is intentionally disabled; menu/story presentation
  retains music while Levels 1–3 use environmental and contextual sound.
- Level 1 story loading screen — OpenAI-generated project asset.
- Level 3 classroom brick/floor textures — AI-generated by Gabriel Raz.
- Level 3 zoom-hands UI — OpenAI-generated by Gabriel Raz.
- Team-created environments, game systems, shaders and UI listed in the project-created section above.

## Runtime groups still needing provenance or replacement

These remain **open** and are the reason Issue #245 must not be closed yet:

### Vehicles
- normalised Aston Martin, BYD, Honda, Nissan and Volkswagen runtime variants;
- Diesel Thomas proxy/reference clearance.

### Recorded Level 1 audio
- `idle-car.wav`.

The previous undocumented `car-crash.mp3` and `collision-hit.mp3` runtime files
were removed after licensed replacements were integrated under Issue #233.

### Font
- `pencil-pete-trial.ttf`.

### Level 1 foliage / environment assets
- `giant-low-poly-tree.glb`;
- `grass-pack-lods.glb`;
- `lilac-bushes-lods.glb`;
- `low-poly-tree-pack.glb`;
- stylized grass albedo / normal / roughness / AO texture set;
- `east-precast-wall-texture.jpg`.

### Level 2 player / NPC assets
- student backpack;
- female student 1–3 GLB/FBX assets;
- male student 1–3 GLB/FBX assets;
- standing-idle and walk animations;
- Level 2 player rig/model;
- injured-idle, running and selection-fight-idle animations.

### Level 3 character / prop assets
- tutor rig/model;
- seated-student animation;
- `classroom-desk.glb`;
- `classroom-plastic-chair.glb`.

The repository also retains `cartoon-desk.glb` (recorded as project-created)
and `plastic-chair.glb` (Jazavac, CC BY 4.0), but the live Level 3 code loads
the `classroom-*` replacement files instead. Their provenance relationship
must be confirmed before carrying those older credits across to the runtime replacements.

### Other runtime assets
- Wits shark model/texture;
- AMIC fence/reference textures;
- At Wits End logo;
- main-menu background images;
- Level 2 and Level 3 story images;
- suspicion-meter artwork.

For each unresolved item, the final action is one of:

1. record the original source, author and licence;
2. record a truthful team-authorship / generation record; or
3. replace/remove the asset before submission.

## Still required before final submission

- Freeze the final asset set.
- Re-run this audit against the final production code and asset tree.
- Remove stale credit entries for anything no longer shipped.
- Add any new resources introduced after this audit.
- Confirm all attribution-required licences are represented in the distributed Credits screen.
- Confirm the Credits screen is readable in the production build.
- Confirm credits survive the final LAMP build/deployment.
- Have a second team member independently cross-check the final register.

**Issue #245 should remain open until all of the above are complete.**
