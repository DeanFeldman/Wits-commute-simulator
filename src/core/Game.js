import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { InputManager } from "./InputManager.js";

import { ParkingLevel } from "../levels/ParkingLevel.js";
import { CrossingLevel } from "../levels/crossing/CrossingLevel.js";
import { CheatingLevel } from "../levels/CheatingLevel.js";
import { SuspicionShader } from "../shaders/suspicionShader.js";

const LEVEL_STATES = new Map([
  [1, "level1"],
  [2, "level2"],
  [3, "level3"]
]);

export class Game {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.suspicionComposer = new EffectComposer(this.renderer);
    this.suspicionRenderPass = new RenderPass(this.scene, this.camera);
    this.suspicionPass = new ShaderPass(SuspicionShader);
    this.suspicionOutputPass = new OutputPass();

    this.suspicionComposer.addPass(this.suspicionRenderPass);
    this.suspicionComposer.addPass(this.suspicionPass);
    this.suspicionComposer.addPass(this.suspicionOutputPass);

    this.clock = new THREE.Clock();
    this.input = new InputManager(this.renderer.domElement);
    this.globalControls = this.input.registerBindings({
      pause: "KeyP",
      levelOne: "Digit1",
      levelTwo: "Digit2",
      levelThree: "Digit3",
      restart: "KeyR",
      debugColliders: "F3"
    });

    this.levelFactories = new Map([
      [1, ParkingLevel],
      [2, CrossingLevel],
      [3, CheatingLevel]
    ]);
    this.state = "menu";
    this.currentLevel = null;
    this.currentLevelNumber = null;
    this.currentCheckpoint = "start";
    this.isPaused = false;
    this.isLoading = false;
    this.isTransitioning = false;
    this.loadVersion = 0;
    this.animationFrameId = null;
    this.transitionTimer = null;
    this.collisionDebug = false;
    this.journeyScore = 0;
    this.journeyTime = 0;
    this.levelThreeLookSensitivity = 1;

    this.hudElement = document.querySelector("#hud");
    this.messageElement = document.querySelector("#message");
    this.levelNameElement = document.querySelector("#level-name");
    this.menuElement = document.querySelector("#menu");
    this.fadeElement = document.querySelector("#fade-overlay");
    this.menuTitleElement = document.querySelector("#menu-title");
    this.menuCopyElement = document.querySelector("#menu-copy");
    this.menuPrimaryAction = document.querySelector("#menu-primary-action");
    this.devLevelSelect = document.querySelector("#dev-level-select");
    this.pauseMenuElement = document.querySelector("#pause-menu");
    this.lookSensitivityInput = document.querySelector("#look-sensitivity");
    this.lookSensitivityValue = document.querySelector("#look-sensitivity-value");
    this.sensitivityControl = document.querySelector("#sensitivity-control");
    this.instructionElement = document.querySelector("#instruction-card");
    this.instructionTitle = document.querySelector("#instruction-title");
    this.instructionCopy = document.querySelector("#instruction-copy");
    this.currentMessage = "";

    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onMenuClick = this.onMenuClick.bind(this);
    this.onPauseMenuClick = this.onPauseMenuClick.bind(this);
    this.onLookSensitivityInput = this.onLookSensitivityInput.bind(this);
    this.onInstructionClick = this.onInstructionClick.bind(this);

    window.addEventListener("resize", this.onResize);
    this.menuElement.addEventListener("click", this.onMenuClick);
    this.pauseMenuElement.addEventListener("click", this.onPauseMenuClick);
    this.lookSensitivityInput.addEventListener("input", this.onLookSensitivityInput);
    this.instructionElement.addEventListener("click", this.onInstructionClick);
    this.devLevelSelect.hidden = !import.meta.env.DEV;
  }

  start() {
    this.showMenu();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  showMenu() {
    this.cancelTransition();
    this.loadVersion += 1;
    this.disposeCurrentLevel();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.state = "menu";
    this.currentLevelNumber = null;
    this.isLoading = false;
    this.isPaused = false;
    this.isTransitioning = false;
    this.levelNameElement.textContent = "Main Menu";
    this.setHUD("");
    this.setMessage("");
    this.menuTitleElement.textContent = "Wits Commute Simulator";
    this.menuCopyElement.textContent = "Park. Cross. Cheat.";
    this.menuPrimaryAction.textContent = "Start journey";
    this.menuPrimaryAction.dataset.gameAction = "start";
    this.pauseMenuElement.hidden = true;
    this.instructionElement.hidden = true;
    this.menuElement.hidden = false;
  }

  showResults(keepFade = false) {
    if (!keepFade) this.cancelTransition();
    this.loadVersion += 1;
    this.disposeCurrentLevel();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.state = "results";
    this.currentLevelNumber = null;
    this.isLoading = false;
    this.isPaused = false;
    this.isTransitioning = false;
    this.levelNameElement.textContent = "Results";
    this.setHUD("");
    this.setMessage("");
    this.menuTitleElement.textContent = "Journey complete";
    this.menuCopyElement.textContent = `You reached class without getting caught. Score: ${this.journeyScore}. Time: ${this.journeyTime.toFixed(1)}s.`;
    if (keepFade) requestAnimationFrame(() => this.fadeElement.classList.remove("visible"));
    this.menuPrimaryAction.textContent = "Play again";
    this.pauseMenuElement.hidden = true;
    this.instructionElement.hidden = true;
    this.menuElement.hidden = false;
  }

  async startLevel(levelNumber, checkpoint = "start", keepFade = false) {
    const Level = this.levelFactories.get(levelNumber);

    if (!Level) {
      throw new Error(`Unknown level: ${levelNumber}`);
    }

    if (!keepFade) this.cancelTransition();
    const loadVersion = ++this.loadVersion;
    const loadingMessage = `Loading Level ${levelNumber}…`;

    this.state = LEVEL_STATES.get(levelNumber);
    this.currentLevelNumber = levelNumber;
    this.currentCheckpoint = checkpoint;
    this.isPaused = false;
    this.isLoading = true;
    this.isTransitioning = false;
    this.menuElement.hidden = true;
    this.setHUD("");
    this.setMessage(loadingMessage);
    this.disposeCurrentLevel();
    this.scene = new THREE.Scene();

    await new Promise((resolve) => requestAnimationFrame(resolve));

    if (loadVersion !== this.loadVersion) {
      return;
    }

    const level = new Level(this);
    this.currentLevel = level;

    try {
      await level.load();
    } catch (error) {
      if (this.currentLevel === level) {
        level.dispose();
        this.currentLevel = null;
        this.isLoading = false;
        this.setMessage("Level failed to load. Check the console for details.");
      }

      console.error(`Unable to load Level ${levelNumber}`, error);
      return;
    }

    if (loadVersion !== this.loadVersion) {
      level.dispose();
      return;
    }

    this.levelNameElement.textContent = level.name;
    this.isLoading = false;
    if (keepFade) requestAnimationFrame(() => this.fadeElement.classList.remove("visible"));

    if (this.currentMessage === loadingMessage) {
      this.setMessage("");
    }
  }

  setCheckpoint(checkpoint) {
    this.currentCheckpoint = checkpoint;
  }

  restartCurrentLevel(keepFade = false) {
    if (this.currentLevelNumber !== null) {
      this.startLevel(this.currentLevelNumber, this.currentCheckpoint, keepFade);
    }
  }

  completeLevel(message) {
    if (!this.currentLevelNumber || this.isTransitioning) return;

    const nextLevel = this.currentLevelNumber + 1;
    this.journeyScore += 100;
    this.isTransitioning = true;
    this.setMessage(message);
    this.fadeTransition(() => {
      if (nextLevel <= 3) this.startLevel(nextLevel, "start", true);
      else this.showResults(true);
    });
  }

  failLevel(message) {
    if (this.currentLevelNumber === null || this.isTransitioning) return;

    this.isTransitioning = true;
    this.setMessage(message);
    this.fadeTransition(() => this.restartCurrentLevel(true));
  }

  fadeTransition(callback) {
    this.fadeElement.classList.add("visible");
    this.scheduleTransition(callback, 280);
  }

  scheduleTransition(callback, delay) {
    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      callback();
    }, delay);
  }

  cancelTransition() {
    this.fadeElement?.classList.remove("visible");
    if (this.transitionTimer !== null) {
      window.clearTimeout(this.transitionTimer);
      this.transitionTimer = null;
    }
  }

  disposeCurrentLevel() {
    if (this.currentLevel) {
      this.currentLevel.dispose();
      this.currentLevel = null;
    }

    this.scene.clear();
    this.renderer.renderLists.dispose();
  }

  pause() {
    if (this.isPaused || this.currentLevelNumber === null) {
      return;
    }

    this.isPaused = true;
    if (this.currentLevelNumber === 3) {
      this.pauseMenuElement.hidden = false;
      if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock?.();
    }
    this.setMessage("Paused — press P or Resume to continue.");
  }

  resume() {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
    this.pauseMenuElement.hidden = true;
    this.clock.getDelta();
    this.setMessage("");
  }

  togglePause() {
    if (this.isPaused) {
      this.resume();
    } else {
      this.pause();
    }
  }

  setCamera(camera) {
    this.camera = camera;
    this.onResize();
  }

  setHUD(html) {
    this.hudElement.innerHTML = html;
  }

  flashHUD() {
    this.hudElement.classList.remove("damage-flash");
    void this.hudElement.offsetWidth;
    this.hudElement.classList.add("damage-flash");
  }
  setMessage(text = "") {
    this.currentMessage = text;
    this.messageElement.textContent = text;
    this.messageElement.classList.toggle("hidden", text.length === 0);
  }

  updateGlobalControls() {
    if (this.globalControls.wasPressed("pause")) {
      this.togglePause();
      return;
    }

    if (import.meta.env.DEV) {
      if (this.globalControls.wasPressed("levelOne")) {
        this.startLevel(1);
      }

      if (this.globalControls.wasPressed("levelTwo")) {
        this.startLevel(2);
      }

      if (this.globalControls.wasPressed("levelThree")) {
        this.startLevel(3);
      }
    }

    if (this.globalControls.wasPressed("debugColliders")) {
      this.collisionDebug = !this.collisionDebug;
      this.currentLevel?.toggleCollisionDebug?.(this.collisionDebug);
      this.setMessage(`Collision debug ${this.collisionDebug ? "on" : "off"}.`);
    }

    if (this.globalControls.wasPressed("restart")) {
      this.restartCurrentLevel();
    }
  }

  onMenuClick(event) {
    const action = event.target.closest("[data-game-action]")?.dataset.gameAction;

    if (action === "start") {
      this.startLevel(1);
      return;
    }

    if (action === "credits") {
      this.showCredits();
      return;
    }

    if (action === "menu") {
      this.showMenu();
      return;
    }

    if (action?.startsWith("level-")) {
      this.startLevel(Number(action.at(-1)));
    }
  }

  showCredits() {
    this.menuTitleElement.textContent = "Credits";
    this.menuCopyElement.textContent = "Wits Commute Simulator — COMS3006A / COMS3025A. Built with Three.js by the project team.";
    this.menuPrimaryAction.textContent = "Back to menu";
    this.menuPrimaryAction.dataset.gameAction = "menu";
    this.menuElement.hidden = false;
  }

  showInstruction(level) {
    const briefs = {
      1: "Drive with W/S and steer with A/D. Avoid potholes, then stop straight inside the cyan bay.",
      2: "Use arrow keys or WASD: each press hops one grid cell. Reach the far pavement and wait for traffic gaps.",
      3: "Click for mouse-look. Hold Space to copy, then release when the tutor can see you. P opens settings."
    };
    this.instructionTitle.textContent = level.name;
    this.instructionCopy.textContent = briefs[this.currentLevelNumber] ?? "Complete the objective to continue.";
    this.instructionElement.hidden = false;
  }

  onInstructionClick(event) {
    if (event.target.closest("[data-instruction-action='dismiss']")) {
      this.instructionElement.hidden = true;
    }
  }
  onPauseMenuClick(event) {
    if (event.target.closest("[data-pause-action='resume']")) {
      this.resume();
      this.input.requestPointerLock();
    }
  }

  onLookSensitivityInput(event) {
    this.levelThreeLookSensitivity = Number(event.target.value);
    this.lookSensitivityValue.value = `${this.levelThreeLookSensitivity.toFixed(1)}x`;
    this.lookSensitivityValue.textContent = `${this.levelThreeLookSensitivity.toFixed(1)}x`;
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);

    this.update(dt);
    this.render();
    this.input.endFrame();
  }

  update(dt) {
    this.updateGlobalControls();

    if (
      !this.isPaused &&
      !this.isLoading &&
      !this.isTransitioning &&
      this.currentLevel
    ) {
      this.journeyTime += dt;
      this.currentLevel.update(dt);
    }
  }

  render() {

  if (this.currentLevelNumber === 3 && this.currentLevel) {
      this.suspicionRenderPass.scene = this.scene;
      this.suspicionRenderPass.camera = this.camera;
      this.suspicionPass.uniforms.uSuspicion.value =
      THREE.MathUtils.clamp(
        (this.currentLevel.suspicion ?? 0) / 100,
          0,
          1
        );
      this.suspicionComposer.render();
      return;
      }
  this.renderer.render(this.scene, this.camera);
  }

  onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }

    if (this.camera.isOrthographicCamera) {
      const viewHeight = this.camera.userData.viewHeight ?? 18;
      const viewWidth = viewHeight * aspect;

      this.camera.left = -viewWidth / 2;
      this.camera.right = viewWidth / 2;
      this.camera.top = viewHeight / 2;
      this.camera.bottom = -viewHeight / 2;
      this.camera.updateProjectionMatrix();
    }

    this.renderer.setSize(width, height);

    this.suspicionComposer.setSize(width, height);
  }
}
