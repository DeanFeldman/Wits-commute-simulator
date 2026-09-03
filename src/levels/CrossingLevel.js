import * as THREE from "three";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { GridHopController } from "../shared/GridHopController.js";
import { VehicleController } from "../shared/VehicleController.js";
import { WaypointMover } from "../shared/WaypointMover.js";
import { LevelAudio } from "../shared/LevelAudio.js";

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
    this.recoveryTimer = 0;
    this.invulnerabilityTimer = 0;
    this.crowds = [];
    this.crowdContactCooldown = 0;
    this.playerRig = null;
    this.playerAnimationTime = 0;
    this.audio = new LevelAudio();

    this.startZ = 8;
    this.finishZ = -8;
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };

    this.gridSize = 1.6;
    this.completed = false;
  }

  load() {
    const scene = this.game.scene;

    scene.background = new THREE.Color(0x72c9f3);
    this.game.renderer.shadowMap.type = THREE.BasicShadowMap;

    scene.add(this.root);
    this.audio.startDrone(58, 0.018);
    this.collisionWorld = new CollisionWorld(this.root);

    const hemi = new THREE.HemisphereLight(0xe9f8ff, 0x5c7d4e, 2.9);
    this.root.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4d2, 4.2);
    sun.position.set(-12, 22, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -16;
    sun.shadow.camera.right = 16;
    sun.shadow.camera.top = 16;
    sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0005;
    this.root.add(sun);
    this.root.add(sun.target);
    sun.target.position.set(0, 0, 0);
    this.createRoad();
    this.createPlayer();
    this.createTraffic();
    this.createCrowds();
    this.collisionWorld.rebuild();
    this.hopController = new GridHopController(this.player, {
      cellSize: this.gridSize, hopDuration: 0.16, hopHeight: 0.38,
      minX: -9.6, maxX: 9.6, minZ: -8, maxZ: 8
    });

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
      "Cross the road. One key press = one grid step. Reach the finish pavement."
    );
  }

  createRoad() {
    const roadMaterial = new THREE.MeshStandardMaterial({
      color: 0x3d4148,
      roughness: 0.95,
      flatShading: true
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
      color: 0x3a9d78,
      roughness: 0.88,
      flatShading: true
    });

    const pavementZones = [
      { z: 8, color: 0x2f8f68 },
      { z: -8, color: 0x4caf50 }
    ];

    for (const zone of pavementZones) {
      const pavement = new THREE.Mesh(
        new THREE.BoxGeometry(22, 0.25, 2.5),
        pavementMaterial.clone()
      );
      pavement.material.color.setHex(zone.color);
      pavement.position.set(0, 0, zone.z);
      pavement.receiveShadow = true;
      this.root.add(pavement);

      const zoneMarker = new THREE.Mesh(
        new THREE.BoxGeometry(5, 0.04, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      zoneMarker.position.set(0, 0.15, zone.z);
      this.root.add(zoneMarker);
    }

    const kerbMaterial = new THREE.MeshStandardMaterial({ color: 0xf2eadb, roughness: 0.78, flatShading: true });
    for (const z of [6.65, -6.65]) {
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(22, 0.35, 0.35),
        kerbMaterial
      );
      kerb.position.set(0, 0.18, z);
      kerb.castShadow = true;
      kerb.receiveShadow = true;
      this.root.add(kerb);
      this.collisionWorld.add({ object: kerb, size: [22, 0.35, 0.35], color: 0xc9c2b8, tag: "kerb" });
    }

    const islandMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e9d3, roughness: 0.78, flatShading: true });
    const islandTopMaterial = new THREE.MeshStandardMaterial({ color: 0x85b96b, roughness: 0.86, flatShading: true });
    for (const z of [-0.8, 0.8]) {
      const island = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.32, 1.2),
        islandMaterial
      );
      island.position.set(0, 0.16, z);
      island.castShadow = true;
      island.receiveShadow = true;
      this.root.add(island);
      this.collisionWorld.add({ object: island, size: [3.2, 0.32, 1.2], color: 0x7dac63, tag: "island" });

      const islandTop = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 0.05, 0.75),
        islandTopMaterial
      );
      islandTop.position.set(0, 0.35, z);
      this.root.add(islandTop);
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

  createCrowds() {
    const paths = [
      [new THREE.Vector3(-8, 0.75, 8.5), new THREE.Vector3(-2, 0.75, 8), new THREE.Vector3(0, 0.75, 6.95), new THREE.Vector3(2, 0.75, 8), new THREE.Vector3(8, 0.75, 8.5)],
      [new THREE.Vector3(8, 0.75, -8.5), new THREE.Vector3(2, 0.75, -8), new THREE.Vector3(0, 0.75, -6.95), new THREE.Vector3(-2, 0.75, -8), new THREE.Vector3(-8, 0.75, -8.5)]
    ];
    const colours = [0xb95c71, 0x506c9b, 0x7d9b61, 0xa77a4d, 0x665a91, 0x4b9c94];
    for (const path of paths) {
      for (let index = 0; index < 3; index++) {
        const pedestrian = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 1.5, 0.65),
          new THREE.MeshStandardMaterial({ color: colours[this.crowds.length % colours.length], roughness: 0.8 })
        );
        pedestrian.position.copy(path[(index * 2) % path.length]);
        pedestrian.castShadow = true;
        this.root.add(pedestrian);
        this.crowds.push({ mesh: pedestrian, mover: new WaypointMover(pedestrian, { points: path, speed: 0.72 + index * 0.08, startIndex: (index * 2 + 1) % path.length, debugRoot: this.root, debugColor: 0x8fd6c8 }) });
      }
    }
  }
  createTraffic() {
    this.lanes = [
      { z: 4.8, direction: 1, speed: 4.2, minGap: 6.8, maxGap: 8.2, color: 0xd65a5a },
      { z: 1.6, direction: -1, speed: 6.3, minGap: 5.8, maxGap: 7.1, color: 0x496a9b },
      { z: -1.6, direction: 1, speed: 8.5, minGap: 6.4, maxGap: 7.8, color: 0xf2b233, taxi: true },
      { z: -4.8, direction: -1, speed: 7.1, minGap: 5.5, maxGap: 6.7, color: 0x6f7f51 }
    ];
    this.validateTrafficGeneration();

    for (const lane of this.lanes) {
      for (let index = 0; index < 2; index++) {
        const vehicleRoot = new THREE.Group();
        const body = new THREE.Mesh(
          new THREE.BoxGeometry(2.6, 1.1, 1.35),
          new THREE.MeshStandardMaterial({ color: lane.color, roughness: 0.55, metalness: 0.2 })
        );
        body.position.y = 0.65;
        body.castShadow = true;
        vehicleRoot.add(body);
        vehicleRoot.position.set(
          lane.direction > 0 ? -11 - index * 10 : 11 + index * 10,
          0,
          lane.z
        );
        vehicleRoot.rotation.y = lane.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
        this.root.add(vehicleRoot);
        const isTaxi = lane.taxi && index === 0;
        if (isTaxi) this.decorateTaxi(vehicleRoot);
        const pathStart = new THREE.Vector3(lane.direction > 0 ? -15 : 15, 0, lane.z);
        const pathEnd = new THREE.Vector3(lane.direction > 0 ? 15 : -15, 0, lane.z);
        const vehicle = {
          root: vehicleRoot,
          controller: new VehicleController(vehicleRoot, { maxForwardSpeed: lane.speed, acceleration: 18 }),
          lane,
          gap: this.randomGap(lane),
          isTaxi,
          stopTimer: 0,
          nextStopX: null,
          passenger: isTaxi ? this.createTaxiPassenger(lane.z) : null,
          mover: new WaypointMover(vehicleRoot, { points: [pathStart, pathEnd], speed: lane.speed, teleportOnLoop: true, debugRoot: this.root, debugColor: lane.color })
        };
        if (isTaxi) this.scheduleTaxiStop(vehicle);
        this.traffic.push(vehicle);
      }
    }
  }

  decorateTaxi(vehicleRoot) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.22, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xfff4a3 })
    );
    sign.position.set(0, 1.32, 0);
    vehicleRoot.add(sign);
    for (const x of [-0.75, -0.25, 0.25, 0.75]) {
      const checker = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.18, 0.04),
        new THREE.MeshBasicMaterial({ color: 0x161616 })
      );
      checker.position.set(x, 0.7, -0.7);
      vehicleRoot.add(checker);
    }
  }

  createTaxiPassenger(laneZ) {
    const passenger = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.15, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x35e0d1 })
    );
    passenger.visible = false;
    passenger.position.set(0, 0.58, laneZ + 1.15);
    this.root.add(passenger);
    return passenger;
  }

  scheduleTaxiStop(vehicle) {
    vehicle.nextStopX = vehicle.root.position.x + vehicle.lane.direction * (4 + Math.random() * 5);
  }
  randomGap(lane) {
    return lane.minGap + Math.random() * (lane.maxGap - lane.minGap);
  }

  validateTrafficGeneration() {
    for (let run = 0; run < 100; run++) {
      for (const lane of this.lanes) {
        const gaps = [this.randomGap(lane), this.randomGap(lane)];
        if (gaps.some((gap) => gap < lane.minGap || gap > lane.maxGap)) {
          throw new Error("Traffic generator created an invalid lane gap.");
        }
      }
    }
  }

  createPlayer() {
    this.player = new THREE.Group();
    const clothes = new THREE.MeshStandardMaterial({ color: 0x35e0d1, roughness: 0.72 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd6a27c, roughness: 0.8 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x263b54, roughness: 0.86 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.78, 0.38), clothes);
    body.position.y = 0.1;
    body.castShadow = true;
    this.player.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skin);
    head.position.y = 0.72;
    head.castShadow = true;
    this.player.add(head);
    const arms = [];
    const legs = [];
    for (const x of [-0.42, 0.42]) {
      const armBone = new THREE.Group();
      armBone.name = `arm-bone-${x < 0 ? "left" : "right"}`;
      armBone.position.set(x, 0.32, 0);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), clothes);
      arm.position.y = -0.31;
      arm.castShadow = true;
      armBone.add(arm);
      this.player.add(armBone);
      arms.push(armBone);
      const legBone = new THREE.Group();
      legBone.name = `leg-bone-${x < 0 ? "left" : "right"}`;
      legBone.position.set(x * 0.55, -0.28, 0);
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.25), trousers);
      leg.position.y = -0.32;
      leg.castShadow = true;
      legBone.add(leg);
      this.player.add(legBone);
      legs.push(legBone);
    }
    this.player.position.set(0, 0.9, this.startZ);
    this.root.add(this.player);
    this.playerRig = { body, head, arms, legs };
    this.collisionWorld.add({ object: this.player, size: [0.9, 1.7, 0.9], color: 0x35e0d1, tag: "player" });
  }

  update(dt) {
    if (this.completed) return;

    this.updateRecovery(dt);
    if (this.recoveryTimer > 0) {
      this.updateTraffic(dt);
      this.updateCrowds(dt);
      this.updateCamera();
      return;
    }

    this.crossingTime += dt;
    this.capturePlayerInput();
    const landedDirection = this.hopController.update(dt);
    this.updatePlayerAnimation(dt);
    if (landedDirection?.z > 0) this.backwardPenalty += 0.5;
    if (landedDirection) this.updateCheckpoint();
    if (landedDirection) this.audio.cue(180, 0.05, 0.045);
    this.checkFinish();
    this.updateTraffic(dt);
    this.updateCrowds(dt);
    this.checkCollisions();
    this.checkCrowdCollisions();
    this.updateCamera();

    this.game.setHUD(`
      <strong>Cross the Road</strong><br>
      Attempts: ${this.attempts + 1}<br>
      Cell: ${this.hopController.gridPosition.x.toFixed(1)}, ${this.hopController.gridPosition.y.toFixed(1)}<br>
      Time: ${(this.crossingTime + this.backwardPenalty).toFixed(1)}s${this.backwardPenalty > 0 ? " (backtrack penalty)" : ""}<br>
      Goal: reach the far green pavement<br>
      Checkpoint: ${this.checkpoint.label}<br>
      Crowd delay: ${this.hopController.delayTimer > 0 ? "blocked" : "clear"}<br>
      <span class="gap-hint">${this.getNextGapHint()}</span>
    `);
  }

  updatePlayerAnimation(dt) {
    this.playerAnimationTime += dt;
    const rig = this.playerRig;
    if (!rig) return;
    const hopping = this.hopController.isHopping;
    const phase = hopping ? this.hopController.hopProgress * Math.PI * 2 : this.playerAnimationTime * 1.5;
    const swing = Math.sin(phase) * (hopping ? 0.7 : 0.06);
    rig.legs[0].rotation.x = swing;
    rig.legs[1].rotation.x = -swing;
    rig.arms[0].rotation.x = -swing * 0.75;
    rig.arms[1].rotation.x = swing * 0.75;
    rig.body.rotation.x = hopping ? Math.sin(this.hopController.hopProgress * Math.PI) * 0.12 : 0;
    rig.head.position.y = 0.72 + (hopping ? Math.sin(this.hopController.hopProgress * Math.PI) * 0.06 : Math.sin(this.playerAnimationTime * 1.5) * 0.015);
  }
  updateTraffic(dt) {
    for (const vehicle of this.traffic) {
      const isStopping = vehicle.isTaxi && vehicle.stopTimer > 0;
      if (!isStopping) vehicle.mover.update(dt, (direction, requested, stepDt) => {
        return Math.min(vehicle.controller.followDirection(stepDt, direction), requested);
      });
      if (isStopping) {
        vehicle.stopTimer = Math.max(0, vehicle.stopTimer - dt);
        if (vehicle.stopTimer === 0) {
          vehicle.passenger.visible = false;
          this.scheduleTaxiStop(vehicle);
        }
      } else if (vehicle.isTaxi &&
        (vehicle.lane.direction > 0 ? vehicle.root.position.x >= vehicle.nextStopX : vehicle.root.position.x <= vehicle.nextStopX)) {
        vehicle.stopTimer = 1.1 + Math.random() * 0.7;
        vehicle.controller.stop();
        vehicle.mover.pause(vehicle.stopTimer);
        vehicle.passenger.position.x = vehicle.root.position.x;
        vehicle.passenger.visible = true;
        this.audio.cue(520, 0.13, 0.1, vehicle.root.position.x / 12);
      }

      const x = vehicle.root.position.x;
      if (vehicle.lane.direction > 0 && x > 14) {
        vehicle.gap = this.randomGap(vehicle.lane);
        vehicle.root.position.x = -14 - vehicle.gap;
        if (vehicle.isTaxi) this.scheduleTaxiStop(vehicle);
      } else if (vehicle.lane.direction < 0 && x < -14) {
        vehicle.gap = this.randomGap(vehicle.lane);
        vehicle.root.position.x = 14 + vehicle.gap;
        if (vehicle.isTaxi) this.scheduleTaxiStop(vehicle);
      }
    }
  }

  capturePlayerInput() {
    const controls = this.controls;
    if (controls.consumeBuffered("moveUp")) this.hopController.enqueue({ x: 0, z: -1 });
    else if (controls.consumeBuffered("moveDown")) this.hopController.enqueue({ x: 0, z: 1 });
    else if (controls.consumeBuffered("moveLeft")) this.hopController.enqueue({ x: -1, z: 0 });
    else if (controls.consumeBuffered("moveRight")) this.hopController.enqueue({ x: 1, z: 0 });
  }

  checkFinish() {
    if (!this.hopController.isHopping && this.hopController.gridPosition.y <= this.finishZ) {
      this.completed = true;
      this.game.completeLevel("You made it across. Heading to Level 3.");
    }
  }

  checkCollisions() {
    const playerBox = new THREE.Box3().setFromObject(this.player);

    for (const vehicle of this.traffic) {
      const vehicleBox = new THREE.Box3().setFromObject(vehicle.root);

      if (this.invulnerabilityTimer <= 0 && playerBox.intersectsBox(vehicleBox)) {
        this.failAtCheckpoint(vehicle.isTaxi);
        return;
      }
    }
  }

  updateCrowds(dt) {
    if (this.crowdContactCooldown > 0) this.crowdContactCooldown = Math.max(0, this.crowdContactCooldown - dt);
    for (const crowd of this.crowds) {
      crowd.mover.update(dt);
    }
  }

  checkCrowdCollisions() {
    if (this.crowdContactCooldown > 0 || this.recoveryTimer > 0) return;
    const playerBox = new THREE.Box3().setFromObject(this.player);
    for (const crowd of this.crowds) {
      if (!playerBox.intersectsBox(new THREE.Box3().setFromObject(crowd.mesh))) continue;
      const direction = Math.sign(this.player.position.x - crowd.mesh.position.x) || 1;
      const x = THREE.MathUtils.clamp(this.hopController.gridPosition.x + direction * this.gridSize, -9.6, 9.6);
      this.hopController.reset({ x, y: 0.9, z: this.hopController.gridPosition.y });
      this.hopController.delay(0.45);
      this.crowdContactCooldown = 0.55;
      this.game.setMessage("Crowd bottleneck: pushed aside. Wait for the next gap.");
      return;
    }
  }
  updateCheckpoint() {
    const x = this.hopController.gridPosition.x;
    const z = this.hopController.gridPosition.y;
    const isKerb = Math.abs(z - 6.4) < 0.05 || Math.abs(z + 6.4) < 0.05;
    const isIsland = Math.abs(z) < 0.05 && Math.abs(x) <= 1.6;
    if (!isKerb && !isIsland) return;

    const label = isIsland ? "traffic island" : "kerb";
    if (this.checkpoint.x !== x || this.checkpoint.z !== z) {
      this.checkpoint = { x, z, label };
      this.game.setCheckpoint(`level2-${label}-${x}-${z}`);
      this.game.setMessage(`Checkpoint: ${label}.`);
    }
  }

  getNextGapHint() {
    const lane = this.lanes.reduce((closest, candidate) => {
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
    this.game.playAlertTone(wasTaxi ? 110 : 165, 0.14);
    this.recoveryTimer = 0.3;
    this.player.visible = false;
    this.game.setMessage(wasTaxi
      ? "Taxi pickup ambush! Resetting at checkpoint."
      : "Hit! Resetting at checkpoint.");
  }

  updateRecovery(dt) {
    if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
    if (this.recoveryTimer <= 0) return;
    this.recoveryTimer = Math.max(0, this.recoveryTimer - dt);
    if (this.recoveryTimer > 0) return;

    this.hopController.reset({ x: this.checkpoint.x, y: 0.9, z: this.checkpoint.z });
    this.player.visible = true;
    this.invulnerabilityTimer = 0.6;
    this.game.setMessage(`Restarted at ${this.checkpoint.label}.`);
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

  toggleCollisionDebug(visible) {
    this.collisionWorld.setDebugVisible(visible);
    for (const vehicle of this.traffic) vehicle.mover.setDebugVisible(visible);
    for (const crowd of this.crowds) crowd.mover.setDebugVisible(visible);
  }

  dispose() {
    this.audio.dispose();
    this.controls?.dispose();
    disposeObject3D(this.root);
  }
}
