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

Implementation details:
- tutor footsteps are cropped into individual steps, randomly varied, panned,
  and attenuated using the tutor's actual classroom distance from the player;
- classroom room tone, heartbeat and clock are all preloaded before gameplay;
- the Level 3 interaction sprite contains only the two active peek-rustle cues;
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

Integrated in the latest pass:

- [x] immediate licensed collision impact;
- [x] dedicated low pothole thump;
- [x] wet-pothole water splash layered over the thump.

The old undocumented `car-crash.mp3` and `collision-hit.mp3` files have been
removed from the branch because they are no longer used.

Still required before submission:

- provenance or a cleared replacement for `idle-car.wav`;
- provenance or a cleared replacement for `car-door-shut.mp3`.

Still optional:
- parking-brake / parking-confirmation sound.

### Level 2

Integrated in the latest pass:

- [x] taxi horn;
- [x] person collision / bump;
- [x] Vida cup collection cue;
- [x] stronger road-proximity traffic ambience;
- [x] louder, preloaded vehicle collision feedback.

Optional:
- checkpoint confirmation sound.

### Level 3

Integrated in the latest pass:

- [x] louder replacement incorrect-answer cue;
- [x] caught / failure sting;
- [x] test-complete / success sting.

- [x] replacement correct-answer tick supplied, processed, preloaded and wired.

Optional:
- a subtle additional pencil/writing bed could be layered very quietly into
  the classroom if the current room tone feels too empty.

## Final timing / mix audit

Implemented after the full audit:

- [x] current `main` merged into the audio branch, including the latest Level 2
  crowd/pathing and quiz-disposal changes;
- [x] master dynamics limiter added after the shared music/ambience/SFX buses to
  catch stacked gameplay peaks without flattening the normal mix;
- [x] gameplay music and long ambience loops are preloaded during level loading;
- [x] Level 2 fatal vehicle impact is routed through persistent game audio so the
  tail survives level disposal;
- [x] all failure stings now use persistent game audio on Levels 1–3;
- [x] gameplay music fades over 120 ms before fail/success stings;
- [x] Level 2 pass-by overlap reduced with a 2.8-second cooldown;
- [x] short Level 2 traffic ambience de-repeated with two offset/rate layers;
- [x] Level 3 interaction sprite repacked to remove unused legacy answer clips;
- [x] Level 1 completion door sound preloaded.

Remaining audio blockers are provenance-only:

- `public/assets/audio/level1/idle-car.wav`
- `public/assets/audio/level1/car-door-shut.mp3`

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

