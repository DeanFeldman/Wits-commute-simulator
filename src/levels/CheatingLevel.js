import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { WaypointMover } from "../shared/WaypointMover.js";
import { LevelAudio } from "../shared/LevelAudio.js";
import {
  HAIR_STYLES,
  PEDESTRIAN_GEOMETRY,
  PedestrianFactory,
  SKIN_TONES,
  poseWalk
} from "./crossing/PedestrianFactory.js";
import { AnimatedNpcFactory, STUDENT_MODEL_VARIANTS } from "./crossing/AnimatedNpcFactory.js";
import { createAnimatedTutor } from "./level3/TutorModel.js";
import {
  QUESTION_BANK,
  normaliseAnswer,
  shuffle,
  validateQuestion
} from "./cheatingQuestions.js";

export const LEVEL_THREE_TIME_LIMIT = 100;

export const LEVEL_THREE_DUMMY_WORDS = Object.freeze([
  "banana",
  "toaster",
  "giraffe",
  "shoelace",
  "cupcake",
  "penguin",
  "toothbrush",
  "marshmallow",
  "wheelbarrow",
  "pineapple",
  "slipper",
  "dinosaur",
  "teapot",
  "jellybean",
  "umbrella",
  "hamster",
  "pancake",
  "suitcase",
  "cactus",
  "meatball",
  "trampoline",
  "snowman",
  "avocado",
  "kangaroo",
  "doorbell",
  "muffin",
  "lollipop",
  "flamingo",
  "popcorn",
  "sock"
]);

export function buildVariedRoundAnswers(
  questionData,
  _baseAnswers,
  roundIndex = 0
) {
  const correctAnswer = questionData?.correctAnswer;
  if (!correctAnswer) {
    return [];
  }

  const correctKey = normaliseAnswer(correctAnswer);
  const distractorPool = LEVEL_THREE_DUMMY_WORDS.filter(
    (answer) => normaliseAnswer(answer) !== correctKey
  );

  const distractorCount = 6;
  if (distractorPool.length < distractorCount) {
    throw new Error(
      "Level 3 needs at least six obviously-wrong dummy answers."
    );
  }

  // Rotate through a deliberately silly pool so every question gets
  // different rubbish answers while the real answer remains easy to spot.
  const start =
    ((roundIndex + 1) * distractorCount) % distractorPool.length;
  const distractors = [];

  for (let offset = 0; distractors.length < distractorCount; offset += 1) {
    distractors.push(
      distractorPool[(start + offset) % distractorPool.length]
    );
  }

  return shuffle([correctAnswer, ...distractors]);
}

export const LEVEL_THREE_BALANCE = Object.freeze({
  answerGainPerCorrectWord: 20,
  suspicionGainPerSecond: 30,
  tutorPauseSeconds: 2.0,
  tutorTurnSpeed: 2.4
});
export function getExtraTutorPlayerPasses(suspicion) {
  if (suspicion >= 80) {
    return 3;
  }

  if (suspicion >= 60) {
    return 2;
  }

  if (suspicion >= 30) {
    return 1;
  }

  return 0;
}
const CLASSROOM_WIDTH = 22;
const CLASSROOM_HALF_WIDTH = CLASSROOM_WIDTH / 2;
const CLASSROOM_FRONT_Z = -7.8;
const CLASSROOM_BACK_Z = 11.2;
const CLASSROOM_DEPTH = CLASSROOM_BACK_Z - CLASSROOM_FRONT_Z;
const CLASSROOM_CENTER_Z = (CLASSROOM_FRONT_Z + CLASSROOM_BACK_Z) / 2;
const DESKS_PER_ROW = 9;
const DESK_COLUMN_SPACING = 1.9;
const DESK_ROWS = 6;
const DESK_ROW_SPACING = 2.5;
const FRONT_DESK_ROW_Z = -4.3;
const TUTOR_AISLE_X = 9;
const PLAYER_DANGER_AISLE_Z = 2.35;
const WINDOW_CENTERS_Z = [-4.7, 1.7, 8.1];
const TUTOR_CENTER_AISLE_X = DESK_COLUMN_SPACING / 2;
const WINDOW_WIDTH = 3.6;
const WINDOW_BOTTOM_Y = 1.4;
const WINDOW_TOP_Y = 4.8;
const NORMAL_CAMERA_FOV = 62;
const PEEK_CAMERA_FOV = 30;
const HOLOGRAM_FONT_FAMILY = "Pencil Pete";
const HOLOGRAM_TEAR_STYLES = ["bottom", "both", "top", "bottom", "both", "bottom", "top"];
const DESK_INTERACTION_DISTANCE = 5.25;
const VISION_CONE_LENGTH = 5.5;
const VISION_CONE_HALF_ANGLE = THREE.MathUtils.degToRad(32);
const VISION_CONE_OPACITY = 0.075;
// The replacement desk has a lower authored origin than the original prop.
// Keep its work surface, papers, tablets, and interaction volumes together.
const DESK_HEIGHT_ADJUSTMENT = 0.28;
const PAPER_HEIGHT = 0.795 + DESK_HEIGHT_ADJUSTMENT;
const DESK_SURFACE_HEIGHT = PAPER_HEIGHT - DESK_HEIGHT_ADJUSTMENT;
const DESK_CONTENT_CLEARANCE = 0.025;
const PLAYER_PAPER_WIDTH = 0.42;
const PLAYER_PAPER_HEIGHT = 0.5;
const PLAYER_DESK_SCALE = 1.15;
const PLAYER_DESK_LOWERING = 0.1;
const PLAYER_PAPER_TILT_CLEARANCE = 0.08;
const PLAYER_PAPER_READING_LIFT = 0.06;
// The answer sheet sits just above the replacement desk rather than hovering
// at the old prop's work-surface height.
const PLAYER_PAPER_REST_HEIGHT =
  DESK_SURFACE_HEIGHT + DESK_CONTENT_CLEARANCE - PLAYER_DESK_LOWERING + 0.012;
const PLAYER_PAPER_READING_HEIGHT =
  DESK_SURFACE_HEIGHT +
  DESK_CONTENT_CLEARANCE -
  PLAYER_DESK_LOWERING +
  PLAYER_PAPER_TILT_CLEARANCE +
  PLAYER_PAPER_READING_LIFT;
const PLAYER_PAPER_REST_ROTATION = -Math.PI / 2;
const PLAYER_PAPER_READING_ROTATION = -Math.PI / 3;
const PLAYER_PAPER_POSE_SPEED = 8;
const PLAYER_PAPER_SCALE = 0.9;
const PLAYER_EYE_HEIGHT = 1.09;
const PLAYER_SEAT_Z = 4;
const PLAYER_FORWARD_OFFSET = 0.25;
// Keep the revealed note between the seated student's hands, not at face height.
const HOLOGRAM_HEIGHT = DESK_SURFACE_HEIGHT + 0.18;
const HOLOGRAM_WIDTH = 0.58;
const HOLOGRAM_DISPLAY_HEIGHT = 0.22;
const TABLET_TARGET_WIDTH = 1.0;
const TABLET_TARGET_HEIGHT = 0.28;
const TABLET_TARGET_DEPTH = 0.65;
const MAX_TYPED_ANSWER_LENGTH = 24;

const LEVEL3_TUTOR_STEP_AUDIO = "./assets/audio/level3/tutor-steps.opus";
const LEVEL3_TUTOR_STEPS = Object.freeze([
  Object.freeze({ path: LEVEL3_TUTOR_STEP_AUDIO, start: 0, duration: 0.54 }),
  Object.freeze({ path: LEVEL3_TUTOR_STEP_AUDIO, start: 0.64, duration: 0.508 }),
  Object.freeze({ path: LEVEL3_TUTOR_STEP_AUDIO, start: 1.248, duration: 0.539 }),
  Object.freeze({ path: LEVEL3_TUTOR_STEP_AUDIO, start: 1.888, duration: 0.571 })
]);
const LEVEL3_INTERACTION_AUDIO = "./assets/audio/level3/interaction-sprite.opus";
const LEVEL3_CLASSROOM_AMBIENCE_AUDIO = "./assets/audio/level3/classroom-ambience.opus";
const LEVEL3_HEARTBEAT_AUDIO = "./assets/audio/level3/heartbeat.opus";
const LEVEL3_CLOCK_AUDIO = "./assets/audio/level3/clock-tick.opus";
const LEVEL3_CORRECT_AUDIO = "./assets/audio/level3/correct-tick.opus";
const LEVEL3_INCORRECT_AUDIO = "./assets/audio/level3/incorrect-answer.opus";
const LEVEL3_INTERACTION_CUES = Object.freeze({
  peekRustle1: Object.freeze({ start: 0, duration: 0.847 }),
  peekRustle2: Object.freeze({ start: 0.947, duration: 0.897 })
});
export const TUTOR_OPENING_START_INDEX = 7;
export const TUTOR_OPENING_TARGET_INDEX = 8;
export function getTutorOpeningYaw(points) {
  const start = points[TUTOR_OPENING_START_INDEX];
  const target = points[TUTOR_OPENING_TARGET_INDEX];
  return Math.atan2(target.x - start.x, target.z - start.z);
}
const TUTOR_PLAYER_APPROACH_INDEX = 9;
const TUTOR_PLAYER_NEAR_INDEX = 12;
const TUTOR_PLAYER_RECHECK_INDEX = 11;

export function updateSuspicionMeter({
  suspicion,
  peeking,
  seen,
  dt
}) {
  let nextSuspicion = suspicion;

  if (peeking && seen) {
    nextSuspicion +=
      LEVEL_THREE_BALANCE.suspicionGainPerSecond * dt;
  } /*else if (!peeking) {
    nextSuspicion -=
      LEVEL_THREE_BALANCE.suspicionDecayPerSecond * dt;
  }*/

  return clamp(nextSuspicion, 0, 100);
}

export function isCopiedAnswerCorrect(typedAnswer, correctAnswer) {
  if (!correctAnswer) {
    return false;
  }

  return normaliseAnswer(typedAnswer) === normaliseAnswer(correctAnswer);
}

export class CheatingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 3 — Don't Get Caught";

    this.root = new THREE.Group();

    this.camera = null;
    this.minimapCamera = null;
    this.minimapElement = null;
    this.backgroundTexture = null;

    this.playerPosition = new THREE.Vector3(
      0,
      PLAYER_EYE_HEIGHT,
      PLAYER_SEAT_Z - PLAYER_FORWARD_OFFSET
    );

    this.tutor = null;
    this.spotlight = null;
    this.collisionWorld = null;

    this.tutorTime = 0;
this.patrolPoints = [
  // Start at the front of the classroom and walk directly toward
  // the player's area through the central aisle.
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -5.1),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -2.65),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -0.15),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, 2.35),

  // Turn away before passing behind the player.
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -0.15),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -2.65),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -5.1),

  // Sweep one front row.
  new THREE.Vector3(-TUTOR_AISLE_X, 0.95, -5.1),
  new THREE.Vector3(TUTOR_AISLE_X, 0.95, -5.1),

  // Come back down the central aisle toward the player.
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -5.1),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -2.65),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -0.15),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, 2.35),

  // Visit the rear portion of the room.
  new THREE.Vector3(TUTOR_AISLE_X, 0.95, 2.35),
  new THREE.Vector3(TUTOR_AISLE_X, 0.95, 4.85),
  new THREE.Vector3(TUTOR_AISLE_X, 0.95, 7.35),
  new THREE.Vector3(-TUTOR_AISLE_X, 0.95, 7.35),
  new THREE.Vector3(-TUTOR_AISLE_X, 0.95, 4.85),
  new THREE.Vector3(-TUTOR_AISLE_X, 0.95, 2.35),

  // Finish by returning into the player's line of sight.
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, 2.35),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -0.15),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -2.65),
  new THREE.Vector3(TUTOR_CENTER_AISLE_X, 0.95, -5.1)
];
    //this.patrolIndex = 1;
    this.patrolState = "walk";
    this.stateTimer = 0;
    this.occluders = [];
    this.raycaster = new THREE.Raycaster();
    this.interactionRaycaster = new THREE.Raycaster();
    this.playerSeen = false;
    this.tutorMover = null;
    this.extraPlayerPassesRemaining = 0;
    this.tutorLegs = [];
    this.tutorWalkPhase = 0;
    this.tutorWalkGrace = 0;
    this.seatedStudentMixers = [];
    this.visionEyePosition = new THREE.Vector3();
    this.visionCameraOffset = new THREE.Vector3();

    this.answerProgress = 0;
    this.suspicion = 0;
    this.timeRemaining = LEVEL_THREE_TIME_LIMIT;
    this.incorrectAnswers = 0;
    this.audio = new LevelAudio();
    this.audio.preloadStreams([
      LEVEL3_CLASSROOM_AMBIENCE_AUDIO,
      LEVEL3_HEARTBEAT_AUDIO,
      LEVEL3_CLOCK_AUDIO
    ]);
    this.gameplayAudioStarted = false;

    this.cheatDesks = [];
    this.decorativeTablets = [];
    this.hologramTearStyleIndex = 0;
    this.levelThreeHud = null;
    this.playerDesk = null;
    this.targetCheatDesk = null;
    this.isLookingAtPlayerDesk = false;
    this.zoomActive = false;
    this.peekActive = false;
    this.wasPeekActive = false;
    this.peekRustleVariant = 0;
    this.leftMouseDown = false;
    this.zoomOverlay = null;
    this.currentCopiedWord = null;
    this.currentCopiedDesk = null;
    this.activeQuestion = null;
    this.questionOrder = [];
    this.questionIndex = 0;
    this.typedAnswer = "";
    this.feedbackMessage = "";
    this.feedbackTime = 0;
    this.tabletTargetGeometry = new THREE.BoxGeometry(
      TABLET_TARGET_WIDTH,
      TABLET_TARGET_HEIGHT,
      TABLET_TARGET_DEPTH
    );
    this.tabletTargetMaterial = new THREE.MeshBasicMaterial();

    this.yaw = 0;
    // Three.js cameras face down -Z at zero yaw, which is the whiteboard at
    // the front of this classroom. Keep the initial gaze level rather than
    // starting with the player's answer desk in view.
    this.pitch = 0;

    this.completed = false;
    this.tutorialPose = null;

    this.onMouseDown = this.onMouseDown.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);
    this.onPointerLockChange = this.onPointerLockChange.bind(this);
    this.onTypingKeyDown = this.onTypingKeyDown.bind(this);
  }

  async load() {
    await this.audio.waitForPreload([
      LEVEL3_INCORRECT_AUDIO,
      LEVEL3_CORRECT_AUDIO,
      LEVEL3_INTERACTION_AUDIO,
      LEVEL3_TUTOR_STEP_AUDIO
    ]);

    const scene = this.game.scene;

    scene.background = new THREE.Color(0xb9d8e8);
    void this.loadSkybox(scene);
    await this.loadHologramFont();

    scene.add(this.root);
    this.collisionWorld = new CollisionWorld(this.root);

    const ambient = new THREE.HemisphereLight(0xeaf7ff, 0x8f735b, 1.35);
    this.root.add(ambient);

    const ceiling = new THREE.DirectionalLight(0xfff3d7, 1.25);
    ceiling.position.set(0, 10, 4);
    this.root.add(ceiling);

    // Weak cool bounce from the window / camera-facing side keeps faces
    // readable between the warm ceiling fixtures without flattening the room.
    const windowFill = new THREE.DirectionalLight(0xc7e3ff, 0.65);
    windowFill.position.set(0, 5, 10);
    windowFill.target.position.set(0, 1.2, 1.5);
    windowFill.castShadow = false;
    this.root.add(windowFill, windowFill.target);

    const roomAssets = await this.createRoom();
    this.createLightingIdentity(roomAssets);
    await this.createTutor();
    this.tutorMover = new WaypointMover(this.tutor, {
      points: this.patrolPoints, speed: 2.1, pauseAtNodes: LEVEL_THREE_BALANCE.tutorPauseSeconds,
      startIndex: TUTOR_OPENING_TARGET_INDEX,
      debugRoot: this.root, debugColor: 0xff7f86
    });
    this.collisionWorld.rebuild();

    this.camera = new THREE.PerspectiveCamera(NORMAL_CAMERA_FOV, 1, 0.1, 100);
    this.camera.position.copy(this.playerPosition);
    this.resetCameraToWhiteboard();

    this.minimapCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 120);
    this.minimapCamera.position.set(this.tutor.position.x, 5.5, this.tutor.position.z);
    this.minimapCamera.lookAt(this.tutor.position.x, 0, this.tutor.position.z);
    this.updateMinimapCameraFrustum();

    this.game.setCamera(this.camera);
    this.minimapElement = document.querySelector("#level3-minimap");
    if (this.minimapElement) this.minimapElement.hidden = false;
    this.zoomOverlay = document.querySelector("#level3-zoom-overlay");
    if (this.zoomOverlay) {
      this.zoomOverlay.classList.remove("visible");
      this.zoomOverlay.hidden = false;
    }

    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("keydown", this.onTypingKeyDown, true);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
  }

  async loadSkybox(scene) {
    try {
      const { EXRLoader } = await import("three/addons/loaders/EXRLoader.js");
      const texture = await new EXRLoader().loadAsync(
        "./assets/hdri/sunset-jhbcentral-4k.exr"
      );
      if (this.game.scene !== scene) {
        texture.dispose();
        return;
      }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.backgroundTexture = texture;
      scene.background = texture;
      scene.background = texture;
scene.backgroundRotation.y = THREE.MathUtils.degToRad(90);
    } catch (error) {
      console.warn("Unable to load the Level 3 Johannesburg skybox", error);
    }
  }

  async loadHologramFont() {
    try {
      const font = new FontFace(
        HOLOGRAM_FONT_FAMILY,
        "url('./assets/fonts/pencil-pete-trial.ttf')"
      );
      await font.load();
      document.fonts.add(font);
    } catch (error) {
      console.warn("Unable to load the Pencil Pete hologram font", error);
    }
  }

  async createRoom() {
    const columnXPositions = Array.from(
      { length: DESKS_PER_ROW },
      (_, column) => (column - (DESKS_PER_ROW - 1) / 2) * DESK_COLUMN_SPACING
    );
    const deskRowZPositions = Array.from(
      { length: DESK_ROWS },
      (_, row) => FRONT_DESK_ROW_Z + row * DESK_ROW_SPACING
    );
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    const loader = new GLTFLoader();
    const textureLoader = new THREE.TextureLoader();
    const [deskModel, chairModel, whiteboardModel, tabletModel, floorTexture, brickTexture] = await Promise.all([
      loader.loadAsync("./assets/models/props/classroom-desk.glb"),
      loader.loadAsync("./assets/models/props/classroom-plastic-chair.glb"),
      loader.loadAsync("./assets/models/props/whiteboard.glb"),
      loader.loadAsync("./assets/models/props/paper-tablet.glb"),
      textureLoader.loadAsync("./assets/textures/classroom-terrazzo-floor.jpg"),
      textureLoader.loadAsync("./assets/textures/classroom-brick-wall.jpg")
    ]);

    // Give the locally loaded chair template the same subtle preview lift as
    // male-3. The material clone is shared by the Level 3 chair instances,
    // so it does not alter another level or allocate a material per chair.
    const liftChairMaterial = (material) => {
      const previewMaterial = material.clone();
      if (previewMaterial.emissive) {
        previewMaterial.emissive.set(0x2c251f);
        previewMaterial.emissiveIntensity = 0.18;
      }
      return previewMaterial;
    };
    chairModel.scene.traverse((object) => {
      if (!object.isMesh) return;
      object.material = Array.isArray(object.material)
        ? object.material.map(liftChairMaterial)
        : liftChairMaterial(object.material);
    });

    floorTexture.colorSpace = THREE.SRGBColorSpace;
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(CLASSROOM_WIDTH / 3, CLASSROOM_DEPTH / 3);
    floorTexture.anisotropy = Math.min(
      8,
      this.game.renderer.capabilities.getMaxAnisotropy()
    );
    brickTexture.colorSpace = THREE.SRGBColorSpace;
    brickTexture.wrapS = THREE.RepeatWrapping;
    brickTexture.wrapT = THREE.RepeatWrapping;
    brickTexture.repeat.set(5.5, 2.5);
    brickTexture.anisotropy = floorTexture.anisotropy;

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      color: 0xffffff,
      roughness: 0.78,
      metalness: 0.02
    });
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(CLASSROOM_WIDTH, 0.2, CLASSROOM_DEPTH),
      floorMaterial
    );
    floor.position.set(0, 0, CLASSROOM_CENTER_Z);
    floor.receiveShadow = true;
    this.root.add(floor);

    for (const rowZ of deskRowZPositions) {
      for (const x of columnXPositions) {
        const desk = deskModel.scene.clone(true);
        desk.position.set(
          x,
          0.1 + DESK_HEIGHT_ADJUSTMENT,
          rowZ
        );
        desk.rotation.y = Math.PI;
        desk.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });
        this.root.add(desk);

        const isPlayerDesk =
          Math.abs(x - this.playerPosition.x) < 0.01 &&
          Math.abs(rowZ + 0.8 - PLAYER_SEAT_Z) < 0.01;

        if (isPlayerDesk) {
          // Give the seated player a larger, slightly lower work surface.
          // The raised page clearance prevents its 30° tilt from intersecting it.
          desk.scale.set(PLAYER_DESK_SCALE, 1, PLAYER_DESK_SCALE);
          desk.position.y -= PLAYER_DESK_LOWERING;
          this.playerDesk = {
            object: desk,
            paper: this.createDeskPaper("YOUR ANSWER", x, rowZ, 0xeef7ff)
          };
          desk.userData.playerDesk = true;
          this.playerDesk.paper.userData.playerDesk = true;
        } else {
          desk.userData.blocksTutorVision = true;
          this.occluders.push(desk);
          const tablet = this.createDeskTablet(tabletModel.scene, x, rowZ);

          const rowDistanceFromPlayer = Math.abs(
            rowZ + 0.8 - PLAYER_SEAT_Z
          );
          const isNeighbourRow =
            rowDistanceFromPlayer <= DESK_ROW_SPACING + 0.01;
          const isImmediateSideNeighbour =
            Math.abs(Math.abs(x - this.playerPosition.x) - DESK_COLUMN_SPACING) < 0.01;
          const isDirectlyBehindPlayer =
            Math.abs(x - this.playerPosition.x) < 0.01 &&
            rowZ + 0.8 > PLAYER_SEAT_Z &&
            rowDistanceFromPlayer <= DESK_ROW_SPACING + 0.01;

          if (
            (isNeighbourRow && isImmediateSideNeighbour) ||
            isDirectlyBehindPlayer
          ) {
            const interactionTarget = this.createTabletInteractionTarget(x, rowZ);
            const entry = {
              object: desk,
              word: "",
              tablet,
              interactionTarget,
              hologram: this.createWordHologram("", x, rowZ)
            };
            entry.tablet.userData.cheatDesk = entry;
            entry.interactionTarget.userData.cheatDesk = entry;
            this.cheatDesks.push(entry);
          } else {
            this.decorativeTablets.push(tablet);
          }
        }
        this.collisionWorld.add({ object: desk, size: [0.7, 0.7, 0.5], color: 0x785f48, tag: "desk" });
      }
    }

    if (this.cheatDesks.length !== 7) {
      throw new Error(
        `Level 3 needs seven answer tablets around the player; found ${this.cheatDesks.length}.`
      );
    }

    const expectedDecorativeTablets = DESKS_PER_ROW * DESK_ROWS - 8;

    if (this.decorativeTablets.length !== expectedDecorativeTablets) {
      throw new Error(
        `Level 3 needs ${expectedDecorativeTablets} decorative tablets; found ${this.decorativeTablets.length}.`
      );
    }

    this.startQuestionRun();

    const chairBounds = new THREE.Box3().setFromObject(chairModel.scene);
    const chairCenter = chairBounds.getCenter(new THREE.Vector3());
    const chairHeight = chairBounds.getSize(new THREE.Vector3()).y;
    const chairScale = 0.82 / chairHeight;

    for (const rowZ of deskRowZPositions) {
      for (const x of columnXPositions) {
        const chair = new THREE.Group();
        const chairVisual = chairModel.scene.clone(true);
        chairVisual.scale.setScalar(chairScale);
        chairVisual.position.set(
          -chairCenter.x * chairScale,
          -chairBounds.min.y * chairScale,
          -chairCenter.z * chairScale
        );
        chairVisual.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });
        chair.add(chairVisual);
        const isPlayerChair =
          Math.abs(x - this.playerPosition.x) < 0.01 &&
          Math.abs(rowZ + 0.8 - PLAYER_SEAT_Z) < 0.01;
        chair.position.set(
          x,
          0.1,
          rowZ + 0.8 - (isPlayerChair ? PLAYER_FORWARD_OFFSET : 0)
        );
        chair.rotation.y = Math.PI / 2;
        this.root.add(chair);
        //this.occluders.push(chair);
      }
    }

    await this.createSeatedStudentModels(columnXPositions, deskRowZPositions);

    const studentAisle = new THREE.Mesh(
      new THREE.BoxGeometry(19, 0.03, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xd6b24c })
    );
    studentAisle.position.set(0, 0.08, -5.1);
    this.root.add(studentAisle);

    return { whiteboard: whiteboardModel.scene, brickTexture };

    // Retained temporarily as a fallback reference for the old instanced
    // placeholder students. The live classroom now uses the player-model pool
    // through createSeatedStudentModels above.
    const studentGeometry = {
      torso: PEDESTRIAN_GEOMETRY.body,
      head: PEDESTRIAN_GEOMETRY.head,
      arm: PEDESTRIAN_GEOMETRY.arm,
      thigh: PEDESTRIAN_GEOMETRY.leg,
      shin: PEDESTRIAN_GEOMETRY.leg,
      shoe: PEDESTRIAN_GEOMETRY.shoe,
      hairShort: PEDESTRIAN_GEOMETRY.hairShort,
      hairPuff: PEDESTRIAN_GEOMETRY.hairPuff,
      bun: PEDESTRIAN_GEOMETRY.bun,
      capCrown: PEDESTRIAN_GEOMETRY.capCrown,
      capBrim: PEDESTRIAN_GEOMETRY.capBrim
    };
    const trousersMaterial = new THREE.MeshStandardMaterial({ color: 0x26384c, roughness: 0.88 });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.72 });
    const hairMaterial = new THREE.MeshStandardMaterial({ color: 0x1d1714, roughness: 0.95 });
    const skinMaterials = SKIN_TONES.map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.86 })
    );
    const shirtColors = [0x56738f, 0xb65f6e, 0x4f8b69, 0xc18a45, 0x725f9e, 0x3f8794];
    const shirtMaterials = shirtColors.map(
      (color) => new THREE.MeshStandardMaterial({ color, roughness: 0.78 })
    );
    const studentSeats = [];

    for (let row = 0; row < deskRowZPositions.length; row += 1) {
      const seatZ = deskRowZPositions[row] + 0.8;

      for (let column = 0; column < columnXPositions.length; column += 1) {
        const x = columnXPositions[column];
        const isPlayerSeat =
          Math.abs(x - this.playerPosition.x) < 0.01 &&
          Math.abs(seatZ - PLAYER_SEAT_Z) < 0.01;

        if (!isPlayerSeat) {
          const styleIndex = row * DESKS_PER_ROW + column;
          studentSeats.push({
            x,
            z: seatZ,
            shirtIndex: styleIndex % shirtMaterials.length,
            skinIndex: (styleIndex * 5) % skinMaterials.length,
            hair: HAIR_STYLES[(styleIndex * 3) % HAIR_STYLES.length]
          });
        }
      }
    }

    const studentScale = 0.58;
    const studentBaseY = 0.26;
    // Match the Level 2 PedestrianFactory proportions exactly. In that rig,
    // the torso centre is at y=0.06 and the head centre at y=0.72, a 0.66
    // centre-to-centre offset. Applying the same offset to the seated torso
    // keeps the head touching the shoulders without sinking into the body.
    const studentTorsoY = studentBaseY + 0.92 * studentScale;
    const studentHeadY = studentTorsoY + 0.66 * studentScale;
    const transform = new THREE.Object3D();
    const createStudentInstances = (geometry, material, count) => {
      const instances = new THREE.InstancedMesh(geometry, material, count);
      instances.castShadow = true;
      instances.receiveShadow = true;
      this.root.add(instances);
      return instances;
    };
    const setStudentPart = (
      instances,
      index,
      x,
      y,
      z,
      rotationX = 0,
      rotationY = 0,
      rotationZ = 0,
      scale = studentScale
    ) => {
      transform.position.set(x, y, z);
      transform.rotation.set(rotationX, rotationY, rotationZ);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    };

    skinMaterials.forEach((skinMaterial, skinIndex) => {
      const matchingSeats = studentSeats.filter((seat) => seat.skinIndex === skinIndex);
      const heads = createStudentInstances(
        studentGeometry.head,
        skinMaterial,
        matchingSeats.length
      );

      matchingSeats.forEach(({ x, z }, index) => {
        setStudentPart(
          heads,
          index,
          x,
          studentHeadY,
          z - 0.02 * studentScale
        );
      });
      heads.instanceMatrix.needsUpdate = true;
    });

    // Build an actual seated leg pose instead of rotating one standing leg
    // through the chair. Thighs project forward from the seat, knees sit just
    // beyond the chair edge, and shins drop vertically toward the floor.
    const thighs = createStudentInstances(
      studentGeometry.thigh,
      trousersMaterial,
      studentSeats.length * 2
    );
    const shins = createStudentInstances(
      studentGeometry.shin,
      trousersMaterial,
      studentSeats.length * 2
    );
    const shoes = createStudentInstances(
      studentGeometry.shoe,
      shoeMaterial,
      studentSeats.length * 2
    );

    const studentHipY = studentBaseY + 0.47 * studentScale;
    const studentThighZ = -0.2 * studentScale;
    const studentKneeZ = -0.43 * studentScale;
    const studentShinY = studentBaseY + 0.16 * studentScale;
    const studentShoeY = studentBaseY - 0.08 * studentScale;
    const studentShoeZ = -0.46 * studentScale;

    studentSeats.forEach(({ x, z }, studentIndex) => {
      for (const [sideIndex, side] of [-1, 1].entries()) {
        const legIndex = studentIndex * 2 + sideIndex;
        const legX = x + side * 0.16 * studentScale;

        setStudentPart(
          thighs,
          legIndex,
          legX,
          studentHipY,
          z + studentThighZ,
          Math.PI / 2
        );
        setStudentPart(
          shins,
          legIndex,
          legX,
          studentShinY,
          z + studentKneeZ
        );
        setStudentPart(
          shoes,
          legIndex,
          legX,
          studentShoeY,
          z + studentShoeZ
        );
      }
    });
    thighs.instanceMatrix.needsUpdate = true;
    shins.instanceMatrix.needsUpdate = true;
    shoes.instanceMatrix.needsUpdate = true;

    shirtMaterials.forEach((shirtMaterial, shirtIndex) => {
      const matchingSeats = studentSeats.filter((seat) => seat.shirtIndex === shirtIndex);
      const torsos = createStudentInstances(
        studentGeometry.torso,
        shirtMaterial,
        matchingSeats.length
      );
      const arms = createStudentInstances(
        studentGeometry.arm,
        shirtMaterial,
        matchingSeats.length * 2
      );

      matchingSeats.forEach(({ x, z }, studentIndex) => {
        setStudentPart(
          torsos,
          studentIndex,
          x,
          studentTorsoY,
          z
        );

        for (const [sideIndex, side] of [-1, 1].entries()) {
          setStudentPart(
            arms,
            studentIndex * 2 + sideIndex,
            x + side * 0.34 * studentScale,
            studentBaseY + 0.88 * studentScale,
            z - 0.16 * studentScale,
            -0.72
          );
        }
      });
      torsos.instanceMatrix.needsUpdate = true;
      arms.instanceMatrix.needsUpdate = true;
    });

    const addHairInstances = (style, geometry, seats, yOffset = 0, zOffset = 0, scale = studentScale) => {
      if (!geometry || seats.length === 0) return;
      const hair = createStudentInstances(geometry, hairMaterial, seats.length);
      seats.forEach(({ x, z }, index) => {
        setStudentPart(
          hair,
          index,
          x,
          studentHeadY + 0.02 * studentScale + yOffset,
          z - 0.02 * studentScale + zOffset,
          0,
          0,
          0,
          scale
        );
      });
      hair.instanceMatrix.needsUpdate = true;
    };

    addHairInstances(
      "short",
      studentGeometry.hairShort,
      studentSeats.filter((seat) => seat.hair === "short"),
      0.01
    );
    addHairInstances(
      "puff",
      studentGeometry.hairPuff,
      studentSeats.filter((seat) => seat.hair === "puff"),
      0.05,
      -0.015
    );
    const bunSeats = studentSeats.filter((seat) => seat.hair === "bun");
    addHairInstances("bun-base", studentGeometry.hairShort, bunSeats, 0.01);
    addHairInstances(
      "bun",
      studentGeometry.bun,
      bunSeats,
      0.12,
      -0.09,
      studentScale * 0.95
    );
    const capSeats = studentSeats.filter((seat) => seat.hair === "cap");
    addHairInstances("cap-crown", studentGeometry.capCrown, capSeats, 0.025);
    if (capSeats.length > 0) {
      const brims = createStudentInstances(
        studentGeometry.capBrim,
        hairMaterial,
        capSeats.length
      );
      capSeats.forEach(({ x, z }, index) => {
        setStudentPart(
          brims,
          index,
          x,
          studentHeadY + 0.08 * studentScale,
          z + 0.11 * studentScale
        );
      });
      brims.instanceMatrix.needsUpdate = true;
    }
    const aisle = new THREE.Mesh(
      new THREE.BoxGeometry(19, 0.03, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xd6b24c })
    );
    aisle.position.set(0, 0.08, -5.1);
    this.root.add(aisle);

    return { whiteboard: whiteboardModel.scene, brickTexture };
  }

  async createSeatedStudentModels(columnXPositions, deskRowZPositions) {
    const factory = new AnimatedNpcFactory();
    await factory.load({
      idlePath: "./assets/models/level3-students/sitting-idle-heightened.fbx"
    });
    // The seating export includes scene-root Armature transforms that do not
    // exist on the reusable player rigs. Keep the bone tracks, but remove the
    // three unmatched root tracks so each seated student animates cleanly.
    factory.idleClip.tracks = factory.idleClip.tracks.filter(
      (track) => !track.name.startsWith("Armature.")
    );
    factory.idleClip.resetDuration();

    for (let row = 0; row < deskRowZPositions.length; row += 1) {
      const seatZ = deskRowZPositions[row] + 0.8;
      for (let column = 0; column < columnXPositions.length; column += 1) {
        const x = columnXPositions[column];
        const isPlayerSeat =
          Math.abs(x - this.playerPosition.x) < 0.01 &&
          Math.abs(seatZ - PLAYER_SEAT_Z) < 0.01;
        if (isPlayerSeat) continue;

        const variant = (row * DESKS_PER_ROW + column) % STUDENT_MODEL_VARIANTS.length;
        const student = factory.create({
          variant,
          scale: 0.75,
          includeBackpack: false
        });
        student.name = `level3-seated-student-${row}-${column}`;
        student.position.set(x, 0.1, seatZ);
        student.rotation.y = Math.PI;

        // Preview a lift only on the Level 3 male-3 variant. The factory
        // shares source materials, so clone first to leave Level 2 and every
        // other student unchanged.
        if (STUDENT_MODEL_VARIANTS[variant].id === "male-3") {
          const liftMaterial = (material) => {
            const previewMaterial = material.clone();
            if (previewMaterial.emissive) {
              previewMaterial.emissive.set(0x2c251f);
              previewMaterial.emissiveIntensity = 0.18;
            }
            return previewMaterial;
          };

          student.traverse((object) => {
            if (!object.isMesh) return;
            object.material = Array.isArray(object.material)
              ? object.material.map(liftMaterial)
              : liftMaterial(object.material);
          });
        }

        // Each seat owns a mixer; offset its otherwise shared idle clip so
        // the classroom reads as individual students rather than one loop.
        const animation = student.userData.animation;
        const phase = ((row * 37 + column * 17 + 11) % 53) / 53;
        animation.mixer.setTime(phase * animation.idle.getClip().duration);
        this.root.add(student);
        this.seatedStudentMixers.push(animation.mixer);
      }
    }
  }

  createDeskPaper(text, x, z, color = 0xfff7d6) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 600;
    const context = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(
      8,
      this.game.renderer.capabilities.getMaxAnisotropy()
    );

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.DoubleSide,
      toneMapped: false
    });
    const paper = new THREE.Mesh(
      new THREE.PlaneGeometry(PLAYER_PAPER_WIDTH, PLAYER_PAPER_HEIGHT),
      material
    );
    paper.position.set(x, PLAYER_PAPER_REST_HEIGHT, z);
    // Lean the page's normal 30° toward the seated player for legibility.
    paper.rotation.x = PLAYER_PAPER_REST_ROTATION;
    paper.scale.setScalar(PLAYER_PAPER_SCALE);
    paper.userData.paperCanvas = canvas;
    paper.userData.paperContext = context;
    paper.userData.paperTexture = texture;
    paper.userData.paperColor = color;
    this.root.add(paper);
    this.drawPaperText(paper, text);
    return paper;
  }

  drawPaperText(paper, text) {
    const context = paper.userData.paperContext;
    const { width, height } = paper.userData.paperCanvas;

    context.fillStyle = `#${paper.userData.paperColor.toString(16).padStart(6, "0")}`;
    context.fillRect(0, 0, width, height);
    context.strokeStyle = "#26313d";
    context.lineWidth = 8;
    context.strokeRect(8, 8, width - 16, height - 16);
    context.fillStyle = "#17202a";
    context.font = "bold 54px sans-serif";
    if (!this.activeQuestion || paper !== this.playerDesk?.paper) {
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text || "_", width / 2, height / 2, width - 42);
      paper.userData.paperTexture.needsUpdate = true;
      return;
    }

    context.textAlign = "left";
    context.textBaseline = "top";
    context.font = "bold 30px sans-serif";
    const totalQuestions = Math.ceil(100 / LEVEL_THREE_BALANCE.answerGainPerCorrectWord);
    const answeredQuestions = Math.min(totalQuestions,
      Math.round(this.answerProgress / LEVEL_THREE_BALANCE.answerGainPerCorrectWord));
    const currentQuestion = Math.min(answeredQuestions + 1, totalQuestions);
    context.fillText(`QUESTION ${currentQuestion} OF ${totalQuestions}`, 38, 42);
    context.font = "29px sans-serif";
    const questionBottom = this.drawWrappedPaperText(
      context,
      this.activeQuestion.prompt,
      38,
      98,
      width - 76,
      38
    );
    const answerLabelY = Math.max(290, questionBottom + 50);
    context.strokeStyle = "#26313d";
    context.lineWidth = 4;
    context.strokeRect(32, answerLabelY - 22, width - 64, 140);
    context.font = "bold 30px sans-serif";
    context.fillText("YOUR ANSWER", 52, answerLabelY);
    context.font = "bold 32px monospace";
    context.fillText(
      `${this.typedAnswer || ""}_`,
      52,
      answerLabelY + 62,
      width - 104
    );
    // Progress belongs to the answer sheet and redraws with each answer.
    context.fillStyle = "#26313d";
    context.font = "bold 24px sans-serif";
    context.fillText(`${answeredQuestions} OF ${totalQuestions} ANSWERED`, 38, height - 76);
    const progressWidth = width - 76;
    context.fillStyle = "#d0d5d2";
    context.fillRect(38, height - 40, progressWidth, 18);
    context.fillStyle = "#38865b";
    context.fillRect(38, height - 40,
      progressWidth * THREE.MathUtils.clamp(this.answerProgress / 100, 0, 1), 18);
    context.strokeStyle = "#26313d";
    context.lineWidth = 2;
    context.strokeRect(38, height - 40, progressWidth, 18);
    paper.userData.paperTexture.needsUpdate = true;
  }

  drawWrappedPaperText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(/\s+/);
    let line = "";
    let lineY = y;

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        context.fillText(line, x, lineY, maxWidth);
        line = word;
        lineY += lineHeight;
      } else {
        line = candidate;
      }
    }

    if (line) context.fillText(line, x, lineY, maxWidth);
    return lineY + lineHeight;
  }

  createDeskTablet(tabletTemplate, x, z) {
    const tablet = new THREE.Group();
    const visual = tabletTemplate.clone(true);
    const bounds = new THREE.Box3().setFromObject(visual);
    const center = bounds.getCenter(new THREE.Vector3());

    visual.position.sub(center);
    visual.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });

    tablet.add(visual);
    tablet.position.set(x, DESK_SURFACE_HEIGHT + DESK_CONTENT_CLEARANCE + 0.012, z);
    tablet.rotation.x = -Math.PI / 2;
    tablet.rotation.z = 0;
    tablet.scale.setScalar(1.08);
    this.root.add(tablet);
    return tablet;
  }

  createTabletInteractionTarget(x, z) {
    const target = new THREE.Mesh(
      this.tabletTargetGeometry,
      this.tabletTargetMaterial
    );
    target.position.set(
      x,
      DESK_SURFACE_HEIGHT + DESK_CONTENT_CLEARANCE + TABLET_TARGET_HEIGHT / 2,
      z
    );
    target.visible = false;
    this.root.add(target);
    return target;
  }

  createWordHologram(word, x, z) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 192;
    const context = canvas.getContext("2d");
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      toneMapped: false
    });
    const hologram = new THREE.Sprite(material);
    hologram.position.set(x, HOLOGRAM_HEIGHT, z);
    hologram.scale.set(HOLOGRAM_WIDTH, HOLOGRAM_DISPLAY_HEIGHT, 1);
    hologram.visible = false;
    hologram.userData.wordCanvas = canvas;
    hologram.userData.wordContext = context;
    hologram.userData.wordTexture = texture;
    // Cycle controlled variants so every room includes top-only, bottom-only,
    // and double-torn notes. Their randomized edges remain stable on redraw.
    const tearStyle = HOLOGRAM_TEAR_STYLES[
      this.hologramTearStyleIndex % HOLOGRAM_TEAR_STYLES.length
    ];
    this.hologramTearStyleIndex += 1;
    hologram.userData.topTornEdge = tearStyle === "bottom"
      ? null
      : Array.from({ length: 13 }, () => THREE.MathUtils.randInt(16, 39));
    hologram.userData.bottomTornEdge = tearStyle === "top"
      ? null
      : Array.from({ length: 13 }, () => THREE.MathUtils.randInt(145, 169));
    this.root.add(hologram);
    this.drawHologramText(hologram, word);
    return hologram;
  }

  drawHologramText(hologram, word) {
    const context = hologram.userData.wordContext;
    const { width, height } = hologram.userData.wordCanvas;

    context.clearRect(0, 0, width, height);
    const paperLeft = 16;
    const paperRight = width - 16;
    const paperTop = 16;
    const paperBottom = 168;
    const topTornEdge = hologram.userData.topTornEdge;
    const bottomTornEdge = hologram.userData.bottomTornEdge;
    const tearStep = (paperRight - paperLeft) / 12;

    context.save();
    context.beginPath();
    context.moveTo(paperLeft, topTornEdge?.[0] ?? paperTop);
    if (topTornEdge) {
      for (let index = 1; index < topTornEdge.length; index += 1) {
        context.lineTo(paperLeft + index * tearStep, topTornEdge[index]);
      }
    } else {
      context.lineTo(paperRight, paperTop);
    }
    context.lineTo(paperRight, bottomTornEdge?.[0] ?? paperBottom);
    if (bottomTornEdge) {
      for (let index = 1; index < bottomTornEdge.length; index += 1) {
        context.lineTo(paperRight - index * tearStep, bottomTornEdge[index]);
      }
    } else {
      context.lineTo(paperLeft, paperBottom);
    }
    context.closePath();
    context.shadowColor = "rgba(53, 39, 25, 0.35)";
    context.shadowBlur = 10;
    context.shadowOffsetY = 5;
    context.fillStyle = "rgba(255, 253, 244, 0.96)";
    context.fill();
    context.shadowColor = "transparent";
    context.clip();

    context.strokeStyle = "rgba(111, 163, 213, 0.65)";
    context.lineWidth = 2;
    for (let lineY = 48; lineY < 164; lineY += 24) {
      context.beginPath();
      context.moveTo(paperLeft + 12, lineY);
      context.lineTo(paperRight - 12, lineY);
      context.stroke();
    }
    context.strokeStyle = "rgba(207, 89, 76, 0.65)";
    context.beginPath();
    context.moveTo(paperLeft + 44, paperTop + 8);
    context.lineTo(paperLeft + 44, 166);
    context.stroke();
    context.restore();

    context.fillStyle = "#162f4b";
    context.font = `bold 54px "${HOLOGRAM_FONT_FAMILY}", Georgia, serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(word.toUpperCase(), width / 2 + 12, 103, width - 96);
    hologram.userData.wordTexture.needsUpdate = true;
  }

  createLightingIdentity({ whiteboard, brickTexture }) {
    let useSourceBrickTexture = true;
    const createWallMaterial = (width, height) => {
      const texture = useSourceBrickTexture ? brickTexture : brickTexture.clone();
      useSourceBrickTexture = false;
      texture.repeat.set(width / 4, height / 2.5);
      texture.needsUpdate = true;
      return new THREE.MeshStandardMaterial({
        map: texture,
        color: 0xffffff,
        roughness: 0.9
      });
    };
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0xf1e8d8,
      roughness: 0.88
    });
    const beamMaterial = new THREE.MeshStandardMaterial({
      color: 0xd7c9b4,
      roughness: 0.82
    });
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(CLASSROOM_WIDTH, 0.22, CLASSROOM_DEPTH), ceilingMaterial);
    ceiling.position.set(0, 6.2, CLASSROOM_CENTER_Z);
    ceiling.receiveShadow = true;
    this.root.add(ceiling);

    for (const z of [-6, -2, 2, 6, 10]) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(CLASSROOM_WIDTH, 0.16, 0.18),
        beamMaterial
      );
      beam.position.set(0, 6.02, z);
      beam.receiveShadow = true;
      this.root.add(beam);
    }
    for (const x of [-7.3, 0, 7.3]) {
      const beam = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.16, CLASSROOM_DEPTH),
        beamMaterial
      );
      beam.position.set(x, 6.01, CLASSROOM_CENTER_Z);
      beam.receiveShadow = true;
      this.root.add(beam);
    }

    const windowHeight = WINDOW_TOP_Y - WINDOW_BOTTOM_Y;
    const lowerWallHeight = WINDOW_BOTTOM_Y;
    const upperWallHeight = 6.2 - WINDOW_TOP_Y;
    const windowFrameMaterial = new THREE.MeshStandardMaterial({
      color: 0xf0e4cf,
      roughness: 0.72
    });
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xeaf7ff,
      emissive: 0xb9e7ff,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.24,
      roughness: 0.12,
      metalness: 0.05,
      side: THREE.DoubleSide,
      depthWrite: false
    });

    for (const x of [-CLASSROOM_HALF_WIDTH, CLASSROOM_HALF_WIDTH]) {
      const lowerWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, lowerWallHeight, CLASSROOM_DEPTH),
        createWallMaterial(CLASSROOM_DEPTH, lowerWallHeight)
      );
      lowerWall.position.set(x, lowerWallHeight / 2, CLASSROOM_CENTER_Z);
      lowerWall.receiveShadow = true;
      this.root.add(lowerWall);

      const upperWall = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, upperWallHeight, CLASSROOM_DEPTH),
        createWallMaterial(CLASSROOM_DEPTH, upperWallHeight)
      );
      upperWall.position.set(x, WINDOW_TOP_Y + upperWallHeight / 2, CLASSROOM_CENTER_Z);
      upperWall.receiveShadow = true;
      this.root.add(upperWall);

      let pierStartZ = CLASSROOM_FRONT_Z;
      for (const windowZ of WINDOW_CENTERS_Z) {
        const pierEndZ = windowZ - WINDOW_WIDTH / 2;
        const pierDepth = pierEndZ - pierStartZ;
        const pier = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, windowHeight, pierDepth),
          createWallMaterial(pierDepth, windowHeight)
        );
        pier.position.set(x, WINDOW_BOTTOM_Y + windowHeight / 2, pierStartZ + pierDepth / 2);
        pier.receiveShadow = true;
        this.root.add(pier);
        pierStartZ = windowZ + WINDOW_WIDTH / 2;

        const paneX = x < 0 ? x + 0.03 : x - 0.03;
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, windowHeight - 0.16, WINDOW_WIDTH - 0.16),
          glassMaterial
        );
        pane.position.set(paneX, WINDOW_BOTTOM_Y + windowHeight / 2, windowZ);
        this.root.add(pane);

        for (const frameZ of [windowZ - WINDOW_WIDTH / 2, windowZ, windowZ + WINDOW_WIDTH / 2]) {
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, windowHeight + 0.12, 0.1),
            windowFrameMaterial
          );
          frame.position.set(paneX, WINDOW_BOTTOM_Y + windowHeight / 2, frameZ);
          this.root.add(frame);
        }
        for (const frameY of [WINDOW_BOTTOM_Y, WINDOW_BOTTOM_Y + windowHeight / 2, WINDOW_TOP_Y]) {
          const frame = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 0.1, WINDOW_WIDTH + 0.12),
            windowFrameMaterial
          );
          frame.position.set(paneX, frameY, windowZ);
          this.root.add(frame);
        }
      }

      const finalPierDepth = CLASSROOM_BACK_Z - pierStartZ;
      const finalPier = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, windowHeight, finalPierDepth),
        createWallMaterial(finalPierDepth, windowHeight)
      );
      finalPier.position.set(x, WINDOW_BOTTOM_Y + windowHeight / 2, pierStartZ + finalPierDepth / 2);
      finalPier.receiveShadow = true;
      this.root.add(finalPier);
    }
    const frontWall = new THREE.Mesh(
      new THREE.BoxGeometry(CLASSROOM_WIDTH, 6.2, 0.2),
      createWallMaterial(CLASSROOM_WIDTH, 6.2)
    );
    frontWall.position.set(0, 3.1, CLASSROOM_FRONT_Z);
    frontWall.receiveShadow = true;
    this.root.add(frontWall);
    const backWall = new THREE.Mesh(
      new THREE.BoxGeometry(CLASSROOM_WIDTH, 6.2, 0.2),
      createWallMaterial(CLASSROOM_WIDTH, 6.2)
    );
    backWall.position.set(0, 3.1, CLASSROOM_BACK_Z);
    backWall.receiveShadow = true;
    this.root.add(backWall);

    const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0xfff8dd, emissive: 0xffdf9c, emissiveIntensity: 2.2 });
    for (const [x, z] of [[-6, 7], [6, 7], [-6, 1], [6, 1], [-6, -5], [6, -5]]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.55), fixtureMaterial);
      fixture.position.set(x, 6.02, z);
      this.root.add(fixture);
      const light = new THREE.PointLight(0xffe1b5, 3.2, 11, 2);
      light.position.set(x, 5.8, z);
      this.root.add(light);
    }

    const whiteboardTarget = new THREE.Vector3(0, 3.3, -7.6);
    const whiteboardWallZ = -7.68;
    const whiteboardBounds = new THREE.Box3().setFromObject(whiteboard);
    const whiteboardCenter = whiteboardBounds.getCenter(new THREE.Vector3());
    const whiteboardWidth = whiteboardBounds.getSize(new THREE.Vector3()).x;
    const whiteboardScale = 5.8 / whiteboardWidth;
    whiteboard.scale.setScalar(whiteboardScale);
    whiteboard.position.set(
      whiteboardTarget.x - whiteboardCenter.x * whiteboardScale,
      whiteboardTarget.y - whiteboardCenter.y * whiteboardScale,
      whiteboardWallZ - whiteboardBounds.min.z * whiteboardScale
    );
    whiteboard.traverse((object) => {
      if (!object.isMesh) return;
      object.castShadow = true;
      object.receiveShadow = true;
    });
    this.root.add(whiteboard);

    const projector = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.35, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x30343c, emissive: 0x80b8ff, emissiveIntensity: 1.1 })
    );
    projector.position.set(0, 5.6, 5.2);
    this.root.add(projector);
    const projectorTarget = new THREE.Object3D();
    projectorTarget.position.copy(whiteboardTarget);
    this.root.add(projectorTarget);
    const projectorGlow = new THREE.SpotLight(0x8abaff, 1.1, 18, THREE.MathUtils.degToRad(20), 0.7, 1.5);
    projectorGlow.position.copy(projector.position);
    projectorGlow.target = projectorTarget;
    this.root.add(projectorGlow);
  }
  async createTutor() {
    this.tutor = await createAnimatedTutor();
    this.tutor.position.copy(this.patrolPoints[TUTOR_OPENING_START_INDEX]);
    this.tutor.rotation.y = getTutorOpeningYaw(this.patrolPoints);
    this.tutor.name = "level-3-tutor";
    this.root.add(this.tutor);
    this.collisionWorld.add({
      object: this.tutor,
      size: [0.85, 1.9, 0.85],
       color: 0x58708a,
      tag: "tutor"
    });

    this.tutorHead = this.tutor.userData.head;
    // Mixamo's head-bone origin lies at the lower face. Keep the vision
    // systems on an eye-height child so they follow every head scan cleanly.
    this.tutorEye = new THREE.Object3D();
    this.tutorEye.name = "tutor-eye-vision-anchor";
    this.tutorEye.position.set(0, 0.08, 0.08);
    this.tutorHead.add(this.tutorEye);

    this.visionTarget = new THREE.Object3D();
    this.root.add(this.visionTarget);
    this.spotlight = new THREE.SpotLight(
      0xff7f86,
      1.35,
      10,
      THREE.MathUtils.degToRad(32),
      0.55,
      1.5
    );
    this.spotlight.castShadow = true;
    this.tutorEye.add(this.spotlight);
    this.spotlight.target = this.visionTarget;

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(
        Math.tan(VISION_CONE_HALF_ANGLE) * VISION_CONE_LENGTH,
        VISION_CONE_LENGTH,
        24,
        1,
        true
      ),
      new THREE.MeshBasicMaterial({
        color: 0xff8a8f,
        transparent: true,
        opacity: VISION_CONE_OPACITY,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = VISION_CONE_LENGTH / 2;
    this.visionConeMaterial = cone.material;
    this.tutorEye.add(cone);
  }

  beginTutorial() {
    if (!this.camera || this.tutorialPose) return;
    this.tutorialPose = {
      yaw: this.yaw,
      pitch: this.pitch,
      fov: this.camera.fov
    };
    this.endPeek();
    this.typedAnswer = "";
    this.currentCopiedWord = null;
    this.currentCopiedDesk = null;
    this.updatePlayerPaper();
  }

  moveTutorialLook(dx, dy) {
    const sensitivity = this.game.levelThreeLookSensitivity ?? 1;
    this.yaw -= dx * 0.002 * sensitivity;
    this.pitch -= dy * 0.002 * sensitivity;
    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    this.pitch = clamp(this.pitch, -0.65, 0.45);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  setTutorialMouseDown(active) {
    this.leftMouseDown = Boolean(active);
  }

  updateTutorial(dt) {
    if (!this.camera) return;
    this.updateDeskTargeting();
    this.updatePlayerPaperPose(dt);

    this.zoomActive = this.leftMouseDown;
    this.peekActive = Boolean(this.zoomActive && this.targetCheatDesk);
    this.zoomOverlay?.classList.toggle("visible", this.zoomActive);

    for (const desk of this.cheatDesks) {
      desk.hologram.visible = this.peekActive && desk === this.targetCheatDesk;
    }

    if (this.peekActive) {
      this.currentCopiedDesk = this.targetCheatDesk;
      this.currentCopiedWord = this.targetCheatDesk.word;
    }

    const targetFov = this.zoomActive ? PEEK_CAMERA_FOV : NORMAL_CAMERA_FOV;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, Math.min(1, dt * 10));
    this.camera.updateProjectionMatrix();
  }

  endTutorial() {
    if (!this.tutorialPose || !this.camera) return;
    this.endPeek();
    this.yaw = this.tutorialPose.yaw;
    this.pitch = this.tutorialPose.pitch;
    this.camera.fov = this.tutorialPose.fov;
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld(true);
    this.targetCheatDesk = null;
    this.isLookingAtPlayerDesk = false;
    this.currentCopiedWord = null;
    this.currentCopiedDesk = null;
    this.typedAnswer = "";
    this.feedbackMessage = "";
    this.feedbackTime = 0;
    this.updatePlayerPaper();
    this.game.input.clearMouseDelta();
    this.tutorialPose = null;
  }

  update(dt) {
    if (this.completed) {
      return;
    }

    this.ensureGameplayAudio();
    for (const mixer of this.seatedStudentMixers) mixer.update(dt);
    this.updateTutor(dt);
    this.updateMouseLook();
    this.updateDeskTargeting();
    this.updatePlayerPaperPose(dt);
    this.updatePeek(dt);
    this.updateSuspicion(dt);
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);
    this.feedbackTime = Math.max(0, this.feedbackTime - dt);

    if (this.feedbackTime === 0) {
      this.feedbackMessage = "";
    }

    this.updateLevelThreeHUD(dt);

    if (this.answerProgress >= 100) {
      this.completed = true;
      this.game.completeLevel("Test completed. Calculating results…", {
        time: LEVEL_THREE_TIME_LIMIT - this.timeRemaining,
        incorrectAnswers: this.incorrectAnswers,
        suspicion: this.suspicion
      });
    }

    if (this.timeRemaining <= 0) {
      this.completed = true;
      this.game.failLevel({
        title: "Time is up",
        reason: `The test ended with your answer sheet ${Math.round(this.answerProgress)}% full. Peek, look down, type, repeat — every second spent waiting is one you cannot type in.`,
        next: `Retry restarts the test with a fresh ${LEVEL_THREE_TIME_LIMIT} seconds.`
      });
    }

    if (this.suspicion >= 100) {
      this.completed = true;
      this.endPeek();
      this.game.flashHUD();
      this.game.failLevel({
        title: "Caught by the tutor",
        reason: "Suspicion reached 100%. The tutor was looking your way while you were peeking at another tablet — let it fall back down between peeks.",
        next: `Retry restarts the test with a fresh ${LEVEL_THREE_TIME_LIMIT} seconds.`
      });
    }
  }


  ensureGameplayAudio() {
    if (this.gameplayAudioStarted) return;
    this.gameplayAudioStarted = true;

    this.audio.startLoop("level3-classroom", LEVEL3_CLASSROOM_AMBIENCE_AUDIO, {
      bus: "ambience",
      volume: 0.21
    });
    this.audio.startLoop("level3-heartbeat", LEVEL3_HEARTBEAT_AUDIO, {
      bus: "ambience",
      volume: 0,
      playbackRate: 0.88
    });
    this.audio.startLoop("level3-clock", LEVEL3_CLOCK_AUDIO, {
      bus: "ambience",
      volume: 0.006
    });
  }

  updateLevelThreeHUD(dt) {
    if (!this.levelThreeHud?.root?.isConnected) {
      this.game.setHUD(`
        <div class="game-hud l3-hud">
          <section class="l3-timer" aria-label="Test timer">
            <div class="l3-stopwatch" aria-hidden="true" data-l3-stopwatch>
              <img class="l3-stopwatch-base" src="./assets/images/ui/level3-stopwatch-base.png" alt="" draggable="false" />
              <div class="l3-stopwatch-sweep"></div>
              <img class="l3-stopwatch-hand" src="./assets/images/ui/level3-stopwatch-hand.png" alt="" draggable="false" />
            </div>
            <div class="l3-timer-caption">Time <strong data-l3-time></strong></div>
          </section>
          <div class="hud-tip l3-context" data-l3-context></div>
          <section class="l3-suspicion-meter" aria-labelledby="l3-suspicion-label">
            <div class="l3-suspicion-label" id="l3-suspicion-label">Suspicion</div>
            <div class="l3-suspicion-track" role="meter" aria-label="Suspicion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" data-l3-suspicion-meter>
              <div class="l3-suspicion-fill" data-l3-suspicion-fill></div>
            </div>
            <output class="l3-suspicion-value" data-l3-suspicion-value>0%</output>
          </section>
        </div>
      `, "level3");
      const root = this.game.hudElement.querySelector(".l3-hud");
      this.levelThreeHud = {
        root,
        time: root.querySelector("[data-l3-time]"),
        stopwatch: root.querySelector("[data-l3-stopwatch]"),
        context: root.querySelector("[data-l3-context]"),
        suspicionValue: root.querySelector("[data-l3-suspicion-value]"),
        suspicionMeter: root.querySelector("[data-l3-suspicion-meter]"),
        suspicionFill: root.querySelector("[data-l3-suspicion-fill]")
      };
    }

    const hud = this.levelThreeHud;
    hud.time.textContent = `${Math.ceil(this.timeRemaining)}s`;
    // Use gameplay time so the hand and swept area freeze together on pause.
    const elapsedFraction = THREE.MathUtils.clamp(
      1 - this.timeRemaining / LEVEL_THREE_TIME_LIMIT, 0, 1
    );
    hud.stopwatch.style.setProperty("--timer-angle", `${elapsedFraction * 360}deg`);
    hud.context.textContent = this.getContextInstruction();
    if (this.isLookingAtPlayerDesk) {
      const typed = document.createElement("span");
      typed.className = "gap-hint";
      typed.textContent = ` > ${this.typedAnswer}_`;
      hud.context.append(document.createElement("br"), typed);
    }
    hud.suspicionValue.value = `${Math.round(this.suspicion)}%`;
    hud.suspicionValue.textContent = `${Math.round(this.suspicion)}%`;

    const suspicion = THREE.MathUtils.clamp(this.suspicion, 0, 100);
    hud.suspicionFill.style.transform = `scaleY(${suspicion / 100})`;
    hud.suspicionMeter.setAttribute("aria-valuenow", Math.round(suspicion));
    // Keep the phase continuous as the shake speeds up, avoiding animation jumps.
    const shakeProgress = THREE.MathUtils.clamp((suspicion - 50) / 49, 0, 1);
    const shaking = suspicion >= 50;
    const shakePeriod = THREE.MathUtils.lerp(0.7, 0.3, shakeProgress);
    hud.shakePhase = shaking
      ? ((hud.shakePhase ?? 0) + (dt ?? 0) * Math.PI * 2 / shakePeriod) % (Math.PI * 2)
      : 0;
    const shakeWave = Math.sin(hud.shakePhase);
    hud.suspicionMeter.classList.toggle("is-danger", shaking);
    hud.suspicionMeter.style.setProperty("--shake-x", `${shakeWave * THREE.MathUtils.lerp(1, 4, shakeProgress)}px`);
    hud.suspicionMeter.style.setProperty("--shake-rotation", `${shakeWave * THREE.MathUtils.lerp(0.5, 2, shakeProgress)}deg`);
  }

  handleTutorPatrolArrival(reachedIndex) {
  if (reachedIndex === TUTOR_PLAYER_APPROACH_INDEX) {
    this.extraPlayerPassesRemaining =
      getExtraTutorPlayerPasses(this.suspicion);
    return;
  }

  if (
    reachedIndex === TUTOR_PLAYER_NEAR_INDEX &&
    this.extraPlayerPassesRemaining > 0
  ) {
    this.extraPlayerPassesRemaining -= 1;

    // Recheck the centre aisle immediately in front of the player
    // before continuing with the wider classroom patrol.
    this.tutorMover.index = TUTOR_PLAYER_RECHECK_INDEX;
  }
}

  updateTutor(dt) {
    const previousPosition = this.tutor.position.clone();
    const patrolResult = this.tutorMover.update(dt);

    if (patrolResult.arrived) {
      this.handleTutorPatrolArrival(patrolResult.reached);
    }
    const movement = this.tutor.position
      .clone()
      .sub(previousPosition)
      .setY(0);

    const isWalking = movement.lengthSq() > 0.0001;
    if (isWalking) {
      this.tutorWalkGrace = 0.12;
    } else {
      this.tutorWalkGrace = Math.max(0, this.tutorWalkGrace - dt);
    }
    const animateWalking = isWalking || this.tutorWalkGrace > 0;
    const isScanning = this.tutorMover.pauseTimer > 0;

    if (isWalking) {
      const targetYaw = Math.atan2(movement.x, movement.z);
      const difference = Math.atan2(
        Math.sin(targetYaw - this.tutor.rotation.y),
        Math.cos(targetYaw - this.tutor.rotation.y)
      );

      this.tutor.rotation.y += THREE.MathUtils.clamp(
        difference,
        -5 * dt,
        5 * dt
      );
    } else if (isScanning) {
      // During each patrol pause, deliberately turn toward the player's
      // side of the room instead of scanning only along the walking path.
      const toPlayer = this.playerPosition
        .clone()
        .sub(this.tutor.position)
        .setY(0);

      if (toPlayer.lengthSq() > 0.0001) {
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        const difference = Math.atan2(
          Math.sin(targetYaw - this.tutor.rotation.y),
          Math.cos(targetYaw - this.tutor.rotation.y)
        );

        const maxTurn =
          LEVEL_THREE_BALANCE.tutorTurnSpeed * dt;

        this.tutor.rotation.y += THREE.MathUtils.clamp(
          difference,
          -maxTurn,
          maxTurn
        );
      }
    }

    this.patrolState = isScanning ? "scan" : "walk";
    this.stateTimer = this.tutorMover.pauseTimer;
    this.tutorTime += dt;

    this.updateTutorAnimation(dt, animateWalking);

    this.audio.updateTutorFootsteps(
      dt,
      isWalking,
      this.tutor.position.x,
      this.playerPosition.x,
      LEVEL3_TUTOR_STEPS,
      Math.hypot(
        this.tutor.position.x - this.playerPosition.x,
        this.tutor.position.z - this.playerPosition.z
      )
    );

    const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      this.tutorEye.getWorldQuaternion(new THREE.Quaternion())
    );

    const eyePosition = this.tutorEye.getWorldPosition(this.visionEyePosition);
    this.visionTarget.position.copy(eyePosition).addScaledVector(headForward, 10);
    this.updateVisionConeFade(eyePosition, headForward);
  }

  updateVisionConeFade(eyePosition, forward) {
    this.visionCameraOffset.copy(this.camera.position).sub(eyePosition);
    const forwardDistance = this.visionCameraOffset.dot(forward);
    const lateralDistanceSq = Math.max(
      0,
      this.visionCameraOffset.lengthSq() - forwardDistance * forwardDistance
    );
    const coneRadius = Math.tan(VISION_CONE_HALF_ANGLE) * forwardDistance;
    const cameraIsInsideCone =
      forwardDistance > 0 &&
      forwardDistance < VISION_CONE_LENGTH &&
      lateralDistanceSq <= coneRadius * coneRadius;

    let opacity = VISION_CONE_OPACITY;
    if (cameraIsInsideCone) {
      const progress = forwardDistance / VISION_CONE_LENGTH;
      const nearFade = THREE.MathUtils.smoothstep(progress, 0.12, 0.32);
      const farFade = 1 - THREE.MathUtils.smoothstep(progress, 0.5, 0.82);
      opacity *= nearFade * farFade;
    }
    this.visionConeMaterial.opacity = opacity;
  }

  updateTutorAnimation(dt, isWalking) {
    const animation = this.tutor.userData.animation;
    const next = isWalking ? animation.walk : animation.idle;
    if (next !== animation.active) {
      next.reset().play();
      animation.active.crossFadeTo(next, 0.18, false);
      animation.active = next;
    }
    animation.walk.timeScale = 1.35;
    animation.mixer.update(dt);

    if (this.patrolState === "scan") {
      // Keep the Level 3 gameplay cue: the head, spotlight and vision cone
      // sweep together while the tutor scans the room.
      this.tutorHead.rotation.y =
        Math.sin(this.tutorTime * 2.4) *
        THREE.MathUtils.degToRad(18);
    } else {
      this.tutorHead.rotation.y =
        Math.sin(this.tutorWalkPhase * 0.5) *
        (isWalking ? 0.07 : 0.025);
    }
  }

  updateMinimapCameraFrustum(aspect = 4 / 3) {
    if (!this.minimapCamera) return;
    const viewHeight = 8.5, viewWidth = viewHeight * aspect;
    this.minimapCamera.left = -viewWidth / 2;
    this.minimapCamera.right = viewWidth / 2;
    this.minimapCamera.top = viewHeight / 2;
    this.minimapCamera.bottom = -viewHeight / 2;
    this.minimapCamera.updateProjectionMatrix();
  }

  renderOverlay(renderer) {
    if (!this.tutor || !this.minimapCamera || !this.minimapElement || this.minimapElement.hidden) return;
    const rect = this.minimapElement.getBoundingClientRect(), canvasRect = renderer.domElement.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    this.updateMinimapCameraFrustum(rect.width / rect.height);
    const { x, z } = this.tutor.position, angle = this.tutor.rotation.y;
    const fx = Math.sin(angle), fz = Math.cos(angle);
    this.minimapCamera.up.set(fx, 0, fz);
    const halfW = (this.minimapCamera.right - this.minimapCamera.left) / 2;
    const halfH = (this.minimapCamera.top - this.minimapCamera.bottom) / 2;
    const spanX = Math.abs(fz) * halfW + Math.abs(fx) * halfH;
    const spanZ = Math.abs(fx) * halfW + Math.abs(fz) * halfH;
    const mapX = THREE.MathUtils.clamp(x, -CLASSROOM_HALF_WIDTH + spanX, CLASSROOM_HALF_WIDTH - spanX);
    const mapZ = THREE.MathUtils.clamp(z, CLASSROOM_FRONT_Z + spanZ, CLASSROOM_BACK_Z - spanZ);
    this.minimapCamera.position.set(mapX, 5.5, mapZ);
    this.minimapCamera.lookAt(mapX, 0, mapZ);

    const vx = Math.round(rect.left - canvasRect.left), vy = Math.round(canvasRect.bottom - rect.bottom);
    const width = Math.round(rect.width), height = Math.round(rect.height), autoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.setScissorTest(true);
    renderer.setScissor(vx, vy, width, height);
    renderer.setViewport(vx, vy, width, height);
    renderer.clear(true, true, true);
    renderer.render(this.game.scene, this.minimapCamera);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, canvasRect.width, canvasRect.height);
    renderer.autoClear = autoClear;
  }

  updateMouseLook() {
    if (!this.game.input.isPointerLocked()) return;

    const mouse = this.game.input.consumeMouseDelta();

    const sensitivity = this.game.levelThreeLookSensitivity ?? 1;
    this.yaw -= mouse.x * 0.002 * sensitivity;
    this.pitch -= mouse.y * 0.002 * sensitivity;

    this.yaw = Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw));
    this.pitch = clamp(this.pitch, -0.65, 0.45);

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  resetCameraToWhiteboard() {
    // A transition can leave pointer-lock mouse movement buffered while the
    // classroom assets load. Clear it and explicitly restore the front-facing
    // seated view so every Level 3 run begins aimed at the whiteboard.
    this.yaw = 0;
    this.pitch = 0;
    this.camera.rotation.set(0, 0, 0, "YXZ");
    this.camera.updateMatrixWorld(true);
    this.game.input.clearMouseDelta();
  }

  updateDeskTargeting() {
    this.targetCheatDesk = null;
    this.isLookingAtPlayerDesk = false;
    this.root.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.interactionRaycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.interactionRaycaster.far = DESK_INTERACTION_DISTANCE;

    const targets = [];

    if (this.playerDesk) {
      targets.push(this.playerDesk.object, this.playerDesk.paper);
    }

    for (const desk of this.cheatDesks) {
      targets.push(desk.interactionTarget ?? desk.tablet);
    }

    const hit = this.interactionRaycaster.intersectObjects(targets, true)[0];
    let object = hit?.object ?? null;

    while (object) {
      if (object.userData.playerDesk) {
        this.isLookingAtPlayerDesk = true;
        return;
      }

      if (object.userData.cheatDesk) {
        this.targetCheatDesk = object.userData.cheatDesk;
        return;
      }

      object = object.parent;
    }
  }

  updatePlayerPaperPose(dt) {
    const paper = this.playerDesk?.paper;
    if (!paper) return;

    const reading = this.isLookingAtPlayerDesk && !this.completed;
    const blend = Math.min(1, dt * PLAYER_PAPER_POSE_SPEED);
    const targetHeight = reading
      ? PLAYER_PAPER_READING_HEIGHT
      : PLAYER_PAPER_REST_HEIGHT;
    const targetRotation = reading
      ? PLAYER_PAPER_READING_ROTATION
      : PLAYER_PAPER_REST_ROTATION;

    paper.position.y = THREE.MathUtils.lerp(
      paper.position.y,
      targetHeight,
      blend
    );

    paper.rotation.x = THREE.MathUtils.lerp(
      paper.rotation.x,
      targetRotation,
      blend
    );
  }
  updatePeek(dt) {
    this.zoomActive = Boolean(
      this.leftMouseDown &&
      this.game.input.isPointerLocked()
    );
    this.peekActive = Boolean(this.zoomActive && this.targetCheatDesk);
    this.zoomOverlay?.classList.toggle("visible", this.zoomActive);

    if (this.peekActive !== this.wasPeekActive) {
      const cueName = this.peekRustleVariant % 2 === 0 ? "peekRustle1" : "peekRustle2";
      this.peekRustleVariant += 1;
      this.audio.playSegment(LEVEL3_INTERACTION_AUDIO, {
        ...LEVEL3_INTERACTION_CUES[cueName],
        volume: this.peekActive ? 0.34 : 0.24,
        playbackRate: 0.96 + Math.random() * 0.08
      });
      this.wasPeekActive = this.peekActive;
    }

    for (const desk of this.cheatDesks) {
      desk.hologram.visible = this.peekActive && desk === this.targetCheatDesk;
    }

    if (this.peekActive) {
      this.currentCopiedDesk = this.targetCheatDesk;
      this.currentCopiedWord = this.targetCheatDesk.word;
    }

    const targetFov = this.zoomActive ? PEEK_CAMERA_FOV : NORMAL_CAMERA_FOV;
    const nextFov = THREE.MathUtils.lerp(
      this.camera.fov,
      targetFov,
      Math.min(1, dt * 10)
    );

    if (Math.abs(nextFov - this.camera.fov) > 0.001) {
      this.camera.fov = nextFov;
      this.camera.updateProjectionMatrix();
    }
  }

  updateSuspicion(dt) {
    const seen = this.canTutorSeePlayer();
    this.playerSeen = seen;
    this.suspicion = updateSuspicionMeter({
      suspicion: this.suspicion,
      peeking: this.peekActive,
      seen,
      dt
    });

    const suspicionTension = THREE.MathUtils.clamp(
      (this.suspicion - 20) / 80,
      0,
      1
    );
    const timeTension = this.timeRemaining < 15
      ? (15 - this.timeRemaining) / 15
      : 0;
    const tension = Math.max(suspicionTension, timeTension * 0.72);

    this.audio.setLoopParameters("level3-heartbeat", {
      volume: tension > 0 ? 0.04 + tension * 0.24 : 0,
      playbackRate: 0.88 + tension * 0.34
    });

    let clockVolume = 0.006;
    if (this.timeRemaining <= 30) clockVolume = 0.014;
    if (this.timeRemaining <= 15) clockVolume = 0.026;
    if (this.timeRemaining <= 5) clockVolume = 0.045;
    this.audio.setLoopParameters("level3-clock", { volume: clockVolume });
  }

  getContextInstruction() {
    if (this.feedbackMessage) {
      return this.feedbackMessage;
    }

    if (this.peekActive) {
      return "PEEKING — don't get caught!";
    }

    if (this.isLookingAtPlayerDesk) {
      return this.currentCopiedWord
        ? "Type the answer and press ENTER."
        : "Peek at another student's answer first.";
    }

    if (this.targetCheatDesk) {
      return "Hold LEFT CLICK to inspect the tablet.";
    }

    if (this.currentCopiedWord) {
      return "Look down at your own desk to type the answer.";
    }

    if (this.zoomActive) {
      return "ZOOMING — aim directly at a tablet.";
    }

    return "Look for one of the seven answer tablets around you.";
  }

  onMouseDown(event) {
    if (
      event.button === 0 &&
      this.game.input.isPointerLocked() &&
      !this.completed
    ) {
      this.leftMouseDown = true;
    }
  }

  onMouseUp(event) {
    if (event.button === 0) {
      this.leftMouseDown = false;
    }
  }

  onPointerLockChange() {
    if (!this.game.input.isPointerLocked()) {
      this.leftMouseDown = false;
    }
  }

  onTypingKeyDown(event) {
    if (this.completed || !this.isLookingAtPlayerDesk) {
      return;
    }

    const isLetter = /^[a-z]$/i.test(event.key);
    const isTypingControl = ["Backspace", "Enter", "Escape"].includes(event.key);

    if (!isLetter && !isTypingControl) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (event.key === "Enter") {
      if (this.game.isTutorialActive) {
        this.feedbackMessage = this.typedAnswer ? "Practice answer entered." : "Type an answer first.";
        this.feedbackTime = 1.2;
        return;
      }
      if (!event.repeat) this.submitTypedAnswer();
      return;
    }

    if (event.key === "Backspace") {
      this.typedAnswer = this.typedAnswer.slice(0, -1);
    } else if (event.key === "Escape") {
      this.typedAnswer = "";
    } else if (this.typedAnswer.length < MAX_TYPED_ANSWER_LENGTH) {
      this.typedAnswer += event.key.toLowerCase();
    }

    this.updatePlayerPaper();
  }

  submitTypedAnswer() {
    if (
      this.completed ||
      !this.isLookingAtPlayerDesk ||
      !this.activeQuestion
    ) {
      this.feedbackMessage = "Look down at your question paper first.";
      this.feedbackTime = 1.8;
      return false;
    }

    if (!isCopiedAnswerCorrect(this.typedAnswer, this.activeQuestion?.correctAnswer)) {
      this.incorrectAnswers += 1;
      this.audio.playSample(LEVEL3_INCORRECT_AUDIO, {
        volume: 1
      });
      this.typedAnswer = "";
      this.feedbackMessage = "Incorrect.";
      this.feedbackTime = 1.8;
      this.updatePlayerPaper();
      return false;
    }

    this.answerProgress = clamp(
      this.answerProgress + LEVEL_THREE_BALANCE.answerGainPerCorrectWord,
      0,
      100
    );
    this.audio.playSample(LEVEL3_CORRECT_AUDIO, { volume: 0.92 });
    this.currentCopiedWord = null;
    this.currentCopiedDesk = null;
    this.typedAnswer = "";
    this.hideHolograms();
    this.advanceQuestion();
    this.feedbackMessage = "Correct! A new question is waiting.";
    this.feedbackTime = 2.2;
    this.updatePlayerPaper();
    return true;
  }

  startQuestionRun() {
    const validQuestions = QUESTION_BANK.filter((questionData) => {
      const valid = validateQuestion(questionData);
      if (!valid) console.warn("Skipping malformed Level 3 question", questionData);
      return valid;
    });

    this.questionOrder = shuffle(validQuestions);
    this.questionIndex = 0;
    this.advanceQuestion();
  }

  endPeek() {
    this.leftMouseDown = false;
    this.zoomActive = false;
    this.peekActive = false;
    this.targetCheatDesk = null;
    this.zoomOverlay?.classList.remove("visible");

    for (const desk of this.cheatDesks) {
      desk.hologram.visible = false;
    }

    if (this.camera && this.camera.fov !== NORMAL_CAMERA_FOV) {
      this.camera.fov = NORMAL_CAMERA_FOV;
      this.camera.updateProjectionMatrix();
    }
  }

  advanceQuestion() {
    this.activeQuestion = this.questionOrder[this.questionIndex] ?? null;
    this.questionIndex += 1;

    if (!this.activeQuestion) {
      throw new Error("Level 3 needs at least five valid cheating questions.");
    }

    const answers = buildVariedRoundAnswers(
      this.activeQuestion,
      null,
      this.questionIndex - 1
    );

    if (answers.length !== this.cheatDesks.length) {
      throw new Error("Level 3 question rounds need exactly seven unique answers.");
    }

    this.cheatDesks.forEach((desk, index) => {
      desk.word = answers[index];
      this.drawHologramText(desk.hologram, desk.word);
    });
    this.updatePlayerPaper();
  }

  hideHolograms() {
    this.peekActive = false;
    for (const desk of this.cheatDesks) desk.hologram.visible = false;
  }

  updatePlayerPaper() {
    if (this.playerDesk?.paper) {
      this.drawPaperText(
        this.playerDesk.paper,
        this.typedAnswer
      );
    }
  }

canTutorSeePlayer() {
  const eye = this.tutorEye.getWorldPosition(new THREE.Vector3());
  const toPlayer = this.playerPosition.clone().sub(eye);
  const distance = toPlayer.length();

  if (distance > 11) return false;

  const direction = toPlayer.normalize();

  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(
    this.tutorEye.getWorldQuaternion(new THREE.Quaternion())
  );

  if (
    forward.dot(direction) <
    Math.cos(THREE.MathUtils.degToRad(32))
  ) {
    return false;
  }

  this.root.updateMatrixWorld(true);

  this.raycaster.set(eye, direction);
  this.raycaster.far = distance - 0.08;

  const hits = this.raycaster.intersectObjects(
    this.occluders,
    true
  );

  // Only substantial classroom geometry should block the tutor's view.
  // Chairs and nearby students should not make the player permanently
  // invisible from across the room.
  return !hits.some((hit) => {
    let object = hit.object;

    while (object) {
      if (object.userData.blocksTutorVision) {
        return true;
      }

      object = object.parent;
    }

    return false;
  });
}
  toggleCollisionDebug(visible) {
    this.collisionWorld.setDebugVisible(visible);
    this.tutorMover?.setDebugVisible(visible);
  }

  dispose() {
    this.audio.dispose();
    this.levelThreeHud = null;
    this.backgroundTexture?.dispose();
    this.zoomOverlay?.classList.remove("visible");
    if (this.zoomOverlay) {
      this.zoomOverlay.hidden = true;
    }
    this.zoomOverlay = null;
    if (this.minimapElement) this.minimapElement.hidden = true;
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("keydown", this.onTypingKeyDown, true);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);

    if (document.pointerLockElement === this.game.renderer.domElement) {
      document.exitPointerLock?.();
    }

    disposeObject3D(this.root);
  }
}
