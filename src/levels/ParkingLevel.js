import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { VehicleController } from "../shared/VehicleController.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { createAsphaltMaterial } from "../shaders/asphaltShader.js";
import { LevelAudio } from "../shared/LevelAudio.js";
import {
  attachPlayerCarModel,
  createSeededRandom
} from "../shared/VehicleModelLibrary.js";
import {
  createParkingEnvironment,
  PARKING_LAYOUT
} from "./parking/ParkingEnvironment.js";


export const PARKING_BAY_WIDTH = 2.5;
export const PARKING_BAY_LENGTH = 5;
export const PARKING_AISLE_WIDTH = 6;
export const PARKING_LINE_WIDTH = 0.08;

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
  eastAngledRow: Object.freeze({
    name: "east-angled",
    start: Object.freeze({ x: 56.6, z: -30 }),
    step: Object.freeze({ x: -0.19, z: 2.8 }),
    count: 21,
    rotation: -Math.PI / 4
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
  target: Object.freeze({ rowName: "row-d-left", index: 17 }),
  playerSpawn: Object.freeze({ x: -34.5, z: 41, angle: 0 }),
  skyViewScale: 1.65
});

export function createParkingRow({ name, start, count, step, rotation, targetIndex = -1 }) {
  return Array.from({ length: count }, (_, index) => ({
    x: start.x + step.x * index,
    z: start.z + step.z * index,
    angle: rotation,
    rowName: name,
    rowIndex: index,
    isTarget: index === targetIndex
  }));
}

export function createDoubleParkingRow({ name, centerX, startZ, endZ, spacing, target }) {
  const count = Math.floor((endZ - startZ) / spacing) + 1;
  const halfLength = PARKING_BAY_LENGTH / 2;
  return [
    ...createParkingRow({
      name: `${name}-left`,
      start: { x: centerX - halfLength, z: startZ },
      count,
      step: { x: 0, z: spacing },
      rotation: -Math.PI / 2,
      targetIndex: target?.rowName === `${name}-left` ? target.index : -1
    }),
    ...createParkingRow({
      name: `${name}-right`,
      start: { x: centerX + halfLength, z: startZ },
      count,
      step: { x: 0, z: spacing },
      rotation: Math.PI / 2,
      targetIndex: target?.rowName === `${name}-right` ? target.index : -1
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
    ...layout.doubleRows.flatMap((row) => createDoubleParkingRow({
      ...row,
      spacing,
      target: layout.target
    })),
    ...createParkingRow(layout.eastAngledRow)
  ];
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

    const targetSpace = getLevelOneParkingSpaces().find((space) => space.isTarget);
    this.parkingBay = {
      x: targetSpace.x,
      z: targetSpace.z,
      width: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceWidth,
      depth: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceDepth,
      angle: targetSpace.angle
    };

    this.parkingStatus = { containment: false, alignment: false, rest: false, containmentPercent: 0, holdTime: 0 };
    this.parkingConfirmationDuration = 0.75;

    this.completed = false;
  }

load() {
  const scene = this.game.scene;

  const skyColor = new THREE.Color(0x8ec9ee);
  scene.background = skyColor;
  scene.fog = new THREE.Fog(skyColor, 36, 96);
  this.chaseFog = scene.fog;

  scene.add(this.root);
  this.audio.startDrone(74, 0.012);

  const hemi = new THREE.HemisphereLight(
    0x5e7898,
    0x170d09,
    0.75
  );
  this.root.add(hemi);

  const duskSun = new THREE.DirectionalLight(
    0xffb56a,
    1.8
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
  this.createParkedCars();
  this.createPotholes();
  this.createParkingBay();
  this.createPlayerCar();

  this.environment = createParkingEnvironment({
    collisionWorld: this.collisionWorld,
    playerCar: this.car
  });

  this.root.add(this.environment.root);

  this.createStreetLights();

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
    "Drive to the cyan bay. W/S = throttle, A/D = steer, R = restart."
  );

  this.viewToggle = document.querySelector("#level1-view-toggle");
  this.viewToggle.hidden = false;
  this.viewToggle.addEventListener("click", this.onViewToggle);
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

  const asphaltMaterial = createAsphaltMaterial();
  this.asphaltUniforms = asphaltMaterial.uniforms;

  const addAsphaltPiece = (points, name) => {
    const shape = new THREE.Shape(
      points.map(([x, z]) => new THREE.Vector2(x - lot.x, -(z - lot.z)))
    );
    const road = new THREE.Mesh(new THREE.ShapeGeometry(shape), asphaltMaterial);
    road.rotation.x = -Math.PI / 2;
    road.position.set(lot.x, 0.035, lot.z);
    road.receiveShadow = true;
    road.name = name;
    this.root.add(road);
  };

  // Convex pieces avoid the concave polygon triangulation artefacts that let
  // the grass ground show through the parking floor.
  addAsphaltPiece([
    [-56, -50],
    [59, -38],
    [54, 34],
    [-56, 34]
  ], "level-one-parking-asphalt-main");
  addAsphaltPiece([
    [-61, -33],
    [-56, -33],
    [-56, 34],
    [-61, 34]
  ], "level-one-parking-asphalt-west-main");
  addAsphaltPiece([
    [-61, -50],
    [-56, -50],
    [-56, -42],
    [-61, -42]
  ], "level-one-parking-asphalt-west-upper");
}

  createRoadMarkings() {
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xe5ddbd });
    const yellowMaterial = new THREE.MeshBasicMaterial({ color: 0xd8b34f });
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

    const verticalDashGeometry = new THREE.BoxGeometry(0.12, 0.025, 2.8);
    for (const road of layout.verticalRoads) {
      for (let z = road.startZ + 2; z <= road.endZ - 2; z += 6) {
        const dash = new THREE.Mesh(verticalDashGeometry, yellowMaterial);
        dash.position.set(road.x, 0.03, z);
        this.root.add(dash);
      }
    }

    const rearDashGeometry = new THREE.BoxGeometry(2.8, 0.025, 0.12);
    const rearRoadAngle = -Math.atan2(
      layout.rearRoad.rightZ - layout.rearRoad.leftZ,
      layout.rearRoad.width
    );
    for (let x = -48; x <= 48; x += 6) {
      const dash = new THREE.Mesh(rearDashGeometry, yellowMaterial);
      const progress = (x + 48) / 96;
      const z = THREE.MathUtils.lerp(layout.rearRoad.leftZ, layout.rearRoad.rightZ, progress);
      dash.position.set(x, 0.03, z);
      dash.rotation.y = rearRoadAngle;
      this.root.add(dash);
    }

    // Hatched keep-clear box at the lower-middle entrance turning area.
    const entrance = PARKING_LAYOUT.mainEntrance;
    for (let x = entrance.x - 3.2; x <= entrance.x + 3.2; x += 1.05) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 5.2), yellowMaterial);
      stripe.position.set(x, 0.04, 30.5);
      stripe.rotation.y = -0.55;
      this.root.add(stripe);
    }
  }

  createParkedCars() {
    const random = createSeededRandom(3006);
    const colors = [0xe6e3dc, 0x22272d, 0x9aa5a8, 0xb73530, 0x24528b, 0xc99b2e, 0x2f6950];
    const occupied = getLevelOneParkingSpaces()
      .filter((space) => !space.isTarget && random() > 0.08)
      .map((space) => ({ ...space, colorIndex: Math.floor(random() * colors.length) }));
    const bodyGeometry = new THREE.BoxGeometry(2.05, 0.55, 4.15);
    const cabinGeometry = new THREE.BoxGeometry(1.72, 0.42, 2.15);
    const dummy = new THREE.Object3D();

    colors.forEach((color, colorIndex) => {
      const cars = occupied.filter((space) => space.colorIndex === colorIndex);
      const body = new THREE.InstancedMesh(bodyGeometry, new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), cars.length);
      const cabin = new THREE.InstancedMesh(cabinGeometry, new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.72), roughness: 0.55 }), cars.length);
      cars.forEach((space, index) => {
        dummy.position.set(space.x, 0.34, space.z);
        dummy.rotation.set(0, space.angle, 0);
        dummy.updateMatrix();
        body.setMatrixAt(index, dummy.matrix);
        dummy.position.y = 0.82;
        dummy.updateMatrix();
        cabin.setMatrixAt(index, dummy.matrix);
      });
      body.castShadow = true;
      body.receiveShadow = true;
      cabin.castShadow = true;
      body.name = `placeholder-car-bodies-${colorIndex}`;
      cabin.name = `placeholder-car-cabins-${colorIndex}`;
      this.root.add(body, cabin);
    });

    for (const { x, z, angle } of occupied) {
      const collider = new THREE.Object3D();
      collider.position.set(x, 0.6, z);
      collider.rotation.y = angle;
      this.root.add(collider);
      this.collisionWorld.add({ object: collider, size: [2.05, 1.2, 4.15], color: 0xff6b6b, tag: "parked-car" });
    }
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

  createParkingBay() {
    const geometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        this.parkingBay.width,
        0.05,
        this.parkingBay.depth
      )
    );

    const material = new THREE.LineBasicMaterial({ color: 0x35e0d1 });

    const outline = new THREE.LineSegments(geometry, material);

    outline.position.set(
      this.parkingBay.x,
      0.05,
      this.parkingBay.z
    );
    outline.rotation.y = this.parkingBay.angle;

    this.root.add(outline);
  }

  createPlayerCar() {
    const carRoot = new THREE.Group();
    const suspension = new THREE.Group();
    suspension.position.y = 0.04;
    carRoot.add(suspension);
    this.suspension = suspension;

    attachPlayerCarModel(suspension).catch((error) => {
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
  }

  createStreetLights() {
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x27313d, roughness: 0.72 });
    const glowMaterial = new THREE.MeshBasicMaterial({ color: 0xffc779 });
    const positions = LEVEL_ONE_PARKING_LAYOUT.verticalRoads.map((road, index) => [
      road.x,
      index % 2 === 0 ? 7 : -5
    ]);

    for (const [index, [x, z]] of positions.entries()) {
      const pole = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5, 8), poleMaterial);
      shaft.position.y = 2.5;
      pole.add(shaft);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glowMaterial);
      lamp.position.y = 5;
      pole.add(lamp);
      pole.position.set(x, 0, z);
      this.root.add(pole);

      const light = new THREE.PointLight(0xffbd68, 7, 13, 2);
      light.position.set(x, 5, z);
      // Two shadow casters keep the dusk look without multiplying shadow-map cost.
      light.castShadow = index === 1 || index === 5;
      if (light.castShadow) light.shadow.mapSize.set(512, 512);
      this.root.add(light);
    }
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
    this.condition = Math.max(
      0,
      this.condition - 5
    );

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
    this.updateCamera(dt);

    this.game.setHUD(`
      <strong>Park at Wits</strong><br>
      <span class="hud-label">CONDITION</span><div class="meter condition"><i style="width: ${this.condition}%"></i></div>${Math.round(this.condition)}%<br>
      Time: ${this.elapsedTime.toFixed(1)}s<br>
      Speed: ${Math.abs(this.vehicle.speed).toFixed(1)}<br>
      Goal: stop inside the cyan bay<br>
      Containment (${Math.round(this.parkingStatus.containmentPercent)}%): ${this.parkingStatus.containment ? "PASS" : "FAIL"}<br>
      Alignment (12 degrees): ${this.parkingStatus.alignment ? "PASS" : "FAIL"}<br>
      Rest (0.3 m/s): ${this.parkingStatus.rest ? "PASS" : "FAIL"}<br>
      ${this.parkingStatus.holdTime > 0 ? `Confirming: ${Math.round(this.parkingStatus.holdTime / this.parkingConfirmationDuration * 100)}%` : "All three tests must pass"}
    `);

    if (this.condition <= 0) {
      this.completed = true;
      this.game.failLevel("Car condition reached 0%.");
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
        this.condition = Math.max(0, this.condition - 4);

        // Slightly longer cooldown so one pothole doesn't shred the car
        this.potholeCooldown = 1.2;
        break;
      }
    }
  }

  checkParking(dt) {
  const containmentPercent =
    this.getParkingContainment() * 100;

  const delta =
    this.car.rotation.y -
    this.parkingBay.angle;

  const facingError = Math.abs(
    Math.atan2(
      Math.sin(delta),
      Math.cos(delta)
    )
  );

  // Treat both directions along the bay axis as valid.
  // This means 0° and ±180° can both pass.
  const angleError = Math.min(
    facingError,
    Math.abs(Math.PI - facingError)
  );

  this.parkingStatus.containment =
    containmentPercent >= 80;

  this.parkingStatus.alignment =
    angleError <= THREE.MathUtils.degToRad(12);

  this.parkingStatus.rest =
    Math.abs(this.vehicle.speed) < 0.3;

  this.parkingStatus.containmentPercent =
    containmentPercent;

  if (
    this.parkingStatus.containment &&
    this.parkingStatus.alignment &&
    this.parkingStatus.rest
  ) {
    this.parkingStatus.holdTime += dt;
  } else {
    this.parkingStatus.holdTime = 0;
  }

  if (
    this.parkingStatus.holdTime >=
    this.parkingConfirmationDuration
  ) {
    this.completed = true;

    this.game.completeLevel(
      "Parked! Heading to Level 2."
    );
  }
}

  getParkingContainment() {
    const bay = this.parkingBay;
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
