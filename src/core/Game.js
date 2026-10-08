import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { FXAAShader } from "three/addons/shaders/FXAAShader.js";
import { InputManager } from "./InputManager.js";
import { applyRendererBaseline } from "./renderSettings.js";
import { GraphicsSettings, loadSavedGraphicsSettings } from "./GraphicsSettings.js";
import { createGpuTimer } from "./gpuTimer.js";
import { SetbackBanner, describeFailure } from "./FailureReport.js";
import { RoadFogShader } from "../shaders/roadFogShader.js";
import { ToonStyleShader } from "../shaders/toonStyleShader.js";
import { ParkingLevel } from "../levels/ParkingLevel.js";
import { CrossingLevel } from "../levels/crossing/CrossingLevel.js";
import { CheatingLevel } from "../levels/CheatingLevel.js";
import { SuspicionShader } from "../shaders/suspicionShader.js";
import { CREDITS } from "../shared/creditsRegistry.js";
import { LevelAudio } from "../shared/LevelAudio.js";
import { CharacterSelectFlow } from "./CharacterSelectFlow.js";
import {
  loadPersonalBests,
  savePersonalBests,
  scoreLevel,
  summariseJourney,
  updatePersonalBests
} from "./commuteScoring.js";

// How long a checkpoint setback banner lingers while play continues.
const SETBACK_DISPLAY_TIME = 2600;

const LEVEL_STATES = new Map([
  [1, "level1"],
  [2, "level2"],
  [3, "level3"]
]);

// One entry per level. `art` points at an illustrated panel like the
// Level 1 one; leave it null to fall back to the CSS placeholder (see
// .level-intro-placeholder in style.css) with `placeholderIcon` as the
// stand-in graphic until dedicated art exists for that level.
const LEVEL_INTRO_CONFIG = new Map([
  [
    1,
    {
      art: "./assets/images/ui/level1-story-loading-screen.png",
      artAlt: "A driver checking their watch from inside a car on a winding road",
      placeholderIcon: null,
      story: [
        "It’s 7:30 AM! The exam starts in thirty minutes!!!\nBranden is going to have a go at me!",
        "If I miss this exam, I’m cooked...\nWatch out for potholes — they slow the car and reduce its condition.\nAlan Turing, if you can hear me… findParking() better return true."
      ]
    }
  ],
  [
    2,
    {
      art: "./assets/images/ui/level2-story-loading-screen.png",
      artAlt: "A small orange car wedged between parked vehicles",
      placeholderIcon: null,
      story: [
        "Not too shabby! Still a pass in my books",
        "Now time for the long walk to freed- RSH :("
      ]
    }
  ],
  [
    3,
    {
      art: "./assets/images/ui/level3-story-loading-screen.png",
      artAlt: "The student sliding into a lecture hall seat as papers are handed out",
      placeholderIcon: "📝",
      story: [
      "Made it. Soaked in sweat, but I made it.\nBranden’s already walking the rows with that look.",
      "Everyone around me clearly studied. I clearly did not.\nSo... time to get creative.",
      "Look around, sneak a peek at your classmates’ answers and find the right one.\nGet it right, then move on to the next question.",
      "Only problem... the tutors are watching.\nGet caught cheating and your suspicion goes up. Hit 100% and this academic comeback is over.\n\nFinish the test before time runs out.\nEasy... probably."
      ]
    }
  ]
]);

const LEVEL_TUTORIAL_CONFIG = new Map();

export class Game {
  constructor(container) {
    this.container = container;
    const savedGraphics = loadSavedGraphicsSettings();
    this.renderer = new THREE.WebGLRenderer({
      antialias: savedGraphics.antialiasing !== "off"
    });

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
    this.suspicionToonPass = new ShaderPass(ToonStyleShader);
    this.suspicionComposer.addPass(this.suspicionToonPass);
    this.suspicionFxaaPass = new ShaderPass(FXAAShader);
    this.suspicionComposer.addPass(this.suspicionFxaaPass);
    this.suspicionComposer.addPass(this.suspicionOutputPass);

    this.clock = new THREE.Clock();
    this.input = new InputManager(this.renderer.domElement);
    this.globalControls = this.input.registerBindings({
      pause: ["KeyP", "Escape"],
      levelOne: "Digit1",
      levelTwo: "Digit2",
      levelThree: "Digit3",
      restart: "KeyR", // Ctrl modifier is required in updateGlobalControls().
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
    this.isLevelIntroActive = false;
    this.isLevelIntroReady = false;
    this.isTutorialActive = false;
    this.tutorialDemoKeys = new Set();
    this.tutorialCameraDemo = false;
    this.tutorialPeekDemo = false;
    this.tutorialLook = { x: 0, y: 0 };
    this.tutorialDemoPosition = { x: 0, y: 0 };
    this.tutorialTypingTimer = null;
    this.levelIntroStoryIndex = 0;
    this.levelIntroConfig = null;
    this.levelIntroArtPreloads = new Map();
    this.levelIntroArtRequest = 0;
    this.staticParkingImagesReady = false;
    this.staticParkingImagesPreload = null;
    this.staticParkingImageError = false;
    this.staticCrossingImageReady = false;
    this.staticCrossingImagePreload = null;
    this.staticCrossingImageError = false;
    this.staticExamImageReady = false;
    this.staticExamImagePreload = null;
    this.staticExamImageError = false;
    this.loadVersion = 0;
    this.levelOneWarmupFrames = 0;
    this.levelOneGraphicsReady = false;
    this.animationFrameId = null;
    this.transitionTimer = null;
    this.collisionDebug = false;
    this.journeyScore = 0;
    this.journeyTime = 0;
    this.journeyLevelResults = new Map();
    this.journeyFailureCounts = new Map([[1, 0], [2, 0], [3, 0]]);
    this.isScoredJourney = false;
    this.personalBests = loadPersonalBests();
    this.levelThreeLookSensitivity = 1;
    this.isSoundMuted = false;
    this.uiAudio = new LevelAudio();
    this.isMusicEnabled = true;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;

    this.hudElement = document.querySelector("#hud");
    this.messageElement = document.querySelector("#message");
    this.levelNameElement = document.querySelector("#level-name");
    this.fpsElement = document.querySelector("#fps-counter");
    this.menuElement = document.querySelector("#menu");
    this.fadeElement = document.querySelector("#fade-overlay");
    this.menuTitleElement = document.querySelector("#menu-title");
    this.menuCopyElement = document.querySelector("#menu-copy");
    this.menuPrimaryAction = document.querySelector("#menu-primary-action");
    this.devLevelSelect = document.querySelector("#dev-level-select");
    this.menuCreditsAction = document.querySelector("#menu-credits-action");
    this.menuHomeAction = document.querySelector("#menu-home-action");
    this.menuMusicAction = document.querySelector("#menu-music-action");
    this.homeMenuElement = document.querySelector("#home-menu");
    this.homeMenuPrimaryAction = document.querySelector("#home-menu-primary-action");
    this.pauseMenuElement = document.querySelector("#pause-menu");
    this.pauseKickerElement = document.querySelector("#pause-kicker");
    this.lookSensitivityInput = document.querySelector("#look-sensitivity");
    this.lookSensitivityValue = document.querySelector("#look-sensitivity-value");
    this.sensitivityControl = document.querySelector("#sensitivity-control");
    this.instructionElement = document.querySelector("#instruction-card");
    this.instructionKicker = document.querySelector("#instruction-kicker");
    this.instructionTitle = document.querySelector("#instruction-title");
    this.instructionObjective = document.querySelector("#instruction-objective");
    this.instructionControls = document.querySelector("#instruction-controls");
    this.instructionTip = document.querySelector("#instruction-tip");
    this.instructionPreview = document.querySelector("#instruction-preview");
    this.instructionPreviewLabel = document.querySelector("#instruction-preview-label");
    this.instructionDemo = document.querySelector("#instruction-demo");
    this.instructionDemoMarker = document.querySelector("#instruction-demo-marker");
    this.instructionDemoStatus = document.querySelector("#instruction-demo-status");
    this.instructionStart = document.querySelector(".tutorial-start");
    this.levelIntroElement = document.querySelector("#level-intro");
    this.levelIntroStatus = document.querySelector("#level-intro-status-copy");
    this.levelIntroArt = document.querySelector("#level-intro-art");
    this.levelIntroPlaceholder = document.querySelector("#level-intro-placeholder");
    this.levelIntroPlaceholderIcon = document.querySelector("#level-intro-placeholder-icon");
    this.levelIntroDialogueCopy = document.querySelector("#level-intro-dialogue-copy");
    this.levelIntroDialogueContinue = document.querySelector("#level-intro-dialogue-continue");
    this.currentMessage = "";
    this.setbackBanner = new SetbackBanner();

    this.animate = this.animate.bind(this);
    this.onResize = this.onResize.bind(this);
    this.onMenuClick = this.onMenuClick.bind(this);
    this.onPauseMenuClick = this.onPauseMenuClick.bind(this);
    this.onLookSensitivityInput = this.onLookSensitivityInput.bind(this);
    this.onInstructionClick = this.onInstructionClick.bind(this);
    this.onTutorialDemoKeyDown = this.onTutorialDemoKeyDown.bind(this);
    this.onTutorialDemoKeyUp = this.onTutorialDemoKeyUp.bind(this);
    this.onTutorialDemoPointerMove = this.onTutorialDemoPointerMove.bind(this);
    this.onTutorialDemoPointerDown = this.onTutorialDemoPointerDown.bind(this);
    this.onTutorialDemoPointerUp = this.onTutorialDemoPointerUp.bind(this);
    this.onLevelIntroClick = this.onLevelIntroClick.bind(this);

    window.addEventListener("resize", this.onResize);
    // Browsers consume Escape to release pointer lock, so handle that release too.
    this.wasPointerLocked = false;
    document.addEventListener("pointerlockchange", () => {
      const locked = document.pointerLockElement === this.renderer.domElement;
      // A level may release the pointer on purpose (e.g. to show a clickable
      // form); that is not the player asking to pause.
      const levelReleasedPointer = this.currentLevel?.isPointerReleaseExpected?.() ?? false;
      if (this.wasPointerLocked && !locked && !this.isPaused &&
          !this.isLoading && !this.isTransitioning &&
          !this.isLevelIntroActive && !this.isTutorialActive &&
          !levelReleasedPointer) {
        this.pause();
      }
      this.wasPointerLocked = locked;
    });
    this.menuElement.addEventListener("click", this.onMenuClick);
    this.homeMenuElement.addEventListener("click", this.onMenuClick);
    this.homeMenuElement.addEventListener("dragstart", (event) => event.preventDefault());
    this.pauseMenuElement.addEventListener("click", this.onPauseMenuClick);
    this.lookSensitivityInput.addEventListener("input", this.onLookSensitivityInput);
    this.instructionElement.addEventListener("click", this.onInstructionClick);
    window.addEventListener("keydown", this.onTutorialDemoKeyDown, true);
    window.addEventListener("keyup", this.onTutorialDemoKeyUp, true);
    this.instructionPreview.addEventListener("pointermove", this.onTutorialDemoPointerMove);
    this.instructionPreview.addEventListener("pointerdown", this.onTutorialDemoPointerDown);
    this.instructionPreview.addEventListener("pointerup", this.onTutorialDemoPointerUp);
    this.instructionPreview.addEventListener("pointerleave", this.onTutorialDemoPointerUp);
    this.levelIntroElement.addEventListener("click", this.onLevelIntroClick);
    this.devLevelSelect.hidden = !import.meta.env.DEV;
    this.selectedPlayerVariant = 0;
    this.characterSelectFlow = new CharacterSelectFlow({
      onContinue: (variantIndex) => {
        this.selectedPlayerVariant = variantIndex;
        this.startJourney();
      },
      onBack: () => this.showMenu()
    });

  
  
    
    const roadFogTarget=new THREE.WebGLRenderTarget(window.innerWidth,window.innerHeight);
    roadFogTarget.depthTexture=new THREE.DepthTexture(window.innerWidth,window.innerHeight,THREE.UnsignedIntType);

    this.roadFogComposer=new EffectComposer(this.renderer,roadFogTarget);
    this.roadFogRenderPass=new RenderPass(this.scene,this.camera);
    this.roadFogPass=new ShaderPass(RoadFogShader);
    this.roadFogOutputPass=new OutputPass();

    this.roadFogComposer.addPass(this.roadFogRenderPass);
    this.roadFogComposer.addPass(this.roadFogPass);
    this.roadFogToonPass = new ShaderPass(ToonStyleShader);
    this.roadFogComposer.addPass(this.roadFogToonPass);
    this.roadFogFxaaPass = new ShaderPass(FXAAShader);
    this.roadFogComposer.addPass(this.roadFogFxaaPass);
    this.roadFogComposer.addPass(this.roadFogOutputPass);

    this.toonComposer = new EffectComposer(this.renderer);
    this.toonRenderPass = new RenderPass(this.scene, this.camera);
    this.toonPass = new ShaderPass(ToonStyleShader);
    this.toonFxaaPass = new ShaderPass(FXAAShader);
    this.toonOutputPass = new OutputPass();
    this.toonComposer.addPass(this.toonRenderPass);
    this.toonComposer.addPass(this.toonPass);
    this.toonComposer.addPass(this.toonFxaaPass);
    this.toonComposer.addPass(this.toonOutputPass);
    this.fxaaResolution = new THREE.Vector2();

    this.graphicsSettings = new GraphicsSettings({
      renderer: this.renderer,
      composers: [this.roadFogComposer, this.suspicionComposer, this.toonComposer]
    });
  }

  start() {
    this.showMenu();
    this.preloadCharacterAssets();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  showMenu() {
    this.characterSelectFlow?.hide();
    this.cancelTransition();
    this.uiAudio.startMusic("menu");
    this.uiAudio.setMusicEnabled(this.isMusicEnabled);
    this.uiAudio.setMuted(this.isSoundMuted);
    this.hideLevelIntro();
    this.loadVersion += 1;
    this.disposeCurrentLevel();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.state = "menu";
    this.isScoredJourney = false;
    this.setbackBanner.hide();
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
    this.menuPrimaryAction.classList.add("pixel-menu-button");
    this.menuCreditsAction.hidden = false;
    this.menuCreditsAction.textContent = "Credits & licences";
    this.menuCreditsAction.dataset.gameAction = "credits";
    this.menuMusicAction.hidden = false;
    this.updateMenuMusicAction();
    this.menuHomeAction.hidden = true;
    this.menuElement.classList.remove("menu-credits", "menu-results");
    this.menuPrimaryAction.dataset.gameAction = "start";
    this.menuElement.classList.add("menu-home");
    this.devLevelSelect.hidden = false;
    this.pauseMenuElement.hidden = true;
    this.hideInstruction();
    this.menuElement.hidden = true;
    this.homeMenuElement.hidden = false;
    document.body.classList.remove("level-2");
    this.updateStartAvailability();
  }

  preloadCharacterAssets() {
    this.updateStartAvailability();

    void this.characterSelectFlow
      .preload()
      .then(() => {
        this.updateStartAvailability();
        // Story art is presentation-only, so it starts only after the required
        // character assets are ready and never blocks the Start button.
        void this.preloadLevelIntroArt(1);
      })
      .catch((error) => {
        // Do not trap the player on the menu forever if the character bundle
        // cannot be fetched. Level 2 already has a procedural/legacy fallback.
        console.warn("Character assets could not be preloaded; continuing with fallback loading.", error);
        this.updateStartAvailability();
        void this.preloadLevelIntroArt(1);
      });
  }

  updateStartAvailability() {
    if (this.state !== "menu") return;

    const startAction = this.homeMenuPrimaryAction;
    startAction.disabled = false;
    startAction.removeAttribute("aria-busy");
    startAction.querySelector(".journey-button-label").textContent = "Begin Journey";

    if (this.characterSelectFlow.didFail) {
      startAction.title =
        "Character previews could not be preloaded; fallback loading will be used.";
    } else {
      startAction.removeAttribute("title");
    }
  }

  showResults(keepFade = false) {
    if (!keepFade) this.cancelTransition();

    const summary = summariseJourney(
      [...this.journeyLevelResults.values()],
      this.journeyTime
    );
    this.journeyScore = summary.totalScore;

    if (this.isScoredJourney && summary.isFullJourney) {
      this.personalBests = updatePersonalBests(this.personalBests, summary);
      savePersonalBests(this.personalBests);
    }

    this.loadVersion += 1;
    this.disposeCurrentLevel();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.state = "results";
    this.setbackBanner.hide();
    this.currentLevelNumber = null;
    this.isLoading = false;
    this.isPaused = false;
    this.isTransitioning = false;
    this.levelNameElement.textContent = "Results";
    this.setHUD("");
    this.setMessage("");
    this.menuTitleElement.textContent = summary.isFullJourney
      ? `${summary.rating.grade} — ${summary.rating.label}`
      : "Practice results";
    this.menuCopyElement.innerHTML = this.renderResults(summary);
    if (keepFade) requestAnimationFrame(() => this.fadeElement.classList.remove("visible"));
    this.menuPrimaryAction.textContent = "Play again";
    this.menuPrimaryAction.dataset.gameAction = "start";
    this.menuMusicAction.hidden = true;
    this.menuCreditsAction.hidden = false;
    this.menuCreditsAction.textContent = "Credits & licences";
    this.menuCreditsAction.dataset.gameAction = "credits";
    this.menuHomeAction.hidden = false;
    this.menuElement.classList.remove("menu-home", "menu-credits");
    this.menuElement.classList.add("menu-results");
    this.devLevelSelect.hidden = true;
    this.pauseMenuElement.hidden = true;
    this.hideInstruction();
    this.menuElement.hidden = false;
    this.homeMenuElement.hidden = true;
    document.body.classList.remove("level-2");
  }

  renderResults(summary) {
    const levelNames = {
      1: "Park at Wits",
      2: "Cross the Road",
      3: "Don't Get Caught"
    };

    const rawDetail = (result) => {
      const p = result.performance;
      if (result.levelNumber === 1) {
        return `${p.condition.toFixed(0)}% condition · ${p.containmentPercent.toFixed(0)}% contained · ${p.alignmentErrorDegrees.toFixed(1)}° alignment error`;
      }
      if (result.levelNumber === 2) {
        return `${p.impacts} impact${p.impacts === 1 ? "" : "s"} · ${p.backwardSteps} backward step${p.backwardSteps === 1 ? "" : "s"}`;
      }
      return `${p.incorrectAnswers} wrong answer${p.incorrectAnswers === 1 ? "" : "s"} · ${p.suspicion.toFixed(0)}% suspicion`;
    };

    const levelCards = summary.levels.map((result) => `
      <article class="result-level-card">
        <div class="result-level-heading">
          <strong>Level ${result.levelNumber} — ${levelNames[result.levelNumber]}</strong>
          <strong>${result.total}/100</strong>
        </div>
        <div class="result-components">
          <span>Time <strong>${result.components.time}/40</strong></span>
          <span>Mistakes <strong>${result.components.mistakes}/30</strong></span>
          <span>Quality <strong>${result.components.quality}/30</strong></span>
        </div>
        <p>${result.time.toFixed(1)}s · ${rawDetail(result)}</p>
        ${result.failedAttempts > 0 ? `<p class="result-attempts">${result.failedAttempts} prior failed/restarted attempt${result.failedAttempts === 1 ? "" : "s"}</p>` : ""}
      </article>
    `).join("");

    const bests = this.personalBests ?? {};
    const bestLevelTimes = [1, 2, 3]
      .map((levelNumber) => {
        const time = bests.levelTimes?.[String(levelNumber)];
        return Number.isFinite(time) ? `L${levelNumber} ${time.toFixed(1)}s` : null;
      })
      .filter(Boolean)
      .join(" · ");

    const records = this.isScoredJourney && summary.isFullJourney
      ? `
        <section class="result-records">
          <strong>Personal bests</strong>
          <p>${bestLevelTimes || "First recorded commute"}</p>
          <p>Journey: ${Number.isFinite(bests.journeyTime) ? `${bests.journeyTime.toFixed(1)}s` : "—"} · Score: ${Number.isFinite(bests.journeyScore) ? `${bests.journeyScore}/300` : "—"}</p>
        </section>
      `
      : `<p class="result-practice-note">Practice/dev runs do not update personal bests.</p>`;

    return `
      <section class="results-summary">
        <p class="result-total"><strong>${summary.totalScore}/${summary.isFullJourney ? 300 : Math.max(100, summary.levels.length * 100)}</strong> · ${summary.totalTime.toFixed(1)}s total commute time</p>
        <div class="result-levels">${levelCards}</div>
        ${records}
      </section>
    `;
  }

  async startLevel(levelNumber, checkpoint = "start", keepFade = false, showIntro = false) {
    const Level = this.levelFactories.get(levelNumber);

    if (!Level) {
      throw new Error(`Unknown level: ${levelNumber}`);
    }

    if (!keepFade) this.cancelTransition();
    const loadVersion = ++this.loadVersion;
    this.levelOneWarmupFrames = 0;
    this.levelOneGraphicsReady = levelNumber !== 1;
    const loadingMessage = `Loading Level ${levelNumber}…`;

    this.state = LEVEL_STATES.get(levelNumber);
    this.setbackBanner.hide();
    this.currentLevelNumber = levelNumber;
    document.body.classList.toggle("level-2",levelNumber===2);
    this.currentCheckpoint = checkpoint;
    this.isPaused = false;
    this.isLoading = true;
    this.isTransitioning = false;
    if (!showIntro) this.hideLevelIntro();
    this.hideInstruction();
    this.menuElement.hidden = true;
    this.homeMenuElement.hidden = true;
    this.levelNameElement.textContent = loadingMessage;
    this.setHUD("");
    this.setMessage(loadingMessage);
    this.disposeCurrentLevel();
    this.scene = new THREE.Scene();

    await new Promise((resolve) => requestAnimationFrame(resolve));

    // Nothing to undo here: this load has not built anything yet, and every
    // field it set above has already been overwritten by the load that
    // superseded it.
    if (loadVersion !== this.loadVersion) {
      return;
    }

    const level = new Level(this);
    this.currentLevel = level;
    level.audio?.setMusicEnabled?.(this.isMusicEnabled);

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
      if (showIntro) this.setLevelIntroLoadState("error");
      return;
    }

    if (loadVersion !== this.loadVersion) {
      level.dispose();
      // level.load() sets its own instruction message and HUD, and it did so
      // while the winning load was still in flight, so that text is now
      // sitting on screen for a level that no longer exists. Put the winner's
      // loading state back. `isLoading` still belongs to the winner, so it is
      // deliberately not reset here; whichever load finishes last clears it.
      if (this.isLoading) {
        this.setHUD("");
        this.setMessage(`Loading Level ${this.currentLevelNumber}…`);
        this.levelNameElement.textContent = `Loading Level ${this.currentLevelNumber}…`;
      }
      return;
    }

    this.levelNameElement.textContent = level.name;
    level.audio?.setMusicEnabled?.(this.isMusicEnabled);
    level.audio?.setMuted?.(this.isSoundMuted);
    level.setMuted?.(this.isSoundMuted);
    this.isLoading = false;
    if (showIntro && (levelNumber !== 1 || this.levelOneGraphicsReady)) this.setLevelIntroLoadState("ready");
    if (levelNumber === 1 && this.staticParkingTutorial && !this.staticParkingTutorial.hidden) this.updateStaticParkingReady();
    if (levelNumber === 2 && this.staticCrossingTutorial && !this.staticCrossingTutorial.hidden) this.updateStaticCrossingReady();
    if (levelNumber === 3 && this.staticExamTutorial && !this.staticExamTutorial.hidden) this.updateStaticExamReady();
    if (keepFade) requestAnimationFrame(() => this.fadeElement.classList.remove("visible"));

    if (this.currentMessage === loadingMessage) {
      this.setMessage("");
    }
    if (!showIntro) this.showInstruction(level);
  }

  showCharacterSelect() {
    this.cancelTransition();
    this.hideLevelIntro();
    this.pauseMenuElement.hidden = true;
    this.hideInstruction();
    this.menuElement.hidden = true;
    this.setHUD("");
    this.setMessage("");
    this.homeMenuElement.hidden = true;
    this.characterSelectFlow.show(this.selectedPlayerVariant);
  }

  startJourney() {
    this.journeyScore = 0;
    this.journeyTime = 0;
    this.journeyLevelResults.clear();
    this.journeyFailureCounts = new Map([[1, 0], [2, 0], [3, 0]]);
    this.isScoredJourney = true;
    void this.preloadStaticParkingImages();
    this.showLevelIntro(1);
    this.startLevel(1, "start", false, true);
  }

  startPracticeLevel(levelNumber) {
    this.uiAudio.stopMusic();
    this.journeyScore = 0;
    this.journeyTime = 0;
    this.journeyLevelResults.clear();
    this.journeyFailureCounts = new Map([[1, 0], [2, 0], [3, 0]]);
    this.isScoredJourney = false;
    if (levelNumber === 1) void this.preloadStaticParkingImages();
    if (levelNumber === 2) void this.preloadStaticCrossingImage();
    if (levelNumber === 3) void this.preloadStaticExamImage();
    this.startLevel(levelNumber);
  }

  preloadStaticParkingImages() {
    if (this.staticParkingImagesPreload) return this.staticParkingImagesPreload;
    const src = "./assets/images/ui/level1-static-tutorial.webp";
    const image = new Image();
    image.decoding = "async";
    image.src = src;

    const ready = typeof image.decode === "function"
      ? image.decode()
      : new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          if (image.complete) image.naturalWidth ? resolve() : reject(new Error(src));
        });

    this.staticParkingImagesPreload = ready.then(() => {
      if (!image.naturalWidth) throw new Error("Tutorial art decoded without image dimensions.");
      this.staticParkingImagesReady = true;
      const poster = document.querySelector("#static-parking-art");
      if (poster) {
        poster.src = image.currentSrc || image.src;
        poster.hidden = false;
      }
      this.updateStaticParkingReady();
      if (this.isLevelIntroActive && this.currentLevelNumber === 1) this.renderLevelIntroStory();
      return true;
    }).catch((error) => {
      console.error("Unable to load Level 1 tutorial artwork.", error);
      this.staticParkingImageError = true;
      this.updateStaticParkingReady();
      if (this.isLevelIntroActive && this.currentLevelNumber === 1) this.renderLevelIntroStory();
      return false;
    });
    return this.staticParkingImagesPreload;
  }

  preloadStaticCrossingImage() {
    if (this.staticCrossingImagePreload) return this.staticCrossingImagePreload;
    const image = new Image();
    image.decoding = "async";
    image.src = "./assets/images/ui/level2-static-tutorial.webp";
    const ready = typeof image.decode === "function"
      ? image.decode()
      : new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          if (image.complete) image.naturalWidth ? resolve() : reject(new Error(image.src));
        });
    this.staticCrossingImagePreload = ready.then(() => {
      if (!image.naturalWidth) throw new Error("Level 2 poster decoded without dimensions");
      this.staticCrossingImageReady = true;
      const poster = document.querySelector("#static-crossing-art");
      if (poster) {
        poster.src = image.currentSrc || image.src;
        poster.hidden = false;
      }
      this.updateStaticCrossingReady();
      if (this.isLevelIntroActive && this.currentLevelNumber === 2) this.renderLevelIntroStory();
      return true;
    }).catch((error) => {
      console.error("Unable to load Level 2 tutorial poster.", error);
      this.staticCrossingImageError = true;
      this.updateStaticCrossingReady();
      if (this.isLevelIntroActive && this.currentLevelNumber === 2) this.renderLevelIntroStory();
      return false;
    });
    return this.staticCrossingImagePreload;
  }

  preloadStaticExamImage() {
    if (this.staticExamImagePreload) return this.staticExamImagePreload;
    const image = new Image();
    image.decoding = "async";
    image.src = "./assets/images/ui/level3-static-tutorial.webp";

    const ready = typeof image.decode === "function"
      ? image.decode()
      : new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          if (image.complete) image.naturalWidth ? resolve() : reject(new Error(image.src));
        });
    this.staticExamImagePreload = ready.then(() => {
      if (!image.naturalWidth) throw new Error("Level 3 tutorial poster has no image dimensions");
      this.staticExamImageReady = true;
      const poster = document.querySelector("#static-exam-art");
      if (poster) {
        poster.src = image.currentSrc || image.src;
        poster.hidden = false;
      }
      this.updateStaticExamReady();
      if (this.isLevelIntroActive && this.currentLevelNumber === 3) this.renderLevelIntroStory();
      return true;
    }).catch((error) => {
      console.error("Unable to load Level 3 tutorial poster.", error);
      this.staticExamImageError = true;
      this.updateStaticExamReady();
      if (this.isLevelIntroActive && this.currentLevelNumber === 3) this.renderLevelIntroStory();
      return false;
    });
    return this.staticExamImagePreload;
  }

  preloadLevelIntroArt(levelNumber) {
    const config = LEVEL_INTRO_CONFIG.get(levelNumber);
    if (!config?.art) return Promise.resolve(null);

    const existing = this.levelIntroArtPreloads.get(levelNumber);
    if (existing) return existing;

    const preload = new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Unable to load intro art for Level ${levelNumber}.`));
      image.src = config.art;
    })
      .then(async (image) => {
        // Decode off-screen so the visible <img> never paints progressively in
        // horizontal strips on slower LAMP connections.
        try {
          await image.decode();
        } catch {
          // A completed image is still usable even if decode() is unsupported
          // or the browser chooses not to expose the decode result.
        }
        return image;
      })
      .catch((error) => {
        this.levelIntroArtPreloads.delete(levelNumber);
        console.warn(`Intro art for Level ${levelNumber} could not be preloaded.`, error);
        return null;
      });

    this.levelIntroArtPreloads.set(levelNumber, preload);
    return preload;
  }

  async revealLevelIntroArt(levelNumber, config) {
    const request = ++this.levelIntroArtRequest;

    // Keep the real image hidden until its bytes are present and decoded. The
    // existing placeholder gives us a clean fallback instead of a striped load.
    this.levelIntroArt.hidden = true;
    this.levelIntroPlaceholder.hidden = false;
    this.levelIntroPlaceholderIcon.textContent = config.placeholderIcon ?? "";

    const image = await this.preloadLevelIntroArt(levelNumber);
    if (
      !image ||
      request !== this.levelIntroArtRequest ||
      !this.isLevelIntroActive ||
      this.levelIntroConfig !== config
    ) {
      return;
    }

    this.levelIntroArt.src = image.currentSrc || image.src;
    this.levelIntroArt.alt = config.artAlt ?? "";

    try {
      await this.levelIntroArt.decode();
    } catch {
      // If the resource is already complete, showing it is safe even when a
      // browser rejects decode() for implementation-specific reasons.
    }

    if (
      request !== this.levelIntroArtRequest ||
      !this.isLevelIntroActive ||
      this.levelIntroConfig !== config ||
      !this.levelIntroArt.complete ||
      this.levelIntroArt.naturalWidth === 0
    ) {
      return;
    }

    this.levelIntroArt.hidden = false;
    this.levelIntroPlaceholder.hidden = true;
  }

  showLevelIntro(levelNumber) {
    const config = LEVEL_INTRO_CONFIG.get(levelNumber);

    if (!config) {
      console.warn(`No intro configured for Level ${levelNumber}; skipping straight to load.`);
      return;
    }

    // Story controls need an ordinary visible cursor. This also prevents a
    // just-completed level from keeping pointer lock while its intro appears.
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock?.();
    }

    this.currentLevel?.audio?.stopMusic?.();
    this.uiAudio.startMusic("menu");
    this.uiAudio.setMusicEnabled(this.isMusicEnabled);
    this.uiAudio.setMuted(this.isSoundMuted);
    this.levelIntroConfig = config;
    if (levelNumber === 2) void this.preloadStaticCrossingImage();
    if (levelNumber === 3) void this.preloadStaticExamImage();
    this.isLevelIntroActive = true;
    this.isLevelIntroReady = false;
    this.levelIntroStoryIndex = 0;
    this.levelIntroElement.hidden = false;
    this.levelIntroElement.dataset.level = String(levelNumber);
    this.levelIntroElement.dataset.loadState = "loading";
    this.levelIntroStatus.textContent = `Loading Level ${levelNumber}...`;

    if (config.art) {
      void this.revealLevelIntroArt(levelNumber, config);
    } else {
      this.levelIntroArtRequest += 1;
      this.levelIntroArt.hidden = true;
      this.levelIntroPlaceholder.hidden = false;
      this.levelIntroPlaceholderIcon.textContent = config.placeholderIcon ?? "";
    }

    this.renderLevelIntroStory();
  }

  hideLevelIntro() {
    this.isLevelIntroActive = false;
    this.isLevelIntroReady = false;
    this.levelIntroArtRequest += 1;
    this.levelIntroElement.hidden = true;
  }

  setLevelIntroLoadState(state) {
    this.levelIntroElement.dataset.loadState = state;
    this.isLevelIntroReady = state === "ready";
    this.levelIntroStatus.textContent = state === "ready"
      ? `Level ${this.currentLevelNumber} ready`
      : `Level ${this.currentLevelNumber} could not be loaded`;
    this.renderLevelIntroStory();
  }

  renderLevelIntroStory() {
    const story = this.levelIntroConfig?.story ?? [];
    this.levelIntroDialogueCopy.textContent = story[this.levelIntroStoryIndex] ?? "";
    const isFinalBox = this.levelIntroStoryIndex === story.length - 1;
    const waitingForLevel = isFinalBox && (
      this.currentLevelNumber === 1 ? !this.staticParkingImagesReady :
      this.currentLevelNumber === 2 ? !this.staticCrossingImageReady :
      this.currentLevelNumber === 3 ? !this.staticExamImageReady :
      !this.isLevelIntroReady
    );

    this.levelIntroDialogueContinue.disabled = waitingForLevel;
    this.levelIntroDialogueContinue.firstChild.textContent = waitingForLevel
      ? ((this.currentLevelNumber === 1 && this.staticParkingImageError) ||
          (this.currentLevelNumber === 2 && this.staticCrossingImageError) ||
          (this.currentLevelNumber === 3 && this.staticExamImageError)
          ? "IMAGE ERROR " : "Loading... ")
      : "Continue ";
  }

  onLevelIntroClick(event) {
    if (!event.target.closest("#level-intro-dialogue-continue")) return;

    const story = this.levelIntroConfig?.story ?? [];
    if (this.levelIntroStoryIndex < story.length - 1) {
      this.levelIntroStoryIndex += 1;
      this.renderLevelIntroStory();
      return;
    }

    if (
      this.currentLevelNumber === 1 ? !this.staticParkingImagesReady :
      this.currentLevelNumber === 2 ? !this.staticCrossingImageReady :
      this.currentLevelNumber === 3 ? !this.staticExamImageReady :
      !this.isLevelIntroReady
    ) return;

    const nextLevel = (this.currentLevelNumber ?? 0) + 1;
    this.hideLevelIntro();
    if (nextLevel <= 3) void this.preloadLevelIntroArt(nextLevel);
    if (this.currentLevelNumber === 1) this.showStaticParkingTutorial();
    else if (this.currentLevelNumber === 2) this.showStaticCrossingTutorial();
    else if (this.currentLevelNumber === 3) this.showStaticExamTutorial();
    else this.showInstruction(this.currentLevel);
  }

  setCheckpoint(checkpoint) {
    this.currentCheckpoint = checkpoint;
  }

  restartCurrentLevel(keepFade = false, countAttempt = false) {
    if (this.currentLevelNumber !== null) {
      if (countAttempt && this.isScoredJourney) {
        this.recordFailedAttempt(this.currentLevelNumber);
      }
      this.startLevel(this.currentLevelNumber, this.currentCheckpoint, keepFade);
    }
  }

  recordFailedAttempt(levelNumber) {
    const previous = this.journeyFailureCounts.get(levelNumber) ?? 0;
    this.journeyFailureCounts.set(levelNumber, previous + 1);
  }

  completeLevel(message, performance = {}) {
    if (!this.currentLevelNumber || this.isTransitioning) return;

    const completedLevel = this.currentLevelNumber;
    const nextLevel = completedLevel + 1;
    const result = scoreLevel(completedLevel, {
      ...performance,
      failedAttempts: this.journeyFailureCounts.get(completedLevel) ?? 0
    });
    this.journeyLevelResults.set(completedLevel, result);
    this.journeyScore = [...this.journeyLevelResults.values()]
      .reduce((sum, levelResult) => sum + levelResult.total, 0);

    if (this.isScoredJourney) {
      const partialSummary = summariseJourney(
        [...this.journeyLevelResults.values()],
        this.journeyTime
      );
      this.personalBests = updatePersonalBests(this.personalBests, partialSummary);
      savePersonalBests(this.personalBests);
    }

    this.isTransitioning = true;
    this.setMessage(message);

    this.fadeTransition(() => {
      if (nextLevel <= 3) {
        this.showLevelIntro(nextLevel);
        requestAnimationFrame(() => requestAnimationFrame(() => this.startLevel(nextLevel, "start", true, true)));
      } else {
        this.showResults(true);
      }
    });
  }

  completeGameEasterEgg() {
    if (this.currentLevelNumber === null || this.isTransitioning) return;
    this.journeyScore = Math.max(this.journeyScore, 300);
    this.isTransitioning = true;
    this.setMessage("You escaped Wits!");
    this.fadeTransition(() => {
      this.showResults(true);
      this.journeyScore = 300;
      this.menuTitleElement.textContent = "SECRET ENDING";
      this.menuCopyElement.textContent = "You drove straight out of Wits instead of going to class. Technically, you can't be late if you never arrive.";
    });
  }

  playOneShotAudio(path, volume = 1, options = {}) {
    if (this.isSoundMuted) return;
    return this.uiAudio.playSample(path, { ...options, volume });
  }

  playTransitionSafeAudioSegment(path, options = {}) {
    if (this.isSoundMuted) return null;
    return this.uiAudio.playSegment(path, options);
  }

  preloadTransitionSafeAudio(paths) {
    return this.uiAudio.waitForPreload(paths);
  }

  // `failure` is a { title, reason, next } description from the level; a
  // plain sentence still works for older call sites.
  failLevel(failure) {
    if (this.currentLevelNumber === null || this.isTransitioning) return;

    if (this.isScoredJourney) {
      this.recordFailedAttempt(this.currentLevelNumber);
    }
    this.isTransitioning = true;
    this.setMessage(describeFailure(failure).title);
    this.fadeTransition(() => this.showFailure(failure));
  }

  // A respawn that does not end the run, such as Level 2 sending the player
  // back to a checkpoint. Play continues, so this only explains itself.
  reportSetback(failure) {
    if (this.currentLevelNumber === null) return;
    this.setbackBanner.show(failure, SETBACK_DISPLAY_TIME);
  }

  showFailure(failure) {
    document.exitPointerLock?.();
    const { title, reason, next } = describeFailure(failure);
    this.loadVersion += 1;
    this.disposeCurrentLevel();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.state = "failed";
    this.setbackBanner.hide();
    this.isLoading = false;
    this.isPaused = false;
    this.isTransitioning = false;
    this.levelNameElement.textContent = "Game Over";
    this.setHUD("");
    this.setMessage("");
    this.pauseMenuElement.hidden = true;
    this.hideInstruction();
    this.menuTitleElement.textContent = title;
    // The card says what went wrong and what Retry will do, rather than the
    // single line the message strip used to flash before the fade covered it.
    this.menuCopyElement.innerHTML = `
      <p class="failure-reason">${reason}</p>
      <p class="failure-next">${next}</p>
    `;
    this.menuPrimaryAction.textContent = "Retry";
    this.menuPrimaryAction.dataset.gameAction = "retry";
    this.menuCreditsAction.hidden = false;
    this.menuCreditsAction.textContent = "Back to menu";
    this.menuCreditsAction.dataset.gameAction = "menu";
    this.menuElement.classList.remove("menu-home", "menu-results");
    this.menuMusicAction.hidden = true;
    this.devLevelSelect.hidden = true;
    this.menuElement.hidden = false;
    requestAnimationFrame(() => this.fadeElement.classList.remove("visible"));
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
      const level = this.currentLevel;
      this.currentLevel = null;
      try {
        level.dispose();
      } catch (error) {
        console.error("Level cleanup failed:", error);
      }
    }

    this.scene.clear();
    this.renderer.renderLists.dispose();
  }

  pause() {
    if (this.isPaused || this.currentLevelNumber === null) {
      return;
    }

    this.isPaused = true;
    this.pauseMenuElement.hidden = false;
    this.pauseKickerElement.textContent = `LEVEL ${this.currentLevelNumber} PAUSED`;
    this.sensitivityControl.hidden = this.currentLevelNumber !== 3;
    // Releasing pointer lock is what returns the visible cursor immediately;
    // no Escape key or extra click should be required to use this menu.
    if (document.pointerLockElement === this.renderer.domElement) document.exitPointerLock?.();
    requestAnimationFrame(() => {
      this.pauseMenuElement.querySelector("[data-pause-action='resume']")?.focus();
    });
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

  setHUD(html, variant = "") {
    this.hudElement.innerHTML = html;
    if (variant) this.hudElement.dataset.variant = variant;
    else delete this.hudElement.dataset.variant;
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
    if (this.isLevelIntroActive || this.isTutorialActive) return;

    if (this.globalControls.wasPressed("pause")) {
      if (this.input.wasPressed("Escape")) this.pause();
      else this.togglePause();
      return;
    }

    // Same race as the menu buttons: a keypress mid-load would supersede the
    // load in flight and abandon it halfway through.
    if (import.meta.env.DEV && !this.isLoading) {
      if (this.globalControls.wasPressed("levelOne")) {
        this.startPracticeLevel(1);
      }

      if (this.globalControls.wasPressed("levelTwo")) {
        this.startPracticeLevel(2);
      }

      if (this.globalControls.wasPressed("levelThree")) {
        this.startPracticeLevel(3);
      }
    }

    if (this.globalControls.wasPressed("debugColliders")) {
      this.collisionDebug = !this.collisionDebug;
      this.currentLevel?.toggleCollisionDebug?.(this.collisionDebug);
      this.setMessage(`Collision debug ${this.collisionDebug ? "on" : "off"}.`);
    }

    if (this.input.isControlDown() && this.globalControls.wasPressed("restart")) {
      this.restartCurrentLevel(false, true);
    }
  }

  onMenuClick(event) {
    const action = event.target.closest("[data-game-action]")?.dataset.gameAction;

    // Starting a second load while one is in flight supersedes the first
    // midway through, which is what leaves the UI half-applied. The level
    // buttons sit on the home screen, so this is reachable by clicking fast.
    const startsLoad = action === "start" || action === "retry" || Boolean(action?.startsWith("level-"));
    if (startsLoad && this.isLoading) return;

    if (action === "start") {
      this.showCharacterSelect();
      return;
    }

    if (action === "retry") {
      this.restartCurrentLevel();
      return;
    }

    if (action === "credits") {
      this.homeMenuElement.hidden = true;
      this.showCredits();
      return;
    }

    if (action === "music") {
      this.setMusicEnabled(!this.isMusicEnabled);
      return;
    }

    if (action === "menu") {
      this.showMenu();
      return;
    }

    if (action === "end-screen") {
      // Sample results let the team inspect the full ending without a scored run.
      const samples = [
        { time: 48, condition: 90, containmentPercent: 98, alignmentErrorDegrees: 2 },
        { time: 35, impacts: 1, backwardSteps: 2 },
        { time: 52, incorrectAnswers: 1, suspicion: 15 }
      ];
      this.isScoredJourney = false;
      this.journeyLevelResults = new Map(samples.map((performance, index) =>
        [index + 1, scoreLevel(index + 1, performance)]));
      this.journeyTime = samples.reduce((total, performance) => total + performance.time, 0);
      this.showResults();
      return;
    }

    if (action === "settings") {
      this.graphicsSettings.open();
      return;
    }

    if (action?.startsWith("level-")) {
      this.startPracticeLevel(Number(action.at(-1)));
    }
  }

  updateMenuMusicAction() {
    this.menuMusicAction.textContent = this.isMusicEnabled ? "Pause music" : "Play music";
    this.menuMusicAction.setAttribute("aria-pressed", String(!this.isMusicEnabled));
  }

  showCredits() {
    this.menuTitleElement.textContent = "Credits";
    this.menuCopyElement.textContent = "Wits Commute Simulator — COMS3006A / COMS3025A. Built with Three.js by the project team.";
    this.menuPrimaryAction.textContent = "Back";
    this.menuCopyElement.innerHTML = CREDITS.map(({ heading, entries }) => `
      <section class="credits-section" aria-label="${heading}">
        <h2>${heading}</h2>
        ${entries.map(({ name, detail, url }) => `
          <article class="credit-entry">
            <h3>${url ? `<a href="${url}" target="_blank" rel="noreferrer">${name}</a>` : name}</h3>
            <p>${detail}</p>
          </article>
        `).join("")}
      </section>
    `).join("");
    this.menuElement.classList.add("menu-credits");
    this.menuCreditsAction.hidden = true;
    this.menuHomeAction.hidden = true;
    this.menuMusicAction.hidden = true;
    this.menuPrimaryAction.dataset.gameAction = "menu";
    this.menuElement.classList.remove("menu-home", "menu-results");
    this.devLevelSelect.hidden = true;
    this.menuElement.hidden = false;
    this.homeMenuElement.hidden = true;
  }

  updateStaticParkingReady() {
    const start = this.staticParkingStart ?? document.querySelector("#static-parking-start");
    const status = document.querySelector("#static-parking-status");
    const poster = document.querySelector("#static-parking-art");
    if (!start) return;

    const imageReady = this.staticParkingImagesReady && !!poster?.getAttribute("src");
    const levelReady = !this.isLoading && !!this.currentLevel && this.currentLevelNumber === 1 && this.levelOneGraphicsReady;
    start.disabled = !imageReady || !levelReady;
    start.textContent = imageReady && levelReady ? "START LEVEL" : "LOADING…";
    if (status) {
      status.hidden = imageReady;
      status.textContent = this.staticParkingImageError
        ? "Unable to load tutorial image. Refresh to retry."
        : "Preparing tutorial…";
    }
  }

  showStaticParkingTutorial() {
    this.staticParkingTutorial ??= document.querySelector("#static-parking-tutorial");
    this.staticParkingStart ??= document.querySelector("#static-parking-start");
    if (!this.staticParkingTutorial || !this.staticParkingStart) return;

    this.input.clearTransientState();
    document.exitPointerLock?.();
    this.isTutorialActive = true;
    this.instructionElement.hidden = true;
    this.staticParkingTutorial.hidden = false;

    void this.preloadStaticParkingImages();
    this.updateStaticParkingReady();

    if (!this.staticParkingStart.dataset.bound) {
      this.staticParkingStart.dataset.bound = "true";
      this.staticParkingStart.addEventListener("click", () => {
        if (this.staticParkingStart.disabled || this.isLoading ||
            !this.currentLevel || this.currentLevelNumber !== 1) return;
        this.hideInstruction();
        this.input.clearTransientState();
        this.uiAudio.stopMusic();
        this.input.requestPointerLock();
        this.clock.getDelta();
      });
    }
  }

  updateStaticCrossingReady() {
    const start = this.staticCrossingStart ?? document.querySelector("#static-crossing-start");
    const poster = document.querySelector("#static-crossing-art");
    const status = document.querySelector("#static-crossing-status");
    if (!start) return;
    const imageReady = this.staticCrossingImageReady && !!poster?.getAttribute("src");
    const levelReady = !this.isLoading && !!this.currentLevel && this.currentLevelNumber === 2;
    start.disabled = !imageReady || !levelReady;
    start.textContent = imageReady && levelReady ? "START LEVEL" : "LOADING…";
    if (status) {
      status.hidden = imageReady;
      status.textContent = this.staticCrossingImageError
        ? "Unable to load tutorial image. Refresh to retry."
        : "Preparing tutorial…";
    }
  }

  showStaticCrossingTutorial() {
    this.staticCrossingTutorial ??= document.querySelector("#static-crossing-tutorial");
    this.staticCrossingStart ??= document.querySelector("#static-crossing-start");
    if (!this.staticCrossingTutorial || !this.staticCrossingStart) return;
    this.input.clearTransientState();
    document.exitPointerLock?.();
    this.isTutorialActive = true;
    this.instructionElement.hidden = true;
    this.staticCrossingTutorial.hidden = false;
    void this.preloadStaticCrossingImage();
    this.updateStaticCrossingReady();
    if (!this.staticCrossingStart.dataset.bound) {
      this.staticCrossingStart.dataset.bound = "true";
      this.staticCrossingStart.addEventListener("click", () => {
        if (this.staticCrossingStart.disabled || this.isLoading ||
            !this.currentLevel || this.currentLevelNumber !== 2) return;
        this.hideInstruction();
        this.input.clearTransientState();
        this.uiAudio.stopMusic();
        this.input.requestPointerLock();
        this.clock.getDelta();
      });
    }
  }

  updateStaticExamReady() {
    const start = this.staticExamStart ?? document.querySelector("#static-exam-start");
    const poster = document.querySelector("#static-exam-art");
    const status = document.querySelector("#static-exam-status");
    if (!start) return;
    const imageReady = this.staticExamImageReady && !!poster?.getAttribute("src");
    const levelReady = !this.isLoading && !!this.currentLevel && this.currentLevelNumber === 3;
    start.disabled = !imageReady || !levelReady;
    start.textContent = imageReady && levelReady ? "START LEVEL" : "LOADING…";
    if (status) {
      status.hidden = imageReady && levelReady;
      status.textContent = this.staticExamImageError
        ? "Unable to load tutorial artwork. Refresh to retry."
        : "Preparing Level 3…";
    }
  }

  showStaticExamTutorial() {
    this.staticExamTutorial ??= document.querySelector("#static-exam-tutorial");
    this.staticExamStart ??= document.querySelector("#static-exam-start");
    if (!this.staticExamTutorial || !this.staticExamStart) return;

    this.input.clearTransientState();
    document.exitPointerLock?.();
    this.isTutorialActive = true;
    this.instructionElement.hidden = true;
    this.staticExamTutorial.hidden = false;
    void this.preloadStaticExamImage();
    this.updateStaticExamReady();

    if (!this.staticExamStart.dataset.bound) {
      this.staticExamStart.dataset.bound = "true";
      this.staticExamStart.addEventListener("click", () => {
        if (this.staticExamStart.disabled || this.isLoading ||
            !this.currentLevel || this.currentLevelNumber !== 3) return;
        this.hideInstruction();
        this.input.clearTransientState();
        this.uiAudio.stopMusic();
        this.input.requestPointerLock();
        this.clock.getDelta();
      });
    }
  }

  showInstruction(level) {
    if (this.currentLevelNumber === 1) {
      this.showStaticParkingTutorial();
      return;
    }
    if (this.currentLevelNumber === 2) {
      this.showStaticCrossingTutorial();
      return;
    }
    if (this.currentLevelNumber === 3) {
      this.showStaticExamTutorial();
      return;
    }
    const config = LEVEL_TUTORIAL_CONFIG.get(this.currentLevelNumber);
    if (!config || !level) return;
    document.exitPointerLock?.();
    this.input.clearTransientState();
    this.isTutorialActive = true;
    this.instructionElement.dataset.level = String(this.currentLevelNumber);
    this.instructionKicker.textContent = config.kicker;
    this.instructionTitle.textContent = config.title;
    this.instructionObjective.textContent = config.objective;
    this.instructionControls.innerHTML = config.controls.map(([keys, action], index) => `<li data-control-index="${index}"><kbd>${keys}</kbd><span>${action}</span></li>`).join("");
    this.instructionTip.textContent = config.tip;
    this.instructionPreviewLabel.textContent = config.previewLabel;
    this.instructionElement.hidden = false;
    this.currentLevel?.beginTutorial?.();
    this.resetTutorialDemo();
    this.configureTutorialDemo();
    this.captureTutorialPreview();
    requestAnimationFrame(() => this.instructionStart?.focus());
  }

  captureTutorialPreview() {
    requestAnimationFrame(() => this.syncTutorialPreviewFrame());
  }

  syncTutorialPreviewFrame() {
    const preview = this.instructionPreview, source = this.renderer.domElement;
    if ([1, 2, 3].includes(this.currentLevelNumber) || !this.isTutorialActive || !preview || !source || !this.currentLevel) return;
    const now = performance.now();
    if (now - (this.lastTutorialPreview ?? 0) < 1000 / 30) return;
    this.lastTutorialPreview = now;
    const ctx = preview.getContext("2d");
    if (!ctx) return;
    const sw = source.width, sh = source.height, dw = preview.width, dh = preview.height;
    const srcRatio = sw / sh, dstRatio = dw / dh;
    let sx = 0, sy = 0, cw = sw, ch = sh;
    if (srcRatio > dstRatio) {
      cw = sh * dstRatio;
      sx = (sw - cw) / 2;
    } else {
      ch = sw / dstRatio;
      sy = (sh - ch) / 2;
    }
    ctx.drawImage(source, sx, sy, cw, ch, 0, 0, dw, dh);
  }

  configureTutorialDemo() {
    const level = this.currentLevelNumber;
    this.instructionDemo.dataset.level = String(level);
    this.instructionDemoMarker.textContent = level === 1 ? "CAR" : level === 2 ? "YOU" : "+";
    this.instructionDemoStatus.textContent = level === 1
      ? "DRIVE THE ACTUAL CAR • PRESS C"
      : level === 2
        ? "MOVE THE ACTUAL PLAYER • PRESS C"
        : "MOVE MOUSE OVER PREVIEW • HOLD LEFT CLICK • TYPE";
    this.instructionDemo.classList.toggle("is-level3", level === 3);
    this.instructionDemoMarker.style.transform = "";
  }

  setTutorialDemoStatus(text) {
    this.instructionDemoStatus.textContent = text;
    this.instructionDemoStatus.classList.remove("is-pulse");
    void this.instructionDemoStatus.offsetWidth;
    this.instructionDemoStatus.classList.add("is-pulse");
  }

  moveTutorialDemo(code) {
    const p = this.tutorialDemoPosition;
    if (code === "KeyW" || code === "ArrowUp") p.y -= 9;
    if (code === "KeyS" || code === "ArrowDown") p.y += 9;
    if (code === "KeyA" || code === "ArrowLeft") p.x -= 9;
    if (code === "KeyD" || code === "ArrowRight") p.x += 9;
    p.x = THREE.MathUtils.clamp(p.x, -70, 70);
    p.y = THREE.MathUtils.clamp(p.y, -42, 42);
    this.instructionDemoMarker.style.transform = `translate(${p.x}px, ${p.y}px)`;
  }

  tutorialControlIndex(code) {
    if (this.currentLevelNumber === 1) {
      if (code === "KeyW" || code === "ArrowUp") return 0;
      if (code === "KeyS" || code === "ArrowDown") return 1;
      if (["KeyA", "KeyD", "ArrowLeft", "ArrowRight"].includes(code)) return 2;
      if (code === "KeyC") return 3;
    }
    if (this.currentLevelNumber === 2) {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(code)) return 0;
      if (code === "KeyC") return 1;
      if (code === "KeyP") return 2;
    }
    if (this.currentLevelNumber === 3) {
      if (code === "KeyP") return 3;
      if (code === "Enter" || /^Key[A-Z]$/.test(code)) return 2;
    }
    return -1;
  }

  setTutorialControlActive(index, active) {
    if (index < 0) return;
    this.instructionControls.querySelector(`[data-control-index="${index}"]`)?.classList.toggle("is-active", active);
  }

  applyTutorialDemoMotion() {
    const preview = this.instructionPreview;
    if (!preview) return;
    if (this.currentLevelNumber === 3) {
      const scale = this.tutorialPeekDemo ? 1.1 : 1.025;
      preview.style.transform = `translate(${this.tutorialLook.x}px, ${this.tutorialLook.y}px) scale(${scale})`;
      preview.style.filter = this.tutorialPeekDemo ? "contrast(1.1) saturate(1.12)" : "";
      this.instructionDemoMarker.style.transform = `translate(${-this.tutorialLook.x * 2}px, ${-this.tutorialLook.y * 2}px)`;
      this.instructionDemo.classList.toggle("is-peeking", this.tutorialPeekDemo);
      return;
    }

    const x = this.tutorialDemoPosition.x * .14;
    const y = this.tutorialDemoPosition.y * .12;
    const rotation = this.tutorialDemoPosition.x * .012;
    const scale = (this.tutorialCameraDemo ? 1.065 : 1) + (this.tutorialDemoPosition.y < 0 ? .012 : 0);
    preview.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
    preview.style.filter = this.tutorialCameraDemo ? "contrast(1.06) saturate(1.08)" : "";
    preview.closest(".tutorial-preview-frame")?.classList.toggle("is-camera-demo", this.tutorialCameraDemo);
  }

  onTutorialDemoKeyDown(event) {
    // The old live tutorial is hidden while any static poster is displayed.
    // Do not steal Enter/Space key activation from the real Start button.
    if (!this.isTutorialActive || this.instructionElement.hidden) return;
    const index = this.tutorialControlIndex(event.code);
    if (index < 0) return;
    event.preventDefault();
    this.setTutorialControlActive(index, true);

    if (this.currentLevelNumber === 1 || this.currentLevelNumber === 2) {
      const action = event.code === "KeyW" || event.code === "ArrowUp" ? (this.currentLevelNumber === 1 ? "ACCELERATE" : "WALK FORWARD")
        : event.code === "KeyS" || event.code === "ArrowDown" ? (this.currentLevelNumber === 1 ? "BRAKE / REVERSE" : "WALK BACK")
        : event.code === "KeyA" || event.code === "ArrowLeft" ? (this.currentLevelNumber === 1 ? "STEER LEFT" : "WALK LEFT")
        : event.code === "KeyD" || event.code === "ArrowRight" ? (this.currentLevelNumber === 1 ? "STEER RIGHT" : "WALK RIGHT")
        : event.code === "KeyC" ? "CAMERA VIEW"
        : "PAUSE / SETTINGS";
      this.setTutorialDemoStatus(action);
      if (event.code === "KeyP") event.stopImmediatePropagation();
      return;
    }

    if (event.code === "KeyP") {
      this.setTutorialDemoStatus("PAUSE / SETTINGS");
      event.stopImmediatePropagation();
      return;
    }

    if (this.currentLevelNumber === 3 && index === 2) {
      const label = event.code === "Enter" ? "ENTER" : event.code.replace("Key", "");
      this.setTutorialDemoStatus(`TYPING: ${label}`);
      this.instructionPreview.classList.remove("is-typing-demo");
      void this.instructionPreview.offsetWidth;
      this.instructionPreview.classList.add("is-typing-demo");
      window.clearTimeout(this.tutorialTypingTimer);
      this.tutorialTypingTimer = window.setTimeout(() => {
        this.instructionPreview.classList.remove("is-typing-demo");
        this.setTutorialControlActive(2, false);
      }, 180);
    }
  }

  onTutorialDemoKeyUp(event) {
    if (!this.isTutorialActive || this.instructionElement.hidden) return;
    const index = this.tutorialControlIndex(event.code);
    if (index < 0) return;
    event.preventDefault();

    if (this.currentLevelNumber === 1 || this.currentLevelNumber === 2) {
      this.setTutorialControlActive(index, false);
      return;
    }

    if (this.currentLevelNumber === 3 && event.code === "KeyP") {
      this.setTutorialControlActive(index, false);
      event.stopImmediatePropagation();
      return;
    }
    this.tutorialDemoKeys.delete(event.code);
    if (event.code !== "KeyC") this.setTutorialControlActive(index, false);
    this.applyTutorialDemoMotion();
  }

  onTutorialDemoPointerMove(event) {
    if (!this.isTutorialActive || this.currentLevelNumber !== 3) return;
    this.currentLevel?.moveTutorialLook?.(event.movementX, event.movementY);
    this.setTutorialControlActive(0, true);
    this.setTutorialDemoStatus("LOOK AROUND");
  }

  onTutorialDemoPointerDown(event) {
    if (!this.isTutorialActive || this.currentLevelNumber !== 3 || event.button !== 0) return;
    event.preventDefault();
    this.instructionPreview.setPointerCapture?.(event.pointerId);
    this.currentLevel?.setTutorialMouseDown?.(true);
    this.setTutorialControlActive(1, true);
    this.setTutorialDemoStatus("PEEKING — HOLD LEFT CLICK");
  }

  onTutorialDemoPointerUp(event) {
    if (!this.isTutorialActive || this.currentLevelNumber !== 3) return;
    this.currentLevel?.setTutorialMouseDown?.(false);
    this.instructionPreview.releasePointerCapture?.(event?.pointerId);
    this.setTutorialControlActive(1, false);
    this.setTutorialControlActive(0, false);
    this.setTutorialDemoStatus("MOVE MOUSE OVER PREVIEW • HOLD LEFT CLICK • TYPE");
  }

  resetTutorialDemo() {
    this.tutorialDemoKeys.clear();
    this.tutorialCameraDemo = false;
    this.tutorialPeekDemo = false;
    this.tutorialLook.x = 0;
    this.tutorialLook.y = 0;
    this.tutorialDemoPosition.x = 0;
    this.tutorialDemoPosition.y = 0;
    window.clearTimeout(this.tutorialTypingTimer);
    this.tutorialTypingTimer = null;
    if (this.instructionPreview) {
      this.instructionPreview.style.transform = "";
      this.instructionPreview.style.filter = "";
      this.instructionPreview.classList.remove("is-typing-demo");
      this.instructionPreview.closest(".tutorial-preview-frame")?.classList.remove("is-camera-demo");
    }
    if (this.instructionDemo) {
      this.instructionDemo.classList.remove("is-peeking");
      this.instructionDemoMarker.style.transform = "";
      this.instructionDemoStatus.classList.remove("is-pulse");
    }
    this.instructionControls?.querySelectorAll(".is-active").forEach((element) => element.classList.remove("is-active"));
  }

  hideInstruction() {
    this.currentLevel?.endTutorial?.();
    this.isTutorialActive = false;
    this.resetTutorialDemo();
    this.instructionElement.hidden = true;
    if (this.staticParkingTutorial) this.staticParkingTutorial.hidden = true;
    if (this.staticCrossingTutorial) this.staticCrossingTutorial.hidden = true;
    if (this.staticExamTutorial) this.staticExamTutorial.hidden = true;
  }

  onInstructionClick(event) {
    if (!event.target.closest("[data-instruction-action='dismiss']")) return;
    this.hideInstruction();
    this.input.clearTransientState();
    // Story/menu music ends when gameplay begins. Levels use environmental
    // and contextual sound rather than a continuous soundtrack.
    this.uiAudio.stopMusic();
    this.input.requestPointerLock();
    this.clock.getDelta();
  }

  onPauseMenuClick(event) {
    if (event.target.closest("[data-pause-action='resume']")) {
      this.resume();
      if (this.currentLevelNumber === 3) this.input.requestPointerLock();
      return;
    }

    if (event.target.closest("[data-pause-action='restart']")) {
      this.pauseMenuElement.hidden = true;
      this.isPaused = false;
      this.restartCurrentLevel(false, true);
      return;
    }

    if (event.target.closest("[data-pause-action='home']")) {
      this.showMenu();
      return;
    }


    if (event.target.closest("[data-pause-action='settings']")) {
      this.graphicsSettings.open();
    }
  }

  setMusicEnabled(enabled) {
    this.isMusicEnabled = enabled;
    this.uiAudio.setMusicEnabled(enabled);
    this.currentLevel?.audio?.setMusicEnabled?.(enabled);
    this.updateMenuMusicAction();
  }

  setSoundMuted(muted) {
    this.isSoundMuted = muted;
    this.uiAudio.setMuted(muted);
    this.currentLevel?.audio?.setMuted?.(muted);
    this.currentLevel?.setMuted?.(muted);
  }

  onLookSensitivityInput(event) {
    this.levelThreeLookSensitivity = Number(event.target.value);
    this.lookSensitivityValue.value = `${this.levelThreeLookSensitivity.toFixed(1)}x`;
    this.lookSensitivityValue.textContent = `${this.levelThreeLookSensitivity.toFixed(1)}x`;
  }

  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate);
    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    this.updateFps(rawDt);

    this.update(dt);
    // Wrapped around render() rather than inside it, so the level 3 composer
    // path is timed on the same terms as the direct one.
    this.gpuTimer?.begin();
    this.render();
    this.advanceLevelOneWarmup();
    this.syncTutorialPreviewFrame();
    this.gpuTimer?.end();
    this.gpuTimer?.poll();
    this.input.endFrame();
  }

  // A loaded scene is not necessarily ready to draw: the first real frames also
  // compile GPU programs, upload textures and initialise shadow/render targets.
  // Warm those paths underneath the intro/tutorial without advancing gameplay.
  advanceLevelOneWarmup() {
    if (this.currentLevelNumber !== 1 || this.isLoading ||
        !this.currentLevel || this.levelOneGraphicsReady) return;

    this.levelOneWarmupFrames += 1;
    if (this.levelOneWarmupFrames < 3) return;

    this.levelOneGraphicsReady = true;
    if (this.isLevelIntroActive) this.setLevelIntroLoadState("ready");
    this.updateStaticParkingReady();
  }

  updateFps(rawDt) {
    // Ignore a background-tab pause rather than briefly reporting 1 FPS when
    // the page becomes active again. Updating twice a second avoids a DOM
    // write on every frame.
    if (rawDt > 0.5) {
      this.fpsFrames = 0;
      this.fpsElapsed = 0;
      return;
    }

    this.fpsFrames += 1;
    this.fpsElapsed += rawDt;
    if (this.fpsElapsed < 0.5) return;

    this.fpsElement.textContent = `FPS: ${Math.round(this.fpsFrames / this.fpsElapsed)}`;
    this.fpsFrames = 0;
    this.fpsElapsed = 0;
  }

  update(dt) {
    this.updateGlobalControls();

    if (this.isTutorialActive) {
      if (![1, 2, 3].includes(this.currentLevelNumber)) this.currentLevel?.updateTutorial?.(dt);
      return;
    }

    if (
      !this.isPaused &&
      !this.isLoading &&
      !this.isTransitioning &&
      !this.isLevelIntroActive &&
      !this.isTutorialActive &&
      this.currentLevel
    ) {
      this.journeyTime += dt;
      this.currentLevel.update(dt);
    }
  }

  render(){
    if (this.isLoading) return;
    // Level 1 must exercise its full rendering path before Start becomes
    // clickable. Its simulation is still paused by update() above.
    if (this.isTutorialActive &&
        (this.currentLevelNumber !== 1 || !this.currentLevel)) return;

    const effectsEnabled = this.graphicsSettings.effectsEnabled;
    const drawingBufferSize = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.fxaaResolution.set(
      1 / Math.max(drawingBufferSize.x, 1),
      1 / Math.max(drawingBufferSize.y, 1)
    );
    this.roadFogToonPass.uniforms.uResolution.value.copy(drawingBufferSize);
    this.suspicionToonPass.uniforms.uResolution.value.copy(drawingBufferSize);
    this.toonPass.uniforms.uResolution.value.copy(drawingBufferSize);
    [this.roadFogFxaaPass, this.suspicionFxaaPass, this.toonFxaaPass].forEach((pass) => {
      pass.enabled = this.graphicsSettings.settings.antialiasing !== "off";
      pass.uniforms.resolution.value.copy(this.fxaaResolution);
    });
    const level1Fog=effectsEnabled&&this.currentLevelNumber===1&&this.currentLevel&&!this.currentLevel.skyViewActive;
    if((level1Fog||(effectsEnabled&&this.currentLevelNumber===2))&&this.currentLevel){
      this.roadFogRenderPass.scene=this.scene;
      this.roadFogRenderPass.camera=this.camera;
      const u=this.roadFogPass.uniforms;
      u.tDepth.value=this.roadFogComposer.readBuffer.depthTexture;
      u.uProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
      u.uCameraMatrixWorld.value.copy(this.camera.matrixWorld);
      u.uTime.value=this.clock.elapsedTime;
      if(level1Fog){
        const fog=this.currentLevel.roadFogConfig??{};
        const distanceScale = this.graphicsSettings.viewDistanceScale;
        u.uRadialMode.value=1;
        u.uFogCenterX.value=0;
        u.uFogCenterZ.value=-8;
        u.uFogStart.value=(fog.fogStart??82)*distanceScale;
        u.uFogEnd.value=(fog.fogEnd??130)*distanceScale;
        u.uDensity.value=fog.density??0.9;
      }else{
        u.uRadialMode.value=0;
        u.uFogCenterX.value=0;
        u.uFogStart.value=24;
        u.uFogEnd.value=58;
        u.uRearFogStart.value=38;
        u.uRearFogEnd.value=56;
        u.uDensity.value=1.5;
      }
      this.roadFogComposer.render();
      this.currentLevel.renderOverlay?.(this.renderer);
      return;
    }

    if(effectsEnabled&&this.currentLevelNumber===3&&this.currentLevel){
      this.suspicionRenderPass.scene=this.scene;
      this.suspicionRenderPass.camera=this.camera;
      this.suspicionPass.uniforms.uSuspicion.value=THREE.MathUtils.clamp((this.currentLevel.suspicion??0)/100,0,1);
      this.suspicionComposer.render();
      this.currentLevel.renderOverlay?.(this.renderer);
      return;
    }

    if (effectsEnabled && this.currentLevel) {
      this.toonRenderPass.scene = this.scene;
      this.toonRenderPass.camera = this.camera;
      this.toonComposer.render();
      return;
    }

    this.renderer.render(this.scene,this.camera);
    this.currentLevel?.renderOverlay?.(this.renderer);
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
    this.graphicsSettings?.apply();
    this.roadFogComposer.setSize(width, height);
    this.suspicionComposer.setSize(width, height);
    this.toonComposer.setSize(width, height);
  }
}
