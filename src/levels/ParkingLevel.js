import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { VehicleController } from "../shared/VehicleController.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { createAsphaltMaterial } from "../shaders/asphaltShader.js";
import { LevelAudio } from "../shared/LevelAudio.js";
import {
  attachCarModel,
  attachPlayerCarModel,
  createSeededRandom,
  pickRandomParkingCar
} from "../shared/VehicleModelLibrary.js";
import {
  createParkingEnvironment,
  PARKING_LAYOUT
} from "./parking/ParkingEnvironment.js";


export const LEVEL_ONE_PARKING_LAYOUT = Object.freeze({
  parkingSpaceWidth: 3.2,
  parkingSpaceDepth: 6.4,
  verticalRoadWidth: 8.5,
  verticalSlotZs: Object.freeze(Array.from(
    { length: 23 },
    (_, index) => Number((-41.5 + index * 3.25).toFixed(2))
  )),
  verticalColumns: Object.freeze([
    Object.freeze({ x: -43.65, angle: Math.PI / 2 }),
    Object.freeze({ x: -28.75, angle: Math.PI / 2 }),
    Object.freeze({ x: -13.85, angle: Math.PI / 2 }),
    Object.freeze({ x: -7.45, angle: -Math.PI / 2 }),
    Object.freeze({ x: 7.45, angle: Math.PI / 2 }),
    Object.freeze({ x: 13.85, angle: -Math.PI / 2 }),
    Object.freeze({ x: 28.75, angle: -Math.PI / 2 }),
    Object.freeze({ x: 43.65, angle: -Math.PI / 2 })
  ]),
  verticalRoads: Object.freeze([
    Object.freeze({ x: -36.2, width: 8.5 }),
    Object.freeze({ x: -21.3, width: 8.5 }),
    Object.freeze({ x: 0, width: 8.5 }),
    Object.freeze({ x: 21.3, width: 8.5 }),
    Object.freeze({ x: 36.2, width: 8.5 })
  ]),
  verticalRoad: Object.freeze({ z: -5.575, depth: 75.15 }),
  rearRoad: Object.freeze({ z: -46.35, depth: 6.4, width: 98 }),
  rearRowZ: -52.8,
  rearRowXs: Object.freeze(Array.from(
    { length: 29 },
    (_, index) => Number((-44.8 + index * 3.2).toFixed(1))
  )),
  targetSlotX: -22.4,
  playerSpawn: Object.freeze({ x: 0, z: 25.5, angle: 0 }),
  skyViewScale: 1.65
});

export function getLevelOneParkingSpaces() {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const spaces = [];

  for (const column of layout.verticalColumns) {
    for (const z of layout.verticalSlotZs) {
      spaces.push({ x: column.x, z, angle: column.angle, isTarget: false });
    }
  }

  for (const x of layout.rearRowXs) {
    spaces.push({
      x,
      z: layout.rearRowZ,
      angle: Math.PI,
      isTarget: Math.abs(x - layout.targetSlotX) < 0.001
    });
  }

  return spaces;
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

    this.parkingBay = {
      x: LEVEL_ONE_PARKING_LAYOUT.targetSlotX,
      z: LEVEL_ONE_PARKING_LAYOUT.rearRowZ,
      width: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceWidth,
      depth: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceDepth,
      angle: Math.PI
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

  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(lot.width, lot.depth, 64, 128),
    asphaltMaterial
  );

  road.rotation.x = -Math.PI / 2;
  road.position.set(lot.x, 0.01, lot.z);
  road.receiveShadow = true;
  this.root.add(road);

  const kerbMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8b8af,
    roughness: 0.8
  });

  const halfWidth = lot.width / 2;

  for (const x of [
    lot.x - halfWidth - 0.25,
    lot.x + halfWidth + 0.25
  ]) {
    const kerb = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.25, lot.depth),
      kerbMaterial
    );

    kerb.position.set(x, 0.125, lot.z);
    kerb.castShadow = true;
    kerb.receiveShadow = true;
    this.root.add(kerb);

    this.collisionWorld.add({
      object: kerb,
      size: [0.5, 0.25, lot.depth],
      color: 0xff6b6b,
      tag: "kerb"
    });
  }

  const sidewalkMaterial = new THREE.MeshStandardMaterial({
    color: 0x8d918e,
    roughness: 0.85
  });

  for (const x of [
    lot.x - halfWidth - 2,
    lot.x + halfWidth + 2
  ]) {
    const sidewalk = new THREE.Mesh(
      new THREE.BoxGeometry(3, 0.12, lot.depth),
      sidewalkMaterial
    );

    sidewalk.position.set(x, 0.06, lot.z);
    sidewalk.receiveShadow = true;
    this.root.add(sidewalk);
  }
}

  createRoadMarkings() {
    const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xe5ddbd });
    const yellowMaterial = new THREE.MeshBasicMaterial({ color: 0xd8b34f });
    const layout = LEVEL_ONE_PARKING_LAYOUT;
    const sideLine = new THREE.BoxGeometry(0.09, 0.025, layout.parkingSpaceDepth);
    const endLine = new THREE.BoxGeometry(layout.parkingSpaceWidth, 0.025, 0.09);

    for (const space of getLevelOneParkingSpaces()) {
      const outline = new THREE.Group();
      outline.position.set(space.x, 0.025, space.z);
      outline.rotation.y = space.angle;

      for (const offset of [-layout.parkingSpaceWidth / 2, layout.parkingSpaceWidth / 2]) {
        const line = new THREE.Mesh(sideLine, lineMaterial);
        line.position.x = offset;
        outline.add(line);
      }

      for (const offset of [-layout.parkingSpaceDepth / 2, layout.parkingSpaceDepth / 2]) {
        const line = new THREE.Mesh(endLine, lineMaterial);
        line.position.z = offset;
        outline.add(line);
      }

      this.root.add(outline);
    }

    const roadStart = layout.verticalRoad.z - layout.verticalRoad.depth / 2 + 3;
    const roadEnd = layout.verticalRoad.z + layout.verticalRoad.depth / 2 - 3;
    const verticalDashGeometry = new THREE.BoxGeometry(0.12, 0.025, 2.8);
    for (const road of layout.verticalRoads) {
      for (let z = roadStart; z <= roadEnd; z += 6) {
        const dash = new THREE.Mesh(verticalDashGeometry, yellowMaterial);
        dash.position.set(road.x, 0.03, z);
        this.root.add(dash);
      }
    }

    const rearDashGeometry = new THREE.BoxGeometry(2.8, 0.025, 0.12);
    for (let x = -45; x <= 45; x += 6) {
      const dash = new THREE.Mesh(rearDashGeometry, yellowMaterial);
      dash.position.set(x, 0.03, layout.rearRoad.z);
      this.root.add(dash);
    }
  }

  createParkedCars() {
    const random = createSeededRandom(3006);

    for (const { x, z, angle, isTarget } of getLevelOneParkingSpaces()) {
      if (isTarget) continue;

      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      holder.rotation.y = angle;
      this.root.add(holder);

      const spec = pickRandomParkingCar(random);
      attachCarModel(holder, spec, "lite").catch((error) => {
        console.warn(`Unable to load parked car ${spec.id}`, error);
      });

      const collider = new THREE.Object3D();
      collider.position.set(x, 0.55, z);
      collider.rotation.y = angle;
      this.root.add(collider);
      this.collisionWorld.add({ object: collider, size: spec.collider, color: 0xff6b6b, tag: String.fromCharCode(112, 97, 114, 107, 101, 100, 45, 99, 97, 114) });
    }
  }

  createPotholes() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 1
    });

    const rearRoadZ = LEVEL_ONE_PARKING_LAYOUT.rearRoad.z;
    const positions = [
      [-21.3, 22, 1.05], [-21.3, 6, 0.72], [-21.3, -10, 0.92], [-21.3, -28, 0.82], [-21.3, -40, 1.12],
      [0, 16, 0.76], [0, 0, 1.02], [0, -16, 0.84], [0, -32, 1.1],
      [21.3, 22, 0.74], [21.3, 6, 0.95], [21.3, -10, 0.8], [21.3, -28, 1.04], [21.3, -40, 0.9],
      [-36.2, 14, 0.82], [-36.2, -18, 1.02], [36.2, 8, 0.88], [36.2, -26, 0.96],
      [-27, rearRoadZ, 0.74], [-10, rearRoadZ, 0.95], [10, rearRoadZ, 0.8],
      [27, rearRoadZ, 1.04]
    ];

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
    const positions = [[-10.2, 10], [10.2, 3], [-10.2, -5], [10.2, -13]];

    for (const [x, z] of positions) {
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
      light.castShadow = z === 10 || z === -5;
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
