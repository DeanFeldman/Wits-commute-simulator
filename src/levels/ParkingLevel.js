import * as THREE from "three";
import { clamp, moveTowards } from "../shared/math.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";

export class ParkingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 1 — Park at Wits";

    this.root = new THREE.Group();

    this.car = null;

    this.speed = 0;
    this.heading = 0;

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
        color: 0x3d4146,
        roughness: 0.95
      })
    );

    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.root.add(ground);

    this.createRoadMarkings();
    this.createParkedCars();
    this.createPotholes();
    this.createParkingBay();
    this.createPlayerCar();

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 150);
    camera.position.set(0, 6, 9);
    this.game.setCamera(camera);

    this.game.setMessage(
      "Drive to the cyan bay. W/S = throttle, A/D = steer, R = restart."
    );
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

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.9, 4),
      new THREE.MeshStandardMaterial({ color: 0xf0b429 })
    );

    body.position.y = 0.75;
    body.castShadow = true;

    carRoot.add(body);

    const wheelMaterial = new THREE.MeshStandardMaterial({
      color: 0x151515
    });

    const wheelPositions = [
      [-1.05, 0.35, 1.25],
      [1.05, 0.35, 1.25],
      [-1.05, 0.35, -1.25],
      [1.05, 0.35, -1.25]
    ];

    for (const [x, y, z] of wheelPositions) {
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.38, 0.38, 0.35, 16),
        wheelMaterial
      );

      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, y, z);
      carRoot.add(wheel);
    }

    carRoot.position.set(0, 0, 12);

    this.car = carRoot;
    this.root.add(this.car);
  }

  update(dt) {
    if (this.completed) {
      return;
    }

    const input = this.game.input;

    const throttle =
      (input.isDown("KeyW") || input.isDown("ArrowUp") ? 1 : 0) -
      (input.isDown("KeyS") || input.isDown("ArrowDown") ? 1 : 0);

    const steer =
      (input.isDown("KeyA") || input.isDown("ArrowLeft") ? 1 : 0) -
      (input.isDown("KeyD") || input.isDown("ArrowRight") ? 1 : 0);

    const targetSpeed = throttle * 8;
    this.speed = moveTowards(this.speed, targetSpeed, 10 * dt);

    if (throttle === 0) {
      this.speed = moveTowards(this.speed, 0, 5 * dt);
    }

    const steeringStrength =
      (1.7 * clamp(Math.abs(this.speed) / 2.5, 0.2, 1.0)) *
      Math.sign(this.speed || 1);

    this.heading += steer * steeringStrength * dt;

    this.car.rotation.y = this.heading;

    const forward = new THREE.Vector3(
      Math.sin(this.heading),
      0,
      Math.cos(this.heading)
    );

    this.car.position.addScaledVector(forward, -this.speed * dt);

    this.car.position.x = clamp(this.car.position.x, -16, 16);
    this.car.position.z = clamp(this.car.position.z, -16, 16);

    this.potholeCooldown = Math.max(0, this.potholeCooldown - dt);
    this.checkPotholes();
    this.checkParking();
    this.updateCamera(dt);

    this.game.setHUD(`
      <strong>Park at Wits</strong><br>
      Condition: ${Math.round(this.condition)}%<br>
      Speed: ${Math.abs(this.speed).toFixed(1)}<br>
      Goal: stop inside the cyan bay
    `);

    if (this.condition <= 0) {
      this.game.setMessage("Car condition reached 0%. Restarting…");
      this.completed = true;

      window.setTimeout(() => {
        this.game.restartLevel();
      }, 900);
    }
  }

  checkPotholes() {
    if (this.potholeCooldown > 0) {
      return;
    }

    for (const pothole of this.potholes) {
      const distance = pothole.position.distanceTo(this.car.position);

      if (distance < 1.35) {
        this.speed *= 0.6;
        this.condition = Math.max(0, this.condition - 10);
        this.potholeCooldown = 0.8;
        break;
      }
    }
  }

  checkParking() {
    const dx = Math.abs(this.car.position.x - this.parkingBay.x);
    const dz = Math.abs(this.car.position.z - this.parkingBay.z);

    const inside =
      dx < this.parkingBay.width * 0.42 &&
      dz < this.parkingBay.depth * 0.42;

    const angleError = Math.abs(
      Math.atan2(
        Math.sin(this.heading - this.parkingBay.angle),
        Math.cos(this.heading - this.parkingBay.angle)
      )
    );

    const aligned = angleError < THREE.MathUtils.degToRad(18);
    const stopped = Math.abs(this.speed) < 0.35;

    if (inside && aligned && stopped) {
      this.completed = true;
      this.game.setMessage("Parked! Press 2 for Level 2.");
    }
  }

  updateCamera(dt) {
    const camera = this.game.camera;

    const behind = new THREE.Vector3(
      Math.sin(this.heading) * 8,
      5,
      Math.cos(this.heading) * 8
    );

    const targetPosition = this.car.position.clone().add(behind);

    camera.position.lerp(targetPosition, 1 - Math.exp(-5 * dt));

    const lookTarget = this.car.position.clone();
    lookTarget.y += 1;
    camera.lookAt(lookTarget);
  }

  dispose() {
    disposeObject3D(this.root);
  }
}
