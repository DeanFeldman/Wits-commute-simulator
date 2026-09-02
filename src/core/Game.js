import * as THREE from "three";
import { InputManager } from "./InputManager.js";

import { ParkingLevel } from "../levels/ParkingLevel.js";
import { CrossingLevel } from "../levels/CrossingLevel.js";
import { CheatingLevel } from "../levels/CheatingLevel.js";

export class Game {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true
    });

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

    this.currentLevel = null;
    this.currentLevelNumber = 1;
    this.isPaused = false;
    this.animationFrameId = null;

    this.hudElement = document.querySelector("#hud");
    this.messageElement = document.querySelector("#message");
    this.levelNameElement = document.querySelector("#level-name");

    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);

    window.addEventListener("resize", this.onResize);
  }

  start() {
    this.loadLevel(1);
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  pause() {
    if (this.isPaused) {
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
      return;
    }

    this.pause();
  }

  setCamera(camera) {
    this.camera = camera;
    this.onResize();
  }

  setHUD(html) {
    this.hudElement.innerHTML = html;
  }

  setMessage(text = "") {
    this.messageElement.textContent = text;
    this.messageElement.classList.toggle("hidden", text.length === 0);
  }

  loadLevel(levelNumber) {
    if (this.currentLevel) {
      this.currentLevel.dispose();
      this.currentLevel = null;
    }

    this.scene.clear();
    this.scene = new THREE.Scene();

    this.currentLevelNumber = levelNumber;

    switch (levelNumber) {
      case 1:
        this.currentLevel = new ParkingLevel(this);
        break;

      case 2:
        this.currentLevel = new CrossingLevel(this);
        break;

      case 3:
        this.currentLevel = new CheatingLevel(this);
        break;

      default:
        throw new Error(`Unknown level: ${levelNumber}`);
    }

    this.levelNameElement.textContent = this.currentLevel.name;
    this.setMessage("");
    this.currentLevel.load();
  }

  restartLevel() {
    this.loadLevel(this.currentLevelNumber);
  }

  updateGlobalControls() {
    if (this.input.wasPressed("KeyP")) {
      this.togglePause();
      return;
    }

    if (this.isPaused) {
      return;
    }

    if (this.input.wasPressed("Digit1")) {
      this.loadLevel(1);
    }

    if (this.input.wasPressed("Digit2")) {
      this.loadLevel(2);
    }

    if (this.input.wasPressed("Digit3")) {
      this.loadLevel(3);
    }

    if (this.input.wasPressed("KeyR")) {
      this.restartLevel();
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

    if (!this.isPaused && this.currentLevel) {
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
