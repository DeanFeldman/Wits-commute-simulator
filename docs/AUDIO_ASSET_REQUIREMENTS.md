# Audio Asset Requirements — Issue #233

The audio code now supports separate music, ambience and SFX buses and avoids using
oscillator beeps as substitutes for physical sounds. The remaining work depends on
cleared audio assets.

## Delivery rules

- Prefer team-recorded, CC0, or otherwise clearly licensed audio.
- For every downloaded sound, retain the source URL, author/uploader and licence.
- Short one-shots may be WAV or MP3.
- Loops should preferably be clean, seamless WAV files.
- Keep files mono when stereo information is not useful; positional sounds are
  panned by the game.
- Avoid heavily mastered/compressed sounds. The game mix should control loudness.
- Do not bake music into ambience recordings.

## Existing Level 1 audio that must be cleared or replaced

The following files already exist but have incomplete provenance:

- `public/assets/audio/level1/idle-car.wav`
- `public/assets/audio/level1/car-crash.mp3`
- `public/assets/audio/level1/collision-hit.mp3`
- `public/assets/audio/level1/car-door-shut.mp3`

For each one, either provide its original source/author/licence or replace it with a
cleared equivalent.

### Additional Level 1 sound

Required:

- `public/assets/audio/level1/pothole-splash-1.wav`
- `public/assets/audio/level1/pothole-splash-2.wav`

These should be short tyre/water splashes without music or voices.

Optional but useful:

- `public/assets/audio/level1/pothole-thump-1.wav`
- `public/assets/audio/level1/pothole-thump-2.wav`
- `public/assets/audio/level1/parking-brake.wav`

## Level 2 — Walking

Required:

- `public/assets/audio/level2/footstep-pavement-1.wav`
- `public/assets/audio/level2/footstep-pavement-2.wav`
- `public/assets/audio/level2/footstep-pavement-3.wav`
- `public/assets/audio/level2/footstep-pavement-4.wav`
- `public/assets/audio/level2/traffic-ambience.wav`
- `public/assets/audio/level2/vehicle-passby-1.wav`
- `public/assets/audio/level2/vehicle-passby-2.wav`
- `public/assets/audio/level2/vehicle-impact.wav`
- `public/assets/audio/level2/taxi-horn.wav`
- `public/assets/audio/level2/person-bump.wav`
- `public/assets/audio/level2/cup-pickup-1.wav`
- `public/assets/audio/level2/cup-pickup-2.wav`
- `public/assets/audio/level2/shield-pop.wav`
- `public/assets/audio/level2/pencil-mark.wav`
- `public/assets/audio/level2/paper-move.wav`
- `public/assets/audio/level2/form-submit.wav`

Optional:

- `public/assets/audio/level2/checkpoint.wav`

## Level 3 — Cheating

Required:

- `public/assets/audio/level3/classroom-ambience.wav`
- `public/assets/audio/level3/tutor-step-1.wav`
- `public/assets/audio/level3/tutor-step-2.wav`
- `public/assets/audio/level3/tutor-step-3.wav`
- `public/assets/audio/level3/tutor-step-4.wav`
- `public/assets/audio/level3/clock-tick.wav`
- `public/assets/audio/level3/peek-rustle-1.wav`
- `public/assets/audio/level3/peek-rustle-2.wav`
- `public/assets/audio/level3/heartbeat.wav`
- `public/assets/audio/level3/answer-correct.wav`
- `public/assets/audio/level3/answer-incorrect.wav`
- `public/assets/audio/level3/caught-sting.wav`
- `public/assets/audio/level3/test-complete.wav`

The classroom ambience should be restrained: projector/HVAC room tone with very
light paper/pencil/chair activity is ideal. It should not contain intelligible
speech.

The heartbeat should be a clean loop that can be varied in volume and playback
rate as suspicion increases.

## Music

No new music is required yet.

Issue #233 deliberately rebalances the existing soundtrack before deciding whether
the four compositions themselves need replacement. Once the environmental/SFX mix
is in place, reassess the menu and three level tracks in context.
