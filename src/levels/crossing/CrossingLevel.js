import * as THREE from "three";
import { disposeObject3D } from "../../shared/disposeObject3D.js";
import { CollisionWorld } from "../../shared/CollisionWorld.js";
import { GridHopController } from "./GridHopController.js";
import { LevelAudio } from "../../shared/LevelAudio.js";
import { createWitsTerrain } from "./WitsTerrain.js";
import { CrossingStrip, createAmicDeckMaterial } from "./CrossingStrip.js";
import { createRoadMaterial, createRoadTextures } from "../../shaders/asphaltShader.js";
import { PedestrianFactory, poseWalk } from "./PedestrianFactory.js";
import { CampusCrowd, createCrowdPlan, standingCells } from "./CampusCrowd.js";
import { SpeechBubbles } from "./SpeechBubbles.js";
import { QuizOverlay } from "./QuizOverlay.js";
import { pickQuiz } from "./quizBank.js";
import { CUP_SCORE, CUP_TYPES, CupModelKit, PowerUpState, VidaCups, planCupSpots } from "./VidaCups.js";
import {
  createSeededRandom,
  generateLevel2Layout,
  normalizeSeed,
  STRIP_DEPTH,
  validateGeneratedLayouts
} from "./Level2StripGenerator.js";

// The player walks half a strip row per grid step. Smaller steps plus a steady
// walk speed replace the old 2.4 m lunges between rows.
const WALK_STEP = STRIP_DEPTH / 2;
const WALK_SPEED = 4.6;
// Distance covered by one full left-right stride cycle.
const STRIDE_LENGTH = 1.6;
const PLAYER_Y = 0.95;
const LEVEL_2_TIME_LIMIT = 30;


const DIRECTIONS = Object.freeze({
  up: Object.freeze({ x: 0, z: -1 }),
  down: Object.freeze({ x: 0, z: 1 }),
  left: Object.freeze({ x: -1, z: 0 }),
  right: Object.freeze({ x: 1, z: 0 })
});

const SPEAKER_TITLES = {
  guard: "Campus Protection",
  tutor: "Tutor",
  jogger: "Jogger",
  queue: "Vida queue",
  psychQuizzer: "Psych Elective",
  ccduAdvisor: "CCDU"
};

export class CrossingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 2 — Cross the Road";

    this.root = new THREE.Group();

    this.player = null;
    this.controls = null;
    this.collisionWorld = null;
    this.hopController = null;
    this.crossingTime = 0;
    this.backwardPenalty = 0;
    this.attempts = 0;
    this.traffic = [];
    this.lanes = [];
    this.strips = [];
    this.blockedCells = [];
    this.boundaryVolumes = [];
    this.layout = null;
    this.seed = null;
    this.invulnerabilityTimer = 0;
    this.playerRig = null;
    this.playerAnimationTime = 0;
    this.walkBlend = 0;
    this.celebrateTimer = 0;
    this.impactTimer = 0;
    this.cameraShakeTime = 0;
    this.cameraShakeStrength = 1;
    this.bumpCooldown = 0;
    this.routeMessageCooldown = 0;
    this.pendingRespawn = null;
    this.level2PlayerSpawn = null;
    this.cameraPositionTarget = new THREE.Vector3();
    this.cameraLookTarget = new THREE.Vector3();
    this.cameraLookGoal = new THREE.Vector3();
    this.playerCollisionBox = new THREE.Box3();
    this.vehicleCollisionBox = new THREE.Box3();
    this.walkwayMaterial = createAmicDeckMaterial();
    this.parkingRoadTextures = null;
    this.parkingMaterial = null;
    this.audio = new LevelAudio();
    this.chimes = [];

    this.cupKit = null;
    this.pedestrians = null;
    this.crowd = null;
    this.cups = null;
    this.powerUps = new PowerUpState();
    this.speech = null;
    this.quiz = null;
    this.quizPaused = false;
    this.aura = null;
    this.shieldBubble = null;

    this.startZ = 0;
    this.finishZ = 0;
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };

    this.gridSize = STRIP_DEPTH;
    this.completed = false;
  }
  getAdjustedTime() {
  return Math.max(
    0,
    this.crossingTime +
    this.backwardPenalty -
    this.powerUps.timeBonus
  );
}

  async load() {
    const scene = this.game.scene;

    // Keep Level 2 in the same exterior visual language as Level 1 while
    // retaining the brighter midday lighting that distinguishes the crossing.
    // const skyColor = new THREE.Color(0x8ec9ee);
    // scene.background = skyColor;
    // this.game.renderer.shadowMap.type = THREE.BasicShadowMap;

    const skyColor = new THREE.Color(0x8ec9ee);
    scene.background = skyColor;
    //scene.fog = new THREE.Fog(0x8ec9ee, 30, 85);
    this.game.renderer.shadowMap.enabled = true;
    this.game.renderer.shadowMap.type = THREE.PCFSoftShadowMap;


    scene.add(this.root);
    this.root.add(createWitsTerrain({
      baseY: -3.8,
      nearScenery: false,
      palette: { ground: 0x4f6844, buildings: 0x86513d, windows: 0xf0b56b, trees: 0x315c3a }
    }));
    this.audio.startDrone(58, 0.018);
    this.collisionWorld = new CollisionWorld(this.root);

    // Trimmed from 2.9 / 4.2 for ACES, 2026-09-08. These were the highest
    // intensities in the game and were clipping against NoToneMapping; the
    // curve's 1.67x pre-gain pushed them further up rather than down, so
    // midday measured 4.7% brighter and 18.6% less saturated after the
    // change. See src/core/renderSettings.js and docs/DECISIONS.md.
    const hemi = new THREE.HemisphereLight(0xe9f8ff, 0x5c7d4e, 2.65);
    this.root.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff1cf, 3.4);
    sun.position.set(-10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -12;
    sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 55;
    sun.shadow.bias = -0.0003;
    sun.shadow.normalBias = 0.025;

    this.root.add(sun);
    this.root.add(sun.target);
    sun.target.position.set(0, 0, 0);
    // Build the generated environment before placing gameplay actors into it.
    this.parkingRoadTextures = createRoadTextures();
    this.parkingMaterial = createRoadMaterial(this.parkingRoadTextures);
    await this.createStrips();

    this.createRoadEndFog();

    this.cupKit = new CupModelKit();
    this.pedestrians = new PedestrianFactory({ createHeldCup: (type) => this.cupKit.createCup(type) });
    this.speech = new SpeechBubbles();
    this.quiz = new QuizOverlay();
    this.createPlayer();
    const crowdPlan = this.createCrowd();
    this.createCups(crowdPlan);
    this.createPlayerEffects();
    this.collisionWorld.rebuild();
    this.hopController = new GridHopController(this.player, {
      cellSize: WALK_STEP,
      walkSpeed: WALK_SPEED,
      minX: -this.gridSize, maxX: this.gridSize, minZ: this.finishZ, maxZ: this.startZ,
      canEnter: (x, z) => !this.isBlockedCell(x, z) && !this.crowd.personAt(x, z),
      onBlocked: (x, z, direction) => this.onWalkBlocked(x, z, direction)
    });

    const camera = new THREE.PerspectiveCamera(
      58,
      this.game.renderer.domElement.clientWidth / Math.max(1, this.game.renderer.domElement.clientHeight),
      0.1,
      160
    );
    camera.position.set(this.player.position.x + 5.2, 6.5, this.player.position.z + 7.5);
    this.cameraLookTarget.set(this.player.position.x, 0.9, this.player.position.z - 3);
    camera.lookAt(this.cameraLookTarget);

    this.game.setCamera(camera);

    this.controls = this.game.input.registerBindings({
      moveUp: ["KeyW", "ArrowUp"],
      moveDown: ["KeyS", "ArrowDown"],
      moveLeft: ["KeyA", "ArrowLeft"],
      moveRight: ["KeyD", "ArrowRight"]
    });
    this.game.setMessage(
      "Collect every Vida cup and reach Engineering in under 30 seconds."
    );
  }

  createRoadEndFog() {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(0x8ec9ee) }, uOpacity: { value: 0.32 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec2 vUv;uniform vec3 uColor;uniform float uOpacity;void main(){float a=smoothstep(0.,.7,vUv.y)*uOpacity;gl_FragColor=vec4(uColor,a);}`
  });

  for (const strip of this.strips) {
    if (!strip.lanes.length) continue;

    for (const side of [-1,1]) {
      for (let i=0;i<4;i++) {
        const fog=new THREE.Mesh(new THREE.PlaneGeometry(strip.definition.depth+0.4,7),mat.clone());
        fog.material.uniforms.uOpacity.value=0.14+i*0.14;
        fog.rotation.y=Math.PI/2;
        fog.position.set(side*(44+i*4),3.1,strip.z);
        this.root.add(fog);
      }
    }
  }
}
  async createStrips() {
    // A URL seed reproduces a layout; otherwise each new Level 2 start gets a new seed.
    this.seed = this.resolveSeed();
    this.layout = generateLevel2Layout(this.seed);
    if (import.meta.env.DEV) {
      const failures = validateGeneratedLayouts(100, this.seed);
      if (failures.length > 0) throw new Error(`Level 2 validation failed: ${JSON.stringify(failures[0])}`);
    }

    // Stack grid-aligned strips, including custom strips that span several rows.
    const centerRow = (this.layout.rowCount - 1) / 2;
    for (const definition of this.layout.strips) {
      const stripCenterRow = definition.rowStart + (definition.rowSpan - 1) / 2;
      const z = (centerRow - stripCenterRow) * this.layout.depth;
      const random = createSeededRandom(this.seed ^ Math.imul(definition.index + 1, 0x9e3779b1));
      const strip = new CrossingStrip({
        definition,
        z,
        parent: this.root,
        random,
        audio: this.audio,
        walkwayMaterial: this.walkwayMaterial,
        parkingMaterial: this.parkingMaterial
      });
      this.strips.push(strip);
    }

    const stripsWithModels = this.strips.filter((strip) => strip.definition.models?.length > 0);
    if (stripsWithModels.length > 0) {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const modelCache = new Map();
      await Promise.all(stripsWithModels.map((strip) => strip.loadModels(loader, modelCache)));
    }

    this.startZ = centerRow * this.layout.depth;
    this.finishZ = -centerRow * this.layout.depth;
    this.level2PlayerSpawn = Object.freeze({ x: 0, y: PLAYER_Y, z: this.startZ, rotationY: Math.PI });
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };
    // Flat collections keep the existing collision and gap-hint code simple.
    this.lanes = this.strips.flatMap((strip) => strip.lanes);
    this.traffic = this.strips.flatMap((strip) => strip.traffic);
    this.blockedCells = this.strips.flatMap((strip) => strip.blockedCells);
    this.boundaryVolumes = this.strips.flatMap((strip) => strip.boundaryVolumes);
    await Promise.all(this.strips.map((strip) => strip.whenReady()));
    await this.parkingRoadTextures.ready;
  }

  resolveSeed() {
    const requestedSeed = new URLSearchParams(window.location.search).get("level2Seed");
    if (requestedSeed !== null) return normalizeSeed(requestedSeed);
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }

  // Strip type -> { z, depth } for the authored crowd and cup placement.
  get zones() {
    return Object.fromEntries(this.strips.map((strip) => [strip.definition.type, { z: strip.z, depth: strip.definition.depth }]));
  }

  // Every cell the player can stand on, labelled with the strip it lies in.
  reachableCells() {
    const cells = [];
    const rows = Math.round((this.startZ - this.finishZ) / WALK_STEP);
    for (let row = 0; row <= rows; row++) {
      const z = this.startZ - row * WALK_STEP;
      // Cells on the line between two strips (e.g. the Yale Road kerb) get no zone.
      const zone = this.stripInside(z)?.definition.type ?? "boundary";
      for (let column = -2; column <= 2; column++) {
        const x = column * WALK_STEP;
        if (!this.isBlockedCell(x, z)) cells.push({ x, z, zone });
      }
    }
    return cells;
  }

  // The strip whose interior contains z; cells on a strip boundary have none.
  stripInside(z) {
    return this.strips.find((strip) => Math.abs(z - strip.z) < strip.definition.depth / 2 - 0.01) ?? null;
  }

  createCrowd() {
    const plan = createCrowdPlan({ zones: this.zones, startZ: this.startZ, step: WALK_STEP });
    this.crowd = new CampusCrowd({
      root: this.root,
      factory: this.pedestrians,
      random: createSeededRandom(this.seed ^ 0x51ab1e),
      onSay: (person, text, tone) => this.speech.say(person.mesh, text, {
        speaker: SPEAKER_TITLES[person.kind] ? `${person.name} · ${SPEAKER_TITLES[person.kind]}` : person.name,
        tone
      })
    });
    this.crowd.spawn(plan);
    return plan;
  }

  createCups(crowdPlan) {
    this.cups = new VidaCups({ root: this.root, kit: this.cupKit, groundY: 0 });
    const spots = planCupSpots({
      cells: this.reachableCells(),
      random: createSeededRandom(this.seed ^ 0xc0ffee),
      reserved: standingCells(crowdPlan),
      startZ: this.startZ
    });
    this.cups.spawn(spots);
  }

  createPlayer() {
    this.player = this.pedestrians.create({
      shirt: 0x2f8f88,
      trousers: 0x263b54,
      skin: 0x9a6440,
      hair: "short",
      backpack: 0xd6a43a,
      scale: 1.03
    });
    this.player.name = "level2-player";
    this.player.position.set(this.level2PlayerSpawn.x, this.level2PlayerSpawn.y, this.level2PlayerSpawn.z);
    this.player.rotation.y = this.level2PlayerSpawn.rotationY;
    this.root.add(this.player);
    this.playerRig = this.player.userData.rig;
    this.collisionWorld.add({ object: this.player, size: [0.9, 1.7, 0.9], color: 0x35e0d1, tag: "player" });
  }

  // Power-up visuals live beside the player, not inside it, so they never
  // inflate the player's collision box.
  createPlayerEffects() {
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.8, 40),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.aura.name = "level2-power-aura";
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.visible = false;
    this.root.add(this.aura);

    this.shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 28, 18),
      new THREE.MeshBasicMaterial({
        color: CUP_TYPES.shield.glow,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      })
    );
    this.shieldBubble.name = "level2-shield-bubble";
    this.shieldBubble.visible = false;
    this.root.add(this.shieldBubble);
  }

  update(dt) {
    if (this.completed) return;
    if (this.quizPaused) return; // quiz overlay owns input while it's open

    this.updateInvulnerability(dt);
    this.updateImpact(dt);
    this.updateChimes(dt);
    this.crossingTime += dt;
    this.bumpCooldown = Math.max(0, this.bumpCooldown - dt);
    this.routeMessageCooldown = Math.max(0, this.routeMessageCooldown - dt);
    this.powerUps.update(dt);
    this.hopController.speedMultiplier = this.powerUps.speedMultiplier;

    this.capturePlayerInput();
    const landedDirection = this.hopController.update(dt);
    this.updatePlayerAnimation(dt);
    if (landedDirection?.z > 0) this.backwardPenalty += 0.25;
    if (landedDirection) this.updateCheckpoint();
    if (landedDirection) this.audio.cue(170 + Math.random() * 30, 0.04, 0.03);
    this.updateCups(dt);
    this.checkFinish();
    this.updateTraffic(dt * this.powerUps.trafficScale);
    this.crowd.update(dt, this.player.position);
    this.checkCollisions();
    this.updatePlayerEffects(dt);
    this.updateCamera(dt);
    this.updateSpeech(dt);
    this.updateHUD();
  }

  updateHUD() {
    const effects = this.powerUps.active.map(({ type, fraction }) => `
      <div class="l2-effect" style="--effect-color: #${type.glow.toString(16).padStart(6, "0")}">
        <span>${type.label}</span>
        <span class="l2-effect-bar"><span style="width: ${(fraction * 100).toFixed(0)}%"></span></span>
      </div>`).join("");
   // const time = Math.max(0, this.crossingTime + this.backwardPenalty - this.powerUps.timeBonus);
    const time = this.getAdjustedTime();

    this.game.setHUD(`
      <div class="l2-hud">
        <strong class="l2-hud-title">Cross the Road</strong>
        <div class="l2-hud-row"><span>Time</span><strong>${time.toFixed(1)}s</strong></div>
        <div class="l2-hud-row"><span>Attempts</span><strong>${this.attempts + 1}</strong></div>
        <div class="l2-hud-row"><span>Vida cups</span><strong class="l2-cups">${this.powerUps.collected} / ${this.cups.total}</strong></div>
        <div class="l2-hud-row"><span>Checkpoint</span><strong>${this.checkpoint.label}</strong></div>
        ${effects}
        <span class="gap-hint">${this.getNextGapHint()}</span>
      </div>
    `);
  }

  updatePlayerAnimation(dt) {
    this.playerAnimationTime += dt;
    const rig = this.playerRig;
    if (!rig) return;
    const walking = this.hopController.isHopping;
    this.walkBlend = THREE.MathUtils.damp(this.walkBlend, walking ? 1 : 0, 12, dt);
    const phase = (this.hopController.distanceWalked / STRIDE_LENGTH) * Math.PI * 2;
    poseWalk(rig, phase, this.walkBlend);
    rig.upper.position.y += Math.sin(this.playerAnimationTime * 1.8) * 0.01 * (1 - this.walkBlend);

    // Lean into the walk, stagger on impact, lean into a bump.
    const lean = this.hopController.isBumping ? 0.22 : 0.08 * this.walkBlend;
    rig.upper.rotation.x = THREE.MathUtils.damp(rig.upper.rotation.x, lean, 14, dt);
    rig.upper.rotation.z = THREE.MathUtils.damp(rig.upper.rotation.z, this.impactTimer > 0 ? 0.35 : 0, 16, dt);

    // Arms up for a moment after grabbing a cup.
    this.celebrateTimer = Math.max(0, this.celebrateTimer - dt);
    const cheer = Math.min(1, this.celebrateTimer / 0.2);
    rig.arms[0].rotation.x = THREE.MathUtils.lerp(rig.arms[0].rotation.x, -2.7, cheer);
    rig.arms[1].rotation.x = THREE.MathUtils.lerp(rig.arms[1].rotation.x, -2.7, cheer);
    rig.arms[0].rotation.z = -0.35 * cheer;
    rig.arms[1].rotation.z = 0.35 * cheer;

    // Blink while invulnerable after a shield save.
    this.player.visible = this.invulnerabilityTimer <= 0 || this.impactTimer > 0
      || Math.floor(this.invulnerabilityTimer * 12) % 2 === 0;
  }

  updateTraffic(dt) {
    for (const strip of this.strips) strip.update(dt);
  }

  capturePlayerInput() {
    if (this.impactTimer > 0) {
      this.hopController.setHeldDirection(null);
      return;
    }
    const controls = this.controls;
    // A tap walks exactly one cell; holding keeps walking cell to cell.
    if (controls.consumeBuffered("moveUp")) this.hopController.enqueue(DIRECTIONS.up);
    else if (controls.consumeBuffered("moveDown")) this.hopController.enqueue(DIRECTIONS.down);
    else if (controls.consumeBuffered("moveLeft")) this.hopController.enqueue(DIRECTIONS.left);
    else if (controls.consumeBuffered("moveRight")) this.hopController.enqueue(DIRECTIONS.right);

    let held = null;
    if (controls.isDown("moveUp")) held = DIRECTIONS.up;
    else if (controls.isDown("moveDown")) held = DIRECTIONS.down;
    else if (controls.isDown("moveLeft")) held = DIRECTIONS.left;
    else if (controls.isDown("moveRight")) held = DIRECTIONS.right;
    this.hopController.setHeldDirection(held);
  }

  isBlockedCell(x, z) {
    const tolerance = this.gridSize * 0.1;
    return this.boundaryVolumes.some((volume) =>
      x >= volume.minX && x <= volume.maxX && z >= volume.minZ && z <= volume.maxZ
    ) || this.blockedCells.some((cell) =>
      Math.abs(cell.x - x) < tolerance && Math.abs(cell.z - z) < tolerance
    );
  }

  onWalkBlocked(x, z, direction) {
    if (this.quizPaused) return;
    const person = this.crowd.personAt(x, z);
    if (!person) {
      if (this.routeMessageCooldown === 0) this.game.setMessage("Stay on the marked pedestrian route.");
      this.routeMessageCooldown = 2;
      return;
    }

    const isQuizzer = person.kind === "psychQuizzer" || person.kind === "ccduAdvisor";
    if (isQuizzer && !person.quizDone) {
      this.startQuiz(person);
      return;
    }

    if (this.bumpCooldown > 0) return;
    this.bumpCooldown = 0.9;
    this.hopController.bump(direction);
    this.cameraShakeTime = 0.18;
    this.cameraShakeStrength = 0.35;
    this.audio.cue(120, 0.09, 0.09);
    const { droppedCup } = this.crowd.bump(person, this.player.position);
    if (droppedCup) {
      // They drop their coffee straight into your hands, after a little bounce.
      const grid = this.hopController.gridPosition;
      this.cups.add(grid.x, grid.y, droppedCup, { dropped: true });
    }
  }

  // Stops the player and opens a quiz for a psychQuizzer/ccduAdvisor person.
  // The answer is checked for validity only (see quizBank.isValidAnswer) and
  // is never stored — `person.quizDone` just stops the same person from
  // re-asking for the rest of this playthrough.
  startQuiz(person) {
    if (person.kind === "psychQuizzer") {
      this.quizPaused = true;
      this.quiz.openPsychologyQuestionnaire(this.crowd.random, () => {
        person.quizDone = true;
        this.quizPaused = false;
        this.game.setMessage("Form received. Carry on.");
      });
      return;
    }
    const quiz = pickQuiz(person.kind, this.crowd.random);
    if (!quiz) return;
    this.quizPaused = true;
    this.quiz.open(quiz, () => {
      person.quizDone = true;
      this.quizPaused = false;
      this.game.setMessage("Thanks! Carry on.");
    });
  }

  updateCups(dt) {
    this.cups.update(dt);
    const cup = this.cups.collectNear(this.player.position);
    if (!cup) return;
    const type = this.powerUps.apply(cup.type.id);
    this.celebrateTimer = 0.55;
    const color = `#${type.glow.toString(16).padStart(6, "0")}`;
    this.speech.popup(cup.mesh.position, `+ ${type.label}`, color);
    this.game.setMessage(`${type.label}! ${type.blurb}.`);
    // A rising three-note chime; faster types get a higher one.
    const base = type.id === "doubleShot" ? 660 : type.id === "icedLatte" ? 520 : type.id === "shield" ? 440 : 590;
    this.chimes.push({ delay: 0, frequency: base }, { delay: 0.07, frequency: base * 1.25 }, { delay: 0.14, frequency: base * 1.5 });
  }

  updateChimes(dt) {
    for (let index = this.chimes.length - 1; index >= 0; index--) {
      const chime = this.chimes[index];
      chime.delay -= dt;
      if (chime.delay > 0) continue;
      this.audio.cue(chime.frequency, 0.12, 0.07);
      this.chimes.splice(index, 1);
    }
  }

  updatePlayerEffects(dt) {
    const time = this.playerAnimationTime;
    const timed = this.powerUps.active.filter((effect) => effect.type.duration > 0);
    this.aura.visible = timed.length > 0;
    if (this.aura.visible) {
      // The most recent effect with the most time left sets the colour.
      const effect = timed.reduce((best, candidate) => (candidate.remaining > best.remaining ? candidate : best));
      this.aura.material.color.setHex(effect.type.glow);
      // Fade out over the last second so the player sees it running out.
      const fade = Math.min(1, effect.remaining);
      const flicker = effect.remaining < 1.5 ? 0.5 + 0.5 * Math.sin(time * 30) : 1;
      this.aura.material.opacity = 0.75 * fade * flicker;
      this.aura.position.set(this.player.position.x, 0.24, this.player.position.z);
      const pulse = 1 + Math.sin(time * 8) * 0.08;
      this.aura.scale.set(pulse, pulse, pulse);
    }

    this.shieldBubble.visible = this.powerUps.shield;
    if (this.shieldBubble.visible) {
      this.shieldBubble.position.set(this.player.position.x, this.player.position.y + 0.05, this.player.position.z);
      this.shieldBubble.material.opacity = 0.13 + Math.sin(time * 5) * 0.05;
      this.shieldBubble.rotation.y += dt;
    }
  }

  updateSpeech(dt) {
    const canvas = this.game.renderer.domElement;
    this.speech.update(dt, this.game.camera, canvas.clientWidth, canvas.clientHeight);
  }

checkFinish() {
    if (this.hopController.isHopping || this.hopController.gridPosition.y > this.finishZ) return;
    const cups = this.powerUps.collected, total = this.cups.total;
    if (cups !== total) { this.game.setMessage(`You still need ${total - cups} Vida cup${total - cups === 1 ? "" : "s"} before you can finish!`); return; }
    const time = this.getAdjustedTime();
    if (time >= LEVEL_2_TIME_LIMIT) { this.completed = true; this.game.failLevel(`Too slow! You collected all ${total} Vida cups, but finished in ${time.toFixed(1)}s. You need to finish in under ${LEVEL_2_TIME_LIMIT} seconds.`); return; }
    this.completed = true;
    this.game.journeyScore += cups * CUP_SCORE;
    this.game.completeLevel(`You collected all ${total} Vida cups and crossed in ${time.toFixed(1)}s (+${cups * CUP_SCORE}). Heading to Level 3.`);
  }

  checkCollisions() {
    if (this.invulnerabilityTimer > 0) return;
    const playerBox = this.playerCollisionBox.setFromObject(this.player);

    for (const vehicle of this.traffic) {
      if (vehicle.lane.isHighway) continue;
      const vehicleBox = this.vehicleCollisionBox.setFromObject(vehicle.root);
      if (!playerBox.intersectsBox(vehicleBox)) continue;
      if (this.powerUps.consumeShield()) this.saveWithShield(vehicle.isTaxi);
      else this.failAtCheckpoint(vehicle.isTaxi);
      return;
    }
  }

  saveWithShield(wasTaxi) {
    this.game.flashHUD();
    this.audio.cue(880, 0.18, 0.1);
    this.audio.cue(wasTaxi ? 110 : 165, 0.12, 0.08);
    this.impactTimer = 0.25;
    this.cameraShakeTime = 0.3;
    this.cameraShakeStrength = 0.8;
    this.invulnerabilityTimer = 1.8;
    this.speech.popup(this.player.position, "SHIELD POPPED!", "#ffd257");
    this.game.setMessage(wasTaxi
      ? "The Red Cappuccino saved you from that taxi! Get off the road!"
      : "The Red Cappuccino saved you! Get off the road!");
  }

  updateCheckpoint() {
    const x = this.hopController.gridPosition.x;
    const z = this.hopController.gridPosition.y;
    // Generated safe and median strips reuse the existing checkpoint/reset flow.
    // Boundary cells are skipped: the bridge landing's last cell is the Yale
    // Road kerb line, which traffic in the first lane still clips.
    const strip = this.stripInside(z);
    if (!strip?.isCheckpoint) return;

    const label = strip.checkpointLabel;
    if (this.checkpoint.label !== label) {
      this.game.setMessage(`Checkpoint: ${label}.`);
      this.game.setCheckpoint(`level2-${this.seed}-${strip.definition.index}-${x}`);
    }
    // Respawn where the player last stood inside the checkpoint area.
    this.checkpoint = { x, z, label };
  }

  getNextGapHint() {
    const lane = this.lanes.filter((candidate) => !candidate.isHighway).reduce((closest, candidate) => {
      if (!closest || Math.abs(candidate.z - this.player.position.z) < Math.abs(closest.z - this.player.position.z)) {
        return candidate;
      }
      return closest;
    }, null);

    if (!lane || Math.abs(lane.z - this.player.position.z) > this.gridSize) {
      return "Next gap: move to the kerb";
    }

    const closestVehicle = this.traffic
      .filter((vehicle) => vehicle.lane === lane)
      .reduce((nearest, vehicle) => (!nearest || Math.abs(vehicle.root.position.x - this.player.position.x) < Math.abs(nearest.root.position.x - this.player.position.x) ? vehicle : nearest), null);
    const distance = Math.abs((closestVehicle?.root.position.x ?? 99) - this.player.position.x);
    return distance > 4.5 ? "Next gap: GO" : "Next gap: WAIT";
  }

  failAtCheckpoint(wasTaxi) {
    this.attempts += 1;
    this.game.flashHUD();
    this.audio.cue(wasTaxi ? 110 : 165, 0.2, 0.12);
    this.pendingRespawn = { x: this.checkpoint.x, y: PLAYER_Y, z: this.checkpoint.z };
    this.impactTimer = 0.42;
    this.cameraShakeTime = 0.34;
    this.cameraShakeStrength = 1;
    this.invulnerabilityTimer = 0.9;
    this.hopController.delay(this.impactTimer);
    this.game.setMessage(wasTaxi
      ? `Taxi impact! Returning to ${this.checkpoint.label}.`
      : `Vehicle impact! Returning to ${this.checkpoint.label}.`);
  }

  updateImpact(dt) {
    if (this.impactTimer <= 0) return;
    this.impactTimer = Math.max(0, this.impactTimer - dt);
    if (this.impactTimer === 0 && this.pendingRespawn) {
      this.hopController.reset(this.pendingRespawn);
      this.hopController.targetYaw = Math.PI;
      this.pendingRespawn = null;
    }
  }

  updateInvulnerability(dt) {
    if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
  }

  updateCamera(dt) {
    const camera = this.game.camera;
    const shake = this.cameraShakeTime > 0 ? (this.cameraShakeTime / 0.34) * this.cameraShakeStrength : 0;
    this.cameraShakeTime = Math.max(0, this.cameraShakeTime - dt);
    this.cameraPositionTarget.set(
      this.player.position.x + 5.2 + (Math.random() - 0.5) * shake * 0.35,
      6.5 + (Math.random() - 0.5) * shake * 0.2,
      this.player.position.z + 7.5 + (Math.random() - 0.5) * shake * 0.35
    );
    const follow = 1 - Math.exp(-6 * dt);
    camera.position.lerp(this.cameraPositionTarget, follow);
    // The look target follows at the same rate as the camera, so walking
    // glides instead of the view snapping to each new cell.
    this.cameraLookGoal.set(this.player.position.x, 0.9, this.player.position.z - 3);
    this.cameraLookTarget.lerp(this.cameraLookGoal, follow);
    camera.lookAt(this.cameraLookTarget);
  }

  toggleCollisionDebug(visible) {
    this.collisionWorld.setDebugVisible(visible);
    for (const strip of this.strips) strip.setDebugVisible(visible);
  }

  dispose() {
    this.audio.dispose();
    this.controls?.dispose();
    this.speech?.dispose();
    this.quiz?.dispose();
    disposeObject3D(this.root);
  }
}
