const MIX = Object.freeze({
  master: 0.9,
  music: 0.18,
  ambience: 0.34,
  sfx: 1
});

const MUSIC_FILES = {
  menu: "./assets/audio/music/menu-commute-theme.wav",
  level1: "./assets/audio/music/level1-dusk-drive.wav",
  level2: "./assets/audio/music/level2-empire-rush.wav",
  level3: "./assets/audio/music/level3-dont-get-caught.wav"
};

const clamp01 = (value) => Math.max(0, Math.min(1, value));

export class LevelAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.masterLimiter = null;
    this.musicBus = null;
    this.musicDuck = null;
    this.ambienceBus = null;
    this.sfxBus = null;

    this.music = null;
    this.musicSource = null;
    this.musicTrackGain = null;
    this.musicPreset = null;
    this.musicScale = 1;
    this.musicStopTimer = null;
    this.musicDuckTimer = null;

    this.loops = new Map();
    this.oneShots = new Set();
    this.sampleCache = new Map();
    this.bufferCache = new Map();
    this.bufferPromises = new Map();
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
      for (const loop of this.loops.values()) {
        if (loop.shouldPlay && loop.element.paused) loop.element.play().catch(() => {});
      }
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
    this.masterLimiter = this.context.createDynamicsCompressor();
    this.musicBus = this.context.createGain();
    this.musicDuck = this.context.createGain();
    this.ambienceBus = this.context.createGain();
    this.sfxBus = this.context.createGain();

    this.master.gain.value = this.isMuted ? 0 : MIX.master;
    this.musicBus.gain.value = this.musicEnabled ? MIX.music * this.musicScale : 0;
    this.musicDuck.gain.value = 1;
    this.ambienceBus.gain.value = MIX.ambience;
    this.sfxBus.gain.value = MIX.sfx;

    this.musicBus.connect(this.musicDuck).connect(this.master);
    this.ambienceBus.connect(this.master);
    this.sfxBus.connect(this.master);

    // Catch short gameplay peaks when layered effects coincide (for example
    // engine + pothole thump + splash, or impact + shield + traffic) without
    // flattening the whole mix.
    this.masterLimiter.threshold.value = -3;
    this.masterLimiter.knee.value = 2;
    this.masterLimiter.ratio.value = 12;
    this.masterLimiter.attack.value = 0.002;
    this.masterLimiter.release.value = 0.12;
    this.master.connect(this.masterLimiter).connect(this.context.destination);

    this.armUnlock();
    this.unlockAudio();
    return true;
  }

  getBus(name) {
    if (!this.ensure()) return null;
    if (name === "music") return this.musicBus;
    if (name === "ambience") return this.ambienceBus;
    return this.sfxBus;
  }

  preloadMusic(preset) {
    const src = MUSIC_FILES[preset];
    if (src) this.preload([src]);
  }

  startMusic(preset, { fadeSeconds = 0.55 } = {}) {
    const src = MUSIC_FILES[preset];
    if (!src) return;
    if (this.musicPreset === preset && this.music) {
      this.resumeMusic();
      return;
    }

    this.stopMusic({ fadeSeconds: Math.min(0.25, fadeSeconds), reset: true });

    const music = this.createSampleElement(src);
    music.loop = true;
    music.preload = "auto";
    music.volume = 1;

    this.music = music;
    this.musicPreset = preset;

    if (this.ensure()) {
      const source = this.context.createMediaElementSource(music);
      const trackGain = this.context.createGain();
      const now = this.context.currentTime;
      trackGain.gain.setValueAtTime(fadeSeconds > 0 ? 0.001 : 1, now);
      if (fadeSeconds > 0) {
        trackGain.gain.exponentialRampToValueAtTime(1, now + fadeSeconds);
      }
      source.connect(trackGain).connect(this.musicBus);
      this.musicSource = source;
      this.musicTrackGain = trackGain;
    } else {
      music.muted = this.isMuted || !this.musicEnabled;
      music.volume = MIX.music;
    }

    if (this.musicEnabled) music.play().catch(() => {});
  }

  stopMusic({ fadeSeconds = 0.3, reset = true } = {}) {
    if (this.musicStopTimer) {
      clearTimeout(this.musicStopTimer);
      this.musicStopTimer = null;
    }

    const music = this.music;
    const source = this.musicSource;
    const trackGain = this.musicTrackGain;

    this.music = null;
    this.musicSource = null;
    this.musicTrackGain = null;
    this.musicPreset = null;

    if (!music) return;

    const finish = () => {
      music.pause();
      if (reset) music.currentTime = 0;
      source?.disconnect();
      trackGain?.disconnect();
    };

    if (!this.context || !trackGain || fadeSeconds <= 0) {
      finish();
      return;
    }

    const now = this.context.currentTime;
    const current = Math.max(trackGain.gain.value, 0.001);
    trackGain.gain.cancelScheduledValues(now);
    trackGain.gain.setValueAtTime(current, now);
    trackGain.gain.exponentialRampToValueAtTime(0.001, now + fadeSeconds);
    this.musicStopTimer = setTimeout(finish, Math.ceil(fadeSeconds * 1000) + 20);
  }

  pauseMusic() {
    this.music?.pause();
  }

  resumeMusic() {
    if (this.musicEnabled) this.music?.play().catch(() => {});
  }

  isMusicPaused() {
    return !this.music || this.music.paused;
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (this.musicBus && this.context) {
      const now = this.context.currentTime;
      this.musicBus.gain.cancelScheduledValues(now);
      this.musicBus.gain.setTargetAtTime(enabled ? MIX.music * this.musicScale : 0, now, 0.04);
    }
    enabled ? this.resumeMusic() : this.pauseMusic();
    if (this.music && !this.musicSource) this.music.muted = this.isMuted || !enabled;
  }

  setMusicScale(scale = 1) {
    this.musicScale = clamp01(scale);
    if (!this.musicBus || !this.context) return;
    this.musicBus.gain.setTargetAtTime(
      this.musicEnabled ? MIX.music * this.musicScale : 0,
      this.context.currentTime,
      0.08
    );
  }

  duckMusic({
    scale = 0.25,
    attack = 0.025,
    hold = 0.45,
    release = 0.22
  } = {}) {
    if (!this.ensure() || !this.musicDuck) return;
    if (this.musicDuckTimer) {
      clearTimeout(this.musicDuckTimer);
      this.musicDuckTimer = null;
    }

    const now = this.context.currentTime;
    const gain = this.musicDuck.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0.001, gain.value), now);
    gain.linearRampToValueAtTime(Math.max(0.001, clamp01(scale)), now + attack);

    this.musicDuckTimer = setTimeout(() => {
      if (!this.context || !this.musicDuck) return;
      const releaseStart = this.context.currentTime;
      this.musicDuck.gain.cancelScheduledValues(releaseStart);
      this.musicDuck.gain.setValueAtTime(
        Math.max(0.001, this.musicDuck.gain.value),
        releaseStart
      );
      this.musicDuck.gain.linearRampToValueAtTime(1, releaseStart + release);
      this.musicDuckTimer = null;
    }, Math.ceil((attack + hold) * 1000));
  }

  primeSamplePool(path, targetSize = 3) {
    if (!path) return;
    const pool = this.sampleCache.get(path) ?? [];
    while (pool.length < targetSize) {
      const audio = new Audio(path);
      audio.preload = "auto";
      audio.load?.();
      pool.push(audio);
    }
    this.sampleCache.set(path, pool);
  }

  preload(paths = []) {
    for (const path of paths) this.primeSamplePool(path);
  }

  createSampleElement(path) {
    this.primeSamplePool(path);
    const pool = this.sampleCache.get(path) ?? [];

    // Prefer the already-warmed media element itself. Cloning a preloaded
    // element resets readyState in Chromium and caused the first impact in a
    // level to arrive late even though the source had been preloaded.
    let index = pool.findIndex((audio) => audio.readyState >= 1);
    if (index < 0) index = 0;

    const audio = pool.splice(index, 1)[0] ?? new Audio(path);
    audio.preload = "auto";
    this.primeSamplePool(path);
    return audio;
  }

  async preloadBuffer(path) {
    if (!path) return null;
    if (this.bufferCache.has(path)) return this.bufferCache.get(path);
    if (this.bufferPromises.has(path)) return this.bufferPromises.get(path);

    const promise = (async () => {
      if (!this.ensure() || typeof fetch !== "function") return null;
      const response = await fetch(path);
      if (!response.ok) return null;
      const bytes = await response.arrayBuffer();
      const buffer = await this.context.decodeAudioData(bytes.slice(0));
      this.bufferCache.set(path, buffer);
      return buffer;
    })().catch(() => null).finally(() => {
      this.bufferPromises.delete(path);
    });

    this.bufferPromises.set(path, promise);
    return promise;
  }

  async waitForPreload(paths = [], timeoutMs = 1800) {
    this.preload(paths);

    const metadataReady = Promise.all(paths.map((path) => new Promise((resolve) => {
      const pool = this.sampleCache.get(path) ?? [];
      if (pool.some((audio) => audio.readyState >= 1)) {
        resolve();
        return;
      }

      const audio = pool[0];
      if (!audio) {
        resolve();
        return;
      }

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      audio.addEventListener("loadedmetadata", finish, { once: true });
      audio.addEventListener("error", finish, { once: true });
      audio.load?.();
    })));

    const decodedReady = Promise.all(paths.map((path) => this.preloadBuffer(path)));
    await Promise.race([
      Promise.all([metadataReady, decodedReady]),
      new Promise((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  }

  playDecoded(path, {
    start = 0,
    duration = null,
    volume = 1,
    pan = 0,
    playbackRate = 1,
    bus = "sfx"
  } = {}) {
    const buffer = this.bufferCache.get(path);
    if (!buffer || !this.ensure() || this.isMuted) return null;

    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner?.();
    source.buffer = buffer;
    source.playbackRate.value = playbackRate;
    gain.gain.value = Math.max(0, volume);

    source.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.getBus(bus));
    } else {
      gain.connect(this.getBus(bus));
    }

    const handle = { source, gain, panner };
    this.oneShots.add(handle);
    const cleanup = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.oneShots.delete(handle);
    };
    source.addEventListener("ended", cleanup, { once: true });

    const offset = Math.max(0, Math.min(start, Math.max(0, buffer.duration - 0.001)));
    if (Number.isFinite(duration) && duration > 0) {
      source.start(0, offset, Math.min(duration, Math.max(0.001, buffer.duration - offset)));
    } else {
      source.start(0, offset);
    }
    return source;
  }

  playSample(path, {
    volume = 1,
    pan = 0,
    playbackRate = 1,
    bus = "sfx"
  } = {}) {
    if (!path || this.isMuted) return null;

    const decoded = this.playDecoded(path, { volume, pan, playbackRate, bus });
    if (decoded) return decoded;

    const audio = this.createSampleElement(path);
    audio.preload = "auto";
    audio.playbackRate = playbackRate;
    if (!this.ensure()) {
      audio.volume = clamp01(volume);
      audio.play().catch(() => {});
      return audio;
    }

    const source = this.context.createMediaElementSource(audio);
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner?.();
    gain.gain.value = Math.max(0, volume);

    source.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.getBus(bus));
    } else {
      gain.connect(this.getBus(bus));
    }

    const handle = { audio, source, gain, panner };
    this.oneShots.add(handle);

    const cleanup = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.oneShots.delete(handle);
    };
    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("error", cleanup, { once: true });
    audio.play().catch(cleanup);
    return audio;
  }

  playSegment(path, {
    start = 0,
    duration = 0.5,
    volume = 1,
    pan = 0,
    playbackRate = 1,
    bus = "sfx"
  } = {}) {
    if (!path || this.isMuted || duration <= 0) return null;

    const decoded = this.playDecoded(path, {
      start,
      duration,
      volume,
      pan,
      playbackRate,
      bus
    });
    if (decoded) return decoded;

    const audio = this.createSampleElement(path);
    audio.preload = "auto";
    audio.playbackRate = playbackRate;

    let source = null;
    let gain = null;
    let panner = null;
    let stopTimer = null;
    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      if (stopTimer) clearTimeout(stopTimer);
      audio.pause();
      source?.disconnect();
      gain?.disconnect();
      panner?.disconnect();
      this.oneShots.delete(handle);
    };

    const handle = { audio, cleanup };
    this.oneShots.add(handle);

    const begin = () => {
      if (cleaned) return;
      try {
        audio.currentTime = Math.max(0, start);
      } catch {
        cleanup();
        return;
      }

      if (this.ensure()) {
        source = this.context.createMediaElementSource(audio);
        gain = this.context.createGain();
        panner = this.context.createStereoPanner?.();
        gain.gain.value = Math.max(0, volume);
        source.connect(gain);
        if (panner) {
          panner.pan.value = Math.max(-1, Math.min(1, pan));
          gain.connect(panner).connect(this.getBus(bus));
        } else {
          gain.connect(this.getBus(bus));
        }
      } else {
        audio.volume = clamp01(volume);
      }

      audio.play().then(() => {
        stopTimer = setTimeout(
          cleanup,
          Math.ceil((duration / Math.max(0.25, playbackRate)) * 1000)
        );
      }).catch(cleanup);
    };

    audio.addEventListener("error", cleanup, { once: true });
    if (audio.readyState >= 1) begin();
    else audio.addEventListener("loadedmetadata", begin, { once: true });

    return audio;
  }

  startLoop(name, path, {
    volume = 1,
    playbackRate = 1,
    pan = 0,
    bus = "ambience",
    startTime = 0
  } = {}) {
    if (!name || !path) return null;
    const existing = this.loops.get(name);
    if (existing) return existing.element;

    const audio = this.createSampleElement(path);
    audio.loop = true;
    audio.preload = "auto";
    audio.playbackRate = playbackRate;

    if (!this.ensure()) {
      audio.volume = clamp01(volume);
      audio.muted = this.isMuted;
      this.loops.set(name, { element: audio, shouldPlay: true, fallback: true });
      audio.play().catch(() => {});
      return audio;
    }

    const source = this.context.createMediaElementSource(audio);
    const gain = this.context.createGain();
    const panner = this.context.createStereoPanner?.();
    gain.gain.value = Math.max(0, volume);
    source.connect(gain);

    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner).connect(this.getBus(bus));
    } else {
      gain.connect(this.getBus(bus));
    }

    const handle = { element: audio, source, gain, panner, shouldPlay: true, fallback: false };
    this.loops.set(name, handle);

    const begin = () => {
      if (!handle.shouldPlay) return;
      if (startTime > 0) {
        try {
          const maxStart = Number.isFinite(audio.duration) && audio.duration > 0
            ? Math.max(0, audio.duration - 0.01)
            : startTime;
          audio.currentTime = Math.min(startTime, maxStart);
        } catch {
          // If seeking is temporarily unavailable, playback still starts.
        }
      }
      audio.play().catch(() => {});
    };

    if (startTime > 0 && audio.readyState < 1) {
      audio.addEventListener("loadedmetadata", begin, { once: true });
    } else {
      begin();
    }
    return audio;
  }

  setLoopParameters(name, { volume, playbackRate, pan } = {}) {
    const loop = this.loops.get(name);
    if (!loop) return;
    if (Number.isFinite(playbackRate)) loop.element.playbackRate = Math.max(0.25, playbackRate);
    if (Number.isFinite(volume)) {
      if (loop.gain && this.context) {
        loop.gain.gain.setTargetAtTime(Math.max(0, volume), this.context.currentTime, 0.06);
      } else {
        loop.element.volume = clamp01(volume);
      }
    }
    if (Number.isFinite(pan) && loop.panner) {
      loop.panner.pan.value = Math.max(-1, Math.min(1, pan));
    }
  }

  stopLoop(name) {
    const loop = this.loops.get(name);
    if (!loop) return;
    loop.shouldPlay = false;
    loop.element.pause();
    loop.source?.disconnect();
    loop.gain?.disconnect();
    loop.panner?.disconnect();
    this.loops.delete(name);
  }

  startEngineLoop(path = "./assets/audio/level1/idle-car.wav") {
    return this.startLoop("engine", path, {
      bus: "sfx",
      volume: 0.16,
      playbackRate: 0.86
    });
  }

  updateEngine(speed) {
    if (!this.loops.has("engine")) return;
    const intensity = clamp01(Math.abs(speed) / 10);
    this.setLoopParameters("engine", {
      playbackRate: 0.86 + intensity * 0.34,
      volume: 0.14 + intensity * 0.2
    });
  }

  cue(frequency = 440, duration = 0.08, volume = 0.08, pan = 0) {
    if (!this.ensure() || this.isMuted) return;
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
      gain.connect(panner).connect(this.sfxBus);
    } else {
      gain.connect(this.sfxBus);
    }

    oscillator.start();
    oscillator.stop(this.context.currentTime + duration);
  }

  updateTutorFootsteps(dt, walking, tutorX, playerX, samples = [], distance = null) {
    this.stepTimer -= dt;
    if (!walking || this.stepTimer > 0 || samples.length === 0) return;
    this.stepTimer = 0.42;

    const lateralDistance = tutorX - playerX;
    const audibleDistance = Number.isFinite(distance)
      ? Math.max(0, distance)
      : Math.abs(lateralDistance);
    const pan = lateralDistance / 8;
    const proximity = Math.max(0.12, 0.86 - audibleDistance * 0.05);
    const sample = samples[Math.floor(Math.random() * samples.length)];
    const options = {
      volume: proximity,
      pan,
      playbackRate: 0.96 + Math.random() * 0.08
    };

    if (typeof sample === "string") {
      this.playSample(sample, options);
      return;
    }

    this.playSegment(sample.path, {
      ...options,
      start: sample.start,
      duration: sample.duration
    });
  }

  updateClock(dt, {
    path = null,
    volume = 0.16,
    enabled = true
  } = {}) {
    this.tickTimer -= dt;
    if (!enabled || !path || this.tickTimer > 0) return;
    this.tickTimer = 1;
    this.playSample(path, {
      volume,
      playbackRate: 0.98 + Math.random() * 0.04,
      bus: "ambience"
    });
  }

  setMuted(muted) {
    this.isMuted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : MIX.master;
    if (this.music && !this.musicSource) this.music.muted = muted || !this.musicEnabled;
    for (const loop of this.loops.values()) {
      if (loop.fallback) loop.element.muted = muted;
    }
  }

  dispose() {
    this.stopMusic({ fadeSeconds: 0, reset: true });
    for (const name of [...this.loops.keys()]) this.stopLoop(name);
    for (const handle of [...this.oneShots]) {
      if (handle.cleanup) handle.cleanup();
      else {
        handle.audio.pause();
        handle.source?.disconnect();
        handle.gain?.disconnect();
        handle.panner?.disconnect();
      }
    }
    this.oneShots.clear();
    this.sampleCache.clear();
    this.bufferCache.clear();
    this.bufferPromises.clear();

    if (this.musicDuckTimer) {
      clearTimeout(this.musicDuckTimer);
      this.musicDuckTimer = null;
    }

    if (this.unlockAudio) {
      globalThis.removeEventListener?.("pointerdown", this.unlockAudio);
      globalThis.removeEventListener?.("keydown", this.unlockAudio);
    }

    this.musicDuck?.disconnect?.();
    this.masterLimiter?.disconnect?.();
    this.context?.close?.();
    this.context = null;
  }
}

export { MIX as AUDIO_MIX };
