import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { VehicleController } from "../shared/VehicleController.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { createAsphaltMaterial } from "../shaders/asphaltShader.js";

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

    this.condition = 100;
    this.potholes = [];
    this.potholeCooldown = 0;

    this.parkingBay = {
      x: 7,
      z: -8,
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

    scene.background = new THREE.Color(0x18202a);
    scene.fog = new THREE.Fog(0x18202a, 35, 75);

    scene.add(this.root);

    const hemi = new THREE.HemisphereLight(0x8da7c4, 0x18110d, 1.7);
    this.root.add(hemi);

    const streetLight = new THREE.DirectionalLight(0xffd6a3, 2.4);
    streetLight.position.set(-8, 14, 8);
    streetLight.castShadow = true;
    this.root.add(streetLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(42, 42),
      new THREE.MeshStandardMaterial({
        color: 0x507048,
        roughness: 0.95
      })
    );

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);

    this.collisionWorld = new CollisionWorld(this.root);

    this.createRoadCorridor();
    this.createRoadMarkings();
    this.createParkedCars();
    this.createPotholes();
    this.createParkingBay();
    this.createPlayerCar();
    this.collisionWorld.rebuild();

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 150);
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

  createRoadCorridor() {
    const asphaltMaterial = createAsphaltMaterial();
    this.asphaltUniforms = asphaltMaterial.uniforms;
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 42, 64, 128),
      asphaltMaterial
    );

    road.rotation.x = -Math.PI / 2;
    road.position.y = 0.01;
    road.receiveShadow = true;
    this.root.add(road);

    const kerbMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8b8af,
      roughness: 0.8
    });

    for (const x of [-11.25, 11.25]) {
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.25, 42),
        kerbMaterial
      );

      kerb.position.set(x, 0.125, 0);
      kerb.castShadow = true;
      kerb.receiveShadow = true;
      this.root.add(kerb);
    }
  }
  createRoadMarkings() {
    const material = new THREE.MeshBasicMaterial({ color: 0xc8b35b });

    for (let z = 10; z >= -5; z -= 4) {
      const marking = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.02, 2),
        material
      );

      marking.position.set(0, 0.02, z);
      this.root.add(marking);
    }
  }

  createParkedCars() {
    const material = new THREE.MeshStandardMaterial({ color: 0x596273 });

    const positions = [
      [-6, -7],
      [-2, -7],
      [2, -7],
      [11, -7],
      [-9, 6],
      [8, 4]
    ];

    for (const [x, z] of positions) {
      const car = new THREE.Mesh(
        new THREE.BoxGeometry(2.2, 1.1, 4.2),
        material
      );

      car.position.set(x, 0.55, z);
      car.castShadow = true;
      car.receiveShadow = true;

      this.root.add(car);
      this.collisionWorld.add({ object: car, size: [2.2, 1.1, 4.2], color: 0xff6b6b, tag: "parked-car" });
    }
  }

  createPotholes() {
    const material = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 1
    });

    const positions = [
      [-3, 6],
      [3, 1],
      [-4, -3],
      [5, -2]
    ];

    for (const [x, z] of positions) {
      const pothole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.75, 0.95, 0.08, 24),
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
    }

    carRoot.position.set(0, 0, 12);
    this.car = carRoot;
    this.vehicle = new VehicleController(carRoot);
    this.root.add(carRoot);
  }

  update(dt) {
    if (this.completed) {
      return;
    }

    const controls = this.controls;
    const previousPosition = this.car.position.clone();
    this.vehicle.update(dt, {
      throttle: (controls.isDown("accelerate") ? 1 : 0) - (controls.isDown("brake") ? 1 : 0),
      steering: (controls.isDown("steerLeft") ? 1 : 0) - (controls.isDown("steerRight") ? 1 : 0)
    });
    this.car.position.x = clamp(this.car.position.x, -10.2, 10.2);
    this.car.position.z = clamp(this.car.position.z, -16, 16);
    if (this.collisionWorld.firstHit(this.car, [2.1, 1.1, 4], (collider) => collider.tag === "parked-car")) {
      this.car.position.copy(previousPosition);
      this.vehicle.stop();
    }
    this.updateVehicleVisuals(dt);
    this.updateAsphalt(dt);

    this.potholeCooldown = Math.max(0, this.potholeCooldown - dt);
    this.checkPotholes();
    this.checkParking(dt);
    this.updateCamera(dt);

    this.game.setHUD(`
      <strong>Park at Wits</strong><br>
      Condition: ${Math.round(this.condition)}%<br>
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
        this.vehicle.speed *= 0.6;
        this.cameraShake = 0.5;
        this.game.flashHUD();
        this.condition = Math.max(0, this.condition - 10);
        this.potholeCooldown = 0.8;
        break;
      }
    }
  }

  checkParking(dt) {
    const containmentPercent = this.getParkingContainment() * 100;
    const angleError = Math.abs(Math.atan2(
      Math.sin(this.car.rotation.y - this.parkingBay.angle),
      Math.cos(this.car.rotation.y - this.parkingBay.angle)
    ));
    this.parkingStatus.containment = containmentPercent >= 80;
    this.parkingStatus.alignment = angleError <= THREE.MathUtils.degToRad(12);
    this.parkingStatus.rest = Math.abs(this.vehicle.speed) < 0.3;
    this.parkingStatus.containmentPercent = containmentPercent;

    if (this.parkingStatus.containment && this.parkingStatus.alignment && this.parkingStatus.rest) {
      this.parkingStatus.holdTime += dt;
    } else {
      this.parkingStatus.holdTime = 0;
    }

    if (this.parkingStatus.holdTime >= this.parkingConfirmationDuration) {
      this.completed = true;
      this.game.completeLevel("Parked! Heading to Level 2.");
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
    this.controls?.dispose();
    disposeObject3D(this.root);
  }
}
