import * as THREE from "three";
import { addEastDioramaFoliage } from "./ParkingFoliage.js";

// +X is east, -Z is north. The saved camera therefore sees the M1/building on
// its left, Entrance 9 and overflow parking on its right, and the open green
// belt directly ahead. One world unit is approximately one metre.
export const EAST_DIORAMA_CONFIG = Object.freeze({
  rootOffset: Object.freeze([0, 0, 0]),
  referenceCamera: Object.freeze({
    // The camera sits in a full drive aisle, not inside a row of parked cars.
    // Its distance from Entrance 9 keeps the canopy readable on the right
    // without letting it dominate the road, open field and skyline.
    position: Object.freeze([13.5, 5.1, 10]),
    target: Object.freeze([155, 3.2, 0]),
    fov: 58,
    far: 380
  }),
  entrance: Object.freeze({
    checkpointPosition: Object.freeze([81.5, 48.5]),
    accessCenter: Object.freeze([77, 48.5]),
    accessLength: 18
  }),
  road: Object.freeze({
    // Matches the east edge of the existing Yale/bridge road rather than
    // laying a second road surface on top of it.
    fieldEdgeX: 75.4,
    centerZ: -5,
    depth: 148,
    rotation: THREE.MathUtils.degToRad(-4)
  }),
  cemetery: Object.freeze({
    // Extends south across the former overflow-lot footprint. The existing
    // Level 1 terrain remains visible below it; this config adds markers only.
    center: Object.freeze([115, 25]),
    width: 76,
    depth: 138,
    markerDensity: 0.72
  }),
  vegetation: Object.freeze({ density: 0.72 }),
  highway: Object.freeze({
    centerX: 0,
    bridgeX: 69,
    northZ: -66.5,
    southZ: -46.5,
    gantryX: 119,
    centerZ: -56.5,
    roadDepth: 18,
    rotation: THREE.MathUtils.degToRad(-6),
    fieldClearance: 0.9
  }),
  leftBuilding: Object.freeze({
    position: Object.freeze([120, -83]),
    size: Object.freeze([26, 50, 22])
  }),
  horizon: Object.freeze({
    centerX: 238,
    depth: 190
  }),
  atmosphere: Object.freeze({
    fogStart: 90,
    fogEnd: 270,
    density: 0.9
  })
});

const PALETTE = Object.freeze({
  asphaltDark: 0x30373a,
  kerb: 0xb5b7ae,
  stone: 0x9c968a,
  concrete: 0x858a89,
  concreteDark: 0x676d6d,
  brick: 0x816252,
  roof: 0x6b7477,
  glass: 0x425e68,
  metal: 0x30393d,
  freewaySign: 0x315a72,
  horizon: 0x718382,
  canopy: 0x3d6546
});

function material(color, roughness = 0.9, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extras });
}

function addBox(root, size, position, boxMaterial, {
  name = "",
  rotationY = 0,
  castShadow = false,
  receiveShadow = true
} = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), boxMaterial);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = rotationY;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  root.add(mesh);
  return mesh;
}

function addInstancedBoxes(root, name, placements, boxMaterial, { receiveShadow = true } = {}) {
  const mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    boxMaterial,
    placements.length
  );
  mesh.name = name;
  mesh.castShadow = false;
  mesh.receiveShadow = receiveShadow;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  placements.forEach((item, index) => {
    position.set(...item.position);
    euler.set(0, item.rotationY ?? 0, 0);
    quaternion.setFromEuler(euler);
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

function seededValue(index, salt) {
  const value = Math.sin((index + 1) * 91.713 + salt * 37.119) * 43758.5453;
  return value - Math.floor(value);
}

export function getEastHighwaySouthLipZAt(x) {
  const highway = EAST_DIORAMA_CONFIG.highway;
  const localZ = highway.roadDepth / 2;
  const cos = Math.cos(highway.rotation);
  const sin = Math.sin(highway.rotation);
  const localX = (x - highway.centerX - sin * localZ) / cos;
  return highway.centerZ - sin * localX + cos * localZ;
}

function createEntrance(root, materials) {
  const group = new THREE.Group();
  group.name = "Entrance";
  root.add(group);
  const config = EAST_DIORAMA_CONFIG.entrance;
  const [accessX, accessZ] = config.accessCenter;
  const [gateX, gateZ] = config.checkpointPosition;

  addBox(
    group,
    [config.accessLength, 0.1, 8],
    [accessX, 0, accessZ],
    materials.asphaltDark,
    { name: "east-diorama-parking-access" }
  );

  addBox(group, [7.8, 0.5, 6.6], [gateX, 4.15, gateZ], materials.roof, {
    name: "east-diorama-gatehouse-roof"
  });
  for (const z of [gateZ - 2.55, gateZ + 2.55]) {
    for (const x of [gateX - 3.15, gateX + 3.15]) {
      addBox(group, [0.34, 4, 0.34], [x, 2, z], materials.metal, {
        name: "east-diorama-gatehouse-column"
      });
    }
  }
  addBox(group, [2.8, 2.55, 3.6], [gateX + 1.65, 1.28, gateZ], materials.stone, {
    name: "east-diorama-gatehouse-booth"
  });
  for (const z of [gateZ - 1.84, gateZ + 1.84]) {
    addBox(group, [2.25, 0.82, 0.08], [gateX + 1.65, 1.65, z], materials.glass, {
      name: "east-diorama-gatehouse-window",
      receiveShadow: false
    });
  }
}

function createRoadEdge(root, materials) {
  const group = new THREE.Group();
  group.name = "Roads";
  root.add(group);
  const road = EAST_DIORAMA_CONFIG.road;

  addBox(
    group,
    [1.15, 0.18, road.depth],
    [road.fieldEdgeX, 0.09, road.centerZ],
    materials.kerb,
    {
      name: "east-diorama-yale-road-field-kerb",
      rotationY: road.rotation
    }
  );

  const posts = Array.from({ length: 29 }, (_, index) => ({
    position: [road.fieldEdgeX + 0.75, 0.65, road.centerZ - road.depth / 2 + 3 + index * 5],
    scale: [0.18, 1.3, 0.18]
  }));
  addInstancedBoxes(group, "east-diorama-road-boundary-posts", posts, materials.concreteDark);
}

export function getEastDioramaMarkerPlacements() {
  const cemetery = EAST_DIORAMA_CONFIG.cemetery;
  const markers = [];
  let markerIndex = 0;

  for (let x = cemetery.center[0] - cemetery.width / 2 + 10; x <= cemetery.center[0] + cemetery.width / 2 - 9; x += 8) {
    for (let z = cemetery.center[1] - cemetery.depth / 2 + 10; z <= cemetery.center[1] + cemetery.depth / 2 - 9; z += 7) {
      if (seededValue(markerIndex, 410) <= cemetery.markerDensity
        && z >= getEastHighwaySouthLipZAt(x) + EAST_DIORAMA_CONFIG.highway.fieldClearance + 2) {
        markers.push(Object.freeze({
          position: Object.freeze([x + (seededValue(markerIndex, 411) - 0.5) * 0.7, 0.16, z]),
          scale: Object.freeze([0.55, 0.32, 0.2]),
          rotationY: (seededValue(markerIndex, 412) - 0.5) * 0.12
        }));
      }
      markerIndex++;
    }
  }
  return Object.freeze(markers);
}

function createCemetery(root, materials) {
  const group = new THREE.Group();
  group.name = "Cemetery";
  root.add(group);
  const markers = getEastDioramaMarkerPlacements();
  addInstancedBoxes(group, "east-diorama-field-markers", markers, materials.stone);
  return markers.length;
}

function createHighwayAndBridgeDetails(root, materials) {
  const group = new THREE.Group();
  group.name = "HighwayAndBridge";
  root.add(group);
  const highway = EAST_DIORAMA_CONFIG.highway;

  // The Yale deck and M1 surface already exist in ParkingEnvironment. These
  // cheap abutments and one gantry strengthen their ground-level silhouette.
  for (const z of [highway.northZ, highway.southZ]) {
    addBox(
      group,
      [13.2, 3.4, 1.25],
      [highway.bridgeX, -2.05, z],
      materials.concrete,
      { name: "east-diorama-bridge-abutment" }
    );
  }
  for (const z of [highway.centerZ - 8.5, highway.centerZ + 8.5]) {
    addBox(group, [0.34, 8.8, 0.34], [highway.gantryX, 0.4, z], materials.metal, {
      name: "east-diorama-highway-gantry-post"
    });
  }
  addBox(
    group,
    [0.38, 0.4, 17.4],
    [highway.gantryX, 4.7, highway.centerZ],
    materials.metal,
    { name: "east-diorama-highway-gantry-beam" }
  );
  for (const z of [highway.centerZ - 4.25, highway.centerZ + 4.25]) {
    addBox(
      group,
      [0.32, 2.2, 7.1],
      [highway.gantryX - 0.08, 3.45, z],
      materials.freewaySign,
      { name: "east-diorama-highway-sign", receiveShadow: false }
    );
  }
}

function createLeftBuilding(root, materials) {
  const group = new THREE.Group();
  group.name = "UrbanStructures";
  root.add(group);
  const building = EAST_DIORAMA_CONFIG.leftBuilding;
  const [x, z] = building.position;
  const [width, height, depth] = building.size;

  addBox(group, building.size, [x, height / 2, z], materials.brick, {
    name: "east-diorama-left-tower"
  });
  addBox(group, [width + 0.9, 0.7, depth + 0.9], [x, height + 0.35, z], materials.roof, {
    name: "east-diorama-left-tower-roof"
  });

  const windows = [];
  for (let floor = 0; floor < 13; floor++) {
    const y = 2.8 + floor * 3.55;
    for (let bay = -3; bay <= 3; bay++) {
      windows.push({
        position: [x + bay * 3.2, y, z + depth / 2 + 0.06],
        scale: [1.65, 1.45, 0.12]
      });
    }
  }
  addInstancedBoxes(group, "east-diorama-left-tower-windows", windows, materials.glass, {
    receiveShadow: false
  });

  addBox(group, [width + 8, 7, depth + 7], [x + 8, 3.5, z - 4], materials.concreteDark, {
    name: "east-diorama-left-tower-podium"
  });
}

export function getEastDioramaCanopyPlacements() {
  return Object.freeze(Array.from({ length: 62 }, (_, index) => {
    const band = index % 3;
    const radius = 5.5 + seededValue(index, 511) * 4;
    const x = 160 + band * 23 + seededValue(index, 512) * 11;
    const z = getEastHighwaySouthLipZAt(x)
      + radius
      + 3
      + (index % 21) * 6.1
      + (seededValue(index, 510) - 0.5) * 4;

    return Object.freeze({
      x,
      z,
      radius,
      height: 5 + seededValue(index, 514) * 4.2,
      rotationY: seededValue(index, 513) * Math.PI * 2
    });
  }));
}

function createDistantBackground(root, materials) {
  const group = new THREE.Group();
  group.name = "DistantBackground";
  root.add(group);
  const horizon = EAST_DIORAMA_CONFIG.horizon;

  const skyline = Array.from({ length: 19 }, (_, index) => {
    const z = -horizon.depth / 2 + index * (horizon.depth / 18);
    const height = 6 + seededValue(index, 500) * 13;
    return {
      position: [horizon.centerX + seededValue(index, 501) * 14, height / 2, z],
      scale: [7 + seededValue(index, 502) * 7, height, 5 + seededValue(index, 503) * 5]
    };
  });
  addInstancedBoxes(group, "east-diorama-distant-city", skyline, materials.horizon, {
    receiveShadow: false
  });

  // One low-cost batch holds the green silhouette while the cached foliage
  // packs load, and adds crown overlap without another GLB variant.
  const canopyPlacements = getEastDioramaCanopyPlacements();
  const canopyGeometry = new THREE.IcosahedronGeometry(1, 1);
  const canopies = new THREE.InstancedMesh(canopyGeometry, materials.canopy, canopyPlacements.length);
  canopies.name = "east-diorama-canopy-mass";
  canopies.castShadow = false;
  canopies.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  canopyPlacements.forEach((item, index) => {
    position.set(item.x, 3.6 + item.radius * 0.35, item.z);
    quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), item.rotationY);
    scale.set(item.radius, item.height, item.radius * 0.9);
    matrix.compose(position, quaternion, scale);
    canopies.setMatrixAt(index, matrix);
  });
  canopies.instanceMatrix.needsUpdate = true;
  canopies.computeBoundingSphere();
  group.add(canopies);
}

function createDebugHelpers(root) {
  const debug = new THREE.Group();
  debug.name = "EastDioramaDebugHelpers";
  debug.visible = false;
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xf0bb38 });
  for (const x of [75, 145, 205, 240]) {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0.3, -96),
      new THREE.Vector3(x, 0.3, 98)
    ]);
    debug.add(new THREE.Line(geometry, lineMaterial));
  }
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xffcc33 })
  );
  marker.position.set(...EAST_DIORAMA_CONFIG.referenceCamera.position);
  debug.add(marker);
  root.add(debug);
}

export function createEastDiorama({ loadAssets = true } = {}) {
  const root = new THREE.Group();
  root.name = "EastDiorama";
  root.position.set(...EAST_DIORAMA_CONFIG.rootOffset);

  const materials = {
    asphaltDark: material(PALETTE.asphaltDark, 0.96),
    kerb: material(PALETTE.kerb, 0.86),
    stone: material(PALETTE.stone, 0.92),
    concrete: material(PALETTE.concrete, 0.9),
    concreteDark: material(PALETTE.concreteDark, 0.93),
    brick: material(PALETTE.brick, 0.9),
    roof: material(PALETTE.roof, 0.72, { metalness: 0.14 }),
    glass: new THREE.MeshBasicMaterial({ color: PALETTE.glass }),
    metal: material(PALETTE.metal, 0.62, { metalness: 0.5 }),
    freewaySign: material(PALETTE.freewaySign, 0.58, { metalness: 0.22 }),
    horizon: new THREE.MeshBasicMaterial({ color: PALETTE.horizon }),
    canopy: material(PALETTE.canopy, 0.98)
  };

  createEntrance(root, materials);
  createRoadEdge(root, materials);
  const fieldMarkers = createCemetery(root, materials);
  createHighwayAndBridgeDetails(root, materials);
  createLeftBuilding(root, materials);
  createDistantBackground(root, materials);
  if (import.meta.env?.DEV) createDebugHelpers(root);

  const foliageReady = loadAssets
    ? addEastDioramaFoliage(root, EAST_DIORAMA_CONFIG.vegetation.density)
    : Promise.resolve();

  return {
    root,
    ready: Promise.all([foliageReady]),
    stats: Object.freeze({
      parkedCars: 0,
      fieldMarkers,
      placeholderCanopies: 62,
      dynamicUpdates: 0
    })
  };
}
