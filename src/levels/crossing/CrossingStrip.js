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
import {
  LEVEL_2_STRIPS,
  STRIP_DEPTH
} from "./Level2StripGenerator.js";

// Visual tuning values shared by every generated Level 2 strip.
const ROAD_COLOR = 0x292d31;

const ROAD_VISUAL_WIDTH = 120;
const TRAFFIC_EDGE = ROAD_VISUAL_WIDTH / 2 - 4;

const ARM_BACK_EXTENSION = 20;

// The bridge checkpoint sinks its own surface/traffic by this much so they
// read as the highway far below the deck (see createBridgeDetails).
const BRIDGE_SINK = 3.4;
// Only this much of the bridge's width is walkable; the rest is side paving
// over the sunken highway and is blocked off in createBridgeDetails.
const BRIDGE_DECK_WIDTH = 7.2;

// Every normal pedestrian surface uses the same physical height and texture
// scale so Level 2 reads as one continuous walking route.
const WALKWAY_CENTER_Y = 0.15;
const WALKWAY_HEIGHT = 0.08;
const WALKWAY_TOP_Y = WALKWAY_CENTER_Y + WALKWAY_HEIGHT / 2;
const WALKWAY_TILE_SIZE = 1.8;

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
  texture.repeat.set(1, 1);
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

  createWalkwayPanel(width, depth, {
    x = 0,
    z = 0,
    y = WALKWAY_CENTER_Y,
    height = WALKWAY_HEIGHT,
    name = "amic-walkway-panel",
    castShadow = false
  } = {}) {
    // Clone the material/texture per panel so repeat can be based on physical
    // size. This keeps the AMIC paving the same scale everywhere instead of
    // stretching differently on each strip.
    const material = this.walkwayMaterial.clone();

    if (this.walkwayMaterial.map) {
      material.map = this.walkwayMaterial.map.clone();
      material.map.wrapS = THREE.RepeatWrapping;
      material.map.wrapT = THREE.RepeatWrapping;
      material.map.repeat.set(
        Math.max(0.001, width / WALKWAY_TILE_SIZE),
        Math.max(0.001, depth / WALKWAY_TILE_SIZE)
      );

      // Use world-relative offsets so neighbouring panels begin at a
      // compatible point in the repeating pattern.
      material.map.offset.set(
        (x - width / 2) / WALKWAY_TILE_SIZE,
        (this.z + z - depth / 2) / WALKWAY_TILE_SIZE
      );
      material.map.needsUpdate = true;
    }

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      material
    );
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    this.root.add(mesh);
    return mesh;
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
    // Roads/medians keep their own surfaces. Every ordinary pedestrian strip
    // gets the same 7.2 m centre walkway, at the same height and tile scale.
    const isRoad = this.definition.surface === "road";
    const isMedian = this.definition.surface === "median";

    if (isRoad || isMedian) {
      const colors = {
        median: 0xd3c6ae
      };
      const color = this.definition.surfaceColor
        ?? (isRoad ? ROAD_COLOR : colors.median);

      const surfaceMaterial = isRoad && this.parkingMaterial
        ? this.parkingMaterial
        : new THREE.MeshStandardMaterial({
          color,
          roughness: isRoad ? 0.94 : 0.88,
          metalness: 0.02
        });

      const surfaceWidth =
        isRoad
          ? ROAD_VISUAL_WIDTH
          : this.definition.width;

      const surface = new THREE.Mesh(
        new THREE.BoxGeometry(
          surfaceWidth,
          isRoad ? 0.12 : 0.22,
          this.definition.depth
        ),
        surfaceMaterial
      );

      if (isRoad && this.parkingMaterial) {
        applyRoadUvs(
            surface.geometry,
            surfaceWidth,
            this.definition.depth
          );
      }

      surface.name = isRoad ? "road-surface" : "median-surface";
      surface.position.y = isRoad ? -0.06 : 0;
      surface.receiveShadow = true;
      this.root.add(surface);
    } else {
      this.createWalkwayPanel(
        BRIDGE_DECK_WIDTH,
        this.definition.depth,
        { name: "amic-walkable-surface" }
      );
    }

    if (isRoad) this.createRoadMarkings();
    if (isMedian) this.createMedianDetails();
    if (this.isBridge) this.createBridgeDetails();
    if (this.definition.section === "arm") this.createArmWalkwayDetails();
    if (this.definition.section === "yale-road") this.createYaleRoadDetails();
    if (this.definition.section === "bridge-entry" || this.definition.section === "bridge-exit") {
      this.createBridgeEntryDetails();
    }
    if (this.definition.section === "engineering" || this.definition.section === "engineering-finish") {
      this.createEngineeringDetails();
    }

    if (!isRoad && !isMedian) this.blockOutsideWalkway();

    if (this.isCheckpoint) {
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

  createArmBuilding() {
  const root = new THREE.Group();
  root.name = "wits-arm-building";

  // Position the building on the LEFT of the pedestrian route.
  root.position.set(-9.5, 0, 0.4 + ARM_BACK_EXTENSION / 2);
  this.root.add(root);

  const brick = new THREE.MeshStandardMaterial({
    color: 0x86513d,
    roughness: 0.88
  });

  const darkBrick = new THREE.MeshStandardMaterial({
    color: 0x704233,
    roughness: 0.88
  });

  const concrete = new THREE.MeshStandardMaterial({
    color: 0xb1aaa0,
    roughness: 0.9
  });

  const roof = new THREE.MeshStandardMaterial({
    color: 0x89979b,
    roughness: 0.76,
    metalness: 0.12
  });

  const windows = new THREE.MeshBasicMaterial({
    color: 0xf0b56b
  });

  const addBox = (
    size,
    position,
    mat,
    name = ""
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      mat
    );

    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;

    root.add(mesh);

    return mesh;
  };

  // --------------------------------------------------
  // MAIN ARM MASS
  // --------------------------------------------------

  const buildingWidth = 7.5;
  const buildingDepth =
      this.definition.depth +
      4 +
      ARM_BACK_EXTENSION;

  const buildingHeight = 8.5;

  addBox(
    [
      buildingWidth,
      buildingHeight,
      buildingDepth
    ],
    [
      0,
      buildingHeight / 2,
      0
    ],
    brick,
    "wits-arm-main"
  );

  // Roof slab.
  addBox(
    [
      buildingWidth - 0.35,
      0.35,
      buildingDepth - 0.4
    ],
    [
      0,
      buildingHeight + 0.18,
      0
    ],
    roof,
    "wits-arm-roof"
  );

  // --------------------------------------------------
  // INTERLOCKING REAR / SIDE MASS
  // --------------------------------------------------

  addBox(
    [
      buildingWidth + 2.8,
      buildingHeight - 1.6,
      5.5
    ],
    [
      -1.0,
      (buildingHeight - 1.6) / 2,
      -buildingDepth / 2 + 1.5
    ],
    concrete,
    "wits-arm-concrete-wing"
  );

  const tallWingX = 1.7;
const tallWingWidth = 4.5;

const tallWingZ =
  buildingDepth / 2 - 2.1;

const tallWingDepth = 6.2;

const tallWingHeight =
  buildingHeight + 2.2;

addBox(
  [
    tallWingWidth,
    tallWingHeight,
    tallWingDepth
  ],
  [
    tallWingX,
    tallWingHeight / 2,
    tallWingZ
  ],
  darkBrick,
  "wits-arm-tall-wing"
);

  // --------------------------------------------------
  // CIRCULAR / DOME SECTION
  // --------------------------------------------------

  const domeBase =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        2.7,
        2.7,
        2.4,
        28
      ),
      concrete
    );

  domeBase.position.set(
    0.7,
    buildingHeight + 1.2,
    0.5
  );

  domeBase.castShadow = true;
  domeBase.receiveShadow = true;

  root.add(domeBase);

  const domeRoof =
    new THREE.Mesh(
      new THREE.CylinderGeometry(
        2.45,
        2.65,
        0.7,
        28
      ),
      roof
    );

  domeRoof.position.set(
    0.7,
    buildingHeight + 2.75,
    0.5
  );

  domeRoof.castShadow = true;

  root.add(domeRoof);
// --------------------------------------------------
// FULL ARM WINDOW GRID
// Main building + brown wing
// --------------------------------------------------

const windowWidth = 1.45;
const windowHeight = 1.0;
const windowInset = 0.055;

const windowRows = [
  1.35,
  2.85,
  4.35,
  5.85,
  7.35
];

// Helper that fills an X-facing wall almost edge-to-edge.
const addWindowsAcrossXFace = ({
  faceX,
  zMin,
  zMax,
  rows = windowRows,
  name = "wits-arm-window"
}) => {
  // Only leave a tiny border at either end.
  const edgeMargin = 0.12;

  const firstZ =
    zMin +
    edgeMargin +
    windowWidth / 2;

  const lastZ =
    zMax -
    edgeMargin -
    windowWidth / 2;

  const available =
    Math.max(0, lastZ - firstZ);

  // Fairly tight spacing so we don't leave a large blank wall.
  const count = Math.max(
    1,
    Math.ceil(available / 1.7) + 1
  );

  for (let column = 0; column < count; column++) {
    const z =
      count === 1
        ? (zMin + zMax) / 2
        : THREE.MathUtils.lerp(
            firstZ,
            lastZ,
            column / (count - 1)
          );

    for (const y of rows) {
      addBox(
        [
          0.08,
          windowHeight,
          windowWidth
        ],
        [
          faceX,
          y,
          z
        ],
        windows,
        name
      );
    }
  }
};

// --------------------------------------------------
// MAIN BUILDING — BOTH LONG SIDES
// --------------------------------------------------

addWindowsAcrossXFace({
  faceX:
    buildingWidth / 2 +
    windowInset,

  zMin:
    -buildingDepth / 2,

  zMax:
    buildingDepth / 2,

  name:
    "wits-arm-main-window-right"
});

addWindowsAcrossXFace({
  faceX:
    -buildingWidth / 2 -
    windowInset,

  zMin:
    -buildingDepth / 2,

  zMax:
    buildingDepth / 2,

  name:
    "wits-arm-main-window-left"
});

// --------------------------------------------------
// BROWN TALL WING
// This is the blank brown section you are seeing.
// --------------------------------------------------

// const tallWingX = 1.7;
// const tallWingWidth = 4.5;

// const tallWingZ =
//   buildingDepth / 2 - 2.1;

// const tallWingDepth = 6.2;

const tallWingRows = [
  1.35,
  2.85,
  4.35,
  5.85,
  7.35,
  8.85
];

addWindowsAcrossXFace({
  faceX:
    tallWingX +
    tallWingWidth / 2 +
    windowInset,

  zMin:
    tallWingZ -
    tallWingDepth / 2,

  zMax:
    tallWingZ +
    tallWingDepth / 2,

  rows:
    tallWingRows,

  name:
    "wits-arm-tall-wing-window"
});

// Back face of the tall wing as well.
addWindowsAcrossXFace({
  faceX:
    tallWingX -
    tallWingWidth / 2 -
    windowInset,

  zMin:
    tallWingZ -
    tallWingDepth / 2,

  zMax:
    tallWingZ +
    tallWingDepth / 2,

  rows:
    tallWingRows,

  name:
    "wits-arm-tall-wing-window-back"
});

// --------------------------------------------------
// END WALLS OF MAIN BUILDING
// --------------------------------------------------

const endEdgeMargin = 0.12;

const firstX =
  -buildingWidth / 2 +
  endEdgeMargin +
  windowWidth / 2;

const lastX =
  buildingWidth / 2 -
  endEdgeMargin -
  windowWidth / 2;

const endColumnCount = Math.max(
  1,
  Math.ceil(
    (lastX - firstX) / 1.7
  ) + 1
);

for (const zSide of [-1, 1]) {
  const windowZ =
    zSide *
    (
      buildingDepth / 2 +
      windowInset
    );

  for (
    let column = 0;
    column < endColumnCount;
    column++
  ) {
    const x =
      endColumnCount === 1
        ? 0
        : THREE.MathUtils.lerp(
            firstX,
            lastX,
            column /
              (endColumnCount - 1)
          );

    for (const y of windowRows) {
      addBox(
        [
          windowWidth,
          windowHeight,
          0.08
        ],
        [
          x,
          y,
          windowZ
        ],
        windows,
        "wits-arm-end-window"
      );
    }
  }
}


  // Thin concrete trim along the walkway-facing wall.
  addBox(
    [
      0.55,
      1.8,
      buildingDepth - 1
    ],
    [
      buildingWidth / 2 + 0.28,
      0.9,
      0
    ],
    concrete,
    "wits-arm-concrete-trim"
  );
}

  createArmWalkwayDetails() {
  const armSideWidth =
    (this.definition.width - BRIDGE_DECK_WIDTH) / 2;

  const armSideCenterX =
    -(BRIDGE_DECK_WIDTH / 2 + armSideWidth / 2);

  // Existing ARM-side courtyard.
  this.createWalkwayPanel(
    armSideWidth,
    this.definition.depth,
    {
      x: armSideCenterX,
      name: "amic-arm-courtyard"
    }
  );

  // --------------------------------------------------
  // EXTEND THE WALKWAY BACK TOWARD THE START / CAMERA
  // --------------------------------------------------

  const backExtension = ARM_BACK_EXTENSION;

  // Starts exactly where the current strip ends.
  const extensionZ =
    this.definition.depth / 2 +
    backExtension / 2;

  // Extend the LEFT courtyard.
  this.createWalkwayPanel(
    armSideWidth,
    backExtension,
    {
      x: armSideCenterX,
      z: extensionZ,
      name: "amic-arm-courtyard-back-extension"
    }
  );

  // Extend the CENTER walking path too.
  this.createWalkwayPanel(
    BRIDGE_DECK_WIDTH,
    backExtension,
    {
      x: 0,
      z: extensionZ,
      name: "amic-main-walkway-back-extension"
    }
  );

  this.createArmBuilding();

  // Parking remains on the right.
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
  const paint =
    new THREE.MeshBasicMaterial({
      color: 0xf1efe5
    });

  const yellow =
    new THREE.MeshBasicMaterial({
      color: 0xe0bd4f
    });

  const kerb =
    new THREE.MeshStandardMaterial({
      color: 0xd7d2c7,
      roughness: 0.86
    });

  const roadDepth = this.definition.depth;
  const laneCount = this.definition.rowSpan;
  const laneDepth = roadDepth / laneCount;

  // --------------------------------------------------
  // OUTER KERBS
  // --------------------------------------------------

  for (const z of [
    -roadDepth / 2 + 0.08,
    roadDepth / 2 - 0.08
  ]) {
    const edge = new THREE.Mesh(
      new THREE.BoxGeometry(
        ROAD_VISUAL_WIDTH,
        0.28,
        0.2
      ),
      kerb
    );

    edge.position.set(
      0,
      0.09,
      z
    );

    edge.castShadow = true;
    edge.receiveShadow = true;

    this.root.add(edge);
  }

  // --------------------------------------------------
  // 8-LANE ROAD MARKINGS
  //
  // lanes 1-4  ->
  // ---------------- yellow centre ----------------
  // lanes 5-8  <-
  // --------------------------------------------------

  for (
    let boundary = 1;
    boundary < laneCount;
    boundary++
  ) {
    const z =
      -roadDepth / 2 +
      boundary * laneDepth;

    const isCentre =
      boundary === laneCount / 2;

    const divider =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          ROAD_VISUAL_WIDTH,
          0.025,
          isCentre ? 0.12 : 0.06
        ),
        isCentre ? yellow : paint
      );

    divider.position.set(
      0,
      0.025,
      z
    );

    this.root.add(divider);
  }

  // --------------------------------------------------
  // ZEBRA CROSSING
  //
  // Automatically spans the entire 8-lane road.
  // --------------------------------------------------

  for (
    let z = -roadDepth / 2 + 0.45;
    z < roadDepth / 2;
    z += 0.8
  ) {
    const stripe =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          4.2,
          0.035,
          0.4
        ),
        paint
      );

    stripe.position.set(
      0,
      0.04,
      z
    );

    this.root.add(stripe);
  }

  // --------------------------------------------------
  // TRAFFIC / PEDESTRIAN SIGNALS
  //
  // These automatically move outward with the wider
  // road because they use roadDepth.
  // --------------------------------------------------

  for (const x of [-4.3, 4.3]) {
    for (const z of [
      -roadDepth / 2 - 0.35,
      roadDepth / 2 + 0.35
    ]) {
      this.createSignal(x, z);
    }
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
  const isFarSideLanding =
    this.definition.section === "bridge-exit";

  const sideWidth =
    (this.definition.width - BRIDGE_DECK_WIDTH) / 2;

  const sideCenterX =
    BRIDGE_DECK_WIDTH / 2 + sideWidth / 2;

  // On the spawn side (bridge-entry), keep only the left plaza.
  // The right side is now taken by the parking extension.
  //
  // On the far side (bridge-exit), keep both side plazas.
  const pavedSides = isFarSideLanding
    ? [-1, 1]
    : [-1];

  for (const side of pavedSides) {
    this.createWalkwayPanel(
      sideWidth,
      this.definition.depth,
      {
        x: side * sideCenterX,
        name:
          isFarSideLanding && side < 0
            ? "amic-vida-courtyard"
            : "amic-bridge-side-plaza"
      }
    );
  }

  if (isFarSideLanding) {
    this.createVidaContainer();
  }
}

  createEngineeringDetails() {
    const brick = new THREE.MeshStandardMaterial({ color: 0x8b6554, roughness: 0.9 });

    // The centre walking route is already created by createGeometry().
    // At the finish only the Engineering/building side (-X) is paved.
    const pavedSides = this.definition.section === "engineering-finish"
      ? [-1]
      : [-1, 1];

    const engineeringSideWidth = (this.definition.width - BRIDGE_DECK_WIDTH) / 2;
    const engineeringSideCenterX = BRIDGE_DECK_WIDTH / 2 + engineeringSideWidth / 2;
    for (const side of pavedSides) {
      this.createWalkwayPanel(
        engineeringSideWidth,
        this.definition.depth,
        {
          x: side * engineeringSideCenterX,
          name: "amic-engineering-side-plaza"
        }
      );
    }

    if (this.definition.section === "engineering-finish") {
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(7, 8.5, this.definition.depth + 2),
        brick
      );
      building.name = "engineering-building";
      building.position.set(-10, 8, -0.4);
      building.castShadow = true;
      this.root.add(building);

      const entrance = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 3.2, 2.8),
        new THREE.MeshStandardMaterial({
          color: 0x78959d,
          roughness: 0.25,
          metalness: 0.15
        })
      );
      entrance.position.set(-4.24, 1.7, -1.2);
      this.root.add(entrance);

      // No duplicate finish-side parking. The parking lot is at spawn/ARM.
    }
  }

createParkingLot(side) {
  const minimumLotWidth =
    PARKING_BAY_LENGTH * 2 +
    PARKING_AISLE_WIDTH;

  // --------------------------------------------------
  // X: walkway -> outer edge
  // --------------------------------------------------

  const walkwayHalfWidth =
    BRIDGE_DECK_WIDTH / 2;

  const parkingGap = 0.15;
  const outerInset = 0.02;

  const innerEdge =
    walkwayHalfWidth + parkingGap;

  const outerEdge =
    this.definition.width / 2 - outerInset;

  const lotWidth = Math.max(
    minimumLotWidth,
    outerEdge - innerEdge
  );

  const centerX = side * (
    innerEdge + lotWidth / 2
  );

  // --------------------------------------------------
  // Z: extend exactly toward the highway fence
  // --------------------------------------------------

  // There is a bridge-entry strip between the ARM area
  // and the bridge itself.
  const bridgeEntryDepth =
    (LEVEL_2_STRIPS.bridgeEntry.rowSpan ?? 1) *
    STRIP_DEPTH;

  // The actual highway fence is one bridge row inside
  // the bridge strip, not exactly on the strip boundary.
  const bridgeApproachDepth = STRIP_DEPTH;

  // Stop 0.02 before the highway fence.
  const fenceGap = 0.02;

  const frontEdgeZ =
  -this.definition.depth / 2
  - bridgeEntryDepth
  - bridgeApproachDepth
  + fenceGap;

const extraParkingRowDepth =
  PARKING_SLOT_PITCH;

const backEdgeZ =
  this.definition.depth / 2 +
  0.4 +
  extraParkingRowDepth;

// Small tiled border directly under the fence.
const fenceBorderDepth = 0.38;

// Asphalt starts just behind that border.
const parkingFrontEdgeZ =
  frontEdgeZ + fenceBorderDepth;

const lotDepth =
  backEdgeZ - parkingFrontEdgeZ;

const centerZ =
  (parkingFrontEdgeZ + backEdgeZ) / 2;

const fenceBorderCenterZ =
  frontEdgeZ + fenceBorderDepth / 2;
  // --------------------------------------------------
  // HEIGHT
  // --------------------------------------------------

  // Make the asphalt top exactly level with the walkway.
  const lotHeight = 0.1;

  const parkingTopY =
    WALKWAY_TOP_Y;

  const lotCenterY =
    parkingTopY - lotHeight / 2;

  const asphalt =
    this.parkingMaterial ??
    new THREE.MeshStandardMaterial({
      color: 0x2f343a,
      roughness: 1,
      metalness: 0
    });

  const lot = new THREE.Mesh(
    new THREE.BoxGeometry(
      lotWidth,
      lotHeight,
      lotDepth
    ),
    asphalt
  );

  applyRoadUvs(
    lot.geometry,
    lotWidth,
    lotDepth
  );

  lot.name = side > 0
    ? "arm-side-parking"
    : "opposite-side-parking";

  lot.position.set(
    centerX,
    lotCenterY,
    centerZ
  );

  lot.receiveShadow = true;

  this.root.add(lot);
  this.createWalkwayPanel(
  lotWidth,
  fenceBorderDepth,
  {
    x: centerX,
    z: fenceBorderCenterZ,
    y: WALKWAY_CENTER_Y,
    height: WALKWAY_HEIGHT,
    name: "parking-fence-border"
  }
);

  // --------------------------------------------------
  // PARKING SPACES
  // --------------------------------------------------

  const rowOffset =
    (
      PARKING_AISLE_WIDTH +
      PARKING_BAY_LENGTH
    ) / 2;

  const usableHalfDepth =
    lotDepth / 2 -
    PARKING_SLOT_PITCH / 2;

  const slotCount = Math.max(
    2,
    Math.floor(
      (usableHalfDepth * 2) /
      PARKING_SLOT_PITCH
    ) + 1
  );

  const zPositions = Array.from(
    { length: slotCount },
    (_, index) =>
      centerZ -
      usableHalfDepth +
      index * (
        usableHalfDepth * 2 /
        Math.max(1, slotCount - 1)
      )
  );

  const spaces = zPositions.flatMap(
    (z) => [
      {
        x: centerX - side * rowOffset,
        z,
        angle: side * Math.PI / 2
      },
      {
        x: centerX + side * rowOffset,
        z,
        angle: -side * Math.PI / 2
      }
    ]
  );

  this.root.add(
    ...createParkingBayMarkings(
      spaces,
      {
        y: parkingTopY + 0.015
      }
    )
  );

  // --------------------------------------------------
  // KERBS
  // --------------------------------------------------

  for (const x of [
    centerX - lotWidth / 2,
    centerX + lotWidth / 2
  ]) {
    const kerb =
      createParkingKerb(lotDepth);

    kerb.position.set(
      x,
      parkingTopY,
      centerZ
    );

    kerb.name =
      "level-one-style-parking-kerb";

    this.root.add(kerb);
  }

  // --------------------------------------------------
  // PARKED CARS
  // --------------------------------------------------

  let index = 0;

  for (const space of spaces) {
    if (index % 7 !== 3) {
      const holder =
        new THREE.Group();

      holder.name =
        `level-two-parked-car-${this.definition.index}-${index++}`;

      holder.position.set(
        space.x,

        // Sit on top of the asphalt.
        parkingTopY + 0.01,

        space.z
      );

      holder.rotation.y =
        space.angle;

      this.root.add(holder);

      const spec =
        pickRandomParkingCar(
          this.random
        );

      holder.userData.vehicleSpecId =
        spec.id;

      if (
        typeof window !== "undefined"
      ) {
        this.modelPromises.push(
          attachVehicleModel(
            holder,
            spec,
            "lite"
          ).catch((error) => {
            console.warn(
              `Level 2 parked car ${spec.id} could not load.`,
              error
            );

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
    const halfWidth =   ROAD_VISUAL_WIDTH / 2;
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
  const highwayWidth =   ROAD_VISUAL_WIDTH;
  const rowDepth = depth / this.definition.rowSpan;
  const deckDepth = depth - 2 * rowDepth;
  const wallZ = deckDepth / 2 + 0.2;
  const concrete = new THREE.MeshStandardMaterial({ color: 0xaaa59b, roughness: 0.92 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x56616a, roughness: 0.65 });
  const cream = new THREE.MeshBasicMaterial({ color: 0xf1ead4 });

  // World-connecting grass beyond the trench walls, clipped to this strip's
  // own depth (it can spill sideways into open space, just not lengthwise
  // into a neighbouring row).
  const outerGroundMaterial = new THREE.MeshStandardMaterial({
    color: 0x587449,
    roughness: 0.95,
    flatShading: true
  });
  const outerGround = new THREE.Mesh(
    new THREE.PlaneGeometry(highwayWidth + 6, depth),
    outerGroundMaterial
  );
  outerGround.rotation.x = -Math.PI / 2;
  // Keep this foundation below the carriageway; a higher full-width plane
  // would hide the recessed M1 from the isometric camera.
  outerGround.position.y = -0.25;
  this.root.add(outerGround);

  for (const side of [-1, 1]) {
    const trenchWall = new THREE.Mesh(new THREE.BoxGeometry(highwayWidth  + 6, 3.5, 0.45), concrete);
    trenchWall.position.set(0, BRIDGE_SINK - 1.65, side * wallZ);
    trenchWall.castShadow = true;
    trenchWall.receiveShadow = true;
    this.root.add(trenchWall);
  }

  // Keep the approaches at the same top height and texture scale as the
  // campus walkway. The bridge deck stays structurally thicker underneath,
  // but its top aligns with the same walking plane.
  for (const zSide of [-1, 1]) {
    const approachZ = zSide * (depth / 2 - rowDepth / 2);

    this.createWalkwayPanel(
      BRIDGE_DECK_WIDTH,
      rowDepth,
      {
        z: approachZ,
        y: BRIDGE_SINK + WALKWAY_CENTER_Y,
        name: "amic-bridge-approach"
      }
    );

    const shoulderWidth = (width - BRIDGE_DECK_WIDTH) / 2;

    for (const xSide of [-1, 1]) {
      // ARM / parking side:
      // parking now extends right up to the highway fence,
      // so do NOT put walkway tiles over it.
      const isParkingSide =
        zSide === 1 &&
        xSide === 1;

      if (isParkingSide) {
        continue;
      }

      this.createWalkwayPanel(
        shoulderWidth,
        rowDepth,
        {
          x: xSide * (
            BRIDGE_DECK_WIDTH / 2 +
            shoulderWidth / 2
          ),
          z: approachZ,
          y: BRIDGE_SINK + WALKWAY_CENTER_Y,
          name: "amic-bridge-side-paving"
        }
      );
    }
  }

  const bridgeDeckHeight = 0.34;
  const bridgeDeckCenterY = BRIDGE_SINK + WALKWAY_TOP_Y - bridgeDeckHeight / 2;
  this.createWalkwayPanel(
    BRIDGE_DECK_WIDTH,
    deckDepth,
    {
      y: bridgeDeckCenterY,
      height: bridgeDeckHeight,
      name: "amic-pedestrian-bridge-deck",
      castShadow: true
    }
  );

  this.addRouteFences({
  // Fence only runs along the actual highway opening.
  length: deckDepth,
  baseY: BRIDGE_SINK + WALKWAY_TOP_Y,
  halfWidth: BRIDGE_DECK_WIDTH / 2 - 0.2
});

this.createBridgeFenceReturns({
  baseY: BRIDGE_SINK + WALKWAY_TOP_Y,
  halfWidth: BRIDGE_DECK_WIDTH / 2 - 0.2,
  deckDepth,
  returnLength: 26
});

  this.createBridgeRailingGates(deckDepth);

  const roadPaint = new THREE.MeshBasicMaterial({ color: 0xe9e5d8 });
  const barrierMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c5bb, roughness: 0.82 });
  for (let row = 1; row < this.definition.rowSpan - 1; row++) {
    const z = this.localZForRow(row) - rowDepth / 2;
    const line = new THREE.Mesh(new THREE.BoxGeometry(highwayWidth , 0.025, 0.06), roadPaint);
    line.position.set(0, 0.03, z);
    this.root.add(line);
  }
  for (const z of [-wallZ + 0.48, wallZ - 0.48]) {
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(highwayWidth  + 6, 0.8, 0.24), barrierMaterial);
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

createBridgeFenceReturns({
  baseY = BRIDGE_SINK + WALKWAY_TOP_Y,
  halfWidth = BRIDGE_DECK_WIDTH / 2 - 0.2,
  deckDepth,
  returnLength = 3.2
} = {}) {
  // IMPORTANT:
  // Use the actual highway/bridge opening edge,
  // not the full strip edge.
  const cornerZ = deckDepth / 2;

  for (const sideX of [-1, 1]) {
    for (const sideZ of [-1, 1]) {
      const fence = createAmicFenceSection({
        length: returnLength,
        name:
          `amic-fence-return-${this.definition.index}-` +
          `${sideX < 0 ? "left" : "right"}-` +
          `${sideZ < 0 ? "far" : "near"}`
      });

      // Original fence sections run along Z.
      // Rotate 90° so the return runs along X.
      fence.rotation.y = Math.PI / 2;

      // Start exactly at the existing side fence.
      // Its centre is half the return length outward from that corner.
      fence.position.set(
        sideX * (halfWidth + returnLength / 2),
        baseY,
        sideZ * cornerZ
      );

      this.root.add(fence);
    }
  }
}

  createBridgeRailingGates(deckDepth) {
    const metal = new THREE.MeshStandardMaterial({
      color: 0x4f585f,
      roughness: 0.62,
      metalness: 0.32
    });
    const inset = new THREE.MeshStandardMaterial({
      color: 0xd8cfbb,
      roughness: 0.84
    });

    const gateHalfWidth = BRIDGE_DECK_WIDTH / 2 - 0.18;
    const gateZ = deckDepth / 2 - 0.12;
    const gateHeight = 1.08;
    const leafLength = 1.45;

    // One open pair at the ARM side of the highway and one open pair at the
    // Engineering side. The leaves fold back against the side railings, so
    // they frame the bridge entrance without blocking the player's route.
    for (const zSide of [-1, 1]) {
      for (const xSide of [-1, 1]) {
        const gate = new THREE.Group();
        gate.name = `amic-highway-gate-${zSide < 0 ? "finish" : "start"}-${xSide < 0 ? "left" : "right"}`;
        gate.position.set(
          xSide * gateHalfWidth,
          BRIDGE_SINK + WALKWAY_TOP_Y,
          zSide * gateZ
        );

        const post = new THREE.Mesh(
          new THREE.BoxGeometry(0.11, gateHeight, 0.11),
          metal
        );
        post.position.y = gateHeight / 2;
        post.castShadow = true;
        gate.add(post);

        // The leaf is deliberately shown open, turned parallel with the
        // bridge railing instead of spanning across the walkable deck.
        const leaf = new THREE.Group();
        leaf.rotation.y = Math.PI / 2;
        leaf.position.set(0, 0, -zSide * leafLength / 2);

        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(leafLength, 0.82, 0.055),
          metal
        );
        frame.position.y = 0.51;
        frame.castShadow = true;
        leaf.add(frame);

        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(leafLength - 0.22, 0.26, 0.035),
          inset
        );
        panel.position.y = 0.28;
        leaf.add(panel);

        gate.add(leaf);
        this.root.add(gate);
      }
    }
  }

  createTraffic() {
    // Each lane gets an independent fixed pool, spacing, direction and recycle tail.
    for (const lane of this.lanes) this.createTrafficLane(lane);
  }

  createTrafficLane(lane) {
    let previousX = lane.direction > 0
      ? -TRAFFIC_EDGE + this.random() * 20
      : TRAFFIC_EDGE - this.random() * 20;
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
