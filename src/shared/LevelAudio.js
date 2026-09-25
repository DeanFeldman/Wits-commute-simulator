const MUSIC = {
  menu: { bpm: 80, chords: [[60,64,67],[57,60,64],[53,57,60],[55,59,62]], bass: [36,33,29,31] },
  level1: { bpm: 84, chords: [[62,65,69],[58,62,65],[53,57,60],[60,64,67]], bass: [38,34,41,36] },
  level2: { bpm: 132, chords: [[64,67,71],[60,64,67],[55,59,62],[62,66,69]], bass: [40,36,43,38] },
  level3: { bpm: 72, chords: [[38,45],[38,45],[38,45],[38,45]], bass: [38,38,38,38] }
};
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

export class LevelAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engine = null;
    this.engineGain = null;
    this.ambience = null;
    this.tickTimer = 0;
    this.stepTimer = 0;
    this.isMuted = false;
    this.musicTimer = null;
    this.musicPreset = null;
    this.musicVolumeScale = 2.8;
    this.musicStep = 0;
    this.nextMusicTime = 0;
    this.unlockAudio = null;
  }

  ensure() {
    if (this.context) return true;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return false;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = this.isMuted ? 0 : 0.16;
    this.master.connect(this.context.destination);
    this.unlockAudio = () => this.context?.resume?.().catch(() => {});
    globalThis.addEventListener?.("pointerdown", this.unlockAudio, { passive: true });
    globalThis.addEventListener?.("keydown", this.unlockAudio);
    this.unlockAudio();
    return true;
  }

  startMusic(preset) {
    if (!MUSIC[preset] || !this.ensure() || this.musicPreset === preset) return;
    this.stopMusic();
    this.musicPreset = preset;
    this.musicStep = 0;
    this.nextMusicTime = this.context.currentTime + 0.05;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 40);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
    this.musicPreset = null;
  }

  scheduleMusic() {
    const p = MUSIC[this.musicPreset];
    if (!p || !this.context) return;
    const stepDuration = 30 / p.bpm;
    if (this.nextMusicTime < this.context.currentTime - 0.25) this.nextMusicTime = this.context.currentTime + 0.05;
    const horizon = this.context.currentTime + 0.12;
    while (this.nextMusicTime < horizon) {
      if (!this.isMuted) this.scheduleMusicStep(p, this.musicStep, this.nextMusicTime);
      this.musicStep = (this.musicStep + 1) % 32;
      this.nextMusicTime += stepDuration;
    }
  }

  scheduleMusicStep(p, step, time) {
    const s = step % 8;
    const bar = Math.floor(step / 8) % 4;
    const beat = 60 / p.bpm;
    const chord = p.chords[bar];
    if (this.musicPreset === "menu") {
      if (s === 0) this.musicToneAt(midi(p.bass[bar]), time, beat * 3.8, 0.07, "sine");
      this.musicToneAt(midi(chord[s % 3] + 12), time, beat * 0.5, 0.045, "triangle", s % 2 ? 0.25 : -0.25);
      if (s === 0 || s === 4) this.musicThumpAt(time, 0.065, 66);
      if (bar === 3 && [1,3,5,7].includes(s)) this.musicToneAt(midi([67,69,71,72][[1,3,5,7].indexOf(s)]), time, beat * 0.35, 0.032, "sine", 0.15);
    } else if (this.musicPreset === "level1") {
      if (s === 0) this.musicToneAt(midi(p.bass[bar]), time, beat * 3.8, 0.11);
      this.musicToneAt(midi(chord[s % 3]), time, beat * 0.42, 0.055, "sine", s % 2 ? 0.35 : -0.35);
      if (s === 0 || s === 4) this.musicThumpAt(time, 0.11, 78);
      if (s === 2 || s === 6) this.musicToneAt(190, time, 0.07, 0.025, "triangle");
      if (bar === 2 && [0,3,6].includes(s)) this.musicToneAt(midi([81,84,88][[0,3,6].indexOf(s)]), time, beat * 0.35, 0.035, "sine", 0.15);
    } else if (this.musicPreset === "level2") {
      this.musicToneAt(midi(p.bass[bar] + (s >= 4 ? 12 : 0)), time, beat * 0.28, 0.075, "sawtooth", s % 2 ? 0.12 : -0.12);
      if (s === 0 || s === 4) this.musicThumpAt(time, 0.13, 92);
      if (s === 2 || s === 6) this.musicToneAt(175, time, 0.08, 0.04, "triangle");
      if (s % 2 === 1) this.musicToneAt(midi([76,79,81,83,86][(bar + s) % 5]), time, beat * 0.24, 0.04, "triangle", s % 4 === 1 ? 0.4 : -0.4);
      if (bar === 3 && s === 5) {
        this.musicToneAt(midi(71), time, beat * 0.18, 0.05, "sawtooth", -0.2);
        this.musicToneAt(midi(74), time + beat * 0.18, beat * 0.18, 0.04, "sawtooth", 0.2);
      }
    } else {
      if (s === 0) {
        this.musicToneAt(midi(38), time, beat * 3.8, 0.045, "sine", -0.15);
        this.musicToneAt(midi(45), time, beat * 3.8, 0.018, "triangle", 0.2);
      }
      if (bar % 2 === 1 && (s === 3 || s === 6)) this.musicToneAt(midi(s === 3 ? 65 : 70), time, beat * 0.55, 0.018, "sine", s === 3 ? -0.35 : 0.35);
      if (bar >= 2 && s === 4) {
        this.musicThumpAt(time, 0.08, 64);
        this.musicThumpAt(time + beat * 0.32, 0.05, 58);
      }
    }
  }

  musicToneAt(frequency, time, duration, volume = 0.08, type = "sine", pan = 0) {
    this.toneAt(frequency, time, duration, volume * this.musicVolumeScale, type, pan);
  }

  musicThumpAt(time, volume = 0.1, frequency = 80) {
    this.thumpAt(time, volume * this.musicVolumeScale, frequency);
  }

  toneAt(frequency, time, duration, volume = 0.08, type = "sine", pan = 0) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner?.();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(0.03, duration));
    oscillator.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.master);
    } else gain.connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + Math.max(0.04, duration) + 0.02);
  }

  thumpAt(time, volume = 0.1, frequency = 80) {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.12);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + 0.15);
  }

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
    this.toneAt(frequency, this.context.currentTime, duration, volume, "sine", pan);
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
