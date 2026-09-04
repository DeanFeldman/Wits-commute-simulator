import * as THREE from "three";
import { disposeObject3D } from "../../shared/disposeObject3D.js";
import { CollisionWorld } from "../../shared/CollisionWorld.js";
import { GridHopController } from "../../shared/GridHopController.js";
import { WaypointMover } from "../../shared/WaypointMover.js";
import { LevelAudio } from "../../shared/LevelAudio.js";
import { createWitsTerrain } from "../../shared/WitsTerrain.js";
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
    this.blockedCells = [];
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
    this.root.add(createWitsTerrain({ baseY: -0.35, palette: { ground: 0x607a51, buildings: 0x927b65 } }));
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
    this.createAmicDeckLandmarks();
    this.createPlayer();
    this.createCrowds();
    this.collisionWorld.rebuild();
    this.hopController = new GridHopController(this.player, {
      cellSize: this.gridSize, hopDuration: 0.16, hopHeight: 0.38,
      minX: -9.6, maxX: 9.6, minZ: this.finishZ, maxZ: this.startZ,
      canEnter: (x, z) => !this.isBlockedCell(x, z),
      onBlocked: () => this.game.setMessage("A tree blocks that grid cell.")
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
    this.layout = this.createAmicDeckLayout(this.layout);
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
        audio: this.audio
      });
      if (definition.traffic?.lanes?.some((lane) => lane.isHighway)) strip.root.position.y = -2;
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
    this.checkpoint = { x: 0, z: this.startZ, label: "start" };
    // Flat collections keep the existing collision and gap-hint code simple.
    this.lanes = this.strips.flatMap((strip) => strip.lanes);
    this.traffic = this.strips.flatMap((strip) => strip.traffic);
    this.blockedCells = this.strips.flatMap((strip) => strip.blockedCells);
  }

  resolveSeed() {
    const requestedSeed = new URLSearchParams(window.location.search).get("level2Seed");
    if (requestedSeed !== null) return normalizeSeed(requestedSeed);
    const values = new Uint32Array(1);
    globalThis.crypto.getRandomValues(values);
    return values[0];
  }

  createAmicDeckLayout(generated) {
    const start = { ...generated.strips[0], rowSpan: 3, surfaceColor: 0xa86446 };
    const sourceRoad = generated.strips.find((strip) => strip.traffic?.lanes)
      ?? generated.strips.find((strip) => strip.traffic);
    const sourceTaxi = generated.strips.find((strip) => strip.traffic?.taxiStops);
    const lanes = sourceRoad.traffic.lanes ?? [sourceRoad.traffic];
    const bridgeHighway = {
      ...sourceRoad,
      rowSpan: 4,
      traffic: { lanes: [
        { ...lanes[0], rowOffset: 0, vehicleCount: 2, isHighway: true },
        { ...(lanes[1] ?? lanes[0]), rowOffset: 1, vehicleCount: 3, isHighway: true },
        { ...lanes[0], rowOffset: 2, vehicleCount: 2, isHighway: true },
        { ...(lanes[1] ?? lanes[0]), rowOffset: 3, vehicleCount: 3, isHighway: true }
      ] }
    };
    const path = { ...generated.strips[2], rowSpan: 3, surfaceColor: 0x9b7259, traffic: null, crowd: null };
    const valeRoad = {
      ...sourceRoad,
      rowSpan: 4,
      traffic: { lanes: [
        { ...lanes[0], rowOffset: 0, vehicleCount: 2 },
        { ...(lanes[1] ?? lanes[0]), rowOffset: 1, vehicleCount: 3 },
        { ...(sourceTaxi?.traffic ?? lanes[0]), rowOffset: 2, vehicleCount: 3 },
        { ...lanes[0], rowOffset: 3, direction: 1, vehicleCount: 2 }
      ] }
    };
    const finish = { ...generated.strips.at(-1), rowSpan: 3, surfaceColor: 0xa86446 };
    let rowStart = 0;
    const strips = [start, bridgeHighway, path, valeRoad, finish].map((strip, index) => {
      const positioned = { ...strip, index, rowStart, width: 22, depth: STRIP_DEPTH * strip.rowSpan };
      rowStart += strip.rowSpan;
      return positioned;
    });
    this.bridgeZ = 5.6;
    this.groundPathZ = 0;
    this.valeRoadZ = -5.6;
    return { ...generated, rowCount: rowStart, strips };
  }

  createAmicDeckLandmarks() {
    // Overlay the active crossing with the Amic Deck's brick plazas and Vale Rd zebra route.
    const brick = new THREE.MeshStandardMaterial({ color: 0xa86446, roughness: 0.9, flatShading: true });
    const cream = new THREE.MeshBasicMaterial({ color: 0xf1ead4 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x56616a, roughness: 0.65 });
    const green = new THREE.MeshStandardMaterial({ color: 0x2f7147, roughness: 0.9, flatShading: true });
    for (const z of [this.startZ, this.finishZ]) {
      const plaza = new THREE.Mesh(new THREE.BoxGeometry(22, 0.04, 3.1), brick);
      plaza.position.set(0, 0.13, z);
      plaza.receiveShadow = true;
      this.root.add(plaza);
      for (const x of [-8.5, 8.5]) {
        const planter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.2), green);
        planter.position.set(x, 0.25, z);
        this.root.add(planter);
        const tree = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.5, 7), green);
        tree.position.set(x, 1.55, z);
        tree.castShadow = true;
        this.root.add(tree);
      }
    }
    for (let x = -4.8; x <= 4.8; x += 1.2) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.035, 6.4), cream);
      stripe.position.set(x, 0.04, this.valeRoadZ);
      this.root.add(stripe);
    }
    const campusGround = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshStandardMaterial({ color: 0x587449, roughness: 0.95 }));
    campusGround.rotation.x = -Math.PI / 2;
    campusGround.position.y = -2.25;
    this.root.add(campusGround);
    const highway = new THREE.Mesh(new THREE.BoxGeometry(22, 0.12, 8.4), new THREE.MeshStandardMaterial({ color: 0x252a31, roughness: 0.95 }));
    highway.position.set(0, -2.08, this.bridgeZ);
    highway.receiveShadow = true;
    this.root.add(highway);
    for (const x of [-10.8, 10.8]) {
      const trenchWall = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.3, 8.8), metal);
      trenchWall.position.set(x, -1.05, this.bridgeZ);
      this.root.add(trenchWall);
    }
    for (const z of [-2.4, 0, 2.4]) {
      const marking = new THREE.Mesh(new THREE.BoxGeometry(21, 0.025, 0.08), cream);
      marking.position.set(0, -2, this.bridgeZ + z);
      this.root.add(marking);
    }
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.28, 8.2), brick);
    deck.position.set(0, 0.14, this.bridgeZ);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.root.add(deck);
    for (const z of [this.bridgeZ - 5.1, this.bridgeZ + 5.1]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.24, 2.8), brick);
      ramp.position.set(0, 0.12, z);
      ramp.rotation.x = 0;
      ramp.receiveShadow = true;
      this.root.add(ramp);
    }
    for (const x of [-3.15, 3.15]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 8.4), metal);
      rail.position.set(x, 0.83, this.bridgeZ);
      this.root.add(rail);
      for (let z = -3.6; z <= 3.6; z += 1.8) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.15, 8), metal);
        post.position.set(x, 0.7, this.bridgeZ + z);
        this.root.add(post);
      }
    }
    for (const x of [-9.5, 9.5]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.5, 8), metal);
      pole.position.set(x, 2.75, this.bridgeZ);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), cream);
      lamp.position.set(x, 5.45, this.bridgeZ);
      this.root.add(pole, lamp);
    }
    const shelter = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.18, 1.2), metal);
    roof.position.y = 2.1;
    shelter.add(roof);
    for (const x of [-1.7, 1.7]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.1, 8), metal);
      post.position.set(x, 1.05, 0);
      shelter.add(post);
    }
    shelter.position.set(-7.5, 0, this.startZ - 1.1);
    this.root.add(shelter);
    for (const z of [this.valeRoadZ - 2.6, this.valeRoadZ + 2.6]) {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(10, 0.7, 0.12), metal);
      barrier.position.set(0, 0.35, z);
      this.root.add(barrier);
    }
    const pedestrianMaterial = new THREE.MeshStandardMaterial({ color: 0x355d87, roughness: 0.8 });
    for (const [x, z] of [[-5, this.startZ], [-2.5, this.startZ + 1], [3.5, this.startZ - 1], [6, this.finishZ], [-4, this.finishZ + 1], [2, this.finishZ - 1]]) {
      const pedestrian = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.34), pedestrianMaterial);
      body.position.y = 0.62;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), cream);
      head.position.y = 1.28;
      pedestrian.add(body, head);
      pedestrian.position.set(x, 0.12, z);
      this.root.add(pedestrian);
    }
    const bridgePedestrian = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.45, 0.5), pedestrianMaterial);
    bridgePedestrian.position.set(0, 1.03, 6.4);
    this.root.add(bridgePedestrian);
    this.blockedCells.push({ x: 0, z: 6.4 });
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
    this.updateBridgeElevation();
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

  updateBridgeElevation() {
    // Amic Deck stays at pedestrian grade; only the M1 traffic trench is lowered.
    this.player.position.y = 0.9;
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

  isBlockedCell(x, z) {
    const tolerance = this.gridSize * 0.1;
    return this.blockedCells.some((cell) =>
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
    const playerBox = new THREE.Box3().setFromObject(this.player);

    for (const vehicle of this.traffic) {
      if (vehicle.lane.isHighway) continue;
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
    camera.position.z = this.player.position.z + 17;
    camera.lookAt(
      this.player.position.x,
      0,
      this.player.position.z + 1.2
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
