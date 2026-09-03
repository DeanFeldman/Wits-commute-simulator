export class LevelAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.engine = null;
    this.engineGain = null;
    this.ambience = null;
    this.tickTimer = 0;
    this.stepTimer = 0;
  }

  ensure() {
    if (this.context) return true;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return false;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.value = 0.16;
    this.master.connect(this.context.destination);
    this.context.resume?.();
    return true;
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
    this.engineGain.gain.setTargetAtTime(0.008 + intensity * 0.055, this.context.currentTime, 0.06);
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
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan)); gain.connect(panner).connect(this.master); }
    else gain.connect(this.master);
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

  dispose() {
    this.engine?.stop();
    this.ambience?.stop();
    this.context?.close();
    this.context = null;
  }
}
