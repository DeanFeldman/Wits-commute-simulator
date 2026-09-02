import * as THREE from "three";
import { InputManager } from "./InputManager.js";

import { ParkingLevel } from "../levels/ParkingLevel.js";
import { CrossingLevel } from "../levels/CrossingLevel.js";
import { CheatingLevel } from "../levels/CheatingLevel.js";

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
    this.clock = new THREE.Clock();
    this.input = new InputManager(this.renderer.domElement);
    this.globalControls = this.input.registerBindings({
      pause: "KeyP",
      levelOne: "Digit1",
      levelTwo: "Digit2",
      levelThree: "Digit3",
      restart: "KeyR"
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

    this.hudElement = document.querySelector("#hud");
    this.messageElement = document.querySelector("#message");
    this.levelNameElement = document.querySelector("#level-name");
    this.menuElement = document.querySelector("#menu");
    this.menuTitleElement = document.querySelector("#menu-title");
    this.menuCopyElement = document.querySelector("#menu-copy");
    this.menuPrimaryAction = document.querySelector("#menu-primary-action");
    this.devLevelSelect = document.querySelector("#dev-level-select");
    this.currentMessage = "";

    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onMenuClick = this.onMenuClick.bind(this);

    window.addEventListener("resize", this.onResize);
    this.menuElement.addEventListener("click", this.onMenuClick);
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
    this.menuElement.hidden = false;
  }

  showResults() {
    this.cancelTransition();
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
    this.menuCopyElement.textContent = "You reached class without getting caught.";
    this.menuPrimaryAction.textContent = "Play again";
    this.menuElement.hidden = false;
  }

  async startLevel(levelNumber, checkpoint = "start") {
    const Level = this.levelFactories.get(levelNumber);

    if (!Level) {
      throw new Error(`Unknown level: ${levelNumber}`);
    }

    this.cancelTransition();
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

    if (this.currentMessage === loadingMessage) {
      this.setMessage("");
    }
  }

  setCheckpoint(checkpoint) {
    this.currentCheckpoint = checkpoint;
  }

  restartCurrentLevel() {
    if (this.currentLevelNumber !== null) {
      this.startLevel(this.currentLevelNumber, this.currentCheckpoint);
    }
  }

  completeLevel(message) {
    if (!this.currentLevelNumber || this.isTransitioning) {
      return;
    }

    const nextLevel = this.currentLevelNumber + 1;
    this.isTransitioning = true;
    this.setMessage(message);

    this.scheduleTransition(() => {
      if (nextLevel <= 3) {
        this.startLevel(nextLevel);
      } else {
        this.showResults();
      }
    }, 900);
  }

  failLevel(message) {
    if (this.currentLevelNumber === null || this.isTransitioning) {
      return;
    }

    this.isTransitioning = true;
    this.setMessage(message);
    this.scheduleTransition(() => this.restartCurrentLevel(), 900);
  }

  scheduleTransition(callback, delay) {
    this.cancelTransition();
    this.transitionTimer = window.setTimeout(() => {
      this.transitionTimer = null;
      callback();
    }, delay);
  }

  cancelTransition() {
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
    this.setMessage("Paused — press P to resume.");
  }

  resume() {
    if (!this.isPaused) {
      return;
    }

    this.isPaused = false;
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

    if (action === "menu") {
      this.showMenu();
      return;
    }

    if (action?.startsWith("level-")) {
      this.startLevel(Number(action.at(-1)));
    }
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
      this.currentLevel.update(dt);
    }
  }

  render() {
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
  }
}
