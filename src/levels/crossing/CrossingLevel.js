import * as THREE from "three";
import { disposeObject3D } from "../../shared/disposeObject3D.js";
import { CollisionWorld } from "../../shared/CollisionWorld.js";
import { GridHopController } from "../../shared/GridHopController.js";
import { WaypointMover } from "../../shared/WaypointMover.js";
import { LevelAudio } from "../../shared/LevelAudio.js";
import { CrossingStrip } from "./CrossingStrip.js";
import {
  createSeededRandom,
  generateLevel2Layout,
  normalizeSeed,
  STRIP_DEPTH,
  validateGeneratedLayouts
} from "./Level2StripGenerator.js";

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
    this.strips = [];
    this.layout = null;
    this.seed = null;
    this.recoveryTimer = 0;
    this.invulnerabilityTimer = 0;
    this.crowds = [];
    this.crowdContactCooldown = 0;
    this.playerRig = null;
    this.playerAnimationTime = 0;
    this.audio = new LevelAudio();

    this.startZ = 0;
    this.finishZ = 0;
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };

    this.gridSize = STRIP_DEPTH;
    this.completed = false;
  }

  async load() {
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
    // Build the generated environment before placing gameplay actors into it.
    await this.createStrips();
    this.createPlayer();
    this.createCrowds();
    this.collisionWorld.rebuild();
    this.hopController = new GridHopController(this.player, {
      cellSize: this.gridSize, hopDuration: 0.16, hopHeight: 0.38,
      minX: -9.6, maxX: 9.6, minZ: this.finishZ, maxZ: this.startZ
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

  async createStrips() {
    // A URL seed reproduces a layout; otherwise each new Level 2 start gets a new seed.
    this.seed = this.resolveSeed();
    this.layout = generateLevel2Layout(this.seed);
    if (import.meta.env.DEV) {
      const failures = validateGeneratedLayouts(100, this.seed);
      if (failures.length > 0) throw new Error(`Level 2 validation failed: ${JSON.stringify(failures[0])}`);
    }

    // Stack grid-aligned strips, including custom strips that span several rows.
    const centerRow = (this.layout.rowCount - 1) / 2;
    for (const definition of this.layout.strips) {
      const stripCenterRow = definition.rowStart + (definition.rowSpan - 1) / 2;
      const z = (centerRow - stripCenterRow) * this.layout.depth;
      const random = createSeededRandom(this.seed ^ Math.imul(definition.index + 1, 0x9e3779b1));
      this.strips.push(new CrossingStrip({
        definition,
        z,
        parent: this.root,
        random,
        audio: this.audio
      }));
    }

    const stripsWithModels = this.strips.filter((strip) => strip.definition.models?.length > 0);
    if (stripsWithModels.length > 0) {
      const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
      const loader = new GLTFLoader();
      const modelCache = new Map();
      await Promise.all(stripsWithModels.map((strip) => strip.loadModels(loader, modelCache)));
    }

    this.startZ = centerRow * this.layout.depth;
    this.finishZ = -centerRow * this.layout.depth;
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };
    // Flat collections keep the existing collision and gap-hint code simple.
    this.lanes = this.strips.flatMap((strip) => strip.lanes);
    this.traffic = this.strips.flatMap((strip) => strip.traffic);
  }

  resolveSeed() {
    const requestedSeed = new URLSearchParams(window.location.search).get("level2Seed");
    if (requestedSeed !== null) return normalizeSeed(requestedSeed);
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }

  createCrowds() {
    // Crowds belong only to strips that explicitly declare a `crowd` hazard.
    const colours = [0xb95c71, 0x506c9b, 0x7d9b61, 0xa77a4d, 0x665a91, 0x4b9c94];
    const crowdStrips = this.strips.filter((strip) => strip.definition.crowd);
    for (const strip of crowdStrips) {
      const config = strip.definition.crowd;
      const [minimumSpeed, maximumSpeed] = config.speedRange;
      for (let index = 0; index < config.count; index++) {
        const rowOffset = config.rowOffsets[index % config.rowOffsets.length];
        const z = strip.z + strip.localZForRow(rowOffset);
        const movesRight = index % 2 === 0;
        const startX = movesRight ? -9 : 9;
        const endX = -startX;
        const path = [
          new THREE.Vector3(startX, 0.75, z),
          new THREE.Vector3(endX, 0.75, z)
        ];
        const pedestrian = new THREE.Mesh(
          new THREE.BoxGeometry(0.65, 1.5, 0.65),
          new THREE.MeshStandardMaterial({ color: colours[this.crowds.length % colours.length], roughness: 0.8 })
        );
        const progress = (index + 1) / (config.count + 1);
        pedestrian.position.set(THREE.MathUtils.lerp(startX, endX, progress), 0.75, z);
        pedestrian.castShadow = true;
        this.root.add(pedestrian);
        const speed = THREE.MathUtils.lerp(minimumSpeed, maximumSpeed, index / Math.max(1, config.count - 1));
        this.crowds.push({
          mesh: pedestrian,
          strip,
          mover: new WaypointMover(pedestrian, {
            points: path,
            speed,
            startIndex: 1,
            debugRoot: this.root,
            debugColor: 0x8fd6c8
          })
        });
      }
    }
  }
  createPlayer() {
    // Draw the pedestrian from primitive body parts and place it on the start strip.
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
      Layout seed: ${this.seed}<br>
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
    for (const strip of this.strips) strip.update(dt);
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
    // Generated safe and median strips reuse the existing checkpoint/reset flow.
    const strip = this.strips.find((candidate) => candidate.isCheckpoint && candidate.containsZ(z));
    if (!strip) return;

    const label = strip.checkpointLabel;
    if (this.checkpoint.x !== x || this.checkpoint.z !== z) {
      this.checkpoint = { x, z, label };
      this.game.setCheckpoint(`level2-${this.seed}-${strip.definition.index}-${x}`);
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
    for (const strip of this.strips) strip.setDebugVisible(visible);
    for (const crowd of this.crowds) crowd.mover.setDebugVisible(visible);
  }

  dispose() {
    this.audio.dispose();
    this.controls?.dispose();
    disposeObject3D(this.root);
  }
}
