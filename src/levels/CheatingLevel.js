import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { WaypointMover } from "../shared/WaypointMover.js";
import { LevelAudio } from "../shared/LevelAudio.js";

export const LEVEL_THREE_BALANCE = Object.freeze({
  answerGainPerSecond: 5,
  suspicionGainPerSecond: 30,
  suspicionDecayPerSecond: 6,
  tutorPauseSeconds: 2.6,
  tutorTurnSpeed: 2.4
});

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
const WINDOW_CENTERS_Z = [-4.7, 1.7, 8.1];
const WINDOW_WIDTH = 3.6;
const WINDOW_BOTTOM_Y = 1.4;
const WINDOW_TOP_Y = 4.8;

export function updateStealthMeters({
  answerProgress,
  suspicion,
  copying,
  seen,
  dt
}) {
  let nextAnswer = answerProgress;
  let nextSuspicion = suspicion;

  if (copying) {
    nextAnswer += LEVEL_THREE_BALANCE.answerGainPerSecond * dt;

    if (seen) {
      nextSuspicion +=
        LEVEL_THREE_BALANCE.suspicionGainPerSecond * dt;
    }
  } else {
    nextSuspicion -=
      LEVEL_THREE_BALANCE.suspicionDecayPerSecond * dt;
  }

  return {
    answerProgress: clamp(nextAnswer, 0, 100),
    suspicion: clamp(nextSuspicion, 0, 100)
  };
}

export class CheatingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 3 — Don't Get Caught";

    this.root = new THREE.Group();

    this.camera = null;
    this.controls = null;

    this.playerPosition = new THREE.Vector3(0, 0.95, 4);

    this.tutor = null;
    this.spotlight = null;
    this.collisionWorld = null;

    this.tutorTime = 0;
    this.patrolPoints = [
      new THREE.Vector3(-TUTOR_AISLE_X, 0.95, -5.1),
      new THREE.Vector3(TUTOR_AISLE_X, 0.95, -5.1),
      new THREE.Vector3(TUTOR_AISLE_X, 0.95, -2.65),
      new THREE.Vector3(-TUTOR_AISLE_X, 0.95, -2.65),
      new THREE.Vector3(-TUTOR_AISLE_X, 0.95, -0.15),
      new THREE.Vector3(TUTOR_AISLE_X, 0.95, -0.15),
      new THREE.Vector3(TUTOR_AISLE_X, 0.95, 2.35),
      new THREE.Vector3(-TUTOR_AISLE_X, 0.95, 2.35),
      new THREE.Vector3(-TUTOR_AISLE_X, 0.95, 4.85),
      new THREE.Vector3(TUTOR_AISLE_X, 0.95, 4.85),
      new THREE.Vector3(TUTOR_AISLE_X, 0.95, 7.35),
      new THREE.Vector3(-TUTOR_AISLE_X, 0.95, 7.35)
    ];
    this.patrolIndex = 1;
    this.patrolState = "walk";
    this.stateTimer = 0;
    this.occluders = [];
    this.raycaster = new THREE.Raycaster();
    this.playerSeen = false;
    this.tutorMover = null;
    this.tutorLegs = [];
    this.tutorWalkPhase = 0;

    this.answerProgress = 0;
    this.suspicion = 0;
    this.timeRemaining = 75;
    this.copyLean = 0;
    this.audio = new LevelAudio();

    this.yaw = 0;
    this.pitch = -0.05;

    this.completed = false;
  }

  async load() {
    const scene = this.game.scene;

    scene.background = new THREE.Color(0xb9d8e8);

    scene.add(this.root);
    this.audio.startDrone(39, 0.004);
    this.collisionWorld = new CollisionWorld(this.root);

    const ambient = new THREE.HemisphereLight(0xeaf7ff, 0x8f735b, 1.35);
    this.root.add(ambient);

    const ceiling = new THREE.DirectionalLight(0xfff3d7, 1.25);
    ceiling.position.set(0, 10, 4);
    this.root.add(ceiling);

    const roomAssets = await this.createRoom();
    this.createLightingIdentity(roomAssets);
    this.createTutor();
    this.tutorMover = new WaypointMover(this.tutor, {
      points: this.patrolPoints, speed: 2.1, pauseAtNodes: LEVEL_THREE_BALANCE.tutorPauseSeconds,
      debugRoot: this.root, debugColor: 0xff7f86
    });
    this.collisionWorld.rebuild();

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    this.camera.position.copy(this.playerPosition);

    this.game.setCamera(this.camera);

    this.controls = this.game.input.registerBindings({
      copy: "Space"
    });
    this.game.setMessage(
      "Click the game for mouse-look. Hold SPACE to copy. Release when the tutor watches you."
    );
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
    const [deskModel, chairModel, whiteboardModel, floorTexture, brickTexture] = await Promise.all([
      loader.loadAsync("./assets/models/props/cartoon-desk.glb"),
      loader.loadAsync("./assets/models/props/plastic-chair.glb"),
      loader.loadAsync("./assets/models/props/whiteboard.glb"),
      textureLoader.loadAsync("./assets/textures/classroom-terrazzo-floor.jpg"),
      textureLoader.loadAsync("./assets/textures/classroom-brick-wall.jpg")
    ]);

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
          0.1,
          rowZ
        );
        desk.rotation.y = Math.PI;
        desk.traverse((object) => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });
        this.root.add(desk);
        this.occluders.push(desk);
        this.collisionWorld.add({ object: desk, size: [0.7, 0.7, 0.5], color: 0x785f48, tag: "desk" });
      }
    }

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
        chair.position.set(
          x,
          0.1,
          rowZ + 0.8
        );
        chair.rotation.y = -Math.PI / 2;
        this.root.add(chair);
        this.occluders.push(chair);
      }
    }

    const studentGeometry = {
      torso: new THREE.BoxGeometry(0.48, 0.62, 0.3),
      head: new THREE.SphereGeometry(0.22, 14, 10),
      arm: new THREE.BoxGeometry(0.14, 0.5, 0.14),
      thigh: new THREE.BoxGeometry(0.18, 0.18, 0.48),
      shin: new THREE.BoxGeometry(0.18, 0.48, 0.18)
    };
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xa96f4f, roughness: 0.82 });
    const trousersMaterial = new THREE.MeshStandardMaterial({ color: 0x26384c, roughness: 0.88 });
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
          Math.abs(seatZ - this.playerPosition.z) < 0.01;

        if (!isPlayerSeat) {
          studentSeats.push({
            x,
            z: seatZ,
            shirtIndex: (row * DESKS_PER_ROW + column) % shirtMaterials.length
          });
        }
      }
    }

    const studentScale = 0.58;
    const studentBaseY = 0.26;
    const transform = new THREE.Object3D();
    const createStudentInstances = (geometry, material, count) => {
      const instances = new THREE.InstancedMesh(geometry, material, count);
      instances.castShadow = true;
      instances.receiveShadow = true;
      this.root.add(instances);
      this.occluders.push(instances);
      return instances;
    };
    const setStudentPart = (instances, index, x, y, z, rotationX = 0) => {
      transform.position.set(x, y, z);
      transform.rotation.set(rotationX, 0, 0);
      transform.scale.setScalar(studentScale);
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    };

    const heads = createStudentInstances(
      studentGeometry.head,
      skinMaterial,
      studentSeats.length
    );
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

    studentSeats.forEach(({ x, z }, studentIndex) => {
      setStudentPart(
        heads,
        studentIndex,
        x,
        studentBaseY + 1.43 * studentScale,
        z - 0.02 * studentScale
      );

      for (const [sideIndex, side] of [-1, 1].entries()) {
        const legIndex = studentIndex * 2 + sideIndex;
        setStudentPart(
          thighs,
          legIndex,
          x + side * 0.14 * studentScale,
          studentBaseY + 0.56 * studentScale,
          z - 0.2 * studentScale
        );
        setStudentPart(
          shins,
          legIndex,
          x + side * 0.14 * studentScale,
          studentBaseY + 0.33 * studentScale,
          z - 0.42 * studentScale
        );
      }
    });
    heads.instanceMatrix.needsUpdate = true;
    thighs.instanceMatrix.needsUpdate = true;
    shins.instanceMatrix.needsUpdate = true;

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
          studentBaseY + 0.92 * studentScale,
          z
        );

        for (const [sideIndex, side] of [-1, 1].entries()) {
          setStudentPart(
            arms,
            studentIndex * 2 + sideIndex,
            x + side * 0.31 * studentScale,
            studentBaseY + 0.9 * studentScale,
            z - 0.15 * studentScale,
            -0.72
          );
        }
      });
      torsos.instanceMatrix.needsUpdate = true;
      arms.instanceMatrix.needsUpdate = true;
    });
    const aisle = new THREE.Mesh(
      new THREE.BoxGeometry(19, 0.03, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xd6b24c })
    );
    aisle.position.set(0, 0.08, -5.1);
    this.root.add(aisle);

    return { whiteboard: whiteboardModel.scene, brickTexture };
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
      color: 0xbfe8ff,
      emissive: 0x7bc7ef,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.48,
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
  createTutor() {
    this.tutor = new THREE.Group();
    this.tutor.position.copy(this.patrolPoints[0]);
    this.root.add(this.tutor);
    this.collisionWorld.add({ object: this.tutor, size: [0.85, 1.9, 0.85], color: 0xe35b66, tag: "tutor" });

    const clothes = new THREE.MeshStandardMaterial({ color: 0xe35b66, roughness: 0.72 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x273442, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd7a47e, roughness: 0.78 });
    this.tutorBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.55), clothes);
    this.tutorBody.castShadow = true;
    this.tutor.add(this.tutorBody);
    for (const x of [-0.24, 0.24]) {
      const leg = new THREE.Group();
      leg.position.set(x, -0.5, 0);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.3), trousers);
      legMesh.position.y = -0.45;
      legMesh.castShadow = true;
      leg.add(legMesh);
      this.tutor.add(leg);
      this.tutorLegs.push(leg);
    }

    this.tutorHead = new THREE.Group();
    this.tutorHead.position.y = 0.75;
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.58), skin);
    headMesh.castShadow = true;
    this.tutorHead.add(headMesh);
    this.tutor.add(this.tutorHead);
    this.visionTarget = new THREE.Object3D();
    this.root.add(this.visionTarget);
    this.spotlight = new THREE.SpotLight(0xff7f86, 1.35, 10, THREE.MathUtils.degToRad(32), 0.55, 1.5);
    this.spotlight.castShadow = true;
    this.tutorHead.add(this.spotlight);
    this.spotlight.target = this.visionTarget;

    const coneLength = 5.5;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.tan(THREE.MathUtils.degToRad(32)) * coneLength, coneLength, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff8a8f, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = coneLength / 2;
    this.tutorHead.add(cone);
  }

  update(dt) {
    if (this.completed) {
      return;
    }

    this.updateTutor(dt);
    this.audio.updateClock(dt);
    this.updateMouseLook();
    this.updateCheating(dt);
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    this.game.setHUD(`
      <strong>Don't Get Caught</strong><br>
      <span class="hud-label">ANSWERS</span><div class="meter progress"><i style="width: ${this.answerProgress}%"></i></div>${Math.round(this.answerProgress)}%<br>
      <span class="hud-label">SUSPICION</span><div class="meter suspicion"><i style="width: ${this.suspicion}%"></i></div>${Math.round(this.suspicion)}%<br>
      Time remaining: ${Math.ceil(this.timeRemaining)}s<br>
      ${this.controls.isDown("copy") ? "COPYING — lean exposed" : "Facing forward — safe posture"}
    `);

    if (this.answerProgress >= 100) {
      this.completed = true;
      this.game.completeLevel("Test completed. Calculating results…");
    }

    if (this.timeRemaining <= 0) {
      this.completed = true;
      this.game.failLevel("Time is up. Restarting from the checkpoint.");
    }

    if (this.suspicion >= 100) {
      this.game.flashHUD();
      this.game.playAlertTone(120, 0.2);
      this.completed = true;
      this.game.failLevel("Caught! Restarting from the checkpoint.");
    }
  }

  updateTutor(dt) {
    const previousPosition = this.tutor.position.clone();
    this.tutorMover.update(dt);

    const movement = this.tutor.position
      .clone()
      .sub(previousPosition)
      .setY(0);

    const isWalking = movement.lengthSq() > 0.0001;
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

    this.updateTutorAnimation(dt, isWalking);

    this.audio.updateTutorFootsteps(
      dt,
      isWalking,
      this.tutor.position.x,
      this.playerPosition.x
    );

    const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      this.tutorHead.getWorldQuaternion(new THREE.Quaternion())
    );

    this.visionTarget.position
      .copy(this.tutorHead.getWorldPosition(new THREE.Vector3()))
      .addScaledVector(headForward, 10);
  }

  updateTutorAnimation(dt, isWalking) {
    if (isWalking) {
      this.tutorWalkPhase += dt * 11;
    }

    const stride = isWalking
      ? Math.sin(this.tutorWalkPhase) * 0.48
      : 0;

    this.tutorLegs[0].rotation.x = stride;
    this.tutorLegs[1].rotation.x = -stride;

    this.tutorBody.position.y = isWalking
      ? Math.abs(Math.sin(this.tutorWalkPhase)) * 0.045
      : 0;

    if (this.patrolState === "scan") {
      // Once the body has turned toward the room, sweep the vision cone
      // slightly so the pause reads as deliberate observation.
      this.tutorHead.rotation.y =
        Math.sin(this.tutorTime * 3.2) * 0.2;
    } else {
      this.tutorHead.rotation.y =
        Math.sin(this.tutorWalkPhase * 0.5) *
        (isWalking ? 0.07 : 0.025);
    }
  }

  updateMouseLook() {
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

  updateCheating(dt) {
    const copying = this.controls.isDown("copy");
    const targetLean = copying ? 1 : 0;

    this.copyLean +=
      (targetLean - this.copyLean) *
      Math.min(1, dt * 12);

    this.camera.rotation.z = -this.copyLean * 0.12;

    const seen = this.canTutorSeePlayer();
    this.playerSeen = seen;

    const previousAnswer = this.answerProgress;

    const meters = updateStealthMeters({
      answerProgress: this.answerProgress,
      suspicion: this.suspicion,
      copying,
      seen,
      dt
    });

    this.answerProgress = meters.answerProgress;
    this.suspicion = meters.suspicion;

    // Cue once when crossing each 12% answer milestone.
    if (
      copying &&
      Math.floor(previousAnswer / 12) <
        Math.floor(this.answerProgress / 12)
    ) {
      this.audio.cue(680, 0.04, 0.025);
    }
  }

  canTutorSeePlayer() {
    const eye = this.tutorHead.getWorldPosition(new THREE.Vector3());
    const toPlayer = this.playerPosition.clone().sub(eye);
    const distance = toPlayer.length();
    if (distance > 11) return false;

    const direction = toPlayer.normalize();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.tutorHead.getWorldQuaternion(new THREE.Quaternion()));
    if (forward.dot(direction) < Math.cos(THREE.MathUtils.degToRad(32))) return false;

    this.root.updateMatrixWorld(true);
    this.raycaster.set(eye, direction);
    this.raycaster.far = distance - 0.08;
    return this.raycaster.intersectObjects(this.occluders, true).length === 0;
  }
  toggleCollisionDebug(visible) {
    this.collisionWorld.setDebugVisible(visible);
    this.tutorMover?.setDebugVisible(visible);
  }

  dispose() {
    this.audio.dispose();
    this.controls?.dispose();

    if (document.pointerLockElement === this.game.renderer.domElement) {
      document.exitPointerLock?.();
    }

    disposeObject3D(this.root);
  }
}
