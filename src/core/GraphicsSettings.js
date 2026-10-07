import * as THREE from "three";
import { setAudioVolumes } from "../shared/LevelAudio.js";

const STORAGE_KEY = "wits-commute-graphics-settings";

const PRESETS = Object.freeze({
  low: { resolution: "1", antialiasing: "off", shadows: "off", effects: "off", viewDistance: "near" },
  medium: { resolution: "1", antialiasing: "on", shadows: "low", effects: "on", viewDistance: "standard" },
  high: { resolution: "1", antialiasing: "on", shadows: "high", effects: "on", viewDistance: "far" }
});

const DEFAULT_SETTINGS = Object.freeze({ preset: "auto", musicVolume: "100", soundEffectsVolume: "100", ...PRESETS.medium });

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}"), resolution: "1" };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function loadSavedGraphicsSettings() {
  return loadSettings();
}

/** Shared browser graphics controls and their renderer-facing behaviour. */
export class GraphicsSettings {
  constructor({ renderer, composers }) {
    this.renderer = renderer;
    this.composers = composers;
    this.element = document.querySelector("#graphics-settings");
    this.form = document.querySelector("#graphics-settings-form");
    this.controls = {
      preset: document.querySelector("#graphics-preset"),
      resolution: document.querySelector("#graphics-resolution"),
      antialiasing: document.querySelector("#graphics-antialiasing"),
      shadows: document.querySelector("#graphics-shadows"),
      effects: document.querySelector("#graphics-effects"),
      viewDistance: document.querySelector("#graphics-view-distance")
    };
    this.audioControls = {
      musicVolume: document.querySelector("#settings-music-volume"),
      soundEffectsVolume: document.querySelector("#settings-effects-volume")
    };
    this.settings = loadSettings();
    if (this.settings.preset === "auto") {
      Object.assign(this.settings, this.resolvePreset("auto"));
    }

    this.form.addEventListener("input", (event) => this.onAudioInput(event));
    this.form.addEventListener("change", (event) => this.onChange(event));
    this.element.addEventListener("click", (event) => this.onClick(event));
    this.syncControls();
    this.apply();
  }

  get effectsEnabled() {
    return this.settings.effects === "on";
  }

  get viewDistanceScale() {
    return { near: 0.72, standard: 1, far: 1.3 }[this.settings.viewDistance] ?? 1;
  }

  open() {
    this.openingSettings = { ...this.settings };
    this.syncControls();
    this.element.hidden = false;
    this.controls.preset.focus();
  }

  close() {
    this.element.hidden = true;
  }

  cancel() {
    this.settings = { ...this.openingSettings };
    this.syncControls();
    this.apply();
    this.close();
  }

  onClick(event) {
    const action = event.target.closest("[data-graphics-action]")?.dataset.graphicsAction;
    if (action === "close") this.cancel();
    if (action === "reset") {
      this.settings = { ...DEFAULT_SETTINGS };
      this.syncControls();
      this.apply();
    }
    if (action === "apply") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      } catch {
        // A private-browser storage restriction should not prevent play.
      }
      this.close();
    }
  }

  onChange(event) {
    if (event.target.type === "range") return;
    const changed = event.target.id;
    if (changed === "graphics-preset") {
      this.settings.preset = this.controls.preset.value;
      const preset = this.resolvePreset(this.settings.preset);
      Object.assign(this.settings, preset);
      this.syncControls();
    } else {
      this.settings.preset = "custom";
      this.settings.resolution = this.controls.resolution.value;
      this.settings.antialiasing = this.controls.antialiasing.value;
      this.settings.shadows = this.controls.shadows.value;
      this.settings.effects = this.controls.effects.value;
      this.settings.viewDistance = this.controls.viewDistance.value;
      this.controls.preset.value = "custom";
    }
    this.apply();
  }

  resolvePreset(preset) {
    if (preset !== "auto") return PRESETS[preset] ?? PRESETS.medium;
    return (navigator.deviceMemory ?? 4) <= 4 ? PRESETS.low : PRESETS.medium;
  }

  onAudioInput(event) {
    const entry = Object.entries(this.audioControls).find(([, control]) => control === event.target);
    if (!entry) return;
    const [key, control] = entry;
    this.settings[key] = control.value;
    this.applyAudio();
  }

  applyAudio() {
    setAudioVolumes(Number(this.settings.musicVolume) / 100, Number(this.settings.soundEffectsVolume) / 100);
    Object.entries(this.audioControls).forEach(([key, control]) => {
      control.value = this.settings[key];
      document.querySelector(`#${control.id}-value`).textContent = `${control.value}%`;
    });
  }

  syncControls() {
    Object.entries(this.controls).forEach(([key, control]) => {
      control.value = this.settings[key];
    });
  }

  apply() {
    this.applyAudio();
    const pixelRatio = Math.min(window.devicePixelRatio * Number(this.settings.resolution), 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = this.settings.shadows !== "off";
    this.renderer.shadowMap.type = this.settings.shadows === "high"
      ? THREE.PCFSoftShadowMap
      : THREE.PCFShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
    this.composers.forEach((composer) => composer.setPixelRatio(pixelRatio));
    document.body.classList.toggle("graphics-effects-off", !this.effectsEnabled);
  }
}
