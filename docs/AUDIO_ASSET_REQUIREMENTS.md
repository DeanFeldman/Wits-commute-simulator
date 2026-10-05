# Audio Asset Requirements — Issue #233

The core audio refactor is implemented on `feat/233-audio-overhaul`: music,
ambience and SFX use separate buses; synthetic gameplay beeps are being replaced
with contextual recordings; and Level 3 music ducks as tension rises.

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
- traffic ambience is deliberately quiet and sits on the ambience bus;
- pass-by sounds trigger only when a nearby car crosses the player, are
  rate-limited, and are stereo-panned so every traffic vehicle is not noisy;
- the old synthetic taxi beep has been removed;
- questionnaire selections use the pencil mark and opening/submission uses paper
  foley.

### Level 3 — Cheating

- [x] Tutor footsteps — supplied Pixabay indoor/hallway recordings
- [x] Desk/chair movement for entering and leaving a peek — Anakronizm
- [x] Correct-answer cue — craigscottuk
- [x] Incorrect-answer cue — Bertrof
- [x] Classroom/hall room tone — klankbeeld
- [x] Adaptive heartbeat — Cloud-10
- [x] Real classroom clock tick — giddster

Runtime assets:
- `public/assets/audio/level3/tutor-steps.opus`
- `public/assets/audio/level3/interaction-sprite.opus`
- `public/assets/audio/level3/classroom-ambience.opus`
- `public/assets/audio/level3/heartbeat.opus`
- `public/assets/audio/level3/clock-tick.opus`

Implementation details:
- tutor footsteps are cropped into individual steps, randomly varied, panned,
  and attenuated using the tutor's actual classroom distance from the player;
- classroom room tone is a quiet continuous ambience layer;
- the heartbeat starts silent and fades in as suspicion rises above 20%, or as
  the final 15 seconds become urgent;
- heartbeat volume and playback rate both increase with tension while the music
  is ducked, keeping gameplay information more readable;
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

The existing files below are still used but have incomplete provenance. Either
find their original source/author/licence or supply cleared replacements:

- `idle-car.wav`
- `car-crash.mp3`
- `collision-hit.mp3`
- `car-door-shut.mp3`

Additional sounds still wanted:

- 2 short pothole / tyre-water splashes
- ideally 2 suspension or pothole thumps
- parking-brake / parking-confirmation sound

### Level 2

Still useful:

- taxi horn
- person/clothing bump or shoe shuffle
- 1–2 cup pickup / cup-lid / ice sounds
- optional checkpoint sound

### Level 3

Still needed:

- caught/failure sting
- test-complete sting

Optional:
- a subtle additional pencil/writing bed could be layered very quietly into
  the classroom if the current room tone feels too empty.

## Delivery rules

- Prefer team-recorded, CC0, or otherwise clearly licensed audio.
- Keep the source URL, author/uploader and licence for every downloaded file.
- Upload the original file; runtime conversion/cropping is done in-project.
- Avoid music baked into ambience/effect recordings.
- Mono is preferred for sounds the game positions itself.
- Do not heavily normalise/compress before supplying the file.

## Music

The soundtrack has now been fully rewritten on this branch.

The four tracks share one recognisable D-major / B-minor commute motif instead
of behaving like unrelated pieces:

- **Menu — "Commute Motif" (84 BPM):** warm, calm statement of the theme.
- **Level 1 — "After Class" (76 BPM):** slower dusk interpretation with lots of
  space for engine, collision and pothole audio.
- **Level 2 — "Crossing Rush" (116 BPM):** brighter rhythmic version designed
  to support movement without covering footsteps and traffic.
- **Level 3 — "Eyes Down" (88 BPM):** deliberately sparse fragmented version;
  suspicion/time pressure is carried primarily by heartbeat, clock and tutor
  footsteps rather than by making the music increasingly loud.

All music is project-created/generated specifically for this game and contains
no downloaded loops or third-party samples.

### Test before finalising

Listen for:

- whether the shared motif is recognisable without becoming repetitive;
- whether music remains behind SFX at normal game volume;
- whether Level 2 feels energetic without becoming tiring;
- whether Level 3 leaves enough room to locate the tutor by sound;
- whether any loop boundary is noticeable;
- whether any track should be slightly louder/quieter before the final SFX pass.

