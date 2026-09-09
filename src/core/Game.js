import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { InputManager } from "./InputManager.js";
import { applyRendererBaseline } from "./renderSettings.js";
import { createGpuTimer } from "./gpuTimer.js";

import { ParkingLevel } from "../levels/ParkingLevel.js";
import { CrossingLevel } from "../levels/crossing/CrossingLevel.js";
import { CheatingLevel } from "../levels/CheatingLevel.js";
import { SuspicionShader } from "../shaders/suspicionShader.js";

const LEVEL_STATES = new Map([
  [1, "level1"],
  [2, "level2"],
  [3, "level3"]
]);

const LEVEL_ONE_STORY = [
  "It’s 7:30 AM! The exam starts in thirty minutes!!!\nBrendan is going to have a go at me!",
  "If I miss this exam, I’m cooked...\nAlan Turing, if you can hear me… findParking() better return true."
];

export class Game {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });

    // Tone mapping, output colour space, shadow filtering and the pixel
    // ratio cap all live in renderSettings.js, which documents why each
    // one changes the image. They are set here, once, because the renderer
    // outlives every level. The pixel ratio cap and the two shadow-map
    // settings were previously written inline here and keep the same
    // values; tone mapping and output colour space are new.
    applyRendererBaseline(this.renderer);

    // Opt-in GPU frame timer, for deciding whether a shader change costs
    // anything. A normal session never issues a query: without ?gpuTimer=1
    // this is null and every call site below is a no-op.
    this.gpuTimer = new URLSearchParams(window.location.search).has("gpuTimer")
      ? createGpuTimer(this.renderer)
      : null;
    if (this.gpuTimer) window.__gpuTimer = this.gpuTimer;

    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
    this.isLevelOneIntroActive = false;
    this.isLevelOneIntroReady = false;
    this.levelOneStoryIndex = 0;
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
    this.levelOneIntroElement = document.querySelector("#level1-intro");
    this.levelOneIntroStatus = document.querySelector("#level1-intro-status-copy");
    this.levelOneDialogueCopy = document.querySelector("#level1-dialogue-copy");
    this.levelOneDialogueContinue = document.querySelector("#level1-dialogue-continue");
    this.currentMessage = "";

    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onMenuClick = this.onMenuClick.bind(this);
    this.onPauseMenuClick = this.onPauseMenuClick.bind(this);
    this.onLookSensitivityInput = this.onLookSensitivityInput.bind(this);
    this.onInstructionClick = this.onInstructionClick.bind(this);
    this.onLevelOneIntroClick = this.onLevelOneIntroClick.bind(this);

    window.addEventListener("resize", this.onResize);
    this.menuElement.addEventListener("click", this.onMenuClick);
    this.pauseMenuElement.addEventListener("click", this.onPauseMenuClick);
    this.lookSensitivityInput.addEventListener("input", this.onLookSensitivityInput);
    this.instructionElement.addEventListener("click", this.onInstructionClick);
    this.levelOneIntroElement.addEventListener("click", this.onLevelOneIntroClick);
    this.devLevelSelect.hidden = !import.meta.env.DEV;
  }

  start() {
    this.showMenu();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  showMenu() {
    this.cancelTransition();
    this.hideLevelOneIntro();
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

  async startLevel(levelNumber, checkpoint = "start", keepFade = false, showIntro = false) {
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
    if (!showIntro) this.hideLevelOneIntro();
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
      if (showIntro) this.setLevelOneIntroLoadState("error");
      return;
    }

    if (loadVersion !== this.loadVersion) {
      level.dispose();
      return;
    }

    this.levelNameElement.textContent = level.name;
    this.isLoading = false;
    if (showIntro) this.setLevelOneIntroLoadState("ready");
    if (keepFade) requestAnimationFrame(() => this.fadeElement.classList.remove("visible"));

    if (this.currentMessage === loadingMessage) {
      this.setMessage("");
    }
  }

  startJourney() {
    this.journeyScore = 0;
    this.journeyTime = 0;
    this.showLevelOneIntro();
    this.startLevel(1, "start", false, true);
  }

  showLevelOneIntro() {
    this.isLevelOneIntroActive = true;
    this.isLevelOneIntroReady = false;
    this.levelOneStoryIndex = 0;
    this.levelOneIntroElement.hidden = false;
    this.levelOneIntroElement.dataset.loadState = "loading";
    this.levelOneIntroStatus.textContent = "Loading Level 1...";
    this.renderLevelOneStory();
  }

  hideLevelOneIntro() {
    this.isLevelOneIntroActive = false;
    this.isLevelOneIntroReady = false;
    this.levelOneIntroElement.hidden = true;
  }

  setLevelOneIntroLoadState(state) {
    this.levelOneIntroElement.dataset.loadState = state;
    this.isLevelOneIntroReady = state === "ready";
    this.levelOneIntroStatus.textContent = state === "ready"
      ? "Level 1 ready"
      : "Level 1 could not be loaded";
    this.renderLevelOneStory();
  }

  renderLevelOneStory() {
    this.levelOneDialogueCopy.textContent = LEVEL_ONE_STORY[this.levelOneStoryIndex];
    const isFinalBox = this.levelOneStoryIndex === LEVEL_ONE_STORY.length - 1;
    const waitingForLevel = isFinalBox && !this.isLevelOneIntroReady;

    this.levelOneDialogueContinue.disabled = waitingForLevel;
    this.levelOneDialogueContinue.firstChild.textContent = waitingForLevel
      ? "Loading... "
      : "Continue ";
  }

  onLevelOneIntroClick(event) {
    if (!event.target.closest("#level1-dialogue-continue")) return;

    if (this.levelOneStoryIndex < LEVEL_ONE_STORY.length - 1) {
      this.levelOneStoryIndex += 1;
      this.renderLevelOneStory();
      return;
    }

    if (!this.isLevelOneIntroReady) return;

    this.hideLevelOneIntro();
    this.clock.getDelta();
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
    if (this.isLevelOneIntroActive) return;

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
      this.startJourney();
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
      3: "Click for mouse-look. Hold left click to zoom and reveal a surrounding tablet's word. Release, look down at your own desk, type the answer, and press Enter. P opens settings."
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
    // Wrapped around render() rather than inside it, so the level 3 composer
    // path is timed on the same terms as the direct one.
    this.gpuTimer?.begin();
    this.render();
    this.gpuTimer?.end();
    this.gpuTimer?.poll();
    this.input.endFrame();
  }

  update(dt) {
    this.updateGlobalControls();

    if (
      !this.isPaused &&
      !this.isLoading &&
      !this.isTransitioning &&
      !this.isLevelOneIntroActive &&
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
