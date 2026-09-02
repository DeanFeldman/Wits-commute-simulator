import * as THREE from "three";
import { disposeObject3D } from "../shared/disposeObject3D.js";

export class CrossingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 2 — Cross the Road";

    this.root = new THREE.Group();

    this.player = null;
    this.traffic = [];
    this.controls = null;

    this.startZ = 7;
    this.finishZ = -7;

    this.gridSize = 1.6;
    this.completed = false;
  }

  load() {
    const scene = this.game.scene;

    scene.background = new THREE.Color(0x8fc7e8);

    scene.add(this.root);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x6a6b58, 2.2);
    this.root.add(hemi);

    const sun = new THREE.DirectionalLight(0xffffff, 3.2);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    this.root.add(sun);

    this.createRoad();
    this.createTraffic();
    this.createPlayer();

    const camera = new THREE.OrthographicCamera(-10, 10, 9, -9, 0.1, 100);
    camera.userData.viewHeight = 18;
    camera.position.set(11, 15, 16);
    camera.lookAt(0, 0, 0);

    this.game.setCamera(camera);

    this.controls = this.game.input.registerBindings({
      moveUp: ["KeyW", "ArrowUp"],
      moveDown: ["KeyS", "ArrowDown"],
      moveLeft: ["KeyA", "ArrowLeft"],
      moveRight: ["KeyD", "ArrowRight"]
    });
    this.game.setMessage(
      "Cross the road. One key press = one grid step. Reach the green pavement."
    );
  }

  createRoad() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d4148,
      roughness: 0.95
    });

    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 13),
      roadMaterial
    );

    road.rotation.x = -Math.PI / 2;
    road.position.z = 0;
    road.receiveShadow = true;
    this.root.add(road);

    const pavementMaterial = new THREE.MeshStandardMaterial({
      color: 0x3a9d78
    });

    for (const z of [8, -8]) {
      const pavement = new THREE.Mesh(
        new THREE.BoxGeometry(22, 0.25, 2.5),
        pavementMaterial
      );

      pavement.position.set(0, 0, z);
      pavement.receiveShadow = true;
      this.root.add(pavement);
    }

    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xe2dd9a
    });

    for (const z of [-4.8, -1.6, 1.6, 4.8]) {
      for (let x = -9; x <= 9; x += 3) {
        const stripe = new THREE.Mesh(
          new THREE.BoxGeometry(1.4, 0.03, 0.12),
          lineMaterial
        );

        stripe.position.set(x, 0.03, z);
        this.root.add(stripe);
      }
    }
  }

  createTraffic() {
    const laneZ = [-4.8, -1.6, 1.6, 4.8];

    for (let lane = 0; lane < laneZ.length; lane++) {
      const direction = lane % 2 === 0 ? 1 : -1;
      const speed = 4 + lane * 0.9;

      for (let i = 0; i < 3; i++) {
        const car = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 1.1, 1.35),
          new THREE.MeshStandardMaterial({
            color: lane === 2 ? 0xf0b429 : 0x596273
          })
        );

        car.position.set(
          -8 + i * 7,
          0.65,
          laneZ[lane]
        );

        car.castShadow = true;

        this.root.add(car);

        this.traffic.push({
          mesh: car,
          direction,
          speed
        });
      }
    }
  }

  createPlayer() {
    this.player = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 1.7, 0.9),
      new THREE.MeshStandardMaterial({
        color: 0x35e0d1
      })
    );

    this.player.position.set(0, 0.9, this.startZ);
    this.player.castShadow = true;

    this.root.add(this.player);
  }

  update(dt) {
    if (this.completed) {
      return;
    }

    this.updateTraffic(dt);
    this.updatePlayerInput();
    this.checkCollisions();
    this.updateCamera();

    this.game.setHUD(`
      <strong>Cross the Road</strong><br>
      Position: ${this.player.position.z.toFixed(1)}<br>
      Goal: reach the far green pavement<br>
      One hit = restart
    `);
  }

  updateTraffic(dt) {
    for (const vehicle of this.traffic) {
      vehicle.mesh.position.x += vehicle.direction * vehicle.speed * dt;

      if (vehicle.mesh.position.x > 12) {
        vehicle.mesh.position.x = -12;
      }

      if (vehicle.mesh.position.x < -12) {
        vehicle.mesh.position.x = 12;
      }
    }
  }

  updatePlayerInput() {
    const controls = this.controls;

    let dx = 0;
    let dz = 0;

    if (controls.consumeBuffered("moveUp")) {
      dz = -this.gridSize;
    }

    if (controls.consumeBuffered("moveDown")) {
      dz = this.gridSize;
    }

    if (controls.consumeBuffered("moveLeft")) {
      dx = -this.gridSize;
    }

    if (controls.consumeBuffered("moveRight")) {
      dx = this.gridSize;
    }

    if (dx !== 0 || dz !== 0) {
      this.player.position.x = THREE.MathUtils.clamp(
        this.player.position.x + dx,
        -9,
        9
      );

      this.player.position.z = THREE.MathUtils.clamp(
        this.player.position.z + dz,
        -9,
        9
      );
    }

    if (this.player.position.z <= this.finishZ) {
      this.completed = true;
      this.game.completeLevel("You made it across. Heading to Level 3.");
    }
  }

  checkCollisions() {
    const playerBox = new THREE.Box3().setFromObject(this.player);

    for (const vehicle of this.traffic) {
      const vehicleBox = new THREE.Box3().setFromObject(vehicle.mesh);

      if (playerBox.intersectsBox(vehicleBox)) {
        this.completed = true;
        this.game.failLevel("Hit by traffic. Restarting from the checkpoint.");

        return;
      }
    }
  }

  updateCamera() {
    const camera = this.game.camera;

    camera.position.x = this.player.position.x + 11;
    camera.position.z = this.player.position.z + 16;
    camera.lookAt(
      this.player.position.x,
      0,
      this.player.position.z
    );
  }

  dispose() {
    this.controls?.dispose();
    disposeObject3D(this.root);
  }
}
