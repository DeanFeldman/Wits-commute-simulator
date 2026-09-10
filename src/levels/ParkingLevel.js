import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { VehicleController } from "../shared/VehicleController.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import {
  ROAD_TILE_METRES,
  SHADER_UV_TILING,
  createAsphaltMaterial,
  createRoadMaterial,
  createRoadTextures
} from "../shaders/asphaltShader.js";
import { LevelAudio } from "../shared/LevelAudio.js";
import { createInstancedCarField } from "../shared/InstancedCarField.js";
import {
  attachPlayerCarModel,
  createSeededRandom,
  pickRandomParkingCar
} from "../shared/VehicleModelLibrary.js";
import {
  createParkingEnvironment,
  PARKING_LAYOUT
} from "./parking/ParkingEnvironment.js";
import { measurePoolCoverage } from "./parking/poolCoverage.js";


export const PARKING_BAY_WIDTH = 2.5;
export const PARKING_BAY_LENGTH = 5;
export const PARKING_AISLE_WIDTH = 6;
export const PARKING_LINE_WIDTH = 0.08;

export const LEVEL_ONE_DAMAGE = Object.freeze({
  small: 4,
  medium: 10,
  high: 20
});

export function parkingAxisAngleError(rotation, bayAngle) {
  const delta = rotation - bayAngle;
  const facingError = Math.abs(
    Math.atan2(Math.sin(delta), Math.cos(delta))
  );

  // A parking bay has an axis rather than a single facing direction:
  // nose-in and reverse-in are both valid.
  return Math.min(
    facingError,
    Math.abs(Math.PI - facingError)
  );
}

export function getLevelOneCollisionDamage(tag = "") {
  const normalizedTag = String(tag).toLowerCase();

  if (normalizedTag === "pothole") {
    return LEVEL_ONE_DAMAGE.small;
  }

  if (normalizedTag === "parked-car") {
    return LEVEL_ONE_DAMAGE.high;
  }

  if (
    normalizedTag.includes("sign") ||
    normalizedTag.includes("curb") ||
    normalizedTag.includes("kerb")
  ) {
    return LEVEL_ONE_DAMAGE.medium;
  }

  if (
    normalizedTag.includes("wall") ||
    normalizedTag.includes("barrier") ||
    normalizedTag.includes("fence") ||
    normalizedTag.includes("boom") ||
    normalizedTag.includes("booth") ||
    normalizedTag.startsWith("wits-arm")
  ) {
    return LEVEL_ONE_DAMAGE.high;
  }

  // Unknown solid obstacles are still damaging, but not catastrophically so.
  return LEVEL_ONE_DAMAGE.medium;
}

export function applyLevelOneDamage(condition, tag) {
  return Math.max(
    0,
    condition - getLevelOneCollisionDamage(tag)
  );
}

const DOUBLE_ROW_CONFIGS = Object.freeze([
  Object.freeze({ name: "row-a", centerX: -42.5, startZ: -38.9, endZ: 32 }),
  Object.freeze({ name: "row-b", centerX: -26.5, startZ: -37.2, endZ: 32 }),
  Object.freeze({ name: "row-c", centerX: -10.5, startZ: -35.5, endZ: 25 }),
  Object.freeze({ name: "row-d", centerX: 5.5, startZ: -33.8, endZ: 25 }),
  Object.freeze({ name: "row-e", centerX: 21.5, startZ: -32.1, endZ: 28 }),
  Object.freeze({ name: "row-f", centerX: 37.5, startZ: -30.5, endZ: 26 })
]);

export const LEVEL_ONE_PARKING_LAYOUT = Object.freeze({
  parkingSpaceWidth: PARKING_BAY_WIDTH,
  parkingSpaceDepth: PARKING_BAY_LENGTH,
  aisleWidth: PARKING_AISLE_WIDTH,
  lineWidth: PARKING_LINE_WIDTH,
  slotSpacing: 2.6,
  topRow: Object.freeze({
    name: "top-row",
    start: Object.freeze({ x: -50, z: -48.2 }),
    step: Object.freeze({ x: 5.15, z: 0.542 }),
    count: 20,
    rotation: Math.atan2(5.15, 0.542)
  }),
  westUpperRow: Object.freeze({ name: "west-upper", x: -58.2, startZ: -45.5, endZ: -37.7 }),
  westRow: Object.freeze({ name: "west-row", x: -58.25, startZ: -32.5, endZ: 26 }),
  doubleRows: DOUBLE_ROW_CONFIGS,
  // Square bays along the east curb, facing into the lot like every other row.
  // The x step follows the curb as the boundary narrows from x = 58.4 at the
  // north end to x = 54.7 at the south, holding each car 0.15 m clear of it.
  eastRow: Object.freeze({
    name: "east-row",
    start: Object.freeze({ x: 56.04, z: -30 }),
    step: Object.freeze({ x: -0.1805, z: 2.6 }),
    count: 22,
    rotation: -Math.PI / 2
  }),
  verticalRoads: Object.freeze([
    Object.freeze({ x: -50.7, width: 6, startZ: -39.5, endZ: 28 }),
    Object.freeze({ x: -34.5, width: 6, startZ: -39.5, endZ: 29 }),
    Object.freeze({ x: -18.5, width: 6, startZ: -38, endZ: 29 }),
    Object.freeze({ x: -2.5, width: 6, startZ: -36.5, endZ: 34 }),
    Object.freeze({ x: 13.5, width: 6, startZ: -34.5, endZ: 29 }),
    Object.freeze({ x: 29.5, width: 6, startZ: -33, endZ: 29 }),
    Object.freeze({ x: 45.5, width: 6, startZ: -31.5, endZ: 27 })
  ]),
  rearRoad: Object.freeze({ leftZ: -40.4, rightZ: -30.2, depth: 5.2, width: 108 }),
  // Every bay is taken except this many. They are drawn at random on each run
  // and held apart, so the player always has a real choice of where to go
  // rather than one scripted slot.
  freeBayCount: 3,
  freeBaySeparation: 18,
  playerSpawn: Object.freeze({ x: -34.5, z: 41, angle: 0 }),
  skyViewScale: 1.65
});

export function createParkingRow({ name, start, count, step, rotation }) {
  return Array.from({ length: count }, (_, index) => ({
    x: start.x + step.x * index,
    z: start.z + step.z * index,
    angle: rotation,
    rowName: name,
    rowIndex: index
  }));
}

export function createDoubleParkingRow({ name, centerX, startZ, endZ, spacing }) {
  const count = Math.floor((endZ - startZ) / spacing) + 1;
  const halfLength = PARKING_BAY_LENGTH / 2;
  return [
    ...createParkingRow({
      name: `${name}-left`,
      start: { x: centerX - halfLength, z: startZ },
      count,
      step: { x: 0, z: spacing },
      rotation: -Math.PI / 2
    }),
    ...createParkingRow({
      name: `${name}-right`,
      start: { x: centerX + halfLength, z: startZ },
      count,
      step: { x: 0, z: spacing },
      rotation: Math.PI / 2
    })
  ];
}

export function getLevelOneParkingSpaces() {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const spacing = layout.slotSpacing;
  const verticalRow = (row, rotation = Math.PI / 2) => createParkingRow({
    name: row.name,
    start: { x: row.x, z: row.startZ },
    count: Math.floor((row.endZ - row.startZ) / spacing) + 1,
    step: { x: 0, z: spacing },
    rotation
  });

  return [
    ...createParkingRow(layout.topRow),
    ...verticalRow(layout.westUpperRow),
    ...verticalRow(layout.westRow),
    ...layout.doubleRows.flatMap((row) => createDoubleParkingRow({ ...row, spacing })),
    ...createParkingRow(layout.eastRow)
  ];
}


// ShapeGeometry emits only the outline vertices and writes raw shape
// coordinates straight into its uv attribute. That left the asphalt shader with
// no interior vertices to displace and made it tile the road textures more than
// a thousand times across the lot, which reads as flat grey noise. Each convex
// piece is therefore built here as a subdivided quad carrying world-scaled uvs.
// The pieces stay convex and visually continuous, as the layout contract
// requires.
export function createAsphaltQuadGeometry(corners, lot) {
  const local = corners.map(([x, z]) => new THREE.Vector2(x - lot.x, -(z - lot.z)));
  const [p0, p1, p2, p3] = local;

  const segmentsFor = (a, b) =>
    THREE.MathUtils.clamp(Math.round(a.distanceTo(b) / 2.5), 2, 64);
  const segmentsU = Math.max(segmentsFor(p0, p1), segmentsFor(p3, p2));
  const segmentsV = Math.max(segmentsFor(p0, p3), segmentsFor(p1, p2));

  const positions = [];
  const normals = [];
  const uvs = [];
  const tileU = ROAD_TILE_METRES * SHADER_UV_TILING.x;
  const tileV = ROAD_TILE_METRES * SHADER_UV_TILING.y;

  for (let j = 0; j <= segmentsV; j++) {
    const v = j / segmentsV;
    for (let i = 0; i <= segmentsU; i++) {
      const u = i / segmentsU;
      const top = p0.clone().lerp(p1, u);
      const bottom = p3.clone().lerp(p2, u);
      const point = top.lerp(bottom, v);

      positions.push(point.x, point.y, 0);
      normals.push(0, 0, 1);
      uvs.push(point.x / tileU, point.y / tileV);
    }
  }

  // Keep the winding facing up once the mesh is laid flat.
  const edgeA = p1.clone().sub(p0);
  const edgeB = p3.clone().sub(p0);
  const counterClockwise = edgeA.x * edgeB.y - edgeA.y * edgeB.x > 0;

  const indices = [];
  for (let j = 0; j < segmentsV; j++) {
    for (let i = 0; i < segmentsU; i++) {
      const a = j * (segmentsU + 1) + i;
      const b = a + 1;
      const c = a + segmentsU + 2;
      const d = a + segmentsU + 1;

      if (counterClockwise) indices.push(a, b, c, a, c, d);
      else indices.push(a, c, b, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}


// The lot floor, as convex pieces. Convex avoids the concave polygon
// triangulation artefacts that let the grass ground show through the parking
// floor. Corners are in world x/z; createAsphaltQuadGeometry converts them.
// Exported because the water-coverage test integrates the pool mask over this
// exact footprint, and a second copy of it would drift.
export const LEVEL_ONE_ASPHALT_PIECES = Object.freeze([
  {
    name: "level-one-parking-asphalt-main",
    corners: [[-56, -50], [59, -38], [54, 34], [-56, 34]]
  },
  {
    name: "level-one-parking-asphalt-west-main",
    corners: [[-61, -33], [-56, -33], [-56, 34], [-61, 34]]
  },
  {
    name: "level-one-parking-asphalt-west-upper",
    corners: [[-61, -50], [-56, -50], [-56, -42], [-61, -42]]
  }
]);
// Chooses the bays left empty. Shuffling first and then filtering keeps the
// draw uniform, and the separation check stops the three landing on top of
// each other. If the separation cannot be satisfied the quota is topped up
// anyway, so this always returns the number asked for while any bays remain.
export function pickFreeParkingBays(spaces, random = Math.random, {
  count = LEVEL_ONE_PARKING_LAYOUT.freeBayCount,
  separation = LEVEL_ONE_PARKING_LAYOUT.freeBaySeparation
} = {}) {
  const shuffled = [...spaces];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }

  const chosen = [];
  const farEnough = (candidate) => chosen.every(
    (bay) => Math.hypot(bay.x - candidate.x, bay.z - candidate.z) >= separation
  );

  for (const candidate of shuffled) {
    if (chosen.length >= count) break;
    if (farEnough(candidate)) chosen.push(candidate);
  }

  for (const candidate of shuffled) {
    if (chosen.length >= count) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }

  return chosen;
}

export function parkingBayKey(space) {
  return `${space.rowName}:${space.rowIndex}`;
}

export class ParkingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 1 — Park at Wits";

    this.root = new THREE.Group();

    this.car = null;
    this.controls = null;

    this.vehicle = null;
    this.wheels = [];
    this.frontWheelPivots = [];
    this.suspension = null;
    this.collisionWorld = null;
    this.cameraShake = 0;
    this.chaseCamera = null;
    this.skyCamera = null;
    this.skyViewActive = false;
    this.viewToggle = null;
    this.chaseFog = null;
    this.onViewToggle = this.toggleSkyView.bind(this);
    this.asphaltUniforms = null;
    this.audio = new LevelAudio();
    this.environment = null;
    this.impactCooldown = 0;

    this.condition = 100;
    this.elapsedTime = 0;
    this.potholes = [];
    this.potholeCooldown = 0;

    // Which bays are left open is decided per run, so the drive is different
    // every time rather than always ending at the same slot.
    this.freeBays = pickFreeParkingBays(getLevelOneParkingSpaces());
    this.freeBayKeys = new Set(this.freeBays.map(parkingBayKey));
    this.parkingBays = this.freeBays.map((space) => ({
      x: space.x,
      z: space.z,
      width: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceWidth,
      depth: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceDepth,
      angle: space.angle
    }));
    this.waypoints = [];
    this.waypointTime = 0;

    this.parkingStatus = { containment: false, alignment: false, rest: false, containmentPercent: 0, holdTime: 0 };
    this.parkingConfirmationDuration = 0.75;

    this.completed = false;
  }

async load() {
  const scene = this.game.scene;

  const skyColor = new THREE.Color(0x8ec9ee);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 36, 96);
  this.chaseFog = scene.fog;

  scene.add(this.root);
  this.audio.startDrone(74, 0.012);

  // Raised from 0.75 for ACES, 2026-09-08, with the dusk sun below. Level 1
  // is the darkest scene in the game, and three's ACES curve is sub-unity
  // down there, so the level lost 41.7% of its viewport luminance when tone
  // mapping went in. Both lights are scaled by 2.172, solved against the
  // measured response rather than guessed: with Level 1's free bays pinned so
  // every frame held identical content, viewport luma read 0.0635 at the old
  // intensities and 0.1019 at double them, and 2.172 is the interpolation
  // onto the 0.1085 the level measured before the curve. With the pin still in
  // it measures 0.1079; shipped, without the pin, 0.1100.
  //
  // The loss is in the lit geometry only. The lot floor is drawn by
  // asphaltShader.js, a raw ShaderMaterial with no light uniforms - nothing
  // here reaches it, and it was measured separately and needed no change.
  // See docs/DECISIONS.md, 2026-09-08.
  const hemi = new THREE.HemisphereLight(
    0x5e7898,
    0x170d09,
    1.63
  );
  this.root.add(hemi);

  const duskSun = new THREE.DirectionalLight(
    0xffb56a,
    // 1.8 before ACES. Same 2.172 scale as the hemisphere above.
    3.91
  );

  duskSun.position.set(-18, 11, 8);
  duskSun.castShadow = true;
  duskSun.shadow.mapSize.set(1536, 1536);
  duskSun.shadow.camera.left = -18;
  duskSun.shadow.camera.right = 18;
  duskSun.shadow.camera.top = 18;
  duskSun.shadow.camera.bottom = -18;
  duskSun.shadow.bias = -0.0004;

  this.root.add(duskSun);

  this.collisionWorld = new CollisionWorld(this.root);

  this.createParkingSurface();
  this.createRoadMarkings();
  const parkedCarsReady = this.createParkedCars();
  this.createPotholes();
  this.createParkingWaypoints();
  const playerCarReady = this.createPlayerCar();

  this.environment = createParkingEnvironment({
    collisionWorld: this.collisionWorld,
    playerCar: this.car,
    roadMaterial: createRoadMaterial(this.roadTextures)
  });

  this.root.add(this.environment.root);


  this.collisionWorld.rebuild();

  const camera = new THREE.PerspectiveCamera(
    58,
    1,
    0.1,
    150
  );

  const initialBehind = new THREE.Vector3(
    Math.sin(this.car.rotation.y) * 8,
    5,
    Math.cos(this.car.rotation.y) * 8
  );
  camera.position.copy(this.car.position).add(initialBehind);
  const initialLookTarget = this.car.position.clone();
  initialLookTarget.y += 1;
  camera.lookAt(initialLookTarget);
  this.chaseCamera = camera;

  this.skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 180);
  this.skyCamera.position.set(PARKING_LAYOUT.mainLot.x, 90, PARKING_LAYOUT.mainLot.z);
  this.skyCamera.up.set(0, 0, -1);
  this.skyCamera.lookAt(PARKING_LAYOUT.mainLot.x, 0, PARKING_LAYOUT.mainLot.z);
  this.updateSkyCameraFrustum();

  this.game.setCamera(camera);

  this.controls = this.game.input.registerBindings({
    accelerate: ["KeyW", "ArrowUp"],
    brake: ["KeyS", "ArrowDown"],
    steerLeft: ["KeyA", "ArrowLeft"],
    steerRight: ["KeyD", "ArrowRight"]
  });

  this.game.setMessage(
    "Every bay is taken but three. Follow a cyan marker. W/S = throttle, A/D = steer, R = restart."
  );

  this.viewToggle = document.querySelector("#level1-view-toggle");
  this.viewToggle.hidden = false;
  this.viewToggle.addEventListener("click", this.onViewToggle);

  await Promise.all([
    parkedCarsReady,
    playerCarReady,
    this.roadTextures.ready
  ]);
}

  updateSkyCameraFrustum() {
    if (!this.skyCamera) return;

    const lot = PARKING_LAYOUT.mainLot;
    const aspect = window.innerWidth / window.innerHeight;
    this.skyCamera.userData.viewHeight = LEVEL_ONE_PARKING_LAYOUT.skyViewScale * Math.max(
      lot.depth + 10,
      (lot.width + 10) / aspect
    );
  }

  toggleSkyView() {
    this.skyViewActive = !this.skyViewActive;

    if (this.skyViewActive) {
      this.updateSkyCameraFrustum();
      this.game.scene.fog = null;
      this.game.setCamera(this.skyCamera);
    } else {
      this.game.scene.fog = this.chaseFog;
      this.game.setCamera(this.chaseCamera);
    }

    this.viewToggle.textContent = this.skyViewActive ? "Chase view" : "Sky view";
    this.viewToggle.setAttribute("aria-pressed", String(this.skyViewActive));
  }


createParkingSurface() {
  const lot = PARKING_LAYOUT.mainLot;

  this.roadTextures = createRoadTextures();
  const asphaltMaterial = createAsphaltMaterial(this.roadTextures);
  this.asphaltUniforms = asphaltMaterial.uniforms;

  this.asphaltMeshes = LEVEL_ONE_ASPHALT_PIECES.map((piece) => {
    const road = new THREE.Mesh(createAsphaltQuadGeometry(piece.corners, lot), asphaltMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(lot.x, 0.035, lot.z);
    road.receiveShadow = true;
    road.name = piece.name;
    this.root.add(road);
    return road;
  });

  // Opt-in pool coverage probe, for the coverage guard and for tuning
  // uPoolEdgeStart / uPoolEdgeEnd. A normal session never renders it.
  if (new URLSearchParams(window.location.search).has("waterCoverage")) {
    window.__poolCoverage = () =>
      measurePoolCoverage(this.game.renderer, this.asphaltMeshes, this.roadTextures);
  }
}

  // Bay outlines are the only paint in Level 1. The lot floor and the streets
  // are left unmarked on purpose.
  createRoadMarkings() {
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xe5ddbd });
    const layout = LEVEL_ONE_PARKING_LAYOUT;
    const spaces = getLevelOneParkingSpaces();
    const sideLines = new THREE.InstancedMesh(
      new THREE.BoxGeometry(layout.lineWidth, 0.025, layout.parkingSpaceDepth),
      lineMaterial,
      spaces.length * 2
    );
    const endLines = new THREE.InstancedMesh(
      new THREE.BoxGeometry(layout.parkingSpaceWidth, 0.025, layout.lineWidth),
      lineMaterial,
      spaces.length * 2
    );
    const rowMatrix = new THREE.Matrix4();
    const localMatrix = new THREE.Matrix4();
    const instanceMatrix = new THREE.Matrix4();
    spaces.forEach((space, index) => {
      rowMatrix.makeRotationY(space.angle);
      rowMatrix.setPosition(space.x, 0.035, space.z);
      for (let side = 0; side < 2; side++) {
        localMatrix.makeTranslation((side ? 1 : -1) * layout.parkingSpaceWidth / 2, 0, 0);
        sideLines.setMatrixAt(index * 2 + side, instanceMatrix.multiplyMatrices(rowMatrix, localMatrix));
        localMatrix.makeTranslation(0, 0, (side ? 1 : -1) * layout.parkingSpaceDepth / 2);
        endLines.setMatrixAt(index * 2 + side, instanceMatrix.multiplyMatrices(rowMatrix, localMatrix));
      }
    });
    sideLines.name = "parking-bay-side-lines";
    endLines.name = "parking-bay-end-lines";
    this.root.add(sideLines, endLines);

  }

  createParkedCars() {
    const random = createSeededRandom(3006);
    const placements = [];

    for (const space of getLevelOneParkingSpaces()) {
      // The lot is full apart from the bays the player is being sent to.
      if (this.freeBayKeys.has(parkingBayKey(space))) continue;

      // Every vehicle in the pack is modelled at its own heading. The loader
      // normalises each one to a 4.2 m length, grounds it and turns it to +Z
      // forward, so a bay only has to supply its own rotation here.
      const spec = pickRandomParkingCar(random);
      placements.push({ spec, x: space.x, z: space.z, angle: space.angle });

      const [colliderWidth, colliderHeight, colliderLength] = spec.collider;
      const collider = new THREE.Object3D();
      collider.position.set(space.x, colliderHeight / 2, space.z);
      collider.rotation.y = space.angle;
      this.root.add(collider);
      this.collisionWorld.add({
        object: collider,
        size: [colliderWidth, colliderHeight, colliderLength],
        color: 0xff6b6b,
        tag: "parked-car"
      });
    }

    return createInstancedCarField(placements, { variant: "lite" })
      .then((field) => {
        field.name = "level-one-parked-cars";
        this.root.add(field);
      })
      .catch((error) => {
        console.warn("Parked car models could not be loaded.", error);
      });
  }

  createPotholes() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 1
    });

    const layout = LEVEL_ONE_PARKING_LAYOUT;
    const positions = layout.verticalRoads.flatMap((road, roadIndex) => [
      [road.x, 24 - (roadIndex % 2) * 5, 0.72 + (roadIndex % 3) * 0.12],
      [road.x, 4 - (roadIndex % 3) * 3, 0.78 + (roadIndex % 2) * 0.16],
      [road.x, -17 + (roadIndex % 2) * 4, 0.74 + (roadIndex % 4) * 0.09]
    ]);
    positions.push(
      [-42, THREE.MathUtils.lerp(layout.rearRoad.leftZ, layout.rearRoad.rightZ, 0.14), 0.78],
      [-18, THREE.MathUtils.lerp(layout.rearRoad.leftZ, layout.rearRoad.rightZ, 0.35), 0.9],
      [8, THREE.MathUtils.lerp(layout.rearRoad.leftZ, layout.rearRoad.rightZ, 0.57), 0.76],
      [34, THREE.MathUtils.lerp(layout.rearRoad.leftZ, layout.rearRoad.rightZ, 0.79), 0.96]
    );

    for (const [x, z, scale] of positions) {
      const pothole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7 * scale, 1 * scale, 0.07, 12),
        material
      );

      pothole.position.set(x, 0.02, z);
      this.root.add(pothole);
      this.potholes.push(pothole);
      this.collisionWorld.add({ object: pothole, size: [1.9, 0.15, 1.9], color: 0xffc857, tag: "pothole" });
    }
  }

  // A marker over every free bay: the painted outline on the ground, a column
  // of light tall enough to clear the parked cars, and a floating pin. Without
  // the column the free bays are invisible from anywhere but right beside them.
  createParkingWaypoints() {
    const markerColour = 0x35e0d1;
    const outlineGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        LEVEL_ONE_PARKING_LAYOUT.parkingSpaceWidth,
        0.05,
        LEVEL_ONE_PARKING_LAYOUT.parkingSpaceDepth
      )
    );
    const outlineMaterial = new THREE.LineBasicMaterial({ color: markerColour });

    const beamHeight = 7;
    const beamGeometry = new THREE.CylinderGeometry(0.17, 0.17, beamHeight, 8, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: markerColour,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const pinGeometry = new THREE.OctahedronGeometry(0.55);
    const pinMaterial = new THREE.MeshBasicMaterial({ color: markerColour });

    for (const bay of this.parkingBays) {
      const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      outline.position.set(bay.x, 0.05, bay.z);
      outline.rotation.y = bay.angle;
      this.root.add(outline);

      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(bay.x, beamHeight / 2, bay.z);
      beam.renderOrder = 2;
      this.root.add(beam);

      const pin = new THREE.Mesh(pinGeometry, pinMaterial);
      pin.position.set(bay.x, beamHeight + 0.6, bay.z);
      pin.userData.baseY = pin.position.y;
      this.root.add(pin);
      this.waypoints.push(pin);
    }
  }

  updateParkingWaypoints(dt) {
    this.waypointTime += dt;

    this.waypoints.forEach((pin, index) => {
      pin.rotation.y += dt * 1.3;
      pin.position.y = pin.userData.baseY + Math.sin(this.waypointTime * 1.7 + index) * 0.35;
    });
  }


  createPlayerCar() {
    const carRoot = new THREE.Group();
    const suspension = new THREE.Group();
    suspension.position.y = 0.04;
    carRoot.add(suspension);
    this.suspension = suspension;

    const modelReady = attachPlayerCarModel(suspension).catch((error) => {
      console.warn("Player car model could not be loaded.", error);
    });

    for (const x of [-0.65, 0.65]) {
      const beam = new THREE.SpotLight(0xfff0bd, 16, 22, Math.PI / 7, 0.45, 1.4);
      beam.position.set(x, 0.65, -2.05);
      beam.target.position.set(x, -0.15, -11);
      beam.castShadow = x < 0;
      if (beam.castShadow) {
        beam.shadow.mapSize.set(1024, 1024);
        beam.shadow.bias = -0.00035;
      }
      suspension.add(beam, beam.target);
    }

    const spawn = LEVEL_ONE_PARKING_LAYOUT.playerSpawn;
    carRoot.position.set(spawn.x, 0, spawn.z);
    carRoot.rotation.y = spawn.angle;
    this.car = carRoot;
    this.vehicle = new VehicleController(carRoot);
    this.root.add(carRoot);
    return modelReady;
  }


  update(dt) {
    if (this.completed) {
      return;
    }

   const controls = this.controls;

this.elapsedTime += dt;
this.impactCooldown = Math.max(
  0,
  this.impactCooldown - dt
);

const previousPosition = this.car.position.clone();

this.vehicle.update(dt, {
  throttle:
    (controls.isDown("accelerate") ? 1 : 0) -
    (controls.isDown("brake") ? 1 : 0),

  steering:
    (controls.isDown("steerLeft") ? 1 : 0) -
    (controls.isDown("steerRight") ? 1 : 0)
});

this.audio.updateEngine(this.vehicle.speed);

this.environment?.update(dt);

// Keep Level 1 contained, but allow the actual fence/barriers
// to be reached rather than clamping before them.
this.car.position.x = clamp(
  this.car.position.x,
  PARKING_LAYOUT.mainLot.x - PARKING_LAYOUT.mainLot.width / 2 + 0.5,
  PARKING_LAYOUT.mainLot.x + PARKING_LAYOUT.mainLot.width / 2 - 0.5
);

this.car.position.z = clamp(
  this.car.position.z,
  PARKING_LAYOUT.mainLot.z - PARKING_LAYOUT.mainLot.depth / 2 + 0.5,
  44.5
);

const hit = this.collisionWorld.firstHit(
  this.car,
  [2.1, 1.1, 4],
  (collider) => collider.tag !== "pothole"
);

if (hit) {
  this.car.position.copy(previousPosition);
  this.vehicle.stop();

  if (this.impactCooldown <= 0) {
    this.condition = applyLevelOneDamage(this.condition, hit.tag);

    this.cameraShake = Math.max(
      this.cameraShake,
      0.28
    );

    this.game.flashHUD();
    this.audio.cue(78, 0.12, 0.15);

    this.impactCooldown = 0.55;
  }
}

    this.updateVehicleVisuals(dt);
    this.updateAsphalt(dt);

    this.potholeCooldown = Math.max(0, this.potholeCooldown - dt);
    this.checkPotholes();
    this.checkParking(dt);
    this.updateParkingWaypoints(dt);
    this.updateCamera(dt);

    this.game.setHUD(`
      <strong>Park at Wits</strong><br>
      <span class="hud-label">CONDITION</span><div class="meter condition"><i style="width: ${this.condition}%"></i></div>${Math.round(this.condition)}%<br>
      Time: ${this.elapsedTime.toFixed(1)}s<br>
      Speed: ${Math.abs(this.vehicle.speed).toFixed(1)}<br>
      Goal: park in any of the ${this.parkingBays.length} marked bays<br>
      Containment (${Math.round(this.parkingStatus.containmentPercent)}%): ${this.parkingStatus.containment ? "PASS" : "FAIL"}<br>
      Alignment (12 degrees): ${this.parkingStatus.alignment ? "PASS" : "FAIL"}<br>
      Rest (0.3 m/s): ${this.parkingStatus.rest ? "PASS" : "FAIL"}<br>
      ${this.parkingStatus.holdTime > 0 ? `Confirming: ${Math.round(this.parkingStatus.holdTime / this.parkingConfirmationDuration * 100)}%` : "All three tests must pass"}
    `);

    if (this.condition <= 0) {
      this.completed = true;
      this.game.failLevel("YOUR CAR BROKE DOWN — You missed your exam. Restarting Level 1…");
    }
  }

  updateAsphalt(dt) {
    if (!this.asphaltUniforms) return;
    this.asphaltUniforms.uTime.value += dt;
    const headlight = this.car.localToWorld(new THREE.Vector3(0, 0.9, -2));
    this.asphaltUniforms.uHeadlightPosition.value.copy(headlight);
  }
  checkPotholes() {
    if (this.potholeCooldown > 0) {
      return;
    }

    for (const pothole of this.potholes) {
      const distance = pothole.position.distanceTo(this.car.position);

      if (distance < 1.35) {
        this.vehicle.speed *= 0.82;
        this.cameraShake = Math.max(this.cameraShake, 0.22);
        this.game.flashHUD();
        this.audio.cue(92, 0.12, 0.14);

        // Light damage only
        this.condition = applyLevelOneDamage(this.condition, "pothole");

        // Slightly longer cooldown so one pothole doesn't shred the car
        this.potholeCooldown = 1.2;
        break;
      }
    }
  }

  checkParking(dt) {
    // Any of the free bays will do, so score the car against all of them and
    // judge it on whichever one it is closest to filling.
    let best = null;
    for (const bay of this.parkingBays) {
      const containment = this.getParkingContainment(bay);
      if (!best || containment > best.containment) best = { bay, containment };
    }

    const containmentPercent = (best?.containment ?? 0) * 100;
    const angleError = parkingAxisAngleError(
      this.car.rotation.y,
      best?.bay.angle ?? 0
    );

    this.parkingStatus.containment = containmentPercent >= 80;
    this.parkingStatus.alignment = angleError <= THREE.MathUtils.degToRad(12);
    this.parkingStatus.rest = Math.abs(this.vehicle.speed) < 0.3;
    this.parkingStatus.containmentPercent = containmentPercent;

    if (
      this.parkingStatus.containment &&
      this.parkingStatus.alignment &&
      this.parkingStatus.rest
    ) {
      this.parkingStatus.holdTime += dt;
    } else {
      this.parkingStatus.holdTime = 0;
    }

    if (this.parkingStatus.holdTime >= this.parkingConfirmationDuration) {
      this.completed = true;
      this.game.completeLevel("Parked! Heading to Level 2.");
    }
  }

  getParkingContainment(bay) {
    const bayCos = Math.cos(-bay.angle);
    const baySin = Math.sin(-bay.angle);
    const dx = this.car.position.x - bay.x;
    const dz = this.car.position.z - bay.z;
    const center = { x: dx * bayCos - dz * baySin, z: dx * baySin + dz * bayCos };
    const carAngle = this.car.rotation.y - bay.angle;
    const halfWidth = 1.05;
    const halfDepth = 2;
    const corners = [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth]].map(([x, z]) => ({
      x: center.x + x * Math.cos(carAngle) - z * Math.sin(carAngle),
      z: center.z + x * Math.sin(carAngle) + z * Math.cos(carAngle)
    }));
    const bounds = [
      { axis: "x", value: -bay.width / 2, greater: true }, { axis: "x", value: bay.width / 2, greater: false },
      { axis: "z", value: -bay.depth / 2, greater: true }, { axis: "z", value: bay.depth / 2, greater: false }
    ];
    const clipped = bounds.reduce((polygon, bound) => this.clipParkingPolygon(polygon, bound), corners);
    return this.polygonArea(clipped) / (halfWidth * 2 * halfDepth * 2);
  }

  clipParkingPolygon(polygon, bound) {
    const result = [];
    for (let index = 0; index < polygon.length; index++) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = bound.greater ? current[bound.axis] >= bound.value : current[bound.axis] <= bound.value;
      const previousInside = bound.greater ? previous[bound.axis] >= bound.value : previous[bound.axis] <= bound.value;
      if (currentInside !== previousInside) {
        const otherAxis = bound.axis === "x" ? "z" : "x";
        const t = (bound.value - previous[bound.axis]) / (current[bound.axis] - previous[bound.axis]);
        result.push({ [bound.axis]: bound.value, [otherAxis]: previous[otherAxis] + t * (current[otherAxis] - previous[otherAxis]) });
      }
      if (currentInside) result.push(current);
    }
    return result;
  }

  polygonArea(polygon) {
    return Math.abs(polygon.reduce((area, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return area + point.x * next.z - next.x * point.z;
    }, 0)) / 2;
  }

  updateVehicleVisuals(dt) {
    const wheelSpin = this.vehicle.speed / 0.38 * dt;
    for (const wheel of this.wheels) wheel.rotation.x -= wheelSpin;
    for (const pivot of this.frontWheelPivots) pivot.rotation.y = this.vehicle.steering;
    this.suspension.rotation.x = -this.vehicle.speed * 0.012 - this.cameraShake * 0.08;
  }

  toggleCollisionDebug(visible) {
    this.collisionWorld.setDebugVisible(visible);
  }
  updateCamera(dt) {
    if (this.skyViewActive) {
      const previousViewHeight = this.skyCamera.userData.viewHeight;
      this.updateSkyCameraFrustum();
      if (this.skyCamera.userData.viewHeight !== previousViewHeight) {
        this.game.onResize();
      }
      return;
    }

    const camera = this.game.camera;

    const behind = new THREE.Vector3(
      Math.sin(this.car.rotation.y) * 8,
      5,
      Math.cos(this.car.rotation.y) * 8
    );

    const targetPosition = this.car.position.clone().add(behind);

    camera.position.lerp(targetPosition, 1 - Math.exp(-5 * dt));
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt);
      camera.position.y += Math.sin(performance.now() * 0.07) * this.cameraShake * 0.35;
    }

    const lookTarget = this.car.position.clone();
    lookTarget.y += 1;
    camera.lookAt(lookTarget);
  }

  dispose() {
    this.audio.dispose();
    this.controls?.dispose();
    this.viewToggle?.removeEventListener("click", this.onViewToggle);
    if (this.viewToggle) {
      this.viewToggle.hidden = true;
      this.viewToggle.textContent = "Sky view";
      this.viewToggle.setAttribute("aria-pressed", "false");
    }
    disposeObject3D(this.root);
  }
}
