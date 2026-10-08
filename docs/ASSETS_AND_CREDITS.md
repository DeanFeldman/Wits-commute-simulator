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

### Pencil Pete FONT (trial)

Type: Font

Source:
https://www.1001fonts.com/pencilpete-font-font.html

Author:
JOEBOB graphics

Licence:
Free for personal use / trial licence; not free for commercial use according to
the 1001 Fonts listing. The repository currently ships the trial TTF, so the team
must confirm that redistribution in the submitted game is permitted or replace it
with a font whose redistribution terms are clear.

Used for:
Level 3 handwritten hologram / answer-note text.

File:
`public/assets/fonts/pencil-pete-trial.ttf`

Modified: No

Added by:
Gabriel Raz

Status:
Source identified, but **redistribution clearance still required before submission**.

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

### Diesel Powered Thomas (reference source for project proxy)

Type:
Model / reference source

Source:
https://sketchfab.com/3d-models/diesel-powered-thomas-7e94742d88a84ca9aacb6b7881aec2ab

Author:
mrmrnaufal

Licence:
Creative Commons Attribution (CC BY), as displayed on the Sketchfab model page.

Used for:
Reference/source for the lightweight project-made `diesel-thomas-proxy-game.glb`
and `diesel-thomas-proxy-lite.glb` files retained under `public/assets/cars/`.
The proxy files are procedural stand-ins and are not a conversion of the source mesh.

Modified:
The source model itself is not shipped. The retained proxies were created separately
from simple geometry for this project.

Added by:
Dean Feldman

---

## Foliage Models

The current Level 1 foliage runtime paths in `ParkingFoliage.js` are:
`low-poly-tree-pack.glb`, `giant-low-poly-tree.glb`,
`lilac-bushes-lods.glb`, and `grass-pack-lods.glb`.

### Grass Pack of 9 Variations

Type: Model / foliage pack

Source:
https://sketchfab.com/3d-models/grass-pack-of-9-vars-lowpoly-game-ready-0561204a1fa14c17939300ee1108948b

Author:
LOLIPOP (@lolipop_1707)

Licence:
Creative Commons Attribution (CC BY) as listed by Sketchfab.

Used for:
Level 1 grass foliage instances.

File:
`public/assets/models/foliage/grass-pack-lods.glb`

Modified:
Yes — imported/processed for runtime use and instanced by `ParkingFoliage.js`.

Added by:
Gabriel Raz

### Lilac Bush Pack (12 variations, LODs)

Type: Model / foliage pack

Source:
https://sketchfab.com/3d-models/lilac-bush-pack-12-vars-lods-game-ready-10312697ec994fc99355cb94f1963a2e

Author:
LOLIPOP (@lolipop_1707)

Licence:
Creative Commons Attribution (CC BY) as listed by Sketchfab.

Used for:
Level 1 bush / understory foliage.

File:
`public/assets/models/foliage/lilac-bushes-lods.glb`

Modified:
Yes — imported/processed for runtime use and instanced by `ParkingFoliage.js`.

Added by:
Gabriel Raz

### Giant Low Poly Tree

Type: Model

Source:
https://sketchfab.com/3d-models/giant-low-poly-tree-acfd2b7f80894848b56c2ac8e7e59572

Author:
Sahir Virmani (@sahirvirmani)

Licence:
Creative Commons Attribution (CC BY) as listed by Sketchfab.

Used for:
Level 1 hero / near-campus tree instances.

File:
`public/assets/models/foliage/giant-low-poly-tree.glb`

Modified:
Yes — normalised/scaled and instanced at runtime.

Added by:
Gabriel Raz

### Low Poly Tree Pack

Type: Model / foliage pack

Source:
https://sketchfab.com/3d-models/low-poly-tree-pack-1edaac90fe8d4bb28546740496684d96

Author:
Pasha (@Pasha.)

Licence:
Sketchfab Free Standard, as listed on the model page.

Used for:
Level 1 near and distant tree instances.

File:
`public/assets/models/foliage/low-poly-tree-pack.glb`

Modified:
Yes — selected subtrees are normalised/scaled and instanced at runtime.

Added by:
Gabriel Raz

### Maple Trees Pack (historical / no longer loaded)

Type: Model / foliage pack

Source:
https://sketchfab.com/3d-models/maple-trees-pack-lowpoly-game-ready-lods-b5d2833c258f4054a01ee2b4ef85adf0

Author:
LOLIPOP (@lolipop_1707)

Licence:
Creative Commons Attribution (CC BY) as listed by Sketchfab.

Status:
This pack was previously added as `maple-trees-lods.glb` but the current
`ParkingFoliage.js` no longer loads it. Retained here only as historical
provenance; it should not appear as a current runtime credit unless reintroduced.

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

### Level 2 Pedestrian Crossing Signal

Type:
Road-crossing ambience / traffic-light signal

Source:
https://freesound.org/people/MacFerret_20/sounds/231936/

Author:
MacFerret_20

Licence:
**Exact Freesound licence still to be verified before final submission.**

Used for:
A low traffic-light ticking layer that fades in only as the player approaches
and crosses Yale Road in Level 2.

Runtime file:
`public/assets/audio/level2/crossing-signal.opus`

Modified:
Yes — leading silence removed, downmixed to mono, loop boundary crossfaded,
normalised with headroom and encoded to Opus.

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

### Level 1 Normal Engine Idle

Type:
Sound effect / vehicle loop

Source:
https://freesound.org/people/GiocoSound/sounds/401552/

Author:
GiocoSound

Licence:
Creative Commons 0 (CC0)

Used for:
Normal Level 1 engine idle / low-speed engine bed after the startup cue.

Runtime file:
`public/assets/audio/level1/idle-car.opus`

Modified:
Yes — converted to compact Opus and circularly crossfaded for a cleaner loop.

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

### Level 2 Traffic Warning Horn

Type:
Sound effect

Source:
https://pixabay.com/sound-effects/film-special-effects-automobile-horn-02-352065/

Author:
Universfield

Licence:
Pixabay Content License

Used for:
A warning only when the player is standing directly in a Yale Road lane and a
vehicle is approaching. Taxi spawning/stopping does not trigger it.

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
https://freesound.org/people/foxboyprower/sounds/512568/

Author:
foxboyprower

Licence:
Creative Commons 0 (CC0)

Used for:
Player-to-pedestrian bumps in Level 2.

Runtime file:
`public/assets/audio/level2/person-bump.opus`

Modified:
Yes — downmixed to mono, peak-normalised with headroom and encoded to Opus.

Added by:
Nadav Sundy


### Level 2 Vida Cup Pickup

Type:
Sound effect

Source:
https://freesound.org/people/Leszek_Szary/sounds/171579/

Author:
Leszek_Szary

Licence:
Creative Commons 0 (CC0)

Used for:
Immediate Vida cup collection feedback in Level 2.

Runtime file:
`public/assets/audio/level2/cup-pickup.opus`

Modified:
Yes — the silent tail was removed, the useful cue was downmixed to mono,
normalised with headroom and encoded to Opus.

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
`public/assets/audio/level3/incorrect-answer.opus`

Modified:
Yes — cropped to the useful error cue, encoded to Opus and played at a stronger
gain than the previous incorrect sound.

Added by:
Nadav Sundy

The older `public/assets/audio/shared/result-sprite.opus` is retained as a
retired source artifact but is not referenced or loaded at runtime. It must not
be presented as the active incorrect-answer or generic result cue.

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


### Main Menu Background

Type:
Image / UI artwork

File:
`public/assets/images/ui/main-menu-background.png`

Source:
Generated with OpenAI image generation via ChatGPT at Dean Feldman's direction
for Wits Commute Simulator.

Author:
OpenAI-generated project asset, directed by Dean Feldman.

Licence:
Generated output — no third-party licence attaches. Note that the generating
model was trained on third-party data.

Used for:
Main menu background artwork.

Added by:
Dean Feldman

### Level 3 Story Loading Screen

Type:
Image / UI artwork

File:
`public/assets/images/ui/level3-story-loading-screen.png`

Source:
Generated with OpenAI image generation via ChatGPT at Dean Feldman's direction
for Wits Commute Simulator.

Author:
OpenAI-generated project asset, directed by Dean Feldman.

Licence:
Generated output — no third-party licence attaches. Note that the generating
model was trained on third-party data.

Used for:
The pre-Level 3 story/loading screen.

Added by:
Dean Feldman

### Original Level Soundtrack

Type:
Music / pre-rendered WAV soundtrack

Source:
Generated with OpenAI/ChatGPT on 2026-09-25 at the project team's request. The rendered WAV files are stored under `public/assets/audio/music/`. Only `menu-commute-theme.wav` is currently mapped for runtime menu/story playback; the three level tracks remain retained, unused repository assets. No third-party samples or downloaded music files are used.

Files:
`menu-commute-theme.wav`, `level1-dusk-drive.wav`, `level2-empire-rush.wav`, `level3-dont-get-caught.wav`.

Author:
OpenAI-assisted composition generated for the Wits Commute Simulator team.

Licence:
Generated output - no third-party licence attaches. Note that the generating model was trained on third-party data.

Used for:
"Commute Theme" on the home page and level loading/story screens, Level 1 "Dusk Drive" (moody campus driving), Level 2 "Empire Rush" (fast arcade crossing), and Level 3 "Don't Get Caught" (sparse stealth tension).

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

### Historical normalised vehicle variants

The old Aston Martin, BYD, Honda, Nissan and Volkswagen `*-game/lite.glb`
variants are no longer present in the current repository asset tree, so they
require no current submission credit unless reintroduced.

The retained Diesel Thomas proxy files are documented separately above. Their
reference source is mrmrnaufal's Sketchfab model under Creative Commons
Attribution (CC BY), and the repository proxies are project-made procedural
stand-ins rather than a conversion of that source mesh.

---

# Project-Created Assets

Original assets authored by the team:

- Wits parking blockout and bay layout (Level 1)
- M1 cutting and surrounding road geometry (Level 1)
- Custom car hierarchy and vehicle controller rig
- Custom asphalt shader (`src/shaders/asphaltShader.js`)
- Level 2 crossing grid and traffic layout
- Level 3 classroom layout, desk grid and exam-paper canvas textures
- Wits shark 3D model — created by Gabriel Raz using Wits Sharks Instagram imagery as visual reference supplied by Dean Feldman; the unused reference PNG has been removed
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
| `cars/{aston,byd,honda,nissan,vw}-{game,lite}.glb` | Historical Issue #160 record only. These files are no longer present in the current repository asset tree. | No current credit action unless these assets are reintroduced. |
| `cars/diesel-thomas-proxy-{game,lite}.glb` | Procedural project proxy. Reference source: mrmrnaufal, “Diesel Powered Thomas,” Sketchfab, Creative Commons Attribution (CC BY). The uploaded Blender source was not converted. | Source/author/licence record complete; retain attribution if the proxy files remain distributed. |
| `models/characters/wits-shark.glb` | Project-created by Gabriel Raz using the Wits Sharks Instagram account as visual reference supplied by Dean Feldman. The unused `wits-shark.png` reference file was removed because runtime code loads only the GLB. | Project-authorship/reference record complete for the retained GLB. |
| `textures/road/amic-fence.png`, `textures/road/amic-fence-reference.png`, `textures/2695c241-17bb-416d-9d1d-7f061ccf7976.png` | Directly edited/adapted by Dean Feldman from imagery in Crown Publications' “Bridging the divide” article; the article credits its images to eimage/Gareth Gilmour. | Confirm the article image reuse/redistribution terms for these adapted textures, or replace them with cleared/team-made equivalents. |
| `images/ui/main-menu-background.png`, `images/ui/level2-story-loading-screen.png`, `images/ui/level3-story-loading-screen.png` | Dean Feldman confirmed main-menu-background.png and level3-story-loading-screen.png were generated with OpenAI image generation via ChatGPT. Level 2 story art remains unresolved in this group. | Main menu and Level 3 story generation records are now documented; Level 2 story art still needs its own generation/source record. |

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
- Plastic Chair (retained public asset) — Jazavac — CC BY 4.0.
- Paper Tablet — NameSsis — CC BY 4.0.
- Car Scene — toivo — CC BY 4.0.
- Generic Passenger Car Pack — Comrade1280 — CC BY 4.0.
- Diesel Powered Thomas reference — mrmrnaufal — Creative Commons Attribution (CC BY), as displayed on Sketchfab; retained project proxies are procedural stand-ins.
- Asphalt 02 PBR set — Rob Tuytel / Poly Haven — CC0.
- Joburg Central Sunset HDRI — Dimitrios Savva and Greg Zaal / Poly Haven — CC0.
- Grass Pack of 9 Variations — LOLIPOP — CC BY.
- Lilac Bush Pack — LOLIPOP — CC BY.
- Giant Low Poly Tree — Sahir Virmani — CC BY.
- Low Poly Tree Pack — Pasha — Sketchfab Free Standard.
- Original menu / level soundtrack — OpenAI-assisted project-created audio.
- Level 1 story loading screen — OpenAI-generated project asset.
- Main menu background — OpenAI/ChatGPT-generated project asset directed by Dean Feldman.
- Level 3 story loading screen — OpenAI/ChatGPT-generated project asset directed by Dean Feldman.
- Wits shark 3D model — project-created by Gabriel Raz using Wits Sharks Instagram imagery as visual reference supplied by Dean Feldman. The unused reference PNG has been removed; gameplay loads only the GLB.
- Level 3 classroom brick/floor textures — AI-generated by Gabriel Raz.
- Level 3 zoom-hands UI — OpenAI-generated by Gabriel Raz.
- Team-created environments, game systems, shaders and UI listed in the project-created section above.

## Runtime groups still needing provenance or replacement

These remain **open** and are the reason Issue #245 must not be closed yet:

### Vehicles / retained car assets
- Diesel Thomas provenance is resolved: reference source mrmrnaufal on Sketchfab, Creative Commons Attribution (CC BY); retained proxy GLBs are project-made procedural stand-ins.
- The Aston Martin, BYD, Honda, Nissan and Volkswagen `*-game/lite.glb` files referenced by
  the legacy `CAR_SPECS` table are **not present in the current repository asset tree** and
  are therefore not part of the present distributed asset inventory.


### Font
- `pencil-pete-trial.ttf` — source and author are now identified, but the trial
  licence still needs redistribution clearance or replacement.

### Level 1 foliage / environment assets
- **Foliage model provenance resolved:** `giant-low-poly-tree.glb`,
  `grass-pack-lods.glb`, `lilac-bushes-lods.glb`, and
  `low-poly-tree-pack.glb` now have recorded sources/authors/licences above.
- stylized grass albedo / normal / roughness / AO texture set;
- `east-precast-wall-texture.jpg` — image found online via Google Images, with the original source traced to Precast Walling Pros; directly edited/adapted by Dean Feldman for the game.

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
- Wits shark: the 3D model authorship/reference source is recorded. `wits-shark.png` was unused by gameplay and has been removed from the repository; only the project-created GLB remains.
- AMIC fence/reference textures and the Level 2 AMIC deck texture
  `2695c241-17bb-416d-9d1d-7f061ccf7976.png` — source imagery found online, traced to Crown Publications' “Bridging the divide” article (images credited there to eimage/Gareth Gilmour), then directly edited/adapted by Dean Feldman for the game.
- At Wits End logo;
- `main-menu-v3-background.png`;
- Level 2 story image;
- suspicion-meter artwork.

The separate `main-menu-background.png` and Level 3 story image now have OpenAI/ChatGPT generation records supplied by Dean Feldman.

For each unresolved item, the final action is one of:

1. record the original source, author and licence;
2. record a truthful team-authorship / generation record; or
3. replace/remove the asset before submission.

### Level 2 crossing-signal licence verification

The source and author for `crossing-signal.opus` are recorded as MacFerret_20,
Freesound sound 231936. Confirm the exact licence displayed on that specific
Freesound page before final submission; do not infer it from the author's other
recordings.

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


## 7 October 2026 source follow-up

Gabriel Raz supplied source links for the foliage assets and re-confirmed the
already-recorded Asphalt 02, Car Scene, Generic Passenger Car Pack, Paper Tablet
and Whiteboard sources. The current runtime foliage mapping was rechecked against
`src/levels/parking/ParkingFoliage.js`.

The Maple Trees Pack source was also supplied, but that pack is no longer loaded
by the current runtime code, so it is retained only as historical provenance.

The Pencil Pete source was identified as JOEBOB graphics' trial font. This closes
the "unknown source" part of that item, but not the redistribution/licence-clearance
part; it remains open until the team confirms the trial licence permits shipping
the TTF with the project or replaces it.


---

# Whole-Repo Credits Re-audit — 7 October 2026

A second audit was performed against the complete repository tree on the
`docs/245-raz-source-followup` branch after the Raz source follow-up.

## Audit scope

- all 85 files under `public/assets/`;
- all 57 JavaScript/CSS/HTML source files that can reference shipped assets;
- current runtime asset references in Levels 1–3 and shared systems;
- assets retained under `public/` even where current gameplay no longer loads them;
- Git history used to identify the team member who introduced each unresolved asset.

Because Vite copies `public/` into the production output, retained third-party
assets still need either a valid credit/provenance record or removal from the
final submitted asset set, even when they are not referenced by current gameplay.

## Corrections from the re-audit

1. The Level 2 AMIC deck texture
   `public/assets/textures/2695c241-17bb-416d-9d1d-7f061ccf7976.png`
   is actively loaded by `CrossingStrip.js` and must remain on the unresolved list.
2. The Aston Martin, BYD, Honda, Nissan and Volkswagen normalised `*-game/lite.glb`
   files are not present in the current repository tree. They are stale/historical
   references, not current distributed assets.
3. `plastic-chair.glb` remains in `public/assets/models/props/` and is already
   attributable to Jazavac under CC BY 4.0, even though current Level 3 gameplay
   loads `classroom-plastic-chair.glb`.
4. `cartoon-desk.glb` remains in the public asset folder and already has a
   project-authorship record; the live classroom replacement
   `classroom-desk.glb` still needs its own provenance relationship confirmed.
5. `collision-hit.mp3` and `wits-shark.png` are retained in `public/` but were
   not found as current direct runtime references. They still need provenance or
   should be removed before the final asset freeze.
6. The four foliage packs currently loaded by `ParkingFoliage.js` now have source
   records. The supplied Maple Trees Pack source is historical only because that
   model is no longer present/loaded in the current repository.

## Current unresolved distributed assets

### Gabriel Raz
- `pencil-pete-trial.ttf` — source/author found; distribution permission still
  needs confirmation or replacement.
- Level 1 stylized grass texture set.
- Level 2 student backpack.
- Level 2 male/female student rig + textured model sets.
- Level 2 standing/walk and player idle/run/selection animation files.
- Level 2 player rig/textured model.
- Level 3 tutor rig/textured model.
- Level 3 seated-student animation.
- `classroom-desk.glb` and `classroom-plastic-chair.glb` replacement provenance.
- At Wits End logo.
- `main-menu-v3-background.png`.
- Level 2 story-loading image.
- `suspicion-meter.png`.
- `car-crash.mp3`, `car-door-shut.mp3`, and `idle-car.wav`.

### Dean Feldman
- `east-precast-wall-texture.jpg` — found online via Google Images, traced to Precast Walling Pros, and directly edited/adapted by Dean Feldman for the game.
- Wits shark — Gabriel Raz created the 3D model; Dean supplied the Wits Sharks Instagram visual reference. The unused reference PNG has been removed; runtime uses only the GLB.
- `amic-fence.png`, `amic-fence-reference.png`, and
  `2695c241-17bb-416d-9d1d-7f061ccf7976.png` — found online, traced to Crown Publications' “Bridging the divide” (article images credited to eimage/Gareth Gilmour), then directly edited/adapted by Dean for the game.
- `main-menu-background.png` — OpenAI image generation via ChatGPT, directed by Dean Feldman; generation record complete.
- Level 3 story-loading image — OpenAI image generation via ChatGPT, directed by Dean Feldman; generation record complete.

### Liora Rosenberg
- `collision-hit.mp3` — likely traceable from the original source filename, but
  the exact source page, author and licence still need to be recorded.

## 7 October 2026 Dean source follow-up

Dean Feldman supplied the following provenance details for the assets attributed to him in the re-audit:

- **Diesel Powered Thomas source:** https://sketchfab.com/3d-models/diesel-powered-thomas-7e94742d88a84ca9aacb6b7881aec2ab — author **mrmrnaufal**, licence **Creative Commons Attribution (CC BY)** as displayed on Sketchfab. The repository ships only lightweight project-made procedural proxy GLBs, not a conversion of that Blender mesh. This provenance item is resolved.

- **East precast wall:** found online via Google Images, with the original image traced to Precast Walling Pros at `precastwallingpros.co.za`; directly edited/adapted by Dean Feldman for the game.
- **Wits shark:** Gabriel Raz created the 3D model using his modelling workflow. Dean supplied imagery from the Wits Sharks Instagram account as the visual reference. The unused `wits-shark.png` reference image was removed because runtime code loads only `wits-shark.glb`.
- **AMIC fence/reference and deck texture:** source imagery found online and traced to Crown Publications' article “Bridging the divide” (`https://www.crown.co.za/lighting-in-design/case-studies/27707-bridging-the-divide`), which credits its images to eimage/Gareth Gilmour; directly edited/adapted by Dean Feldman for the game.
- **Main menu background:** generated with OpenAI image generation via ChatGPT at Dean's direction for this project.
- **Level 3 story/loading image:** generated with OpenAI image generation via ChatGPT at Dean's direction for this project.

These records resolve the missing generation/authorship history for the two AI-generated UI images and the Diesel Thomas source/author/licence record. They also identify the source/reference history for the wall, shark and AMIC assets without inventing licence terms that have not been confirmed.

---

## Final rule

Issue #245 remains open. Before it can close, the final production asset set must
be frozen, every unresolved item above must either gain a truthful source/licence
or team-authorship record or be removed/replaced, and the final LAMP build must be
checked against this ledger.
