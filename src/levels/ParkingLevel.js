import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { VehicleController } from "../shared/VehicleController.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { createAsphaltMaterial } from "../shaders/asphaltShader.js";
import { LevelAudio } from "../shared/LevelAudio.js";
import {
  attachCarModel,
  createSeededRandom,
  pickRandomCar
} from "../shared/VehicleModelLibrary.js";
import {
  createParkingEnvironment,
  PARKING_LAYOUT
} from "./parking/ParkingEnvironment.js";


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
    this.asphaltUniforms = null;
    this.audio = new LevelAudio();
    this.environment = null;
    this.impactCooldown = 0;

    this.condition = 100;
    this.elapsedTime = 0;
    this.potholes = [];
    this.potholeCooldown = 0;

    this.parkingBay = {
      x: 15,
      z: -20,
      width: 3.2,
      depth: 5.5,
      angle: 0
    };

    this.parkingStatus = { containment: false, alignment: false, rest: false, containmentPercent: 0, holdTime: 0 };
    this.parkingConfirmationDuration = 0.75;

    this.completed = false;
  }

load() {
  const scene = this.game.scene;

  scene.background = new THREE.Color(0x101522);
  scene.fog = new THREE.Fog(0x101522, 36, 96);

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

  camera.position.set(0, 6, 9);
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
    const bayLine = new THREE.BoxGeometry(0.1, 0.025, 5.5);
    const endLine = new THREE.BoxGeometry(3.2, 0.025, 0.1);
    const slotZ = [22, 15, 8, 1, -6, -13, -20, -27];
    for (const x of [-15, -9, -3, 3, 9, 15]) for (const z of slotZ) {
      for (const offset of [-1.6, 1.6]) {
        const line = new THREE.Mesh(bayLine, lineMaterial);
        line.position.set(x + offset, 0.025, z);
        this.root.add(line);
      }
      const end = new THREE.Mesh(endLine, lineMaterial);
      end.position.set(x, 0.025, z - 2.75);
      this.root.add(end);
    }
    for (const x of [-18, -12, -6, 0, 6, 12, 18]) for (let z = 27; z >= -29; z -= 7) {
      const marking = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.025, 2.1), yellowMaterial);
      marking.position.set(x, 0.03, z);
      this.root.add(marking);
    }
  }

  createParkedCars() {
    const rows = [-15, -9, -3, 3, 9, 15];
    const slots = [22, 15, 8, 1, -6, -13, -20, -27];
    const parked = [];
    for (const x of rows) for (const z of slots) if (x !== this.parkingBay.x || z !== this.parkingBay.z) parked.push([x, z]);
    const random = createSeededRandom(3006);

    for (const [x, z] of parked) {
      const holder = new THREE.Group();
      holder.position.set(x, 0, z);
      this.root.add(holder);

      const spec = pickRandomCar(random, { allowThomas: true });
      attachCarModel(holder, spec, "lite").catch((error) => {
        console.warn(`Unable to load parked car ${spec.id}`, error);
      });

      const collider = new THREE.Object3D();
      collider.position.set(x, 0.55, z);
      this.root.add(collider);
      this.collisionWorld.add({ object: collider, size: spec.collider, color: 0xff6b6b, tag: String.fromCharCode(112, 97, 114, 107, 101, 100, 45, 99, 97, 114) });
    }
  }

  createPotholes() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 1
    });

    const positions = [
      [-18, 17, 1.05], [-12, 10, 0.72], [-6, 4, 0.92], [0, 13, 0.82],
      [6, 8, 1.12], [12, 3, 0.76], [18, -4, 1.02], [-18, -10, 0.84],
      [-12, -18, 1.1], [-6, -12, 0.74], [0, -23, 0.95], [6, -17, 0.8],
      [12, -26, 1.04], [18, -14, 0.78]
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

    this.root.add(outline);
  }

  createPlayerCar() {
    const carRoot = new THREE.Group();
    const suspension = new THREE.Group();
    suspension.position.y = 0.35;
    carRoot.add(suspension);
    this.suspension = suspension;

    const body = new THREE.Group();
    suspension.add(body);
    const paint = new THREE.MeshStandardMaterial({ color: 0xf0b429, metalness: 0.35, roughness: 0.35 });
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4), paint);
    chassis.position.y = 0.42;
    chassis.castShadow = true;
    body.add(chassis);
    const cabin = new THREE.Mesh(
      new THREE.BoxGeometry(1.65, 0.65, 1.9),
      new THREE.MeshStandardMaterial({ color: 0x1d3144, metalness: 0.2, roughness: 0.18 })
    );
    cabin.position.set(0, 0.95, 0.25);
    cabin.castShadow = true;
    body.add(cabin);

    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.85 });
    const wheelPositions = [[-1.05, 1.25, true], [1.05, 1.25, true], [-1.05, -1.25, false], [1.05, -1.25, false]];
    for (const [x, z, isFront] of wheelPositions) {
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, z);
      suspension.add(pivot);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.35, 16), wheelMaterial);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.y = -0.02;
      wheel.castShadow = true;
      pivot.add(wheel);
      this.wheels.push(wheel);
      if (isFront) this.frontWheelPivots.push(pivot);
    }

    for (const x of [-0.65, 0.65]) {
      const headlight = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.18, 0.08), new THREE.MeshBasicMaterial({ color: 0xfff1b0 }));
      headlight.position.set(x, 0.55, -2.02);
      body.add(headlight);

      const beam = new THREE.SpotLight(0xfff0bd, 16, 22, Math.PI / 7, 0.45, 1.4);
      beam.position.set(x, 0.55, -2.05);
      beam.target.position.set(x, -0.15, -11);
      beam.castShadow = x < 0;
      if (beam.castShadow) {
        beam.shadow.mapSize.set(1024, 1024);
        beam.shadow.bias = -0.00035;
      }
      body.add(beam, beam.target);
    }

    carRoot.position.set(
      PARKING_LAYOUT.mainEntrance.x,
      0,
      27
    );
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
  -23.5,
  23.5
);

this.car.position.z = clamp(
  this.car.position.z,
  -33.5,
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
    this.game.playAlertTone(118, 0.12);
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
        this.game.playAlertTone(145, 0.1);
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
    disposeObject3D(this.root);
  }
}
