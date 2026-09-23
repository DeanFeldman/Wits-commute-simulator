import * as THREE from "three";
import { addNorthDioramaFoliage } from "./ParkingFoliage.js";

// One metre is approximately one world unit. All important composition values
// live here so the forced-perspective stage can be tuned without hunting
// through construction code.
export const NORTH_DIORAMA_CONFIG = Object.freeze({
  rootOffset: Object.freeze([0, 0, 0]),
  referenceCamera: Object.freeze({
    position: Object.freeze([-34.5, 5, 49]),
    target: Object.freeze([-30, 1.8, -112]),
    fov: 58,
    far: 340
  }),
  foreground: Object.freeze({
    // Kept fully north of the M1's angled far lip. A former straight pavement
    // strip here crossed over the western end of the cutting in sky view.
    fenceZ: -77,
    fenceWidth: 154,
    fenceHeight: 2.15
  }),
  parking: Object.freeze({
    center: Object.freeze([-5, -96]),
    width: 150,
    depth: 36,
    carDensity: 1
  }),
  campus: Object.freeze({
    mainRightPosition: Object.freeze([36, -128]),
    centrePosition: Object.freeze([-18, -136]),
    // Bridges the centre mass to the prominent right building and aligns its
    // front face, so the latter's bright undecorated west wall is not exposed.
    connectorPosition: Object.freeze([-1, -125])
  }),
  vegetation: Object.freeze({
    density: 1
  }),
  skyline: Object.freeze({
    centerZ: -214,
    towerPosition: Object.freeze([-27, -222])
  }),
  atmosphere: Object.freeze({
    fogStart: 92,
    fogEnd: 255,
    density: 0.92
  })
});

const PALETTE = Object.freeze({
  asphalt: 0x4b5051,
  darkConcrete: 0x6e7473,
  metal: 0x20282b,
  campusStone: 0x8f958e,
  campusShadow: 0x626a68,
  roof: 0x687579,
  glass: 0x536b72,
  solar: 0x304d59,
  skyline: 0x7d8b8d,
  skylineDark: 0x6f7d80,
  canopy: 0x46694d,
  cloud: 0xd2dde0,
  parkingPaint: 0xd7d3b5
});

function standardMaterial(color, roughness = 0.9, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extras });
}

function addBox(root, size, position, material, {
  name = "",
  rotation = [0, 0, 0],
  receiveShadow = true,
  castShadow = false
} = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.set(...rotation);
  mesh.receiveShadow = receiveShadow;
  mesh.castShadow = castShadow;
  root.add(mesh);
  return mesh;
}

function addInstancedBoxes(root, name, placements, material) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.InstancedMesh(geometry, material, placements.length);
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();

  placements.forEach((item, index) => {
    position.set(...item.position);
    scale.set(...item.scale);
    euler.set(0, item.rotationY ?? 0, 0);
    quaternion.setFromEuler(euler);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });

  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  root.add(mesh);
  return mesh;
}

function createForeground(root, materials) {
  const group = new THREE.Group();
  group.name = "Foreground";
  root.add(group);

  const config = NORTH_DIORAMA_CONFIG.foreground;
  const postSpacing = 2.4;
  const postCount = Math.floor(config.fenceWidth / postSpacing) + 1;
  const posts = Array.from({ length: postCount }, (_, index) => ({
    position: [
      -5 - config.fenceWidth / 2 + index * (config.fenceWidth / (postCount - 1)),
      config.fenceHeight / 2,
      config.fenceZ
    ],
    scale: [index % 8 === 0 ? 0.16 : 0.075, config.fenceHeight, 0.075]
  }));
  addInstancedBoxes(group, "north-diorama-fence-posts", posts, materials.metal);

  for (const y of [0.45, 1.15, 2.02]) {
    addBox(
      group,
      [config.fenceWidth, 0.09, 0.1],
      [-5, y, config.fenceZ],
      materials.metal,
      { name: "north-diorama-fence-rail", receiveShadow: false }
    );
  }
}

function seededValue(index, salt) {
  const value = Math.sin(index * 91.713 + salt * 37.119) * 43758.5453;
  return value - Math.floor(value);
}

const MAIN_RIGHT_BUILDING = Object.freeze({ size: [58, 18, 24] });
const MAIN_RIGHT_TOWER = Object.freeze({ size: [18, 23, 18] });
const CAMPUS_CONNECTOR = Object.freeze({ size: [18, 16, 18], y: 8 });

function getCentreBuildingMasses() {
  const [centreX, centreZ] = NORTH_DIORAMA_CONFIG.campus.centrePosition;
  return [
    { size: [28, 15, 18], position: [centreX - 6, 7.5, centreZ] },
    { size: [17, 22, 15], position: [centreX + 16, 11, centreZ - 3] },
    { size: [31, 11, 16], position: [centreX - 34, 5.5, centreZ + 4] },
    { size: [24, 18, 19], position: [centreX - 59, 9, centreZ - 1] },
    { size: [18, 12, 15], position: [centreX - 79, 6, centreZ + 5] }
  ];
}

function footprint(name, size, position, buffer) {
  return Object.freeze({ name, x: position[0], z: position[2], width: size[0], depth: size[2], buffer });
}

export function getNorthDioramaFoliageExclusions() {
  const [mainX, mainZ] = NORTH_DIORAMA_CONFIG.campus.mainRightPosition;
  const [connectorX, connectorZ] = NORTH_DIORAMA_CONFIG.campus.connectorPosition;
  const parking = NORTH_DIORAMA_CONFIG.parking;
  // The extra clearance is large enough for the widened tree crowns, so the
  // foliage reads as landscaping in front of a facade rather than growing
  // through it.
  const buildingBuffer = 2.25;

  return Object.freeze([
    footprint("main-right-building", MAIN_RIGHT_BUILDING.size, [mainX, 9, mainZ], buildingBuffer),
    footprint("main-right-tower", MAIN_RIGHT_TOWER.size, [mainX + 23, 11.5, mainZ - 1], buildingBuffer),
    footprint("campus-connector", CAMPUS_CONNECTOR.size, [connectorX, CAMPUS_CONNECTOR.y, connectorZ], buildingBuffer),
    ...getCentreBuildingMasses().map((mass, index) => footprint(
      `centre-building-${index + 1}`,
      mass.size,
      mass.position,
      buildingBuffer
    )),
    Object.freeze({
      name: "north-diorama-parking",
      x: parking.center[0],
      z: parking.center[1],
      width: parking.width,
      depth: parking.depth,
      buffer: 0.35
    })
  ]);
}

function isInsideFootprint(x, z, exclusion) {
  const buffer = exclusion.buffer ?? 0;
  return Math.abs(x - exclusion.x) < exclusion.width / 2 + buffer
    && Math.abs(z - exclusion.z) < exclusion.depth / 2 + buffer;
}

export function getNorthDioramaCarPlacements(density = 1) {
  const columns = [-68, -53, -38, -23, -8, 7, 22, 37, 52];
  const placements = [];
  const parking = NORTH_DIORAMA_CONFIG.parking;
  const nearZ = parking.center[1] + parking.depth / 2 - 4.5;
  const farZ = parking.center[1] - parking.depth / 2 + 5.5;

  columns.forEach((x, column) => {
    // The left half deliberately carries roughly twice the density of the
    // right, matching the supplied north-facing reference.
    const targetCount = column < 5 ? 8 : (column < 7 ? 5 : 3);
    const count = Math.max(1, Math.round(targetCount * density));
    for (let row = 0; row < count; row++) {
      const t = count === 1 ? 0.5 : row / (count - 1);
      placements.push({
        x: x + (seededValue(row + column * 11, 1) - 0.5) * 0.45,
        z: THREE.MathUtils.lerp(nearZ, farZ, t) + (seededValue(row + column * 13, 2) - 0.5) * 0.5,
        rotationY: (seededValue(row + column * 17, 3) - 0.5) * 0.08,
        width: THREE.MathUtils.lerp(1.72, 1.98, seededValue(row + column * 19, 4)),
        length: THREE.MathUtils.lerp(3.65, 4.35, seededValue(row + column * 23, 5)),
        height: THREE.MathUtils.lerp(0.48, 0.65, seededValue(row + column * 29, 6)),
        colorIndex: Math.floor(seededValue(row + column * 31, 7) * 12)
      });
    }
  });

  return placements;
}

function createParking(root, materials) {
  const group = new THREE.Group();
  group.name = "Parking";
  root.add(group);

  const config = NORTH_DIORAMA_CONFIG.parking;
  addBox(
    group,
    [config.width, 0.12, config.depth],
    [config.center[0], 0, config.center[1]],
    materials.asphalt,
    { name: "north-diorama-parking-ground" }
  );

  const linePlacements = [];
  const southEdge = config.center[1] + config.depth / 2;
  const northEdge = config.center[1] - config.depth / 2;
  for (let x = -74; x <= 60; x += 7.5) {
    linePlacements.push({ position: [x, 0.075, config.center[1]], scale: [0.075, 0.018, config.depth - 2] });
  }
  for (let z = southEdge - 3; z >= northEdge + 3; z -= 5.2) {
    linePlacements.push({ position: [config.center[0], 0.076, z], scale: [config.width - 2, 0.018, 0.075] });
  }
  addInstancedBoxes(group, "north-diorama-parking-lines", linePlacements, materials.paint);

  const cars = getNorthDioramaCarPlacements(config.carDensity);
  const carColours = [
    0xd9d9d3,
    0xb4b9b9,
    0x858b8c,
    0x343b3e,
    0xa8483e,
    0x3f6074
  ].map((color) => standardMaterial(color, 0.62, { metalness: 0.12 }));

  carColours.forEach((carMaterial, colourIndex) => {
    const colourCars = cars.filter((car) => {
      // Neutral colours receive nine of every twelve cars.
      const weighted = car.colorIndex < 9 ? car.colorIndex % 4 : car.colorIndex - 7;
      return weighted === colourIndex;
    });
    if (colourCars.length === 0) return;

    const bodies = colourCars.map((car) => ({
      position: [car.x, 0.38, car.z],
      scale: [car.width, car.height, car.length],
      rotationY: car.rotationY
    }));
    const cabins = colourCars.map((car) => ({
      position: [car.x, 0.84, car.z - 0.1],
      scale: [car.width * 0.78, car.height * 0.8, car.length * 0.48],
      rotationY: car.rotationY
    }));
    addInstancedBoxes(group, `north-diorama-car-bodies-${colourIndex}`, bodies, carMaterial);
    addInstancedBoxes(group, `north-diorama-car-cabins-${colourIndex}`, cabins, carMaterial);
  });

  const polePositions = [-61, -30, 1, 32, 60];
  addInstancedBoxes(
    group,
    "north-diorama-light-poles",
    polePositions.map((x) => ({ position: [x, 4.8, config.center[1]], scale: [0.13, 9.6, 0.13] })),
    materials.metal
  );
  addInstancedBoxes(
    group,
    "north-diorama-light-heads",
    polePositions.map((x) => ({ position: [x, 9.58, config.center[1]], scale: [2.2, 0.16, 0.34] })),
    materials.metal
  );
}

function createMainRightBuilding(group, materials) {
  const [x, z] = NORTH_DIORAMA_CONFIG.campus.mainRightPosition;
  addBox(group, MAIN_RIGHT_BUILDING.size, [x, 9, z], materials.campusStone, { name: "MainRightBuilding" });
  addBox(group, MAIN_RIGHT_TOWER.size, [x + 23, 11.5, z - 1], materials.darkConcrete, { name: "main-right-tower" });
  addBox(group, [62, 1.2, 26], [x, 18.6, z], materials.roof, { name: "main-right-roof" });

  for (const y of [4.2, 8.1, 12, 15.9]) {
    addBox(group, [52, 0.85, 0.18], [x - 2, y, z + 12.11], materials.glass, {
      name: "main-right-window-band",
      receiveShadow: false
    });
  }

  const roofPanels = [];
  for (let panel = 0; panel < 8; panel++) {
    roofPanels.push({
      position: [x - 24.5 + panel * 7, 19.6, z + 1],
      scale: [5.2, 0.18, 10],
      rotationY: 0
    });
  }
  addInstancedBoxes(group, "main-right-solar-panels", roofPanels, materials.solar);
}

function createCampusBuildings(root, materials) {
  const group = new THREE.Group();
  group.name = "CampusBuildings";
  root.add(group);

  createMainRightBuilding(group, materials);

  const [connectorX, connectorZ] = NORTH_DIORAMA_CONFIG.campus.connectorPosition;
  addBox(group, CAMPUS_CONNECTOR.size, [connectorX, CAMPUS_CONNECTOR.y, connectorZ], materials.campusStone, {
    name: "campus-centre-right-connector"
  });
  addBox(group, [19, 0.6, 19], [connectorX, 16.3, connectorZ], materials.roof, {
    name: "campus-centre-right-connector-roof"
  });
  for (const y of [3.5, 7.5, 11.5, 14.5]) {
    addBox(group, [14, 0.62, 0.16], [connectorX, y, connectorZ + 9.1], materials.glass, {
      name: "campus-centre-right-connector-window",
      receiveShadow: false
    });
  }

  const masses = getCentreBuildingMasses();

  masses.forEach((mass, index) => {
    addBox(group, mass.size, mass.position, index % 2 ? materials.darkConcrete : materials.campusStone, {
      name: `centre-building-${index + 1}`
    });
    addBox(
      group,
      [mass.size[0] + 0.8, 0.6, mass.size[2] + 0.8],
      [mass.position[0], mass.size[1] + 0.3, mass.position[2]],
      materials.roof,
      { name: `centre-building-roof-${index + 1}` }
    );
  });

  const windowBands = [];
  masses.forEach((mass) => {
    for (let y = 3.2; y < mass.size[1] - 1; y += 3.4) {
      windowBands.push({
        position: [mass.position[0], y, mass.position[2] + mass.size[2] / 2 + 0.11],
        scale: [mass.size[0] * 0.78, 0.58, 0.16]
      });
    }
  });
  addInstancedBoxes(group, "centre-building-window-bands", windowBands, materials.glass);
}

function createVegetationMass(group, materials, density, exclusions) {
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const placements = [];

  const canopyCount = Math.max(0, Math.round(28 * density));
  for (let index = 0; index < canopyCount; index++) {
    const column = index % 8;
    const row = Math.floor(index / 8);
    const width = 5.5 + seededValue(index, 80) * 3.2;
    const height = 5 + seededValue(index, 81) * 3.5;
    const item = {
      position: [
        -110 + column * 8.1 + (seededValue(index, 82) - 0.5) * 3,
        5.5 + height * 0.35,
        -113 - row * 7 + (seededValue(index, 83) - 0.5) * 3
      ],
      scale: [width, height, width * 0.9],
      rotationY: seededValue(index, 84) * Math.PI * 2
    };
    if (!exclusions.some((exclusion) => isInsideFootprint(item.position[0], item.position[2], exclusion))) {
      placements.push(item);
    }
  }

  if (placements.length === 0) return;

  const mesh = new THREE.InstancedMesh(geometry, materials.canopy, placements.length);
  mesh.name = "north-diorama-left-canopy-mass";
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  placements.forEach((item, index) => {
    position.set(...item.position);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.rotationY);
    scale.set(...item.scale);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
  group.add(mesh);
}

function createDistantSkyline(root, materials) {
  const group = new THREE.Group();
  group.name = "DistantSkyline";
  root.add(group);

  const centerZ = NORTH_DIORAMA_CONFIG.skyline.centerZ;
  const buildings = Array.from({ length: 31 }, (_, index) => {
    const x = -125 + index * 8.5;
    const height = 8 + seededValue(index, 50) * 28;
    const width = 5 + seededValue(index, 51) * 5;
    const depth = 8 + seededValue(index, 52) * 8;
    return {
      position: [x, height / 2 + 2, centerZ - seededValue(index, 53) * 24],
      scale: [width, height, depth]
    };
  });
  addInstancedBoxes(group, "distant-city-buildings", buildings, materials.skyline);

  const [towerX, towerZ] = NORTH_DIORAMA_CONFIG.skyline.towerPosition;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.4, 48, 8), materials.skylineDark);
  shaft.name = "north-diorama-hillbrow-tower";
  shaft.position.set(towerX, 26, towerZ);
  shaft.castShadow = false;
  shaft.receiveShadow = false;
  group.add(shaft);

  const deck = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 3.8, 3.2, 12), materials.skylineDark);
  deck.name = "north-diorama-tower-deck";
  deck.position.set(towerX, 43, towerZ);
  deck.castShadow = false;
  deck.receiveShadow = false;
  group.add(deck);

  const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 14, 6), materials.skylineDark);
  antenna.name = "north-diorama-tower-antenna";
  antenna.position.set(towerX, 56, towerZ);
  antenna.castShadow = false;
  antenna.receiveShadow = false;
  group.add(antenna);

  // A single translucent batch gives the existing blue Level 1 sky a broad,
  // stylised cloud layer without introducing an HDRI or texture download.
  const cloudGeometry = new THREE.IcosahedronGeometry(1, 1);
  const cloudPlacements = Array.from({ length: 18 }, (_, index) => ({
    position: [
      -150 + index * 18,
      50 + seededValue(index, 90) * 35,
      -195 - seededValue(index, 91) * 45
    ],
    scale: [
      15 + seededValue(index, 92) * 12,
      4 + seededValue(index, 93) * 5,
      8 + seededValue(index, 94) * 8
    ],
    rotationY: seededValue(index, 95) * Math.PI
  }));
  const clouds = new THREE.InstancedMesh(cloudGeometry, materials.cloud, cloudPlacements.length);
  clouds.name = "north-diorama-cloud-layer";
  clouds.castShadow = false;
  clouds.receiveShadow = false;
  clouds.renderOrder = -1;
  const cloudMatrix = new THREE.Matrix4();
  const cloudPosition = new THREE.Vector3();
  const cloudQuaternion = new THREE.Quaternion();
  const cloudScale = new THREE.Vector3();
  cloudPlacements.forEach((item, index) => {
    cloudPosition.set(...item.position);
    cloudQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.rotationY);
    cloudScale.set(...item.scale);
    cloudMatrix.compose(cloudPosition, cloudQuaternion, cloudScale);
    clouds.setMatrixAt(index, cloudMatrix);
  });
  clouds.instanceMatrix.needsUpdate = true;
  clouds.computeBoundingSphere();
  group.add(clouds);
}

function createDebugHelpers(root) {
  const debug = new THREE.Group();
  debug.name = "NorthDioramaDebugHelpers";
  debug.visible = false;

  const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0x35e0d1 });
  for (const z of [-70, -115, -165, -230]) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-90, 0.25, z),
      new THREE.Vector3(90, 0.25, z)
    ]);
    debug.add(new THREE.Line(geometry, boundaryMaterial));
  }

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc33 })
  );
  marker.position.set(...NORTH_DIORAMA_CONFIG.referenceCamera.position);
  debug.add(marker);
  root.add(debug);
}

export function createNorthDiorama({ loadVegetation = true } = {}) {
  const root = new THREE.Group();
  root.name = "NorthDiorama";
  root.position.set(...NORTH_DIORAMA_CONFIG.rootOffset);

  const materials = {
    asphalt: standardMaterial(PALETTE.asphalt, 0.98),
    metal: standardMaterial(PALETTE.metal, 0.58, { metalness: 0.55 }),
    paint: new THREE.MeshBasicMaterial({ color: PALETTE.parkingPaint }),
    campusStone: standardMaterial(PALETTE.campusStone, 0.9),
    darkConcrete: standardMaterial(PALETTE.campusShadow, 0.93),
    roof: standardMaterial(PALETTE.roof, 0.72, { metalness: 0.16 }),
    glass: new THREE.MeshBasicMaterial({ color: PALETTE.glass }),
    solar: standardMaterial(PALETTE.solar, 0.42, { metalness: 0.3 }),
    skyline: new THREE.MeshBasicMaterial({ color: PALETTE.skyline }),
    skylineDark: new THREE.MeshBasicMaterial({ color: PALETTE.skylineDark }),
    canopy: standardMaterial(PALETTE.canopy, 0.96),
    cloud: new THREE.MeshBasicMaterial({
      color: PALETTE.cloud,
      transparent: true,
      opacity: 0.22,
      depthWrite: false
    })
  };

  createForeground(root, materials);
  createParking(root, materials);

  const vegetation = new THREE.Group();
  vegetation.name = "Vegetation";
  root.add(vegetation);
  const foliageExclusions = getNorthDioramaFoliageExclusions();
  createVegetationMass(
    vegetation,
    materials,
    NORTH_DIORAMA_CONFIG.vegetation.density,
    foliageExclusions
  );

  createCampusBuildings(root, materials);
  createDistantSkyline(root, materials);

  if (import.meta.env.DEV) createDebugHelpers(root);

  // Loading individual LOD nodes at runtime still downloads each complete source GLB.
  // TODO: production asset pass: export trimmed packs containing only the
  // variants and LODs used by this vista, without changing placement code.
  const ready = loadVegetation
    ? addNorthDioramaFoliage(
      vegetation,
      NORTH_DIORAMA_CONFIG.vegetation.density,
      { exclusions: foliageExclusions }
    )
    : Promise.resolve();

  return {
    root,
    ready,
    stats: Object.freeze({
      placeholderCars: getNorthDioramaCarPlacements(NORTH_DIORAMA_CONFIG.parking.carDensity).length,
      skylineBuildings: 31,
      dynamicUpdates: 0
    })
  };
}
