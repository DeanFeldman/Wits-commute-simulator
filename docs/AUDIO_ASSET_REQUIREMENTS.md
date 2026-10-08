# Audio Asset Requirements — Issue #233

The core audio refactor is implemented on `feat/233-audio-overhaul`.
Gameplay now uses environmental ambience and contextual SFX rather than a
continuous level soundtrack. Music is retained for the menu / story intro only.

## Integrated

### Level 2 — Walking

- [x] Pavement footsteps — PeteBarry / Freesound
- [x] Traffic ambience — pawsound / Freesound
- [x] Two directional vehicle pass-bys — Bakstad / Freesound
- [x] Vehicle-to-player impact — avakas / Freesound
- [x] Shield pop — DRAGON-STUDIO / Pixabay
- [x] Pencil mark — NoisyRedFox / Freesound
- [x] Paper movement — ssugg / Freesound

Runtime assets:
- `public/assets/audio/level2/footsteps-pavement.opus`
- `public/assets/audio/level2/traffic-ambience.opus`
- `public/assets/audio/level2/vehicle-passbys.opus`
- `public/assets/audio/level2/vehicle-impact.opus`
- `public/assets/audio/level2/interaction-sprite.opus`
- `public/assets/audio/level2/paper-sprite.opus`

Implementation details:
- footsteps trigger only after a completed grid step and rotate through cropped
  samples with small playback-rate variation;
- traffic ambience is preloaded and layered twice with different offsets/rates,
  making the short source loop much harder to perceive as a repeating cycle;
- pass-by sounds trigger only when a nearby car crosses the player, are
  stereo-panned, and use a 2.8-second global cooldown to prevent long pass-by
  recordings from stacking into a wall of sound;
- the old synthetic taxi beep has been removed;
- questionnaire selections use the pencil mark and opening/submission uses paper
  foley.

### Level 3 — Cheating

- [x] Tutor footsteps — supplied Pixabay indoor/hallway recordings
- [x] Desk/chair movement for entering and leaving a peek — Anakronizm
- [x] Replacement correct-answer tick — DRAGON-STUDIO / Pixabay
- [x] Replacement incorrect-answer cue — TheBuilder15 / Pixabay
- [x] Classroom/hall room tone — klankbeeld
- [x] Adaptive heartbeat — Cloud-10
- [x] Real classroom clock tick — giddster

Runtime assets:
- `public/assets/audio/level3/tutor-steps.opus`
- `public/assets/audio/level3/interaction-sprite.opus`
- `public/assets/audio/level3/classroom-ambience.opus`
- `public/assets/audio/level3/heartbeat.opus`
- `public/assets/audio/level3/clock-tick.opus`
- `public/assets/audio/level3/correct-tick.opus`
- `public/assets/audio/level3/incorrect-answer.opus`

Implementation details:
- tutor footsteps are cropped into individual steps, randomly varied, panned,
  and attenuated using the tutor's actual classroom distance from the player;
- classroom room tone, heartbeat and clock are all preloaded before gameplay;
- the Level 3 interaction sprite contains only the two active peek-rustle cues;
- the heartbeat starts silent and fades in as suspicion rises above 20%, or as
  the final 15 seconds become urgent;
- heartbeat volume and playback rate both increase with tension, keeping
  gameplay information readable without relying on a continuous soundtrack;
- the real wall clock stays extremely quiet during normal play, then steps up
  subtly at 30, 15 and 5 seconds remaining instead of beeping every second.

## Supplied but not used

The following supplied recordings are currently not needed because the chosen
sources are cleaner or have clearer licence records:

- gadesound vehicle pass-by 697044
- Reikun footsteps 220335
- Stevious42 footsteps 259639

They remain source options if the current mix needs a different character.

## Still needed

### Level 1 — Parking

Integrated in the latest pass:

- [x] immediate licensed collision impact;
- [x] dedicated low pothole thump;
- [x] wet-pothole water splash layered over the thump;
- [x] dedicated FunWithSound CC0 parking-lot ambience replaces the temporary
  Level 2 traffic-bed reuse;
- [x] GiocoSound CC0 exterior car-start cue plays once at Level 1 startup;
- [x] LHermanns CC BY 4.0 engine loop crossfades in progressively below 35%
  vehicle condition as a high-damage layer.

The old undocumented `car-crash.mp3` and `collision-hit.mp3` files have been
removed from the branch because they are no longer used.

Still required before submission:

- no Level 1 audio provenance is currently outstanding; the active healthy
  engine is `idle-car.opus`, sourced from GiocoSound 401552 under CC0.

The old end-of-Level-1 door-close cue has been removed from gameplay, so
`car-door-shut.mp3` is no longer required.

Still optional:
- parking-brake / parking-confirmation sound.

### Level 2

Integrated in the latest pass:

- [x] contextual road-warning horn (never tied to taxi spawn/stop);
- [x] person collision / bump;
- [x] Vida cup collection cue;
- [x] stronger road-proximity traffic ambience;
- [x] louder, preloaded vehicle collision feedback.

Optional:
- checkpoint confirmation sound.

### Level 3

Integrated in the latest pass:

- [x] replacement incorrect-answer cue;
- [x] replacement correct-answer tick;
- [x] both answer cues are pre-decoded before gameplay for frame-accurate playback;
- [x] generic failure and completion stings removed.

Optional:
- a subtle additional pencil/writing bed could be layered very quietly into
  the classroom if the current room tone feels too empty.

## Final timing / mix audit

Implemented after the full audit:

- [x] current `main` merged into the audio branch, including the latest Level 2
  crowd/pathing and quiz-disposal changes;
- [x] master dynamics limiter added after the shared music/ambience/SFX buses to
  catch stacked gameplay peaks without flattening the normal mix;
- [x] critical one-shot effects are pre-decoded into Web Audio buffers before
  gameplay, preventing first-use timing delays;
- [x] generic success/failure stings removed from every level;
- [x] continuous level music removed; gameplay is driven by contextual ambience
  and effects, with music retained for menu/story presentation only;
- [x] Level 2 pass-by overlap reduced with a 2.8-second cooldown;
- [x] short Level 2 traffic ambience de-repeated with two offset/rate layers;
- [x] Level 3 interaction sprite repacked to remove unused legacy answer clips;
- [x] Level 1 completion door sound removed; completion has no generic cue.

The remaining provenance blocker is the MacFerret_20 crossing-signal licence,
which still requires verification from the original Freesound record.

Failure-flow hardening:
- decoded Web Audio one-shots now dispose safely even if they are still playing;
- level cleanup errors are logged but can no longer trap the player behind the
  failure fade overlay.

No additional gameplay sound category is required for issue #233. Parking-confirm,
Level 2 checkpoint confirmation and extra classroom writing texture remain optional
polish only.

## Delivery rules

- Prefer team-recorded, CC0, or otherwise clearly licensed audio.
- Keep the source URL, author/uploader and licence for every downloaded file.
- Upload the original file; runtime conversion/cropping is done in-project.
- Avoid music baked into ambience/effect recordings.
- Mono is preferred for sounds the game positions itself.
- Do not heavily normalise/compress before supplying the file.

## Music

The four project-created tracks remain in the repository, but continuous music
is intentionally disabled during Levels 1–3. The menu / story-intro music is
retained for presentation and transitions.

This matches the final sound-design direction: gameplay information is carried
by engine/impact/pothole audio, footsteps, traffic, pickups, classroom room tone,
tutor footsteps, clock, heartbeat, paper movement and answer feedback. This
keeps important cues readable and avoids using music merely because a game is
expected to have a soundtrack.
