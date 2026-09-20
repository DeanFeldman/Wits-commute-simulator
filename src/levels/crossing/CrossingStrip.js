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
import { createWitsBusStop } from "./WitsBusStop.js";

// Visual tuning values shared by every generated Level 2 strip.
const ROAD_COLOR = 0x292d31;

const ROAD_VISUAL_WIDTH = 200;
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

    // Ordinary paving is a top surface, not a stack of touching boxes. This
    // removes coplanar side faces at every panel seam; only the structural
    // bridge deck keeps real thickness.
    const solid = castShadow || Math.abs(height - WALKWAY_HEIGHT) > 1e-6;
    const mesh = new THREE.Mesh(
      solid ? new THREE.BoxGeometry(width, height, depth) : new THREE.PlaneGeometry(width, depth),
      material
    );
    mesh.name = name;
    if (solid) mesh.position.set(x, y, z);
    else {
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y + height / 2, z);
    }
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
    root.position.set(-7.2, 0.2, 2.5);
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

  const intersectionWidth = 22;
  const intersectionDepth = roadDepth - 0.3;

  const intersectionMaterial = this.walkwayMaterial.clone();
  intersectionMaterial.polygonOffset = true;
  intersectionMaterial.polygonOffsetFactor = -1;
  intersectionMaterial.polygonOffsetUnits = -4;

  if (this.walkwayMaterial.map) {
    intersectionMaterial.map =
      this.walkwayMaterial.map.clone();

    intersectionMaterial.map.wrapS =
      THREE.RepeatWrapping;

    intersectionMaterial.map.wrapT =
      THREE.RepeatWrapping;

    intersectionMaterial.map.repeat.set(
      intersectionWidth / WALKWAY_TILE_SIZE,
      intersectionDepth / WALKWAY_TILE_SIZE
    );

    intersectionMaterial.map.needsUpdate = true;
  }

  const intersection =
    new THREE.Mesh(
      new THREE.PlaneGeometry(
        intersectionWidth,
        intersectionDepth
      ),
      intersectionMaterial
    );

  intersection.name =
    "yale-paved-intersection";

  intersection.rotation.x =
    -Math.PI / 2;

  intersection.position.set(
    0,
    0.01,
    0
  );

  intersection.receiveShadow = true;

  this.root.add(intersection);

  this.createZebraCrossing({
  x: -3.5,
  z: 0,
  length: roadDepth - 0.5,
  width: 3.4,
  angle: 0
});

this.createZebraCrossing({
  x: 4.1,
  z: 0,
  length: roadDepth + 1.5,
  width: 3.4,

  // Tune between about 0.35 and 0.5.
  angle: -0.42
});

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

  createZebraCrossing({ x = 0,  z = 0,  length,  width = 3.6,  angle = 0,stripeDepth = 0.38, gap = 0.34}) {
  const group = new THREE.Group();

  group.name = "yale-zebra-crossing";

  group.position.set(
    x,
    0.04,
    z
  );

  group.rotation.y = angle;

  const paint =
    new THREE.MeshBasicMaterial({
      color: 0xf4f1e8
    });

  const step =
    stripeDepth + gap;

  for (
    let offset =
      -length / 2 + stripeDepth / 2;
    offset <=
      length / 2 - stripeDepth / 2;
    offset += step
  ) {
    const stripe =
      new THREE.Mesh(
        new THREE.BoxGeometry(
          width,
          0.025,
          stripeDepth
        ),
        paint
      );

    stripe.position.z = offset;

    group.add(stripe);
  }

  this.root.add(group);

  return group;
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
    ? [-1]
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

  // --------------------------------------------------
  // WITS BUS STOP — NEAR SIDE OF YALE ROAD / BY VIDA
  // --------------------------------------------------

  const nearBusStop = createWitsBusStop();
  const nearBusStopFloorWidth = 15;
  const nearBusStopX = -(this.definition.width / 2 + nearBusStopFloorWidth / 2 + 0.02);
  const nearBusStopDepth = 6;
  const yaleEdgeInset = 0.2;

  // IMPORTANT:
  // Calculate this BEFORE using it for the floor.
  const nearBusStopZ =
    -this.definition.depth / 2 +
    nearBusStopDepth / 2 +
    yaleEdgeInset;

  // --------------------------------------------------
  // WALKWAY MATERIAL UNDER THE BUS STOP
  // --------------------------------------------------

  this.createWalkwayPanel(
    nearBusStopFloorWidth,
    nearBusStopDepth,
    {
      x: nearBusStopX,
      z: nearBusStopZ,
      name: "wits-near-bus-stop-plaza"
    }
  );

  // --------------------------------------------------
  // BUS STOP
  // --------------------------------------------------

  nearBusStop.position.set(
    nearBusStopX,
    WALKWAY_TOP_Y,
    nearBusStopZ
  );

  // 180-degree rotation.
  nearBusStop.rotation.y =
    Math.PI;

  this.root.add(nearBusStop);
  this.createMiniBridgeExitParkingLot(1);
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
    const gateMaterial =
  new THREE.MeshStandardMaterial({
    color: 0xb7aa91,
    roughness: 0.9
  });

for (const x of [-4.4, 4.4]) {
  const pillar =
    new THREE.Mesh(
      new THREE.BoxGeometry(
        0.75,
        3.1,
        0.75
      ),
      gateMaterial
    );

  pillar.name =
    "yale-campus-gate-pillar";

  pillar.position.set(
    x,
    1.55,
    2
  );

  pillar.castShadow = true;

  this.root.add(pillar);
}

    if (this.definition.section === "engineering-finish") {
     

      

      // --------------------------------------------------
      // FAR-SIDE YALE ROAD WALKWAY / PAVEMENT
      // --------------------------------------------------

      // Create a wider tiled area on the far side of Yale Road
      // so the crossing connects into a proper pedestrian space.
      const yaleFarWalkwayWidth = 24;
      const yaleFarWalkwayDepth = 8;
      const yaleFarWalkwayZ = this.definition.depth / 2 - yaleFarWalkwayDepth / 2 - 0.05;
      const existingRightEdge = BRIDGE_DECK_WIDTH / 2;
      const farRightEdge = yaleFarWalkwayWidth / 2;
      const farSideExtensionWidth = farRightEdge - existingRightEdge;
      this.createWalkwayPanel(farSideExtensionWidth, yaleFarWalkwayDepth, {
        x: existingRightEdge + farSideExtensionWidth / 2,
        z: yaleFarWalkwayZ,
        name: "yale-road-far-side-walkway-extension"
      });
      this.createYaleEntranceScenery();
      this.createYaleBackdropBuildings();
      // No duplicate finish-side parking. The parking lot is at spawn/ARM.
   
      // --------------------------------------------------
      // WITS BUS STOP — FAR SIDE OF YALE ROAD
      // --------------------------------------------------

      // +X is free here because the Engineering building
      // occupies the -X side of the finish strip.
      const busStopSideWidth =
        engineeringSideWidth;

      const busStopX =
        -engineeringSideCenterX -6 ;

      // Yale Road is on the +Z edge of this strip.
      // Put the shelter just inside that edge.
      const busStopPadDepth = 4.4;

      const busStopZ =
        this.definition.depth / 2 -
        busStopPadDepth / 2 -
        0.25;

      // Give the shelter its own section of AMIC paving.
      const busStopPadLeft = busStopX - busStopSideWidth / 2;
      const existingPavingLeft = -this.definition.width / 2;
      const busStopExtensionWidth = Math.max(0, existingPavingLeft - busStopPadLeft);
      if (busStopExtensionWidth > 0) this.createWalkwayPanel(busStopExtensionWidth, busStopPadDepth, {
        x: busStopPadLeft + busStopExtensionWidth / 2,
        z: busStopZ,
        name: "wits-bus-stop-plaza-extension"
      });

      const busStop =
        createWitsBusStop();

      // Sit it exactly on the normal walkway height.
      busStop.position.set(
        busStopX,
        WALKWAY_TOP_Y,
        busStopZ
      );

      // IMPORTANT:
      // Rotate the shelter 180 degrees as requested.
      //
      // The flat rear wall now faces back toward Yale Road.
      // The open stepped side faces deeper into campus.
     // busStop.rotation.y =0;

      this.root.add(busStop);


     
    }
  }

  createMiniBridgeExitParkingLot(side = -1) {
  // side = -1 -> left side of the main path
  // side =  1 -> right side of the main path

  const edgeInset = 0.02;
  const innerGap = 0.08;

  const innerEdge =
    side * (BRIDGE_DECK_WIDTH / 2 + innerGap);

  const outerEdge =
    side * (this.definition.width / 2 - edgeInset);

  const minX = Math.min(innerEdge, outerEdge);
  const maxX = Math.max(innerEdge, outerEdge);

  // Fill the whole side area so no tiled walkway shows through.
  const lotWidth = maxX - minX;
  const centerX = (minX + maxX) / 2;

  // Push the lot a bit closer to the road-side edge.
  // Start just inside the Yale Road kerb.
const roadClearance = 0.12;

const roadSideEdgeZ =
  -this.definition.depth / 2 +
  roadClearance;

// Extend through the bridge approach until just before
// the black highway fence.
const bridgeApproachDepth =
  STRIP_DEPTH;

const fenceGap = 0.02;

const fenceSideEdgeZ =
  this.definition.depth / 2 +
  bridgeApproachDepth -
  fenceGap;

const lotDepth =
  fenceSideEdgeZ -
  roadSideEdgeZ;

const lotZ =
  (roadSideEdgeZ + fenceSideEdgeZ) / 2;

  const lotHeight = 0.1;
  const lotTopY = WALKWAY_TOP_Y;
  const lotCenterY =
    lotTopY - lotHeight / 2;

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

  lot.name = "bridge-exit-mini-parking";
  lot.position.set(
    centerX,
    lotCenterY,
    lotZ
  );

  lot.receiveShadow = true;
  this.root.add(lot);

  // ---------------------------------------------
  // Parking bay markings
  // ---------------------------------------------

  const bayOffsetFromCenter =
    Math.min(1.7, lotWidth * 0.22);

const spaces = [
  {
    x: centerX - side * bayOffsetFromCenter,
    z: lotZ - 2.0,
    angle: side > 0 ? Math.PI / 2 : -Math.PI / 2
  },
  {
    x: centerX - side * bayOffsetFromCenter,
    z: lotZ,
    angle: side > 0 ? Math.PI / 2 : -Math.PI / 2
  },
  {
    x: centerX - side * bayOffsetFromCenter,
    z: lotZ + 2.0,
    angle: side > 0 ? Math.PI / 2 : -Math.PI / 2
  }
];

  this.root.add(
    ...createParkingBayMarkings(
      spaces,
      { y: lotTopY + 0.015 }
    )
  );

  // ---------------------------------------------
  // Kerbs
  // ---------------------------------------------

  for (const x of [minX, maxX]) {
    const kerb = createParkingKerb(lotDepth);

    kerb.position.set(
      x,
      lotTopY,
      lotZ
    );

    kerb.name =
      "bridge-exit-mini-parking-kerb";

    this.root.add(kerb);
  }

  // ---------------------------------------------
  // Parked cars
  // ---------------------------------------------

  const parkedSpaces = [spaces[0], spaces[1]];

  let index = 0;

  for (const space of parkedSpaces) {
    const holder = new THREE.Group();

    holder.name =
      `bridge-exit-mini-parked-car-${index++}`;

    holder.position.set(
      space.x,
      lotTopY + 0.01,
      space.z
    );

    holder.rotation.y = space.angle;

    this.root.add(holder);

    const spec = pickRandomParkingCar(this.random);
    holder.userData.vehicleSpecId = spec.id;

    if (typeof window !== "undefined") {
      this.modelPromises.push(
        attachVehicleModel(
          holder,
          spec,
          "lite"
        ).catch((error) => {
          console.warn(
            `Mini parking car ${spec.id} could not load.`,
            error
          );
          return null;
        })
      );
    }
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
const parkingFrontEdgeZ=frontEdgeZ;
const lotDepth=backEdgeZ-parkingFrontEdgeZ;
const centerZ=(parkingFrontEdgeZ+backEdgeZ)/2;
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
  // const flag = new THREE.Group();

  // // Pole
  // const pole = new THREE.Mesh(
  //   new THREE.CylinderGeometry(0.035, 0.035, 1.2, 8),
  //   new THREE.MeshStandardMaterial({ color: 0xdddddd })
  // );
  // pole.position.y = 0.6;
  // flag.add(pole);

  // // Flag cloth
  // const cloth = new THREE.Mesh(
  //   new THREE.BoxGeometry(0.55, 0.32, 0.04),
  //   new THREE.MeshStandardMaterial({ color: 0xffffff })
  // );
  // cloth.position.set(0.275, 1.02, 0);
  // flag.add(cloth);

  // flag.position.set(x, yOffset + (this.definition.surface === "median" ? 0.21 : 0.13), 0);

  // this.root.add(flag);
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
const SIDE_EXTENSION=160;
const SIDE_DEPTH=rowDepth;
const parkingInnerEdge=BRIDGE_DECK_WIDTH/2+.15;
const parkingLotWidth=Math.max(PARKING_BAY_LENGTH*2+PARKING_AISLE_WIDTH,width/2-.02-parkingInnerEdge);
const spawnParkingOuterX=parkingInnerEdge+parkingLotWidth;

for(const zSide of [-1,1]){
  const approachZ=zSide*(depth/2-rowDepth/2);

  this.createWalkwayPanel(BRIDGE_DECK_WIDTH,rowDepth,{
    z:approachZ,
    y:BRIDGE_SINK+WALKWAY_CENTER_Y,
    name:"amic-bridge-approach"
  });
for(const xSide of [-1,1]){
  const startX=xSide<0?-BRIDGE_DECK_WIDTH/2:zSide>0?spawnParkingOuterX+.05:width/2+.05;
  
  const centerX=startX+xSide*SIDE_EXTENSION/2;


  this.createWalkwayPanel(SIDE_EXTENSION,SIDE_DEPTH,{
    x:centerX,
    z:zSide*(depth/2-rowDepth/2),
    y:BRIDGE_SINK+WALKWAY_CENTER_Y,
    name:"amic-bridge-side-paving"
  });
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
  returnLength: 109
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

  // for (const x of [-width / 2 + 1.5, width / 2 - 1.5]) {
  //   const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 5.5, 8), metal);
  //   pole.position.set(x, BRIDGE_SINK + 2.75, 0);
  //   const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 6), cream);
  //   lamp.position.set(x, BRIDGE_SINK + 5.45, 0);
  //   this.root.add(pole, lamp);
  // }

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
        vehicle.controller.speed = lane.speed;
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
createYaleEntranceScenery() {
  const hedgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x426a36,
    roughness: 0.95,
    flatShading: true
  });

  const darkHedgeMaterial = new THREE.MeshStandardMaterial({
    color: 0x2f5229,
    roughness: 0.95,
    flatShading: true
  });

  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x72533a,
    roughness: 0.92
  });

  const leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a7a3e,
    roughness: 0.9,
    flatShading: true
  });

  const gatePostMaterial = new THREE.MeshStandardMaterial({
    color: 0xc8c0ac,
    roughness: 0.88
  });

  const gateCapMaterial = new THREE.MeshStandardMaterial({
    color: 0xe0d8c5,
    roughness: 0.82
  });

  const metalMaterial = new THREE.MeshStandardMaterial({
    color: 0x353b40,
    roughness: 0.66,
    metalness: 0.28
  });

  const addHedge = (x, z, width, depth, height = 0.8, dark = false) => {
    const hedge = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, depth),
      dark ? darkHedgeMaterial : hedgeMaterial
    );

    hedge.position.set(
      x,
      WALKWAY_TOP_Y + height / 2,
      z
    );

    hedge.castShadow = true;
    hedge.receiveShadow = true;
    hedge.name = "yale-entrance-hedge";

    this.root.add(hedge);
    return hedge;
  };

  const addTree = (x, z, scale = 1) => {
    const tree = new THREE.Group();
    tree.name = "yale-entrance-tree";

    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 1.15, 7),
      trunkMaterial
    );
    trunk.position.y = 0.68;
    trunk.castShadow = true;
    tree.add(trunk);

   const canopy = new THREE.Mesh(
  new THREE.SphereGeometry(0.78, 8, 7),
  leafMaterial
);
canopy.position.y = 1.82;
canopy.scale.set(1.15, 0.95, 1.05);
canopy.castShadow = true;
tree.add(canopy);


    tree.position.set(x, 0.11, z);
    tree.scale.setScalar(scale);

    this.root.add(tree);
    return tree;
  };

  const addFence = (x, z, length, rotationY = 0, name = "yale-entrance-fence") => {
    const fence = createAmicFenceSection({
      length,
      name
    });

    fence.position.set(
      x,
      WALKWAY_TOP_Y,
      z
    );

    fence.rotation.y = rotationY;
    this.root.add(fence);
    return fence;
  };

  const addGateLeaf = (x, z, rotationY) => {
    const gate = new THREE.Group();
    gate.name = "yale-entrance-gate-leaf";

    gate.position.set(
      x,
      WALKWAY_TOP_Y,
      z
    );

    gate.rotation.y = rotationY;

    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 1.15, 0.08),
      metalMaterial
    );
    frame.position.y = 0.68;
    frame.castShadow = true;
    gate.add(frame);

    const lowerPanel = new THREE.Mesh(
      new THREE.BoxGeometry(1.85, 0.22, 0.04),
      gatePostMaterial
    );
    lowerPanel.position.y = 0.3;
    gate.add(lowerPanel);

    this.root.add(gate);
    return gate;
  };

  // --------------------------------------------------
  // LAYOUT
  // --------------------------------------------------

  const gateZ = -2.2;
  const pillarX = 3.1;

  // Gate posts
  for (const x of [-pillarX, pillarX]) {
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 3.2, 0.85),
      gatePostMaterial
    );

    pillar.position.set(
      x,
      1.6,
      gateZ
    );

    pillar.castShadow = true;
    pillar.name = "yale-entrance-pillar";
    this.root.add(pillar);

    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.2, 1.02),
      gateCapMaterial
    );

    cap.position.set(
      x,
      3.3,
      gateZ
    );

    cap.castShadow = true;
    cap.name = "yale-entrance-pillar-cap";
    this.root.add(cap);
  }

  // Open gate leaves
  addGateLeaf(-2.35, gateZ + 0.22, Math.PI / 2);
  addGateLeaf( 2.35, gateZ + 0.22, -Math.PI / 2);

  // Fence runs extending outward from the gate
  addFence(-7.7, gateZ, 8.2, Math.PI / 2, "yale-entrance-fence-left");
  addFence( 7.7, gateZ, 8.2, Math.PI / 2, "yale-entrance-fence-right");

  // Small fence returns to suggest enclosed landscaping
  addFence(-11.6, -0.2, 4.2, 0, "yale-entrance-fence-left-return");
  addFence( 11.6, -0.2, 4.2, 0, "yale-entrance-fence-right-return");

  // --------------------------------------------------
  // GREENERY
  // --------------------------------------------------

  // Left side hedge grouping
  addHedge(-8.2, -0.2, 4.4, 1.4, 0.85);
  addHedge(-6.3,  1.2, 3.0, 1.2, 0.75, true);
  addHedge(-9.8,  1.2, 2.4, 1.2, 0.75, true);

  // Right side hedge grouping
  addHedge( 8.2, -0.2, 4.4, 1.4, 0.85);
  addHedge( 6.3,  1.2, 3.0, 1.2, 0.75, true);
  addHedge( 9.8,  1.2, 2.4, 1.2, 0.75, true);

// Trees moved backward in -Z so they stop crowding the crossing
addTree(-13.0, -2.2, 1.05);
addTree(-9.8,  -2.8, 0.95);
addTree(-6.8,   1.4, 0.9);

addTree( 13.0, -2.2, 1.05);
addTree( 9.8,  -2.8, 0.95);
addTree( 6.8,   1.4, 0.9);

// Rear trees further back toward the buildings
addTree(-8.2,-5.0,.95);
addTree(-3.8,-6.2,1.0);
addTree(3.8,-6.4,1.0);
addTree(8.2,-5.0,.95);

// Dense planting in front of the backdrop buildings.
for(const [x,z,s] of [
  [-48,-7.0,1],[-43,-6.5,1.1],[-38,-7.3,.95],[-33,-6.7,1.05],[-27,-7.2,.95],
  [-23,-6.4,1.05],[-19,-7.1,.95],[-15,-6.5,1.1],[-11,-7.3,.9],[-7,-6.6,1],
  [7,-6.7,.95],[11,-7.3,1],[15,-6.5,1.1],[19,-7.1,.95],[23,-6.4,1.05]
])addTree(x,z,s);

addHedge(-43,-5.9,24,1.5,.9,true);
addHedge(-19,-5.9,12,1.4,.9);
addHedge(-9,-6.1,6,1.25,.8,true);
addHedge(9,-6.1,6,1.25,.8,true);
addHedge(19,-5.9,12,1.4,.9);

}


createYaleBackdropBuildings() {

  const backdropDepth = 31.9;
  this.createWalkwayPanel(52, backdropDepth, {
    x: 0,
    z: -10.05,
    y: WALKWAY_CENTER_Y - 0.03,
    name: "yale-campus-backdrop-ground"
  });



  const stone = new THREE.MeshStandardMaterial({
    color: 0x80735f,
    roughness: 0.92
  });

  const darkStone = new THREE.MeshStandardMaterial({
    color: 0x6d604f,
    roughness: 0.93
  });

  const lightBuilding = new THREE.MeshStandardMaterial({
    color: 0xd7d8d4,
    roughness: 0.9
  });

  const roofRed = new THREE.MeshStandardMaterial({
    color: 0x8d4337,
    roughness: 0.88
  });

  const roofGrey = new THREE.MeshStandardMaterial({
    color: 0xaaa79e,
    roughness: 0.9
  });

  const windowMat = new THREE.MeshBasicMaterial({
    color: 0x5e6970
  });

  const addBox = (
    size,
    position,
    material,
    name = "yale-backdrop-mass"
  ) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(...size),
      material
    );

    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;

    this.root.add(mesh);
    return mesh;
  };

    const addGroundPad = (
    width,
    depth,
    x,
    z,
    name = "yale-backdrop-ground-pad"
  ) => {
    const padMaterial = this.walkwayMaterial.clone();

    if (this.walkwayMaterial.map) {
      padMaterial.map = this.walkwayMaterial.map.clone();
      padMaterial.map.wrapS = THREE.RepeatWrapping;
      padMaterial.map.wrapT = THREE.RepeatWrapping;
      padMaterial.map.repeat.set(
        width / WALKWAY_TILE_SIZE,
        depth / WALKWAY_TILE_SIZE
      );
      padMaterial.map.needsUpdate = true;
    }

    const pad = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      padMaterial
    );

    pad.rotation.x = -Math.PI / 2;
    pad.position.set(
      x,
      WALKWAY_TOP_Y + 0.006,
      z
    );

    pad.receiveShadow = true;
    pad.name = name;
    this.root.add(pad);

    return pad;
  };

  const addWindowGrid = ({
    centerX,
    baseY,
    centerZ,
    width,
    height,
    depth,
    columns,
    rows,
    face = "front"
  }) => {
    const usableWidth = width - 1.4;
    const usableHeight = height - 2.2;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < columns; col++) {
        const x =
          centerX -
          usableWidth / 2 +
          (col / Math.max(1, columns - 1)) * usableWidth;

        const y =
          baseY +
          1.3 +
          (row / Math.max(1, rows - 1)) * usableHeight;

        const z =
          face === "front"
            ? centerZ + depth / 2 + 0.04
            : centerZ - depth / 2 - 0.04;

        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(0.7, 1.05, 0.08),
          windowMat
        );

        pane.position.set(x, y, z);
        pane.castShadow = false;
        pane.receiveShadow = false;
        pane.name = "yale-backdrop-window";

        this.root.add(pane);
      }
    }
  };


  
  // --------------------------------------------------
  // LEFT / NORTH-WEST ENGINEERING BUILDING MASS
  // --------------------------------------------------

  const leftX = -16.5;
  const leftZ = -11.5;
  const leftW = 15.5;
  const leftH = 9.5;
  const leftD = 7.0;

  addBox(
    [leftW, leftH, leftD],
    [leftX, leftH / 2, leftZ],
    stone,
    "north-west-engineering-building"
  );

  addBox(
    [leftW + 0.5, 1.0, leftD + 0.5],
    [leftX, leftH + 0.45, leftZ],
    roofRed,
    "north-west-engineering-roof"
  );

  addWindowGrid({
    centerX: leftX,
    baseY: 0,
    centerZ: leftZ,
    width: leftW,
    height: leftH,
    depth: leftD,
    columns: 5,
    rows: 4
  });

  // Front entry feature
  addBox(
    [2.1, 4.2, 1.4],
    [leftX - 5.2, 2.1, leftZ + leftD / 2 + 0.75],
    darkStone,
    "north-west-engineering-entry"
  );

  // --------------------------------------------------
  // MIDDLE REAR BUILDING MASS
  // --------------------------------------------------

  const midX = -1.8;
  const midZ = -15.0;
  const midW = 16.0;
  const midH = 7.5;
  const midD = 6.0;

  addBox(
    [midW, midH, midD],
    [midX, midH / 2, midZ],
    darkStone,
    "yale-backdrop-middle-building"
  );

  addBox(
    [midW + 0.6, 0.8, midD + 0.6],
    [midX, midH + 0.35, midZ],
    roofRed,
    "yale-backdrop-middle-roof"
  );

  addWindowGrid({
    centerX: midX,
    baseY: 0,
    centerZ: midZ,
    width: midW,
    height: midH,
    depth: midD,
    columns: 6,
    rows: 3
  });

  // --------------------------------------------------
  // RIGHT / LIGHT BUILDING MASS
  // --------------------------------------------------

  const rightX = 15.0;
  const rightZ = -11.8;
  const rightW = 10.0;
  const rightH = 6.5;
  const rightD = 6.8;

  addBox(
    [rightW, rightH, rightD],
    [rightX, rightH / 2, rightZ],
    lightBuilding,
    "yale-backdrop-right-building"
  );

  addBox(
    [rightW + 0.35, 0.5, rightD + 0.35],
    [rightX, rightH + 0.22, rightZ],
    roofGrey,
    "yale-backdrop-right-roof"
  );

  addWindowGrid({
    centerX: rightX,
    baseY: 0,
    centerZ: rightZ,
    width: rightW,
    height: rightH,
    depth: rightD,
    columns: 4,
    rows: 3
  });


  // --------------------------------------------------
// FAR-LEFT CAMPUS / PARKING BLOCK
// Fills the empty top-left view and fades into side fog.
// --------------------------------------------------
const farX=-42,farZ=-12.5,farW=26,farD=8,floors=4,floorH=1.75;
const openingMat=new THREE.MeshBasicMaterial({color:0x343b40});

const roadEdgeZ=this.definition.depth/2;
const farBackZ=-20;
const farGroundDepth=roadEdgeZ-farBackZ;
const farGroundZ=(roadEdgeZ+farBackZ)/2;

addGroundPad(38,farGroundDepth,farX,farGroundZ,"yale-far-left-ground");

for(let floor=0;floor<floors;floor++){
  const y=floor*floorH;

  addBox([farW,.22,farD],[farX,y+.11,farZ],roofGrey,"yale-left-garage-floor");

  addBox([farW-.8,1.12,.12],[farX,y+.78,farZ+farD/2+.06],openingMat,"yale-left-garage-opening");

  for(let x=-farW/2+1.4;x<farW/2;x+=3.4){
    addBox([.28,floorH,farD],[farX+x,y+floorH/2,farZ],stone,"yale-left-garage-column");
  }
}

addBox([farW+.5,.35,farD+.4],[farX,floors*floorH+.18,farZ],roofGrey,"yale-left-garage-roof");
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
    // Smoothly match traffic speed while easing down behind a vehicle ahead.
    // Avoid repeatedly hard-resetting speed to zero, which makes traffic jerk.
    const available = this.distanceToVehicleAhead(vehicle);

    let targetSpeed = vehicle.lane.speed;

    // Begin easing off before reaching the minimum following distance.
    if (Number.isFinite(available) && available < 6) {
      targetSpeed *= THREE.MathUtils.clamp(available / 6, 0, 1);
    }

    const responsiveness =
      targetSpeed < vehicle.controller.speed ? 10 : 6;

    vehicle.controller.speed = THREE.MathUtils.damp(
      vehicle.controller.speed,
      targetSpeed,
      responsiveness,
      dt
    );

    const allowed = Math.min(
      requested,
      vehicle.controller.speed * dt,
      available
    );

    if (allowed > 0) {
      vehicle.root.position.addScaledVector(direction, allowed);
    }

    return Math.max(0, allowed);
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
    vehicle.mover.reset(new THREE.Vector3(nextX, 0, lane.localZ), 1);
    vehicle.controller.speed = lane.speed;
    if (vehicle.isTaxi) {
      vehicle.passenger.visible = false;
      this.scheduleTaxiStop(vehicle);
    }
  }

  stopTaxi(vehicle) {
  vehicle.stopTimer = 1.1 + this.random() * 0.7;
  vehicle.controller.stop();

  // Do not display the old blue placeholder passenger.
  if (vehicle.passenger) {
    vehicle.passenger.visible = false;
  }

  this.audio?.cue(
    520,
    0.13,
    0.1,
    vehicle.root.position.x / 12
  );
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
