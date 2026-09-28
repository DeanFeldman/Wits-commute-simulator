import * as THREE from "three";
import {
  AnimatedNpcFactory,
  STUDENT_MODEL_VARIANTS
} from "../levels/crossing/AnimatedNpcFactory.js";

export const DEFAULT_PLAYER_VARIANT = 0;

function clampVariant(index) {
  return Number.isInteger(index) && STUDENT_MODEL_VARIANTS[index]
    ? index
    : DEFAULT_PLAYER_VARIANT;
}

function displayLabel(label) {
  return String(label ?? "")
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .trim();
}

export class CharacterSelectFlow {
  constructor({ onContinue, onBack } = {}) {
    this.onContinue = onContinue;
    this.onBack = onBack;
    this.pendingVariant = DEFAULT_PLAYER_VARIANT;

    // Reuse the exact Level 2 character pipeline. AnimatedNpcFactory loads each
    // rig together with its authored GLB texture, applies the texture/UV fixes,
    // normalises height, attaches the backpack and exposes the selection pose.
    this.factory = new AnimatedNpcFactory();
    this.factoryReady = false;
    this.factoryError = null;
    this.factoryPromise = null;

    this.previewModels = new Map();
    this.previewVisual = null;
    this.previewRenderer = null;
    this.previewScene = null;
    this.previewCamera = null;
    this.previewFrameId = null;
    this.previewClock = new THREE.Clock();
    this.previewRequest = 0;

    this.root = document.createElement("section");
    this.root.className = "character-start";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "character-start-title");

    this.root.innerHTML = `
      <div class="character-start__scanlines" aria-hidden="true"></div>

      <div class="character-start__card">
        <header class="character-start__header">
          <div>
            <p class="character-start__eyebrow">WITS COMMUTE SIM // PLAYER SELECT</p>
            <h1 id="character-start-title">Choose your character</h1>
          </div>
          <span class="character-start__badge">P1</span>
        </header>

        <p class="character-start__copy">
          Pick your student before the commute starts. Same chaos, different face.
        </p>

        <div class="character-start__chooser">
          <div class="character-start__roster">
            <p class="character-start__hint">Select a student</p>
            <div
              class="character-start__options"
              data-character-start-options
              aria-label="Character choices"
            ></div>

            <p class="character-start__selection" data-character-start-selection></p>
          </div>

          <div class="character-start__stage">
            <div class="character-start__burst" aria-hidden="true"></div>
            <canvas
              class="character-start__preview-canvas"
              data-character-start-preview
              aria-label="Selected character preview"
            ></canvas>

            <div class="character-start__identity">
              <span data-character-start-code>M-01</span>
              <strong data-character-start-name>Male 1</strong>
              <small>WITS STUDENT</small>
            </div>

            <p
              class="character-start__preview-status"
              data-character-start-preview-status
              role="status"
            >
              Loading students…
            </p>
          </div>
        </div>

        <div class="character-start__actions">
          <button
            class="character-start__button character-start__button--back"
            type="button"
            data-character-start-back
          >
            Back
          </button>

          <button
            class="character-start__button character-start__button--default"
            type="button"
            data-character-start-default
          >
            Continue with default
          </button>

          <button
            class="character-start__button character-start__button--primary"
            type="button"
            data-character-start-continue
          >
            Continue
          </button>
        </div>
      </div>
    `;

    document.body.append(this.root);

    this.optionsElement = this.root.querySelector("[data-character-start-options]");
    this.selectionElement = this.root.querySelector("[data-character-start-selection]");
    this.previewCanvas = this.root.querySelector("[data-character-start-preview]");
    this.previewStatus = this.root.querySelector("[data-character-start-preview-status]");
    this.nameElement = this.root.querySelector("[data-character-start-name]");
    this.codeElement = this.root.querySelector("[data-character-start-code]");
    this.continueButton = this.root.querySelector("[data-character-start-continue]");
    this.defaultButton = this.root.querySelector("[data-character-start-default]");
    this.backButton = this.root.querySelector("[data-character-start-back]");

    this.setupPreview();
    this.renderOptions();

    this.optionsElement.addEventListener("click", (event) => {
      const button = event.target.closest("[data-character-variant]");
      if (!button) return;
      this.select(Number(button.dataset.characterVariant));
    });

    this.continueButton.addEventListener("click", () => {
      this.hide();
      this.onContinue?.(this.pendingVariant);
    });

    this.defaultButton.addEventListener("click", () => {
      this.hide();
      this.onContinue?.(DEFAULT_PLAYER_VARIANT);
    });

    this.backButton.addEventListener("click", () => {
      this.hide();
      this.onBack?.();
    });

    this.root.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        this.hide();
        this.onBack?.();
        return;
      }

      const direction =
        event.key === "ArrowRight" || event.key === "ArrowDown"
          ? 1
          : event.key === "ArrowLeft" || event.key === "ArrowUp"
            ? -1
            : 0;

      if (!direction) return;

      event.preventDefault();
      const next =
        (this.pendingVariant + direction + STUDENT_MODEL_VARIANTS.length) %
        STUDENT_MODEL_VARIANTS.length;

      this.select(next);
      this.optionsElement
        .querySelector(`[data-character-variant="${next}"]`)
        ?.focus();
    });
  }

  setupPreview() {
    // These values intentionally match the old, working Level 2 character
    // selector instead of maintaining a second independent rendering recipe.
    this.previewRenderer = new THREE.WebGLRenderer({
      canvas: this.previewCanvas,
      alpha: true,
      antialias: false
    });
    this.previewRenderer.setPixelRatio(1);
    this.previewRenderer.outputColorSpace = THREE.SRGBColorSpace;
    this.previewRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.previewRenderer.toneMappingExposure = 1.18;

    this.previewScene = new THREE.Scene();

    this.previewCamera = new THREE.PerspectiveCamera(29, 1, 0.1, 20);
    this.previewCamera.position.set(0, 1.02, 4.35);
    this.previewCamera.lookAt(0, 0.9, 0);

    this.previewScene.add(
      new THREE.HemisphereLight(0xe8fbff, 0x11262f, 3.1)
    );

    const key = new THREE.DirectionalLight(0xffe784, 5.2);
    key.position.set(-2.5, 4, 3);
    this.previewScene.add(key);

    const rim = new THREE.DirectionalLight(0x35e0d1, 4.4);
    rim.position.set(3, 2, -2);
    this.previewScene.add(rim);

    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.88, 1.08, 0.08, 8),
      new THREE.MeshStandardMaterial({
        color: 0x102b33,
        emissive: 0x0b5c61,
        emissiveIntensity: 0.7,
        roughness: 0.7
      })
    );
    platform.position.y = -0.06;
    this.previewScene.add(platform);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.85, 0.025, 4, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd22d })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.005;
    this.previewScene.add(ring);
  }

  ensureFactory() {
    if (this.factoryPromise) return this.factoryPromise;

    this.factoryPromise = this.factory
      .load()
      .then(() => {
        this.factoryReady = true;
        this.factoryError = null;
        this.previewStatus.textContent = "";
      })
      .catch((error) => {
        this.factoryError = error;
        this.previewStatus.textContent = "Character preview unavailable.";
        console.warn("Character selector models could not load.", error);
        throw error;
      });

    return this.factoryPromise;
  }

  renderOptions() {
    this.optionsElement.replaceChildren(
      ...STUDENT_MODEL_VARIANTS.map((variant, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "character-start__option";
        button.dataset.characterVariant = String(index);
        button.dataset.number = String(index + 1).padStart(2, "0");
        button.style.setProperty(
          "--fighter-color",
          index < 3 ? "#68d7d0" : "#ffd45a"
        );
        button.setAttribute("aria-pressed", "false");

        const name = document.createElement("strong");
        name.textContent = displayLabel(variant.label);

        const type = document.createElement("small");
        type.textContent = index < 3 ? "Male student" : "Female student";

        button.append(name, type);
        return button;
      })
    );
  }

  async showCharacterPreview(variant) {
    const request = ++this.previewRequest;
    this.previewStatus.textContent = "Loading students…";

    try {
      await this.ensureFactory();
    } catch {
      return;
    }

    if (request !== this.previewRequest || this.pendingVariant !== variant) return;

    if (this.previewVisual) {
      this.previewScene.remove(this.previewVisual);
    }

    let visual = this.previewModels.get(variant);
    if (!visual) {
      // Create the exact complete, textured student that Level 2 uses.
      visual = this.factory.create({ variant });
      visual.rotation.y = 0;
      this.previewModels.set(variant, visual);
    }

    this.previewScene.add(visual);

    const animation = visual.userData.animation;
    animation.mixer.stopAllAction();
    animation.selection.reset();
    animation.selection.setLoop(THREE.LoopOnce, 1);
    animation.selection.clampWhenFinished = true;
    animation.selection.play();
    animation.mixer.update(0);

    this.previewVisual = visual;
    this.previewStatus.textContent = "";
  }

  select(index) {
    this.pendingVariant = clampVariant(index);
    const definition = STUDENT_MODEL_VARIANTS[this.pendingVariant];

    for (const button of this.optionsElement.querySelectorAll("[data-character-variant]")) {
      const selected =
        Number(button.dataset.characterVariant) === this.pendingVariant;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    }

    const label = displayLabel(definition.label);
    const code = `${this.pendingVariant < 3 ? "M" : "F"}-${String(
      (this.pendingVariant % 3) + 1
    ).padStart(2, "0")}`;

    this.selectionElement.textContent = `Selected: ${label}`;
    this.nameElement.textContent = label;
    this.codeElement.textContent = code;

    void this.showCharacterPreview(this.pendingVariant);
  }

  resizePreview() {
    const width = Math.max(1, this.previewCanvas.clientWidth);
    const height = Math.max(1, this.previewCanvas.clientHeight);

    // Match the original selector's intentionally low internal resolution.
    const renderWidth = Math.max(1, Math.round(width * 0.62));
    const renderHeight = Math.max(1, Math.round(height * 0.62));

    if (
      this.previewCanvas.width !== renderWidth ||
      this.previewCanvas.height !== renderHeight
    ) {
      this.previewRenderer.setSize(renderWidth, renderHeight, false);
      this.previewCamera.aspect = width / height;
      this.previewCamera.updateProjectionMatrix();
    }
  }

  startPreviewLoop() {
    if (this.previewFrameId !== null) return;

    this.previewClock.start();

    const render = () => {
      if (this.root.hidden) {
        this.previewFrameId = null;
        return;
      }

      const dt = Math.min(this.previewClock.getDelta(), 0.05);
      this.previewVisual?.userData.animation?.mixer.update(dt);
      this.resizePreview();
      this.previewRenderer.render(this.previewScene, this.previewCamera);
      this.previewFrameId = requestAnimationFrame(render);
    };

    this.previewFrameId = requestAnimationFrame(render);
  }

  show(currentVariant = DEFAULT_PLAYER_VARIANT) {
    this.root.hidden = false;
    this.select(clampVariant(currentVariant));
    this.startPreviewLoop();

    requestAnimationFrame(() => {
      this.optionsElement
        .querySelector(`[data-character-variant="${this.pendingVariant}"]`)
        ?.focus();
    });
  }

  hide() {
    this.root.hidden = true;

    if (this.previewFrameId !== null) {
      cancelAnimationFrame(this.previewFrameId);
      this.previewFrameId = null;
    }
  }
}
