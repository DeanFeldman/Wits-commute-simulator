const MUSIC_GAIN = 3.2;
const MUSIC_FILES = {
  menu: "./assets/audio/music/menu-commute-theme.wav",
  level1: "./assets/audio/music/level1-dusk-drive.wav",
  level2: "./assets/audio/music/level2-empire-rush.wav",
  level3: "./assets/audio/music/level3-dont-get-caught.wav"
};

export class LevelAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engine = null;
    this.engineGain = null;
    this.ambience = null;
    this.music = null;
    this.musicSource = null;
    this.musicGain = null;
    this.musicLimiter = null;
    this.musicPreset = null;
    this.tickTimer = 0;
    this.stepTimer = 0;
    this.isMuted = false;
    this.musicEnabled = true;
    this.unlockAudio = null;
  }

  armUnlock() {
    if (this.unlockAudio) return;
    this.unlockAudio = () => {
      this.context?.resume?.().catch(() => {});
      if (this.musicEnabled && this.music?.paused) this.music.play().catch(() => {});
    };
    globalThis.addEventListener?.("pointerdown", this.unlockAudio, { passive: true });
    globalThis.addEventListener?.("keydown", this.unlockAudio);
  }

  ensure() {
    if (this.context) return true;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return false;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.isMuted ? 0 : 0.16;
    this.master.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.gain.value = this.isMuted ? 0 : MUSIC_GAIN;
    this.musicLimiter = this.context.createDynamicsCompressor();
    this.musicLimiter.threshold.value = -8;
    this.musicLimiter.knee.value = 4;
    this.musicLimiter.ratio.value = 8;
    this.musicLimiter.attack.value = 0.003;
    this.musicLimiter.release.value = 0.2;
    this.musicGain.connect(this.musicLimiter).connect(this.context.destination);
    this.armUnlock();
    this.unlockAudio();
    return true;
  }

  startMusic(preset) {
    const src = MUSIC_FILES[preset];
    if (!src || this.musicPreset === preset) return;
    this.stopMusic();
    const music = new Audio(src);
    music.loop = true;
    music.preload = "auto";
    music.volume = 1;
    this.music = music;
    this.musicPreset = preset;
    if (this.ensure()) {
      this.musicSource = this.context.createMediaElementSource(music);
      this.musicSource.connect(this.musicGain);
    } else music.muted = this.isMuted;
    if (this.musicEnabled) music.play().catch(() => {});
  }

  stopMusic() {
    this.music?.pause();
    if (this.music) this.music.currentTime = 0;
    this.musicSource?.disconnect();
    this.music = null;
    this.musicSource = null;
    this.musicPreset = null;
  }

  pauseMusic() { this.music?.pause(); }
  resumeMusic() { if (this.musicEnabled) this.music?.play().catch(() => {}); }
  isMusicPaused() { return !this.music || this.music.paused; }
  setMusicEnabled(enabled) { this.musicEnabled = enabled; enabled ? this.resumeMusic() : this.pauseMusic(); }

  startDrone(frequency, volume = 0.02) {
    if (!this.ensure() || this.ambience) return;
    this.ambience = this.context.createOscillator();
    const gain = this.context.createGain();
    this.ambience.type = "triangle";
    this.ambience.frequency.value = frequency;
    gain.gain.value = volume;
    this.ambience.connect(gain).connect(this.master);
    this.ambience.start();
    this.ambienceGain = gain;
  }

  updateEngine(speed) {
    if (!this.ensure()) return;
    if (!this.engine) {
      this.engine = this.context.createOscillator();
      this.engineGain = this.context.createGain();
      this.engine.type = "sawtooth";
      this.engineGain.gain.value = 0.001;
      this.engine.connect(this.engineGain).connect(this.master);
      this.engine.start();
    }
    const intensity = Math.min(Math.abs(speed) / 10, 1);
    this.engine.frequency.setTargetAtTime(52 + intensity * 130, this.context.currentTime, 0.06);
    this.engineGain.gain.setTargetAtTime(0.002 + intensity * 0.012, this.context.currentTime, 0.06);
  }

  cue(frequency = 440, duration = 0.08, volume = 0.12, pan = 0) {
    if (!this.ensure()) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner?.();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + duration);
    oscillator.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.master);
    } else gain.connect(this.master);
    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  updateTutorFootsteps(dt, walking, tutorX, playerX) {
    this.stepTimer -= dt;
    if (!walking || this.stepTimer > 0) return;
    this.stepTimer = 0.42;
    const pan = (tutorX - playerX) / 8;
    const proximity = Math.max(0.03, 0.16 - Math.abs(tutorX - playerX) * 0.012);
    this.cue(95, 0.09, proximity, pan);
  }

  updateClock(dt) {
    this.tickTimer -= dt;
    if (this.tickTimer > 0) return;
    this.tickTimer = 1;
    this.cue(920, 0.035, 0.025);
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.16;
    if (this.musicGain) this.musicGain.gain.value = muted ? 0 : MUSIC_GAIN;
    if (this.music && !this.musicSource) this.music.muted = muted;
  }

  dispose() {
    this.stopMusic();
    this.engine?.stop();
    this.ambience?.stop();
    if (this.unlockAudio) {
      globalThis.removeEventListener?.("pointerdown", this.unlockAudio);
      globalThis.removeEventListener?.("keydown", this.unlockAudio);
    }
    this.context?.close?.();
    this.context = null;
  }
}
