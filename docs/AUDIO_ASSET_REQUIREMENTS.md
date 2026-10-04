# Audio Asset Requirements — Issue #233

The core audio refactor is implemented on `feat/233-audio-overhaul`: music,
ambience and SFX use separate buses; the old synthetic gameplay beeps are being
replaced with contextual recordings; and Level 3 music ducks as tension rises.

## Integrated from the first supplied batch

### Level 2

- [x] Vehicle-to-player impact — avakas / Freesound
- [x] Shield pop — DRAGON-STUDIO / Pixabay
- [x] Pencil mark — NoisyRedFox / Freesound

The shield and pencil sounds are packed into
`public/assets/audio/level2/interaction-sprite.opus`. The collision sound is
`public/assets/audio/level2/vehicle-impact.opus`.

### Level 3

- [x] Tutor footsteps — supplied Pixabay indoor/hallway recordings
- [x] Desk/chair movement for entering and leaving a peek — Anakronizm
- [x] Correct-answer cue — craigscottuk
- [x] Incorrect-answer cue — Bertrof

These are packed into:
- `public/assets/audio/level3/tutor-steps.opus`
- `public/assets/audio/level3/interaction-sprite.opus`

The tutor footsteps are cropped into individual steps, randomly varied, stereo
panned, and attenuated using the tutor's actual classroom distance from the
player.

## Supplied candidate held pending licence confirmation

The supplied paper recording is not currently included in runtime assets:

- https://freesound.org/people/ssugg/sounds/588320/

Please confirm the licence displayed on that Freesound page before it is used.
Once cleared, it can cover paper movement and potentially form submission with
separate cropped sections.

## Files still needed

### Level 1 — Parking

The existing files below are still used but have incomplete provenance. Please
either find their original source/author/licence or supply cleared replacements:

- `idle-car.wav`
- `car-crash.mp3`
- `collision-hit.mp3`
- `car-door-shut.mp3`

Additional sounds still wanted:

- 2 short pothole / tyre-water splashes
- ideally 2 suspension or pothole thumps
- parking-brake / parking-confirmation sound

### Level 2 — Walking

You have already identified candidates for the first three groups below, but the
actual audio files still need to be uploaded so they can be trimmed, normalised
and added to the branch.

**Pavement footsteps**
- https://freesound.org/people/Reikun/sounds/220335/
- https://freesound.org/people/Stevious42/sounds/259639/
- https://freesound.org/people/PeteBarry/sounds/647403/

**Traffic ambience**
- https://freesound.org/people/pawsound/sounds/154858/

**Vehicle pass-bys**
- https://freesound.org/people/Bakstad/sounds/823549/
- https://freesound.org/people/gadesound/sounds/697044/

Also still needed:
- taxi horn
- person/clothing bump or shoe shuffle
- 1–2 cup pickup / cup-lid / ice sounds
- form-submit sound if the paper source is not cleared
- optional checkpoint sound

### Level 3 — Cheating

Still needed:

- real classroom ambience loop: quiet HVAC/projector room tone with light
  paper/pencil/chair activity and no intelligible speech
- real clock tick
- clean heartbeat loop
- caught/failure sting
- test-complete sting

The supplied Anakronizm recording is useful classroom **foley**, but it is not
ambient room tone: it contains a person approaching a desk, moving the
desk/chair/writing surface, and sitting. It is therefore used for peek movement
rather than looped as ambience.

## Delivery rules

- Prefer team-recorded, CC0, or otherwise clearly licensed audio.
- Keep the source URL, author/uploader and licence for every downloaded file.
- Upload the original file; runtime conversion/cropping will be done in-project.
- Avoid music baked into ambience/effect recordings.
- Mono is preferred for sounds that the game will position itself.
- Do not heavily normalise/compress before supplying the file.

## Music

No replacement music is required yet.

The existing soundtrack should be reassessed after the environmental and
interaction soundscape is complete. This avoids replacing the music before we
know how it sits in the corrected mix.
