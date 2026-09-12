import * as THREE from "three";
import { disposeObject3D } from "../../shared/disposeObject3D.js";
import { CollisionWorld } from "../../shared/CollisionWorld.js";
import { GridHopController } from "./GridHopController.js";
import { WaypointMover } from "../../shared/WaypointMover.js";
import { LevelAudio } from "../../shared/LevelAudio.js";
import { createWitsTerrain } from "./WitsTerrain.js";
import { CrossingStrip, createAmicDeckMaterial } from "./CrossingStrip.js";
import { createRoadMaterial, createRoadTextures } from "../../shaders/asphaltShader.js";
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
    this.blockedCells = [];
    this.boundaryVolumes = [];
    this.layout = null;
    this.seed = null;
    this.invulnerabilityTimer = 0;
    this.crowds = [];
    this.crowdContactCooldown = 0;
    this.playerRig = null;
    this.playerAnimationTime = 0;
    this.impactTimer = 0;
    this.cameraShakeTime = 0;
    this.pendingRespawn = null;
    this.level2PlayerSpawn = null;
    this.cameraPositionTarget = new THREE.Vector3();
    this.cameraLookTarget = new THREE.Vector3();
    this.playerCollisionBox = new THREE.Box3();
    this.vehicleCollisionBox = new THREE.Box3();
    this.walkwayMaterial = createAmicDeckMaterial();
    this.parkingRoadTextures = null;
    this.parkingMaterial = null;
    this.audio = new LevelAudio();

    this.startZ = 0;
    this.finishZ = 0;
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };

    this.gridSize = STRIP_DEPTH;
    this.routeDirection = -1;
    this.completed = false;
  }

  async load() {
    const scene = this.game.scene;

    scene.background = new THREE.Color(0x72c9f3);
    this.game.renderer.shadowMap.type = THREE.BasicShadowMap;

    scene.add(this.root);
    this.root.add(createWitsTerrain({ baseY: -3.8, nearScenery: false, palette: { ground: 0x607a51, buildings: 0x927b65 } }));
    this.audio.startDrone(58, 0.018);
    this.collisionWorld = new CollisionWorld(this.root);

    // Trimmed from 2.9 / 4.2 for ACES, 2026-09-08. These were the highest
    // intensities in the game and were clipping against NoToneMapping; the
    // curve's 1.67x pre-gain pushed them further up rather than down, so
    // midday measured 4.7% brighter and 18.6% less saturated after the
    // change. See src/core/renderSettings.js and docs/DECISIONS.md.
    const hemi = new THREE.HemisphereLight(0xe9f8ff, 0x5c7d4e, 2.65);
    this.root.add(hemi);

    const sun = new THREE.DirectionalLight(0xfff4d2, 3.85);
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
    this.parkingRoadTextures = createRoadTextures();
    this.parkingMaterial = createRoadMaterial(this.parkingRoadTextures);
    await this.createStrips();
    this.createPlayer();
    this.createCrowds();
    this.collisionWorld.rebuild();
    this.hopController = new GridHopController(this.player, {
      cellSize: this.gridSize, hopDuration: 0.34, hopHeight: 0.025,
      minX: -this.gridSize, maxX: this.gridSize, minZ: this.finishZ, maxZ: this.startZ,
      canEnter: (x, z) => !this.isBlockedCell(x, z),
      onBlocked: () => this.game.setMessage("Stay on the marked pedestrian route.")
    });

    const camera = new THREE.PerspectiveCamera(
      58,
      this.game.renderer.domElement.clientWidth / Math.max(1, this.game.renderer.domElement.clientHeight),
      0.1,
      160
    );
    camera.position.set(this.player.position.x + 5.2, 6.5, this.player.position.z + 7.5);
    camera.lookAt(this.player.position.x, 0.9, this.player.position.z - 3);

    this.game.setCamera(camera);

    this.controls = this.game.input.registerBindings({
      moveUp: ["KeyW", "ArrowUp"],
      moveDown: ["KeyS", "ArrowDown"],
      moveLeft: ["KeyA", "ArrowLeft"],
      moveRight: ["KeyD", "ArrowRight"]
    });
    this.game.setMessage(
      "Follow the ARM walkway, cross the bridge over the M1, then cross Yale Road to Engineering."
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
      const strip = new CrossingStrip({
        definition,
        z,
        parent: this.root,
        random,
        audio: this.audio,
        walkwayMaterial: this.walkwayMaterial,
        parkingMaterial: this.parkingMaterial
      });
      this.strips.push(strip);
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
    this.level2PlayerSpawn = Object.freeze({ x: 0, y: 0.95, z: this.startZ, rotationY: Math.PI });
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };
    // Flat collections keep the existing collision and gap-hint code simple.
    this.lanes = this.strips.flatMap((strip) => strip.lanes);
    this.traffic = this.strips.flatMap((strip) => strip.traffic);
    this.blockedCells = this.strips.flatMap((strip) => strip.blockedCells);
    this.boundaryVolumes = this.strips.flatMap((strip) => strip.boundaryVolumes);
    await Promise.all(this.strips.map((strip) => strip.whenReady()));
    await this.parkingRoadTextures.ready;
  }

  resolveSeed() {
    const requestedSeed = new URLSearchParams(window.location.search).get("level2Seed");
    if (requestedSeed !== null) return normalizeSeed(requestedSeed);
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }

  createCrowds() {
    const colours = [0xa8464f, 0x405f8e, 0x63864f, 0x9a693f, 0x645687, 0x327a76];
    for (let index = 0; index < 12; index++) {
      const movingForward = index % 2 === 0;
      const x = movingForward ? -1.15 : 1.15;
      const fromZ = movingForward ? this.startZ - 1.6 : this.finishZ + 1.6;
      const toZ = movingForward ? this.finishZ + 1.6 : this.startZ - 1.6;
      const pedestrian = this.createPedestrianModel({
        shirt: colours[index % colours.length],
        trousers: index % 3 === 0 ? 0x31363d : 0x454b55,
        scale: 0.92 + (index % 4) * 0.025
      });
      pedestrian.position.set(x, 0.95, THREE.MathUtils.lerp(fromZ, toZ, (index + 1) / 13));
      pedestrian.rotation.y = movingForward ? Math.PI : 0;
      this.root.add(pedestrian);
      this.crowds.push({
        mesh: pedestrian,
        rig: pedestrian.userData.rig,
        phase: index * 0.73,
        mover: new WaypointMover(pedestrian, {
          points: [new THREE.Vector3(x, 0.95, fromZ), new THREE.Vector3(x, 0.95, toZ)],
          speed: 0.85 + (index % 5) * 0.09,
          debugRoot: this.root,
          debugColor: 0x8fd6c8
        })
      });
    }
  }

  createPlayer() {
    this.player = this.createPedestrianModel({ shirt: 0x2f8f88, trousers: 0x263b54, scale: 1.03 });
    this.player.name = "level2-player";
    this.player.position.set(this.level2PlayerSpawn.x, this.level2PlayerSpawn.y, this.level2PlayerSpawn.z);
    this.player.rotation.y = this.level2PlayerSpawn.rotationY;
    this.root.add(this.player);
    this.playerRig = this.player.userData.rig;
    this.collisionWorld.add({ object: this.player, size: [0.9, 1.7, 0.9], color: 0x35e0d1, tag: "player" });
  }

  createPedestrianModel({ shirt, trousers, scale = 1 }) {
    const pedestrian = new THREE.Group();
    const shirtMaterial = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.78 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xb97857, roughness: 0.86 });
    const trouserMaterial = new THREE.MeshStandardMaterial({ color: trousers, roughness: 0.9 });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0x202328, roughness: 0.72 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.29, 0.46, 5, 10), shirtMaterial);
    body.position.y = 0.06;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), skinMaterial);
    head.position.y = 0.72;
    const arms = [];
    const legs = [];
    for (const side of [-1, 1]) {
      const armBone = new THREE.Group();
      armBone.position.set(side * 0.36, 0.3, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8), shirtMaterial);
      arm.position.y = -0.23;
      armBone.add(arm);
      pedestrian.add(armBone);
      arms.push(armBone);
      const legBone = new THREE.Group();
      legBone.position.set(side * 0.16, -0.33, 0);
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8), trouserMaterial);
      leg.position.y = -0.27;
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.11, 0.3), shoeMaterial);
      shoe.position.set(0, -0.55, -0.06);
      legBone.add(leg, shoe);
      pedestrian.add(legBone);
      legs.push(legBone);
    }
    pedestrian.add(body, head);
    pedestrian.scale.setScalar(scale);
    pedestrian.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    pedestrian.userData.rig = { body, head, arms, legs };
    return pedestrian;
  }

  update(dt) {
    if (this.completed) return;

    this.updateInvulnerability(dt);
    this.updateImpact(dt);
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
    this.updateCamera(dt);

    this.game.setHUD(`
      <strong>Cross the Road</strong><br>
      Attempts: ${this.attempts + 1}<br>
      Cell: ${this.hopController.gridPosition.x.toFixed(1)}, ${this.hopController.gridPosition.y.toFixed(1)}<br>
      Time: ${(this.crossingTime + this.backwardPenalty).toFixed(1)}s${this.backwardPenalty > 0 ? " (backtrack penalty)" : ""}<br>
      Goal: reach the Engineering entrance<br>
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
    const walking = this.hopController.isHopping;
    const phase = walking ? this.hopController.hopProgress * Math.PI * 2 : this.playerAnimationTime * 1.5;
    const swing = Math.sin(phase) * (walking ? 0.62 : 0.045);
    rig.legs[0].rotation.x = swing;
    rig.legs[1].rotation.x = -swing;
    rig.arms[0].rotation.x = -swing * 0.75;
    rig.arms[1].rotation.x = swing * 0.75;
    rig.body.rotation.x = walking ? 0.04 : 0;
    rig.body.rotation.z = this.impactTimer > 0 ? 0.28 : 0;
    rig.head.position.y = 0.72 + (walking ? Math.sin(this.hopController.hopProgress * Math.PI * 2) * 0.018 : Math.sin(this.playerAnimationTime * 1.5) * 0.01);
  }

  updateTraffic(dt) {
    for (const strip of this.strips) strip.update(dt);
  }

  capturePlayerInput() {
    if (this.impactTimer > 0) return;
    const controls = this.controls;
    if (controls.consumeBuffered("moveUp")) this.hopController.enqueue({ x: 0, z: this.routeDirection });
    else if (controls.consumeBuffered("moveDown")) this.hopController.enqueue({ x: 0, z: -this.routeDirection });
    else if (controls.consumeBuffered("moveLeft")) this.hopController.enqueue({ x: -1, z: 0 });
    else if (controls.consumeBuffered("moveRight")) this.hopController.enqueue({ x: 1, z: 0 });
  }

  isBlockedCell(x, z) {
    const tolerance = this.gridSize * 0.1;
    return this.boundaryVolumes.some((volume) =>
      x >= volume.minX && x <= volume.maxX && z >= volume.minZ && z <= volume.maxZ
    ) || this.blockedCells.some((cell) =>
      Math.abs(cell.x - x) < tolerance && Math.abs(cell.z - z) < tolerance
    );
  }

  checkFinish() {
    if (!this.hopController.isHopping && this.hopController.gridPosition.y <= this.finishZ) {
      this.completed = true;
      this.game.completeLevel("You made it across. Heading to Level 3.");
    }
  }

  checkCollisions() {
    const playerBox = this.playerCollisionBox.setFromObject(this.player);

    for (const vehicle of this.traffic) {
      if (vehicle.lane.isHighway) continue;
      const vehicleBox = this.vehicleCollisionBox.setFromObject(vehicle.root);

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
      crowd.mesh.rotation.y = crowd.mover.index === 1 ? Math.PI : 0;
      const swing = Math.sin(this.playerAnimationTime * 5.2 + crowd.phase) * 0.52;
      crowd.rig.legs[0].rotation.x = swing;
      crowd.rig.legs[1].rotation.x = -swing;
      crowd.rig.arms[0].rotation.x = -swing * 0.72;
      crowd.rig.arms[1].rotation.x = swing * 0.72;
    }
  }

  checkCrowdCollisions() {
    if (this.crowdContactCooldown > 0 || this.invulnerabilityTimer > 0) return;
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
    const lane = this.lanes.filter((candidate) => !candidate.isHighway).reduce((closest, candidate) => {
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
    this.pendingRespawn = { x: this.checkpoint.x, y: 0.95, z: this.checkpoint.z };
    this.impactTimer = 0.42;
    this.cameraShakeTime = 0.34;
    this.invulnerabilityTimer = 0.9;
    this.hopController.delay(this.impactTimer);
    this.game.setMessage(wasTaxi
      ? `Taxi impact! Returning to ${this.checkpoint.label}.`
      : `Vehicle impact! Returning to ${this.checkpoint.label}.`);
  }

  updateImpact(dt) {
    if (this.impactTimer <= 0) return;
    this.impactTimer = Math.max(0, this.impactTimer - dt);
    if (this.impactTimer === 0 && this.pendingRespawn) {
      this.hopController.reset(this.pendingRespawn);
      this.pendingRespawn = null;
    }
  }

  updateInvulnerability(dt) {
    if (this.invulnerabilityTimer > 0) this.invulnerabilityTimer = Math.max(0, this.invulnerabilityTimer - dt);
  }
  updateCamera(dt) {
    const camera = this.game.camera;
    const shake = this.cameraShakeTime > 0 ? this.cameraShakeTime / 0.34 : 0;
    this.cameraShakeTime = Math.max(0, this.cameraShakeTime - dt);
    this.cameraPositionTarget.set(
      this.player.position.x + 5.2 + (Math.random() - 0.5) * shake * 0.35,
      6.5 + (Math.random() - 0.5) * shake * 0.2,
      this.player.position.z + 7.5 + (Math.random() - 0.5) * shake * 0.35
    );
    camera.position.lerp(this.cameraPositionTarget, 1 - Math.exp(-7 * dt));
    this.cameraLookTarget.set(this.player.position.x, 0.9, this.player.position.z - 3);
    camera.lookAt(this.cameraLookTarget);
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
