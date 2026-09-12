import * as THREE from "three";
import { VehicleController } from "../../shared/VehicleController.js";
import { WaypointMover } from "../../shared/WaypointMover.js";
import {
  attachVehicleModel,
  pickRandomParkingCar
} from "../../shared/VehicleModelLibrary.js";
import { createAmicFenceSection } from "../../shared/AmicFence.js";
import { applyRoadUvs } from "../../shaders/asphaltShader.js";
import {
  PARKING_AISLE_WIDTH,
  PARKING_BAY_LENGTH,
  PARKING_SLOT_PITCH,
  createParkingBayMarkings,
  createParkingKerb
} from "../../shared/parking/ParkingLotStyle.js";

// Visual tuning values shared by every generated Level 2 strip.
const ROAD_COLOR = 0x292d31;
const TRAFFIC_EDGE = 18;

// The bridge checkpoint sinks its own surface/traffic by this much so they
// read as the highway far below the deck (see createBridgeDetails).
const BRIDGE_SINK = 3.4;
// Only this much of the bridge's width is walkable; the rest is grass
// shoulder over the sunken highway and is blocked off in createBridgeDetails.
const BRIDGE_DECK_WIDTH = 7.2;
const AMIC_DECK_TEXTURE_PATH = "./assets/textures/2695c241-17bb-416d-9d1d-7f061ccf7976.png";

export function createAmicDeckMaterial() {
  // Browser builds use the supplied AMIC reference texture. The tiny data
  // texture keeps layout tests DOM-free; it is never used by the game.
  const texture = typeof document === "undefined"
    ? new THREE.DataTexture(new Uint8Array([
      151, 128, 105, 255, 86, 76, 67, 255,
      86, 76, 67, 255, 151, 128, 105, 255
    ]), 2, 2, THREE.RGBAFormat)
    : new THREE.TextureLoader().load(AMIC_DECK_TEXTURE_PATH);
  texture.name = "amic-deck-texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.91, metalness: 0.01 });
  material.name = "amic-deck-material";
  return material;
}

// One CrossingStrip owns one horizontal area: its surface, decorations and traffic lanes.
export class CrossingStrip {
  constructor({ definition, z, parent, random, audio, walkwayMaterial = null, parkingMaterial = null }) {
    this.definition = definition;
    this.z = z;
    this.random = random;
    this.audio = audio;
    this.walkwayMaterial = walkwayMaterial ?? createAmicDeckMaterial();
    this.parkingMaterial = parkingMaterial;
    this.root = new THREE.Group();
    this.root.name = `crossing-strip-${definition.index}-${definition.type}`;
    this.root.position.z = z;
    this.isBridge = definition.type === "bridge";
    // The bridge's own surface and highway traffic sink below the deck it
    // draws in createBridgeDetails, reading as a sunken road far underneath.
    if (this.isBridge) this.root.position.y = -BRIDGE_SINK;
    parent.add(this.root);

    // Old presets may declare one traffic object directly. Larger custom hazards
    // can declare traffic.lanes, with one lane configuration per occupied row.
    const laneDefinitions = definition.traffic?.lanes
      ?? (definition.traffic ? [definition.traffic] : []);
    this.lanes = laneDefinitions.map((laneDefinition, laneIndex) => {
      const rowOffset = laneDefinition.rowOffset ?? Math.floor(definition.rowSpan / 2);
      const localZ = this.localZForRow(rowOffset);
      return {
        ...laneDefinition,
        laneIndex,
        localZ,
        z: z + localZ,
        strip: this
      };
    });
    // Retain `lane` as a convenience for any existing one-lane callers.
    this.lane = this.lanes[0] ?? null;
    this.traffic = [];
    this.modelPromises = [];
    this.blockedCells = [];
    this.boundaryVolumes = [];
    this.createGeometry();
    if (this.lanes.length > 0) this.createTraffic();
  }

  get isCheckpoint() {
    return this.definition.checkpoint === true;
  }

  get checkpointLabel() {
    if (this.definition.type === "median") return "traffic island";
    if (this.definition.type === "bridge") return "Amic Deck bridge";
    if (this.definition.type === "bridge-entry") return "pedestrian bridge entrance";
    if (this.definition.type === "bridge-exit") return "far side of the bridge";
    if (this.definition.type === "yale-exit") return "far side of Yale Road";
    if (this.definition.type === "start") return "start";
    return "safe pavement";
  }

  containsZ(worldZ) {
    return Math.abs(worldZ - this.z) <= this.definition.depth / 2 + 0.01;
  }

  localZForRow(rowOffset) {
    const rowDepth = this.definition.depth / this.definition.rowSpan;
    return ((this.definition.rowSpan - 1) / 2 - rowOffset) * rowDepth;
  }

  async loadModels(loader, modelCache) {
    // Load optional GLB scenery declared by this strip's preset.
    await Promise.all((this.definition.models ?? []).map(async (modelDefinition) => {
      let modelPromise = modelCache.get(modelDefinition.path);
      if (!modelPromise) {
        modelPromise = loader.loadAsync(modelDefinition.path).then((gltf) => gltf.scene);
        modelCache.set(modelDefinition.path, modelPromise);
      }

      const model = (await modelPromise).clone(true);
      model.name = modelDefinition.name ?? `strip-model-${this.definition.id}`;
      model.position.fromArray(modelDefinition.position ?? [0, 0, 0]);
      model.rotation.fromArray(modelDefinition.rotation ?? [0, 0, 0]);
      if (Array.isArray(modelDefinition.scale)) model.scale.fromArray(modelDefinition.scale);
      else model.scale.setScalar(modelDefinition.scale ?? 1);
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = modelDefinition.castShadow ?? true;
        child.receiveShadow = modelDefinition.receiveShadow ?? true;
      });
      this.root.add(model);
    }));
  }

  createGeometry() {
    // Draw the base road, pavement, start/finish area, or traffic-island surface.
    const isRoad = this.definition.surface === "road";
    const isMedian = this.definition.surface === "median";
    const colors = {
      start: 0xb6afa3,
      finish: 0xb9b2a6,
      pavement: 0xaaa398,
      median: 0xd3c6ae
    };
    const color = this.definition.surfaceColor
      ?? (isRoad ? ROAD_COLOR : colors[this.definition.type] ?? colors[this.definition.surface]);
    const surfaceMaterial = !isRoad && !isMedian
      ? this.walkwayMaterial
      : new THREE.MeshStandardMaterial({ color, roughness: isRoad ? 0.94 : 0.88, metalness: 0.02 });
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(this.definition.width, isRoad ? 0.12 : 0.22, this.definition.depth),
      surfaceMaterial
    );
    surface.name = isRoad ? "road-surface" : "amic-walkable-surface";
    surface.position.y = isRoad ? -0.06 : 0;
    surface.receiveShadow = true;
    this.root.add(surface);

    if (isRoad) this.createRoadMarkings();
    if (isMedian) this.createMedianDetails();
    if (this.isBridge) this.createBridgeDetails();
    if (this.definition.section === "arm") this.createArmWalkwayDetails();
    if (this.definition.section === "yale-road") this.createYaleRoadDetails();
    if (this.definition.section === "bridge-entry" || this.definition.section === "bridge-exit") this.createBridgeEntryDetails();
    if (this.definition.section === "engineering" || this.definition.section === "engineering-finish") {
      this.createEngineeringDetails();
    }
    if (!isRoad && !isMedian) this.blockOutsideWalkway();
    if (this.isCheckpoint) {
      // The bridge's flag sits on the deck itself (much narrower than the
      // full strip) and is lifted back above the sunken root.
      this.createCheckpointMarker(
        this.isBridge ? BRIDGE_SINK : 0,
        this.isBridge ? BRIDGE_DECK_WIDTH / 2 - 0.8 : undefined
      );
    }
    if (this.definition.trees) this.createTrees();
  }

  blockOutsideWalkway() {
    const gridStep = this.definition.depth / this.definition.rowSpan;
    for (let column = -6; column <= 6; column++) {
      const x = column * gridStep;
      if (Math.abs(x) <= 3.25) continue;
      for (let rowOffset = 0; rowOffset < this.definition.rowSpan; rowOffset++) {
        this.blockedCells.push({ x, z: this.z + this.localZForRow(rowOffset), type: "route-edge" });
      }
    }
  }

  addRouteFences({
    length = this.definition.depth,
    baseY = 0.2,
    halfWidth = BRIDGE_DECK_WIDTH / 2 - 0.2,
    colliderHalfWidth = this.definition.width / 2
  } = {}) {
    for (const side of [-1, 1]) {
      const fence = createAmicFenceSection({
        length: length + 0.04,
        name: `amic-fence-${this.definition.index}-${side < 0 ? "left" : "right"}`
      });
      fence.position.set(side * halfWidth, baseY, 0);
      this.root.add(fence);

      // One broad, cheap volume per fence run blocks both the metal line and
      // the exposed area beyond it. The rendered slats have no colliders.
      this.boundaryVolumes.push({
        minX: side < 0 ? -colliderHalfWidth : halfWidth - 0.12,
        maxX: side < 0 ? -halfWidth + 0.12 : colliderHalfWidth,
        minZ: this.z - length / 2 - 0.02,
        maxZ: this.z + length / 2 + 0.02,
        type: "amic-fence"
      });
    }
  }

  createArmWalkwayDetails() {
    const concrete = this.walkwayMaterial;
    const brick = new THREE.MeshStandardMaterial({ color: 0x8f6957, roughness: 0.9 });
    const lawn = new THREE.MeshStandardMaterial({ color: 0x4f7048, roughness: 1 });
    const path = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, this.definition.depth), concrete);
    path.name = "amic-arm-walkway";
    path.position.y = 0.15;
    path.receiveShadow = true;
    this.root.add(path);

    const parkingVerge = new THREE.Mesh(new THREE.BoxGeometry(7.1, 0.12, this.definition.depth), lawn);
    parkingVerge.position.set(7.25, 0.08, 0);
    parkingVerge.receiveShadow = true;
    this.root.add(parkingVerge);

    // The building is deliberately set well behind the route. AMIC paving
    // turns the former grass slot into an open courtyard instead of a squeeze.
    const courtyard = new THREE.Mesh(
      new THREE.BoxGeometry(8.3, 0.08, this.definition.depth),
      concrete
    );
    courtyard.name = "amic-arm-courtyard";
    courtyard.position.set(-8, 0.15, 0);
    courtyard.receiveShadow = true;
    this.root.add(courtyard);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(5.6, 6.8, this.definition.depth + 2.8), brick);
    arm.name = "arm-building";
    arm.position.set(-15.2, 3.42, 0.4);
    arm.castShadow = true;
    arm.receiveShadow = true;
    this.root.add(arm);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.8, this.definition.depth * 0.62), new THREE.MeshStandardMaterial({ color: 0x7fa1a8, roughness: 0.28, metalness: 0.18 }));
    windows.position.set(-12.37, 3.7, 0.4);
    this.root.add(windows);
    this.createParkingLot(1);
  }

  createVidaContainer() {
    const root = new THREE.Group();
    root.name = "vida-courtyard-container";
    // The VIDA container belongs across Yale Road on the Engineering side.
    // Rotate its 6.2 m long edge onto world X so it runs parallel to the road.
    root.position.set(-7.2, 0.2, 0);
    root.rotation.y = Math.PI / 2;

    const containerMaterial = new THREE.MeshStandardMaterial({
      color: 0xb8322d,
      roughness: 0.72,
      metalness: 0.38
    });
    const trimMaterial = new THREE.MeshStandardMaterial({
      color: 0x641b19,
      roughness: 0.66,
      metalness: 0.48
    });
    const shell = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.55, 6.2), containerMaterial);
    shell.name = "vida-container-shell";
    shell.position.y = 1.275;
    shell.castShadow = true;
    shell.receiveShadow = true;
    root.add(shell);

    const ribGeometry = new THREE.BoxGeometry(0.08, 2.38, 0.1);
    const ribCount = 16;
    for (const side of [-1, 1]) {
      const ribs = new THREE.InstancedMesh(ribGeometry, trimMaterial, ribCount);
      ribs.name = "vida-container-ribs";
      const matrix = new THREE.Matrix4();
      for (let index = 0; index < ribCount; index++) {
        matrix.makeTranslation(side * 1.27, 1.28, -2.9 + index * (5.8 / (ribCount - 1)));
        ribs.setMatrixAt(index, matrix);
      }
      ribs.instanceMatrix.needsUpdate = true;
      ribs.castShadow = true;
      root.add(ribs);
    }

    const labelTexture = this.createVidaLabelTexture();
    const labelMaterial = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.9), labelMaterial);
    label.name = "vida-container-label";
    label.rotation.y = -Math.PI / 2;
    label.position.set(-1.306, 1.45, 0);
    root.add(label);
    this.root.add(root);
  }

  createVidaLabelTexture() {
    if (typeof document === "undefined") {
      const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
      texture.needsUpdate = true;
      texture.name = "vida-label-texture";
      return texture;
    }
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 144;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "rgba(91, 20, 18, 0.9)";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#f4ead2";
    context.font = "bold 96px sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText("VIDA", canvas.width / 2, canvas.height / 2 + 4);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.name = "vida-label-texture";
    return texture;
  }

  createYaleRoadDetails() {
    const paint = new THREE.MeshBasicMaterial({ color: 0xf1efe5 });
    const yellow = new THREE.MeshBasicMaterial({ color: 0xe0bd4f });
    const kerb = new THREE.MeshStandardMaterial({ color: 0xd7d2c7, roughness: 0.86 });
    const roadDepth = this.definition.depth;

    for (const z of [-roadDepth / 2 + 0.08, roadDepth / 2 - 0.08]) {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(this.definition.width, 0.28, 0.2), kerb);
      edge.position.set(0, 0.09, z);
      edge.castShadow = true;
      edge.receiveShadow = true;
      this.root.add(edge);
    }
    for (const z of [-2.4, 0, 2.4]) {
      const divider = new THREE.Mesh(new THREE.BoxGeometry(this.definition.width, 0.025, z === 0 ? 0.1 : 0.06), z === 0 ? yellow : paint);
      divider.position.set(0, 0.025, z);
      this.root.add(divider);
    }
    for (let z = -roadDepth / 2 + 0.45; z < roadDepth / 2; z += 0.8) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.035, 0.4), paint);
      stripe.position.set(0, 0.04, z);
      this.root.add(stripe);
    }
    for (const x of [-4.3, 4.3]) {
      for (const z of [-roadDepth / 2 - 0.35, roadDepth / 2 + 0.35]) this.createSignal(x, z);
    }
  }

  createSignal(x, z) {
    const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x30363a, roughness: 0.58, metalness: 0.5 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.8, 10), poleMaterial);
    pole.position.set(x, 1.4, z);
    pole.castShadow = true;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.75, 0.32), poleMaterial);
    head.position.set(x, 2.55, z);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x4ee475 }));
    light.position.set(x, 2.42, z + Math.sign(z || 1) * 0.17);
    this.root.add(pole, head, light);
  }

  createBridgeEntryDetails() {
    const paving = this.walkwayMaterial;
    const lawn = new THREE.MeshStandardMaterial({ color: 0x52764a, roughness: 1 });
    const isFarSideLanding = this.definition.section === "bridge-exit";
    const apron = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.1, this.definition.depth), paving);
    apron.name = "amic-bridge-landing";
    apron.position.y = 0.16;
    apron.receiveShadow = true;
    this.root.add(apron);
    for (const side of [-1, 1]) {
      const isVidaCourtyard = isFarSideLanding && side < 0;
      const bed = new THREE.Mesh(
        new THREE.BoxGeometry(7, 0.1, this.definition.depth),
        isVidaCourtyard ? paving : lawn
      );
      if (isVidaCourtyard) bed.name = "amic-vida-courtyard";
      bed.position.set(side * 7.2, 0.08, 0);
      bed.receiveShadow = true;
      this.root.add(bed);
    }
    if (isFarSideLanding) this.createVidaContainer();
  }

  createEngineeringDetails() {
    const paving = this.walkwayMaterial;
    const lawn = new THREE.MeshStandardMaterial({ color: 0x56784e, roughness: 1 });
    const brick = new THREE.MeshStandardMaterial({ color: 0x8b6554, roughness: 0.9 });
    const route = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.08, this.definition.depth), paving);
    route.name = "amic-engineering-walkway";
    route.position.y = 0.15;
    route.receiveShadow = true;
    this.root.add(route);
    for (const side of [-1, 1]) {
      const verge = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, this.definition.depth), lawn);
      verge.position.set(side * 7.2, 0.08, 0);
      this.root.add(verge);
    }
    if (this.definition.section === "engineering-finish") {
      const building = new THREE.Mesh(new THREE.BoxGeometry(7, 8.5, this.definition.depth + 2), brick);
      building.name = "engineering-building";
      building.position.set(7.8, 4.27, -0.4);
      building.castShadow = true;
      this.root.add(building);
      const entrance = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 2.8), new THREE.MeshStandardMaterial({ color: 0x78959d, roughness: 0.25, metalness: 0.15 }));
      entrance.position.set(4.24, 1.7, -1.2);
      this.root.add(entrance);
      this.createParkingLot(-1);
    }
  }

  createParkingLot(side) {
    const lotWidth = PARKING_BAY_LENGTH * 2 + PARKING_AISLE_WIDTH;
    const lotDepth = this.definition.depth + 0.8;
    const centerX = side * (BRIDGE_DECK_WIDTH / 2 + 0.8 + lotWidth / 2);
    const asphalt = this.parkingMaterial
      ?? new THREE.MeshStandardMaterial({ color: 0x2f343a, roughness: 1, metalness: 0 });
    const lot = new THREE.Mesh(new THREE.BoxGeometry(lotWidth, 0.1, lotDepth), asphalt);
    applyRoadUvs(lot.geometry, lotWidth, lotDepth);
    lot.name = side > 0 ? "arm-side-parking" : "opposite-side-parking";
    lot.position.set(centerX, 0.08, 0);
    lot.receiveShadow = true;
    this.root.add(lot);

    const rowOffset = (PARKING_AISLE_WIDTH + PARKING_BAY_LENGTH) / 2;
    const usableHalfDepth = lotDepth / 2 - PARKING_SLOT_PITCH / 2;
    const slotCount = Math.max(2, Math.floor((usableHalfDepth * 2) / PARKING_SLOT_PITCH) + 1);
    const zPositions = Array.from({ length: slotCount }, (_, index) =>
      -usableHalfDepth + index * (usableHalfDepth * 2 / Math.max(1, slotCount - 1))
    );
    const spaces = zPositions.flatMap((z) => [
      { x: centerX - side * rowOffset, z, angle: side * Math.PI / 2 },
      { x: centerX + side * rowOffset, z, angle: -side * Math.PI / 2 }
    ]);
    this.root.add(...createParkingBayMarkings(spaces, { y: 0.145 }));

    for (const x of [centerX - lotWidth / 2, centerX + lotWidth / 2]) {
      const kerb = createParkingKerb(lotDepth);
      kerb.position.set(x, 0.13, 0);
      kerb.name = "level-one-style-parking-kerb";
      this.root.add(kerb);
    }

    let index = 0;
    for (const space of spaces) {
      if (index % 7 !== 3) {
        const holder = new THREE.Group();
        holder.name = `level-two-parked-car-${this.definition.index}-${index++}`;
        holder.position.set(space.x, 0.14, space.z);
        holder.rotation.y = space.angle;
        this.root.add(holder);
        const spec = pickRandomParkingCar(this.random);
        holder.userData.vehicleSpecId = spec.id;
        if (typeof window !== "undefined") {
          this.modelPromises.push(
            attachVehicleModel(holder, spec, "lite").catch((error) => {
              console.warn(`Level 2 parked car ${spec.id} could not load.`, error);
              return null;
            })
          );
        }
      } else {
        index++;
      }
    }
  }

  createTrees() {
    // Pick unique grid blocks using the strip's seeded RNG. Tree presets normally
    // reserve the centre columns so the player's forward route stays open.
    const config = this.definition.trees;
    const blocks = [];
    for (const rowOffset of config.rowOffsets) {
      for (const column of config.columns) blocks.push({ column, rowOffset });
    }
    for (let index = blocks.length - 1; index > 0; index--) {
      const other = Math.floor(this.random() * (index + 1));
      [blocks[index], blocks[other]] = [blocks[other], blocks[index]];
    }

    const [minimumCount, maximumCount] = config.countRange;
    const count = minimumCount + Math.floor(this.random() * (maximumCount - minimumCount + 1));
    const treeScale = config.scale ?? 1;
    const gridSize = this.definition.depth / this.definition.rowSpan;
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.22, 1.15, 7);
    const canopyGeometry = new THREE.ConeGeometry(0.72, 1.45, 7);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: config.trunkColor ?? 0x76513a,
      roughness: 0.92,
      flatShading: true
    });
    const canopyColors = config.canopyColors ?? [0x3f7f4c, 0x57934f, 0x6aa557];
    const canopyMaterials = canopyColors.map((color) => new THREE.MeshStandardMaterial({
      color,
      roughness: 0.86,
      flatShading: true
    }));

    for (let index = 0; index < count; index++) {
      const block = blocks[index];
      const tree = new THREE.Group();
      tree.name = `strip-tree-${this.definition.index}-${index}`;
      tree.userData.gridColumn = block.column;
      tree.userData.rowOffset = block.rowOffset;

      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 0.68;
      trunk.castShadow = true;
      tree.add(trunk);

      const canopy = new THREE.Mesh(
        canopyGeometry,
        canopyMaterials[Math.floor(this.random() * canopyMaterials.length)]
      );
      canopy.position.y = 1.75;
      canopy.castShadow = true;
      tree.add(canopy);

      tree.scale.setScalar(treeScale);
      tree.position.set(block.column * gridSize, 0.11, this.localZForRow(block.rowOffset));
      this.root.add(tree);
      this.blockedCells.push({
        x: tree.position.x,
        z: this.z + tree.position.z,
        type: "tree"
      });
    }
  }

  createRoadMarkings() {
    // Draw the repeated dashed street line across the centre of a traffic row.
    // A strip preset can override any of these values through `markings`.
    const markings = {
      color: 0xe2dd9a,
      length: 1.4,
      thickness: 0.08,
      spacing: 3,
      offsetZ: 0,
      ...this.definition.markings
    };
    const lineMaterial = new THREE.MeshBasicMaterial({ color: markings.color });
    const halfWidth = this.definition.width / 2;
    for (let x = -halfWidth + 1; x <= halfWidth - 1; x += markings.spacing) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(markings.length, 0.025, markings.thickness),
        lineMaterial
      );
      stripe.position.set(x, 0.015, markings.offsetZ);
      this.root.add(stripe);
    }
  }

  createMedianDetails() {
    // Draw the raised green median top and the pale kerbs on both edges.
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(this.definition.width - 0.5, 0.08, this.definition.depth - 0.42),
      new THREE.MeshStandardMaterial({ color: 0x85b96b, roughness: 0.88, flatShading: true })
    );
    top.position.y = 0.15;
    top.receiveShadow = true;
    this.root.add(top);

    const kerbMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e9d3, roughness: 0.78, flatShading: true });
    const kerbOffset = this.definition.depth / 2 - 0.17;
    for (const localZ of [-kerbOffset, kerbOffset]) {
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(this.definition.width, 0.24, 0.18),
        kerbMaterial
      );
      kerb.position.set(0, 0.12, localZ);
      kerb.castShadow = true;
      kerb.receiveShadow = true;
      this.root.add(kerb);
    }
  }

createCheckpointMarker(yOffset = 0, x = this.definition.width / 2 - 0.8) {
  // Small checkpoint flag placed near the edge of the safe strip.
  const flag = new THREE.Group();

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  pole.position.y = 0.6;
  flag.add(pole);

  // Flag cloth
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.32, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  cloth.position.set(0.275, 1.02, 0);
  flag.add(cloth);

  flag.position.set(x, yOffset + (this.definition.surface === "median" ? 0.21 : 0.13), 0);

  this.root.add(flag);
}

createBridgeDetails() {
  // Draws the Amic Deck pedestrian bridge over the sunken M1: a brick deck
  // and railings at true grade, lifted back up by BRIDGE_SINK to compensate
  // this.root's sink (which otherwise only affects the highway below).
  // Every mesh here is sized to this strip's own depth so nothing bleeds
  // into the neighbouring rows above/below it. The strip's outer rows carry
  // no traffic (see Level2StripLibrary) - they're the grass approach on
  // either side of the deck, in the direction of travel.
  const depth = this.definition.depth;
  const width = this.definition.width;
  const rowDepth = depth / this.definition.rowSpan;
  const deckDepth = depth - 2 * rowDepth;
  const wallZ = deckDepth / 2 + 0.2;
  const concrete = new THREE.MeshStandardMaterial({ color: 0xaaa59b, roughness: 0.92 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x56616a, roughness: 0.65 });
  const cream = new THREE.MeshBasicMaterial({ color: 0xf1ead4 });
  const grass = new THREE.MeshStandardMaterial({ color: 0x587449, roughness: 0.95, flatShading: true });

  // World-connecting grass beyond the trench walls, clipped to this strip's
  // own depth (it can spill sideways into open space, just not lengthwise
  // into a neighbouring row).
  const outerGround = new THREE.Mesh(new THREE.PlaneGeometry(width + 6, depth), grass);
  outerGround.rotation.x = -Math.PI / 2;
  // Keep this foundation below the carriageway; a higher full-width plane
  // would hide the recessed M1 from the isometric camera.
  outerGround.position.y = -0.25;
  this.root.add(outerGround);

  for (const side of [-1, 1]) {
    const trenchWall = new THREE.Mesh(new THREE.BoxGeometry(width + 6, 3.5, 0.45), concrete);
    trenchWall.position.set(0, BRIDGE_SINK - 1.65, side * wallZ);
    trenchWall.castShadow = true;
    trenchWall.receiveShadow = true;
    this.root.add(trenchWall);
  }

  // AMIC-textured pedestrian approaches bridge the campus grade to the deck.
  // Grass stays outside the railings and never becomes a fake M1 ledge path.
  for (const zSide of [-1, 1]) {
    const approach = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE_DECK_WIDTH, 0.16, rowDepth), this.walkwayMaterial);
    approach.name = "amic-bridge-approach";
    approach.position.set(0, BRIDGE_SINK + 0.08, zSide * (depth / 2 - rowDepth / 2));
    approach.receiveShadow = true;
    this.root.add(approach);
    const shoulderWidth = (width - BRIDGE_DECK_WIDTH) / 2;
    for (const xSide of [-1, 1]) {
      const shoulder = new THREE.Mesh(new THREE.BoxGeometry(shoulderWidth, 0.16, rowDepth), grass);
      shoulder.position.set(xSide * (BRIDGE_DECK_WIDTH / 2 + shoulderWidth / 2), BRIDGE_SINK + 0.08, approach.position.z);
      shoulder.receiveShadow = true;
      this.root.add(shoulder);
    }
  }

  const deck = new THREE.Mesh(new THREE.BoxGeometry(BRIDGE_DECK_WIDTH, 0.34, deckDepth), this.walkwayMaterial);
  deck.name = "amic-pedestrian-bridge-deck";
  deck.position.set(0, BRIDGE_SINK + 0.14, 0);
  deck.castShadow = true;
  deck.receiveShadow = true;
  this.root.add(deck);

  this.addRouteFences({
    length: depth,
    baseY: BRIDGE_SINK + 0.31,
    halfWidth: BRIDGE_DECK_WIDTH / 2 - 0.2
  });

  const roadPaint = new THREE.MeshBasicMaterial({ color: 0xe9e5d8 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c5bb, roughness: 0.82 });
  for (let row = 1; row < this.definition.rowSpan - 1; row++) {
    const z = this.localZForRow(row) - rowDepth / 2;
    const line = new THREE.Mesh(new THREE.BoxGeometry(width, 0.025, 0.06), roadPaint);
    line.position.set(0, 0.03, z);
    this.root.add(line);
  }
  for (const z of [-wallZ + 0.48, wallZ - 0.48]) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(width + 6, 0.8, 0.24), barrierMaterial);
    barrier.position.set(0, 0.38, z);
    barrier.castShadow = true;
    this.root.add(barrier);
  }

  for (const z of [-deckDepth / 2 + 0.8, deckDepth / 2 - 0.8]) {
    for (const x of [-2.4, 2.4]) {
      const support = new THREE.Mesh(new THREE.BoxGeometry(0.55, BRIDGE_SINK, 0.55), concrete);
      support.position.set(x, BRIDGE_SINK / 2, z);
      support.castShadow = true;
      this.root.add(support);
    }
  }

  for (const x of [-width / 2 + 1.5, width / 2 - 1.5]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.5, 8), metal);
    pole.position.set(x, BRIDGE_SINK + 2.75, 0);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), cream);
    lamp.position.set(x, BRIDGE_SINK + 5.45, 0);
    this.root.add(pole, lamp);
  }

  // Block every grid cell off the deck so the player can't walk off the
  // bridge and end up floating over the sunken highway.
  const gridStep = depth / this.definition.rowSpan;
  const walkableHalfWidth = BRIDGE_DECK_WIDTH / 2 - 0.4;
  const halfColumnCount = 6; // matches the level's -9.6..9.6 hop grid range
  for (let column = -halfColumnCount; column <= halfColumnCount; column++) {
    const x = column * gridStep;
    if (Math.abs(x) <= walkableHalfWidth) continue;
    for (let rowOffset = 0; rowOffset < this.definition.rowSpan; rowOffset++) {
      this.blockedCells.push({ x, z: this.z + this.localZForRow(rowOffset), type: "bridge-edge" });
    }
  }
}

  createTraffic() {
    // Each lane gets an independent fixed pool, spacing, direction and recycle tail.
    for (const lane of this.lanes) this.createTrafficLane(lane);
  }

  createTrafficLane(lane) {
    let previousX = lane.direction > 0
      ? -10 + this.random() * 20
      : 10 - this.random() * 20;
    for (let index = 0; index < lane.vehicleCount; index++) {
      const type = this.vehicleTypeFor(lane, index);
      const vehicle = this.createVehicle(lane, type, index);
      if (index > 0) previousX -= lane.direction * this.randomGap(lane);
      vehicle.root.position.x = previousX;
      vehicle.mover.reset(vehicle.root.position, 1);
      if (vehicle.isTaxi) this.scheduleTaxiStop(vehicle);
      this.traffic.push(vehicle);
    }
  }

  createVehicle(lane, type, index) {
    const spec = pickRandomParkingCar(this.random);
    const vehicleRoot = new THREE.Group();
    vehicleRoot.name = `${type}-${this.definition.index}-${lane.laneIndex}-${index}`;
    vehicleRoot.rotation.y = lane.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    vehicleRoot.userData.vehicleSpecId = spec.id;
    this.root.add(vehicleRoot);

    if (typeof window !== "undefined") {
      const modelPromise = attachVehicleModel(vehicleRoot, spec, "lite")
        .then((model) => {
          model.name = `level-two-${spec.id}`;
          return model;
        })
        .catch((error) => {
          console.warn(`Level 2 vehicle model ${spec.id} could not load.`, error);
          return null;
        });
      this.modelPromises.push(modelPromise);
    }
    const passenger = type === "taxi" ? this.createTaxiPassenger(lane) : null;
    vehicleRoot.position.z = lane.localZ;
    const start = new THREE.Vector3(lane.direction > 0 ? -TRAFFIC_EDGE : TRAFFIC_EDGE, 0, lane.localZ);
    const end = new THREE.Vector3(lane.direction > 0 ? TRAFFIC_EDGE : -TRAFFIC_EDGE, 0, lane.localZ);
    return {
      root: vehicleRoot,
      controller: new VehicleController(vehicleRoot, {
        maxForwardSpeed: lane.speed,
        acceleration: 18,
        braking: 24
      }),
      lane,
      mover: new WaypointMover(vehicleRoot, {
        points: [start, end],
        speed: lane.speed,
        mode: "one-shot",
        debugRoot: this.root,
        debugColor: type === "taxi" ? 0xf2b233 : 0x8fd6c8
      }),
      type,
      spec,
      length: spec.collider[2],
      isTaxi: type === "taxi",
      passenger,
      stopTimer: 0,
      nextStopX: null
    };
  }

  createTaxiPassenger(lane) {
    // Hidden passenger shown beside a taxi only while it performs a random stop.
    const passenger = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.15, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x35e0d1, roughness: 0.8 })
    );
    passenger.visible = false;
    passenger.position.set(0, 0.58, lane.localZ + 0.95);
    this.root.add(passenger);
    return passenger;
  }

  update(dt) {
    // Advance this strip's traffic and handle taxi stops and end-of-row recycling.
    for (const vehicle of this.traffic) {
      if (vehicle.stopTimer > 0) {
        vehicle.stopTimer = Math.max(0, vehicle.stopTimer - dt);
        vehicle.controller.stop();
        if (vehicle.stopTimer === 0) {
          vehicle.passenger.visible = false;
          this.scheduleTaxiStop(vehicle);
        }
        continue;
      }

      const result = vehicle.mover.update(dt, (direction, requested, stepDt) =>
        this.advanceVehicle(vehicle, direction, requested, stepDt)
      );
      if (result.arrived || vehicle.mover.finished) {
        this.recycleVehicle(vehicle);
        continue;
      }

      if (vehicle.isTaxi && this.hasReachedTaxiStop(vehicle)) this.stopTaxi(vehicle);
    }
  }

  advanceVehicle(vehicle, direction, requested, dt) {
    // Preserve a safe following distance, including behind a stopped taxi.
    const available = this.distanceToVehicleAhead(vehicle);
    if (available <= 0) {
      vehicle.controller.stop();
      return 0;
    }

    const startX = vehicle.root.position.x;
    const travelled = vehicle.controller.followDirection(dt, direction);
    const allowed = Math.min(requested, travelled, available);
    vehicle.root.position.x = startX + vehicle.lane.direction * allowed;
    if (allowed < travelled) vehicle.controller.stop();
    return allowed;
  }

  distanceToVehicleAhead(vehicle) {
    let available = Infinity;
    for (const other of this.traffic) {
      if (other === vehicle || other.lane !== vehicle.lane) continue;
      const centerDistance = (other.root.position.x - vehicle.root.position.x) * vehicle.lane.direction;
      if (centerDistance <= 0) continue;
      const followingDistance = (vehicle.length + other.length) / 2 + 0.8;
      available = Math.min(available, centerDistance - followingDistance);
    }
    return Math.max(0, available);
  }

  recycleVehicle(vehicle) {
    // Reuse the same object behind the current tail instead of creating a new vehicle.
    const lane = vehicle.lane;
    const otherVehicles = this.traffic.filter((candidate) => candidate !== vehicle && candidate.lane === lane);
    const tailX = lane.direction > 0
      ? Math.min(...otherVehicles.map((candidate) => candidate.root.position.x), -TRAFFIC_EDGE)
      : Math.max(...otherVehicles.map((candidate) => candidate.root.position.x), TRAFFIC_EDGE);
    const nextX = tailX - lane.direction * this.randomGap(lane);
    vehicle.controller.stop();
    vehicle.mover.reset(new THREE.Vector3(nextX, 0, lane.localZ), 1);
    if (vehicle.isTaxi) {
      vehicle.passenger.visible = false;
      this.scheduleTaxiStop(vehicle);
    }
  }

  stopTaxi(vehicle) {
    vehicle.stopTimer = 1.1 + this.random() * 0.7;
    vehicle.controller.stop();
    vehicle.passenger.position.x = vehicle.root.position.x;
    vehicle.passenger.visible = true;
    this.audio?.cue(520, 0.13, 0.1, vehicle.root.position.x / 12);
  }

  scheduleTaxiStop(vehicle) {
    const distance = 4.5 + this.random() * 4.5;
    const desired = vehicle.root.position.x + vehicle.lane.direction * distance;
    vehicle.nextStopX = THREE.MathUtils.clamp(desired, -TRAFFIC_EDGE + 3, TRAFFIC_EDGE - 3);
  }

  hasReachedTaxiStop(vehicle) {
    return vehicle.lane.direction > 0
      ? vehicle.root.position.x >= vehicle.nextStopX
      : vehicle.root.position.x <= vehicle.nextStopX;
  }

  vehicleTypeFor(lane, index) {
    if (lane.taxiStops && index === 0) return "taxi";
    const choices = lane.allowedVehicleTypes.filter((type) => type !== "taxi");
    return choices[Math.floor(this.random() * choices.length)] ?? lane.allowedVehicleTypes[0];
  }

  randomGap(lane) {
    const [minimum, maximum] = lane.gapRange;
    return minimum + this.random() * (maximum - minimum);
  }

  whenReady() {
    return Promise.allSettled(this.modelPromises);
  }

  setDebugVisible(visible) {
    for (const vehicle of this.traffic) vehicle.mover.setDebugVisible(visible);
  }
}
