import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { InputManager } from "./InputManager.js";
import { applyRendererBaseline } from "./renderSettings.js";
import { createGpuTimer } from "./gpuTimer.js";
import { SetbackBanner, describeFailure } from "./FailureReport.js";
import { RoadFogShader } from "../shaders/roadFogShader.js";
import { ParkingLevel } from "../levels/ParkingLevel.js";
import { CrossingLevel } from "../levels/crossing/CrossingLevel.js";
import { CheatingLevel } from "../levels/CheatingLevel.js";
import { SuspicionShader } from "../shaders/suspicionShader.js";
import { CREDITS } from "../shared/creditsRegistry.js";
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
        "If I miss this exam, I’m cooked...\nAlan Turing, if you can hear me… findParking() better return true."
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
    this.levelIntroStoryIndex = 0;
    this.levelIntroConfig = null;
    this.loadVersion = 0;
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
    this.pauseMenuElement = document.querySelector("#pause-menu");
    this.pauseKickerElement = document.querySelector("#pause-kicker");
    this.pauseSoundAction = document.querySelector("[data-pause-action='sound']");
    this.lookSensitivityInput = document.querySelector("#look-sensitivity");
    this.lookSensitivityValue = document.querySelector("#look-sensitivity-value");
    this.sensitivityControl = document.querySelector("#sensitivity-control");
    this.instructionElement = document.querySelector("#instruction-card");
    this.instructionTitle = document.querySelector("#instruction-title");
    this.instructionCopy = document.querySelector("#instruction-copy");
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
    this.onLevelIntroClick = this.onLevelIntroClick.bind(this);

    window.addEventListener("resize", this.onResize);
    this.menuElement.addEventListener("click", this.onMenuClick);
    this.pauseMenuElement.addEventListener("click", this.onPauseMenuClick);
    this.lookSensitivityInput.addEventListener("input", this.onLookSensitivityInput);
    this.instructionElement.addEventListener("click", this.onInstructionClick);
    this.levelIntroElement.addEventListener("click", this.onLevelIntroClick);
    this.devLevelSelect.hidden = !import.meta.env.DEV;
  
  
    
    const roadFogTarget=new THREE.WebGLRenderTarget(window.innerWidth,window.innerHeight);
    roadFogTarget.depthTexture=new THREE.DepthTexture(window.innerWidth,window.innerHeight,THREE.UnsignedIntType);

    this.roadFogComposer=new EffectComposer(this.renderer,roadFogTarget);
    this.roadFogRenderPass=new RenderPass(this.scene,this.camera);
    this.roadFogPass=new ShaderPass(RoadFogShader);
    this.roadFogOutputPass=new OutputPass();

    this.roadFogComposer.addPass(this.roadFogRenderPass);
    this.roadFogComposer.addPass(this.roadFogPass);
    this.roadFogComposer.addPass(this.roadFogOutputPass);
  }

  start() {
    this.showMenu();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  showMenu() {
    this.cancelTransition();
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

    const menu = this.menuTitleElement.closest(".menu, .main-menu, body");
    if (menu) {
      menu.style.backgroundImage =
        'url("/assets/images/ui/main-menu-background.png")';
      menu.style.backgroundSize = "100% auto";
      menu.style.backgroundPosition = "center";
      menu.style.backgroundColor = "#8bc0f2";
      menu.style.minHeight = "100vh";
    }
    this.menuCopyElement.textContent = "Park. Cross. Cheat.";
    this.menuPrimaryAction.textContent = "Start journey";
    this.menuPrimaryAction.classList.add("pixel-menu-button");
    this.menuCreditsAction.hidden = false;
    this.menuElement.classList.remove("menu-credits");
    this.menuPrimaryAction.dataset.gameAction = "start";
    this.menuElement.classList.add("menu-home");
    this.devLevelSelect.hidden = false;
    this.pauseMenuElement.hidden = true;
    this.instructionElement.hidden = true;
    this.menuElement.hidden = false;
    document.body.classList.remove("level-2");
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
    this.menuElement.classList.remove("menu-home");
    this.devLevelSelect.hidden = true;
    this.pauseMenuElement.hidden = true;
    this.instructionElement.hidden = true;
    this.menuElement.hidden = false;
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
    this.menuElement.hidden = true;
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
    level.audio?.setMuted?.(this.isSoundMuted);
    level.setMuted?.(this.isSoundMuted);
    this.isLoading = false;
    if (showIntro) this.setLevelIntroLoadState("ready");
    if (keepFade) requestAnimationFrame(() => this.fadeElement.classList.remove("visible"));

    if (this.currentMessage === loadingMessage) {
      this.setMessage("");
    }
  }

  startJourney() {
    this.journeyScore = 0;
    this.journeyTime = 0;
    this.journeyLevelResults.clear();
    this.journeyFailureCounts = new Map([[1, 0], [2, 0], [3, 0]]);
    this.isScoredJourney = true;
    this.showLevelIntro(1);
    this.startLevel(1, "start", false, true);
  }

  startPracticeLevel(levelNumber) {
    this.journeyScore = 0;
    this.journeyTime = 0;
    this.journeyLevelResults.clear();
    this.journeyFailureCounts = new Map([[1, 0], [2, 0], [3, 0]]);
    this.isScoredJourney = false;
    this.startLevel(levelNumber);
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

    this.levelIntroConfig = config;
    this.isLevelIntroActive = true;
    this.isLevelIntroReady = false;
    this.levelIntroStoryIndex = 0;
    this.levelIntroElement.hidden = false;
    this.levelIntroElement.dataset.level = String(levelNumber);
    this.levelIntroElement.dataset.loadState = "loading";
    this.levelIntroStatus.textContent = `Loading Level ${levelNumber}...`;

    if (config.art) {
      this.levelIntroArt.src = config.art;
      this.levelIntroArt.alt = config.artAlt ?? "";
      this.levelIntroArt.hidden = false;
      this.levelIntroPlaceholder.hidden = true;
    } else {
      this.levelIntroArt.hidden = true;
      this.levelIntroPlaceholder.hidden = false;
      this.levelIntroPlaceholderIcon.textContent = config.placeholderIcon ?? "";
    }

    this.renderLevelIntroStory();
  }

  hideLevelIntro() {
    this.isLevelIntroActive = false;
    this.isLevelIntroReady = false;
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
    const waitingForLevel = isFinalBox && !this.isLevelIntroReady;

    this.levelIntroDialogueContinue.disabled = waitingForLevel;
    this.levelIntroDialogueContinue.firstChild.textContent = waitingForLevel
      ? "Loading... "
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

    if (!this.isLevelIntroReady) return;

    this.hideLevelIntro();
    // The Continue click is a user gesture, so it can immediately return
    // focus and mouse control to the loaded level without a second click.
    this.input.requestPointerLock();
    this.clock.getDelta();
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

    if (completedLevel === 1) {
      // ParkingLevel is disposed before the Level 2 intro appears, so this
      // completion cue is owned by the game rather than the parking level.
      // It fires immediately when the parking confirmation reaches 100%.
      this.playOneShotAudio(
        "./assets/audio/level1/car-door-shut.mp3",
        0.4875
      );
    }

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

  playOneShotAudio(path, volume = 1) {
    if (this.isSoundMuted) return;
    const audio = new Audio(path);
    audio.volume = volume;
    audio.play().catch(() => {
      // Browsers can block this if the game's initial click did not count as
      // a user activation. The level transition remains usable in that case.
    });
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
    this.instructionElement.hidden = true;
    this.menuTitleElement.textContent = title;
    // The card says what went wrong and what Retry will do, rather than the
    // single line the message strip used to flash before the fade covered it.
    this.menuCopyElement.innerHTML = `
      <p class="failure-reason">${reason}</p>
      <p class="failure-next">${next}</p>
    `;
    this.menuPrimaryAction.textContent = "Retry";
    this.menuPrimaryAction.dataset.gameAction = "retry";
    this.menuElement.classList.remove("menu-home");
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
    this.pauseMenuElement.hidden = false;
    this.pauseKickerElement.textContent = `LEVEL ${this.currentLevelNumber} PAUSED`;
    this.sensitivityControl.hidden = this.currentLevelNumber !== 3;
    this.pauseSoundAction.textContent = this.isSoundMuted ? "Sound: off" : "Sound: on";
    this.pauseSoundAction.setAttribute("aria-pressed", String(this.isSoundMuted));
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
    if (this.isLevelIntroActive) return;

    if (this.globalControls.wasPressed("pause")) {
      this.togglePause();
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
      this.startJourney();
      return;
    }

    if (action === "retry") {
      this.restartCurrentLevel();
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
      this.startPracticeLevel(Number(action.at(-1)));
    }
  }

  showCredits() {
    this.menuTitleElement.textContent = "Credits";
    this.menuCopyElement.textContent = "Wits Commute Simulator — COMS3006A / COMS3025A. Built with Three.js by the project team.";
    this.menuPrimaryAction.textContent = "Back to menu";
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
    this.menuPrimaryAction.dataset.gameAction = "menu";
    this.menuElement.classList.remove("menu-home");
    this.devLevelSelect.hidden = true;
    this.menuElement.hidden = false;
  }

  showInstruction(level) {
    const briefs = {
      1: "Drive with W/S and steer with A/D. Avoid potholes, then stop straight inside the cyan bay.",
      //2: "Tap WASD or the arrow keys to step, or hold to keep walking. Collect Vida cups for power-ups, wait for gaps in the traffic, and reach Engineering.",
      2: "Tap WASD or the arrow keys to step, or hold to keep walking. Collect every Vida cup and reach Engineering in under 30 seconds. Flat Whites reduce your recorded time.",
      3: "Click for mouse-look. Hold left click to zoom and reveal a surrounding tablet's answer. Release, look down at your own desk, type your answer, and press Enter. P opens settings."
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

    if (event.target.closest("[data-pause-action='sound']")) {
      this.setSoundMuted(!this.isSoundMuted);
    }
  }

  setSoundMuted(muted) {
    this.isSoundMuted = muted;
    this.currentLevel?.audio?.setMuted?.(muted);
    this.currentLevel?.setMuted?.(muted);
    this.pauseSoundAction.textContent = muted ? "Sound: off" : "Sound: on";
    this.pauseSoundAction.setAttribute("aria-pressed", String(muted));
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
    this.gpuTimer?.end();
    this.gpuTimer?.poll();
    this.input.endFrame();
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

    if (
      !this.isPaused &&
      !this.isLoading &&
      !this.isTransitioning &&
      !this.isLevelIntroActive &&
      this.currentLevel
    ) {
      this.journeyTime += dt;
      this.currentLevel.update(dt);
    }
  }

  render(){
    if(this.isLoading)return;

    const level1Fog=this.currentLevelNumber===1&&this.currentLevel&&!this.currentLevel.skyViewActive;
    if((level1Fog||this.currentLevelNumber===2)&&this.currentLevel){
      this.roadFogRenderPass.scene=this.scene;
      this.roadFogRenderPass.camera=this.camera;
      const u=this.roadFogPass.uniforms;
      u.tDepth.value=this.roadFogComposer.readBuffer.depthTexture;
      u.uProjectionMatrixInverse.value.copy(this.camera.projectionMatrixInverse);
      u.uCameraMatrixWorld.value.copy(this.camera.matrixWorld);
      u.uTime.value=this.clock.elapsedTime;
      if(level1Fog){
        const fog=this.currentLevel.roadFogConfig??{};
        u.uRadialMode.value=1;
        u.uFogCenterX.value=0;
        u.uFogCenterZ.value=-8;
        u.uFogStart.value=fog.fogStart??82;
        u.uFogEnd.value=fog.fogEnd??130;
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
      return;
    }

    if(this.currentLevelNumber===3&&this.currentLevel){
      this.suspicionRenderPass.scene=this.scene;
      this.suspicionRenderPass.camera=this.camera;
      this.suspicionPass.uniforms.uSuspicion.value=THREE.MathUtils.clamp((this.currentLevel.suspicion??0)/100,0,1);
      this.suspicionComposer.render();
      return;
    }

    this.renderer.render(this.scene,this.camera);
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
    this.roadFogComposer.setSize(width, height);
    this.suspicionComposer.setSize(width, height);
  }
}
