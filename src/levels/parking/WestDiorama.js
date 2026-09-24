import * as THREE from "three";
import { addWestDioramaFoliage } from "./ParkingFoliage.js";

// West is -X in Level 1. The existing playable lot is deliberately the
// foreground of this vista; this sibling root begins at its western boundary
// and supplies the architecture-heavy campus layers beyond it.
export const WEST_DIORAMA_CONFIG = Object.freeze({
  rootOffset: Object.freeze([0, 0, 0]),
  referenceCamera: Object.freeze({
    position: Object.freeze([43, 5, -5]),
    target: Object.freeze([-142, 8, -5]),
    fov: 58,
    far: 370,
    yaw: Math.PI / 2
  }),
  playableParking: Object.freeze({
    westEdgeX: -61,
    reusedAsForeground: true
  }),
  centralBuilding: Object.freeze({
    position: Object.freeze([-83, 0, -5]),
    size: Object.freeze([38, 28, 68])
  }),
  redSection: Object.freeze({
    position: Object.freeze([-63.35, 0, 12]),
    size: Object.freeze([1.3, 25, 12])
  }),
  annex: Object.freeze({
    position: Object.freeze([-82, 0, -42]),
    size: Object.freeze([32, 18, 23])
  }),
  curvedRoofs: Object.freeze([
    // Keep the three halls south of the campus-road pavement. Their previous
    // positions began at Z = 39 and visibly cut through the west road run.
    Object.freeze({ position: Object.freeze([-116, 0, 59]), size: Object.freeze([30, 11, 18]) }),
    Object.freeze({ position: Object.freeze([-119, 0, 79]), size: Object.freeze([32, 12, 18]) }),
    Object.freeze({ position: Object.freeze([-122, 0, 99]), size: Object.freeze([34, 13, 18]) })
  ]),
  serviceRoad: Object.freeze({
    // This extends the existing campus road westward. Match its Z centre and
    // depth so the two asphalt meshes form one continuous carriageway.
    center: Object.freeze([-124, 41]),
    length: 112,
    depth: 10
  }),
  highway: Object.freeze({
    center: Object.freeze([-198.9, -77.4]),
    width: 100,
    depth: 18,
    y: -4,
    rotation: THREE.MathUtils.degToRad(-6)
  }),
  tower: Object.freeze({
    position: Object.freeze([-188, 0, 39]),
    height: 72
  }),
  vegetation: Object.freeze({ density: 0.92 }),
  atmosphere: Object.freeze({
    fogStart: 96,
    fogEnd: 285,
    density: 0.9
  })
});

const PALETTE = Object.freeze({
  coolGrey: 0x7d898d,
  coolGreyLight: 0xa5adae,
  coolGreyDark: 0x596568,
  brick: 0xa6533d,
  brickDark: 0x633329,
  window: 0x29464f,
  roof: 0x657276,
  roofLight: 0xc5cbca,
  concrete: 0xa8aaa5,
  concreteDark: 0x626867,
  asphalt: 0x353a3b,
  metal: 0x333b3e,
  horizon: 0x687779,
  horizonDark: 0x566467
});

function material(color, roughness = 0.9, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extras });
}

function addBox(root, size, position, boxMaterial, {
  name = "",
  rotationY = 0,
  receiveShadow = true,
  castShadow = false
} = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), boxMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.receiveShadow = receiveShadow;
  mesh.castShadow = castShadow;
  root.add(mesh);
  return mesh;
}

function addInstancedBoxes(root, name, placements, boxMaterial) {
  if (placements.length === 0) return null;
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    boxMaterial,
    placements.length
  );
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  placements.forEach((item, index) => {
    position.set(...item.position);
    quaternion.setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      item.rotationY ?? 0
    );
    scale.set(...item.scale);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return mesh;
}

function buildingFootprint(name, config, buffer = 2) {
  return Object.freeze({
    name,
    x: config.position[0],
    z: config.position[2],
    width: config.size[0],
    depth: config.size[2],
    buffer
  });
}

const BACKGROUND_MASSES = Object.freeze([
  Object.freeze({ position: [-137, 8, -31], size: [27, 16, 24] }),
  Object.freeze({ position: [-143, 11, 0], size: [34, 22, 27] }),
  Object.freeze({ position: [-151, 7, 29], size: [31, 14, 22] }),
  Object.freeze({ position: [-166, 9, -44], size: [28, 18, 25] }),
  Object.freeze({ position: [-174, 13, -11], size: [39, 26, 29] }),
  Object.freeze({ position: [-181, 8, 62], size: [32, 16, 27] }),
  Object.freeze({ position: [-202, 10, -35], size: [31, 20, 26] }),
  Object.freeze({ position: [-211, 7, 5], size: [36, 14, 31] }),
  Object.freeze({ position: [-215, 9, 48], size: [30, 18, 24] })
]);

export function getWestDioramaFoliageExclusions() {
  const exclusions = [
    buildingFootprint("west-central-building", WEST_DIORAMA_CONFIG.centralBuilding, 3.5),
    buildingFootprint("west-annex", WEST_DIORAMA_CONFIG.annex, 3),
    ...WEST_DIORAMA_CONFIG.curvedRoofs.map((config, index) => (
      buildingFootprint(`west-curved-roof-${index + 1}`, config, 2)
    )),
    ...BACKGROUND_MASSES.map((mass, index) => Object.freeze({
      name: `west-background-${index + 1}`,
      x: mass.position[0],
      z: mass.position[2],
      width: mass.size[0],
      depth: mass.size[2],
      buffer: 1.5
    }))
  ];

  return Object.freeze(exclusions);
}

function createMainBuilding(root, materials) {
  const group = new THREE.Group();
  group.name = "WestMainBuildings";
  root.add(group);

  const main = WEST_DIORAMA_CONFIG.centralBuilding;
  const [x, , z] = main.position;
  const [width, height, depth] = main.size;
  addBox(group, main.size, [x, height / 2, z], materials.coolGrey, {
    name: "west-central-grey-building",
    castShadow: true
  });
  addBox(group, [width + 1.2, 0.9, depth + 1.2], [x, height + 0.45, z], materials.roof, {
    name: "west-central-grey-roof"
  });
  addBox(group, [8, 4.2, 18], [x - 7, height + 2.1, z - 10], materials.roofDark, {
    name: "west-central-rooftop-plant"
  });

  const eastFaceX = x + width / 2 + 0.09;
  const windows = [];
  for (const y of [4, 8.2, 12.4, 16.6, 20.8, 25]) {
    for (let windowZ = z - depth / 2 + 4.2; windowZ <= z + depth / 2 - 3; windowZ += 6.1) {
      if (Math.abs(windowZ - WEST_DIORAMA_CONFIG.redSection.position[2]) < 7) continue;
      windows.push({
        position: [eastFaceX, y, windowZ],
        scale: [0.18, 1.25, 3.15]
      });
    }
  }
  addInstancedBoxes(group, "west-central-window-grid", windows, materials.window);

  const bands = [6.1, 10.3, 14.5, 18.7, 22.9].map((y) => ({
    position: [eastFaceX + 0.02, y, z],
    scale: [0.2, 0.18, depth - 2]
  }));
  addInstancedBoxes(group, "west-central-facade-bands", bands, materials.facadeBand);

  const red = WEST_DIORAMA_CONFIG.redSection;
  addBox(
    group,
    red.size,
    [red.position[0], red.size[1] / 2, red.position[2]],
    materials.brick,
    { name: "west-red-vertical-section", castShadow: true }
  );
  addBox(
    group,
    [red.size[0] + 0.5, 0.65, red.size[2] + 0.6],
    [red.position[0], red.size[1] + 0.32, red.position[2]],
    materials.brickDark,
    { name: "west-red-section-cap" }
  );

  const annex = WEST_DIORAMA_CONFIG.annex;
  const [annexX, , annexZ] = annex.position;
  const [annexWidth, annexHeight, annexDepth] = annex.size;
  addBox(group, annex.size, [annexX, annexHeight / 2, annexZ], materials.coolGreyLight, {
    name: "west-right-grey-annex",
    castShadow: true
  });
  addBox(
    group,
    [annexWidth + 0.8, 0.7, annexDepth + 0.8],
    [annexX, annexHeight + 0.35, annexZ],
    materials.roof,
    { name: "west-right-annex-roof" }
  );
  const annexWindows = [];
  for (const y of [3.8, 7.7, 11.6, 15.5]) {
    for (let windowZ = annexZ - annexDepth / 2 + 3; windowZ < annexZ + annexDepth / 2 - 1; windowZ += 5) {
      annexWindows.push({
        position: [annexX + annexWidth / 2 + 0.1, y, windowZ],
        scale: [0.18, 1.05, 2.35]
      });
    }
  }
  addInstancedBoxes(group, "west-annex-window-grid", annexWindows, materials.window);

  addBox(group, [16, 13, 9], [-103, 6.5, -28], materials.coolGreyDark, {
    name: "west-main-annex-connector"
  });
}

function createArchedRoofGeometry(length, width, rise, segments = 12) {
  const vertices = [];
  const indices = [];
  for (let segment = 0; segment <= segments; segment++) {
    const angle = Math.PI - segment / segments * Math.PI;
    const z = Math.cos(angle) * width / 2;
    const y = Math.sin(angle) * rise;
    vertices.push(-length / 2, y, z, length / 2, y, z);
  }
  for (let segment = 0; segment < segments; segment++) {
    const a = segment * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createArchCap(width, rise, segments = 12) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  for (let segment = 0; segment <= segments; segment++) {
    const angle = Math.PI - segment / segments * Math.PI;
    shape.lineTo(Math.cos(angle) * width / 2, Math.sin(angle) * rise);
  }
  shape.lineTo(width / 2, 0);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, segments);
}

function createCurvedRoofCampus(root, materials) {
  const group = new THREE.Group();
  group.name = "WestCurvedRoofCampus";
  root.add(group);

  WEST_DIORAMA_CONFIG.curvedRoofs.forEach((config, index) => {
    const [x, , z] = config.position;
    const [length, totalHeight, width] = config.size;
    const wallHeight = totalHeight * 0.48;
    const rise = totalHeight - wallHeight;

    addBox(
      group,
      [length, wallHeight, width],
      [x, wallHeight / 2, z],
      index % 2 ? materials.concreteDark : materials.coolGreyDark,
      { name: `west-arched-hall-${index + 1}` }
    );

    const roof = new THREE.Mesh(
      createArchedRoofGeometry(length + 0.8, width + 0.8, rise, 12),
      materials.roofLight
    );
    roof.name = `west-curved-roof-${index + 1}`;
    roof.position.set(x, wallHeight, z);
    roof.receiveShadow = true;
    group.add(roof);

    const cap = new THREE.Mesh(
      createArchCap(width + 0.8, rise, 12),
      materials.roofLight
    );
    cap.name = `west-curved-roof-cap-${index + 1}`;
    cap.rotation.y = Math.PI / 2;
    cap.position.set(x + length / 2 + 0.42, wallHeight, z);
    group.add(cap);
  });
}

function createServiceRoad(root, materials) {
  const { center, length, depth } = WEST_DIORAMA_CONFIG.serviceRoad;
  const road = addBox(
    root,
    [length, 0.12, depth],
    [center[0], 0.01, center[1]],
    materials.asphalt,
    { name: "west-campus-service-road" }
  );
  road.receiveShadow = true;

  for (const side of [-1, 1]) {
    addBox(
      root,
      [length, 0.16, 0.45],
      [center[0], 0.08, center[1] + side * (depth / 2 + 0.23)],
      materials.concrete,
      { name: "west-service-road-kerb" }
    );
  }
}

function createBackgroundCampus(root, materials) {
  const group = new THREE.Group();
  group.name = "WestBackgroundCampus";
  root.add(group);

  const windowBands = [];
  BACKGROUND_MASSES.forEach((mass, index) => {
    const bodyMaterial = index % 3 === 0
      ? materials.coolGreyLight
      : (index % 3 === 1 ? materials.coolGreyDark : materials.concrete);
    addBox(group, mass.size, mass.position, bodyMaterial, {
      name: `west-background-building-${index + 1}`
    });
    addBox(
      group,
      [mass.size[0] + 0.8, 0.55, mass.size[2] + 0.8],
      [mass.position[0], mass.size[1] + 0.28, mass.position[2]],
      materials.roofDark,
      { name: `west-background-roof-${index + 1}` }
    );
    for (let y = 3.2; y < mass.size[1] - 1; y += 3.8) {
      windowBands.push({
        position: [mass.position[0] + mass.size[0] / 2 + 0.08, y, mass.position[2]],
        scale: [0.14, 0.58, mass.size[2] * 0.72]
      });
    }
  });
  addInstancedBoxes(group, "west-background-window-bands", windowBands, materials.windowDark);

  const horizonBlocks = Array.from({ length: 29 }, (_, index) => {
    const z = -135 + index * 9.7;
    const height = 7 + (index * 17 % 11);
    return {
      position: [-235 - (index % 4) * 5, height / 2, z],
      scale: [10 + index % 3 * 3, height, 6.5 + index % 4]
    };
  });
  addInstancedBoxes(group, "west-urban-horizon", horizonBlocks, materials.horizon);
}

function createTower(root, materials) {
  const { position, height } = WEST_DIORAMA_CONFIG.tower;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.45, height, 8),
    materials.tower
  );
  shaft.name = "west-tower-landmark";
  shaft.position.set(position[0], height / 2, position[2]);
  shaft.castShadow = false;
  shaft.receiveShadow = true;
  root.add(shaft);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(2.25, 1.5, 3.2, 8),
    materials.towerDark
  );
  crown.name = "west-tower-crown";
  crown.position.set(position[0], height - 5, position[2]);
  root.add(crown);
}

function createHighwayContinuation(root, materials) {
  const config = WEST_DIORAMA_CONFIG.highway;
  addBox(
    root,
    [config.width, 0.16, config.depth],
    [config.center[0], config.y, config.center[1]],
    materials.asphalt,
    { name: "west-m1-continuation", rotationY: config.rotation }
  );

  for (const side of [-1, 1]) {
    const localZ = side * (config.depth / 2 + 0.38);
    const x = config.center[0] + Math.sin(config.rotation) * localZ;
    const z = config.center[1] + Math.cos(config.rotation) * localZ;
    addBox(
      root,
      [config.width, 4.2, 0.76],
      [x, -1.9, z],
      materials.concreteDark,
      { name: "west-m1-retaining-wall", rotationY: config.rotation }
    );
  }
}

function createDebugHelpers(root) {
  const debug = new THREE.Group();
  debug.name = "WestDioramaDebugHelpers";
  debug.visible = false;
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0x35e0d1 });
  for (const x of [-61, -110, -165, -235]) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.3, -125),
      new THREE.Vector3(x, 0.3, 125)
    ]);
    debug.add(new THREE.Line(geometry, lineMaterial));
  }
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc33 })
  );
  marker.name = "west-reference-camera-anchor";
  marker.position.set(...WEST_DIORAMA_CONFIG.referenceCamera.position);
  debug.add(marker);
  root.add(debug);
}

function countStaticDrawCalls(root) {
  let count = 0;
  root.traverse((object) => {
    if (object.isMesh || object.isInstancedMesh) count++;
  });
  return count;
}

export function createWestDiorama({ loadAssets = true } = {}) {
  const root = new THREE.Group();
  root.name = "WestDiorama";
  root.position.set(...WEST_DIORAMA_CONFIG.rootOffset);

  const materials = {
    coolGrey: material(PALETTE.coolGrey, 0.9, {
      emissive: 0x273235,
      emissiveIntensity: 0.42
    }),
    coolGreyLight: material(PALETTE.coolGreyLight, 0.88, {
      emissive: 0x303638,
      emissiveIntensity: 0.34
    }),
    coolGreyDark: material(PALETTE.coolGreyDark, 0.93, {
      emissive: 0x20292c,
      emissiveIntensity: 0.3
    }),
    brick: material(PALETTE.brick, 0.9, {
      emissive: 0x4b1d13,
      emissiveIntensity: 0.52
    }),
    brickDark: material(PALETTE.brickDark, 0.92, {
      emissive: 0x32120c,
      emissiveIntensity: 0.4
    }),
    window: new THREE.MeshBasicMaterial({ color: PALETTE.window }),
    windowDark: new THREE.MeshBasicMaterial({ color: 0x3b5258 }),
    facadeBand: material(0x697578, 0.86),
    roof: material(PALETTE.roof, 0.72, { metalness: 0.16 }),
    roofDark: material(0x4d585b, 0.76, { metalness: 0.12 }),
    roofLight: material(PALETTE.roofLight, 0.68, {
      metalness: 0.18,
      emissive: 0x343838,
      emissiveIntensity: 0.32
    }),
    concrete: material(PALETTE.concrete, 0.92),
    concreteDark: material(PALETTE.concreteDark, 0.95),
    asphalt: material(PALETTE.asphalt, 0.98),
    horizon: new THREE.MeshBasicMaterial({ color: PALETTE.horizon }),
    tower: material(0x7f898b, 0.72, { metalness: 0.12 }),
    towerDark: material(PALETTE.horizonDark, 0.76, { metalness: 0.16 })
  };

  createServiceRoad(root, materials);
  createMainBuilding(root, materials);
  createCurvedRoofCampus(root, materials);
  createBackgroundCampus(root, materials);
  createHighwayContinuation(root, materials);
  createTower(root, materials);

  const vegetation = new THREE.Group();
  vegetation.name = "Vegetation";
  root.add(vegetation);
  const foliageExclusions = getWestDioramaFoliageExclusions();

  if (import.meta.env?.DEV) createDebugHelpers(root);
  const staticDrawCallsBeforeFoliage = countStaticDrawCalls(root);
  const ready = loadAssets
    ? addWestDioramaFoliage(
      vegetation,
      WEST_DIORAMA_CONFIG.vegetation.density,
      { exclusions: foliageExclusions }
    )
    : Promise.resolve();

  return {
    root,
    ready,
    stats: Object.freeze({
      reusesPlayableParking: true,
      reusesExistingM1: true,
      buildingMasses: 14,
      curvedRoofs: WEST_DIORAMA_CONFIG.curvedRoofs.length,
      windowPanels: 70,
      staticDrawCallsBeforeFoliage,
      dynamicUpdates: 0
    })
  };
}
