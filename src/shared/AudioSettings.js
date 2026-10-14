// Single place to tune every runtime sound in Wits Commute Simulator.
//
// All 'volume' values are MULTIPLIERS of the volume requested by gameplay;
// 1 leaves the level's distance/speed/damage-based fades unchanged, 0 mutes.
// 'playbackRate' multiplies the requested speed (1 = unchanged).
// 'bus' is optional: "sfx", "ambience" or "music".
// The game options' Music and SFX sliders still apply on top of these values.
// Sprite files contain several cues: changing their setting affects every cue
// in that sprite, while the start/duration selection stays with each level.
export class AudioSettings {
  static mix = Object.freeze({
    master: 0.9,
    music: 0.18,
    ambience: 0.34,
    sfx: 1
  });

  static sounds = Object.freeze({
    // Main menu
    "./assets/audio/music/menu-commute-theme.wav": { volume: 1, playbackRate: 1 },

    // Level 1 – parking
    "./assets/audio/level1/406096__funwithsound__roadside-parking-lot-2.mp3": { volume: 1, playbackRate: 1 },
    "./assets/audio/level1/401558__giocosound__sfx_car_engine_outside_start.wav": { volume: 1, playbackRate: 1 },
    "./assets/audio/level1/idle-car.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level1/557214__lhermanns__enginewarmup_1-loop.wav": { volume: 1, playbackRate: 1 },
    "./assets/audio/level1/impact-sprite.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level1/car-door-close.opus": { volume: 0.85, playbackRate: 1 },

    // Level 2 – walking / traffic
    "./assets/audio/level2/interaction-sprite.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/vehicle-impact.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/footsteps-pavement.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/traffic-ambience.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/vehicle-passbys.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/extra-sprite.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/cup-pickup.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/person-bump.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/crossing-signal.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level2/paper-sprite.opus": { volume: 1, playbackRate: 1 },

    // Level 3 – exam
    "./assets/audio/level3/tutor-steps.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level3/interaction-sprite.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level3/classroom-ambience.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level3/heartbeat.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level3/clock-tick.opus": { volume: 1, playbackRate: 1 },
    "./assets/audio/level3/correct-tick.opus": { volume: 1.7, playbackRate: 1 },
    "./assets/audio/level3/incorrect-answer.opus": { volume: 1, playbackRate: 1 }
  });

  static gain(path, requested = 1) {
    return Math.max(0, requested) * (this.sounds[path]?.volume ?? 1);
  }

  static rate(path, requested = 1) {
    return Math.max(0.25, requested * (this.sounds[path]?.playbackRate ?? 1));
  }

  static bus(path, requested = "sfx") {
    return this.sounds[path]?.bus ?? requested;
  }
}
