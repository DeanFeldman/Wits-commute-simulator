import * as THREE from "three";
import { addSouthDioramaFoliage } from "./ParkingFoliage.js";

// South is +Z in Level 1. The existing campus road and secondary parking form
// this view's foreground and midground; this root starts beyond them so those
// working systems are not duplicated or covered.
export const SOUTH_DIORAMA_CONFIG = Object.freeze({
  rootOffset: Object.freeze([0, 0, 0]),
  referenceCamera: Object.freeze({
    position: Object.freeze([5.5, 5.1, 28]),
    target: Object.freeze([4, 7.2, 156]),
    fov: 58,
    far: 370,
    yaw: Math.PI
  }),
  sharedRoad: Object.freeze({
    center: Object.freeze([0, 41]),
    width: 185,
    depth: 10
  }),
  roadside: Object.freeze({
    detailZ: 119,
    streetLightHeight: 8.4,
    // The two short central runs leave a full road-width opening for the Yale
    // Road continuation instead of passing through its asphalt surface.
    boundaryWallRuns: Object.freeze([
      Object.freeze([-104.5, -77.5]),
      Object.freeze([-61.5, -44.5]),
      Object.freeze([69.7, 78.5]),
      Object.freeze([83, 101])
    ])
  }),
  centralBuilding: Object.freeze({
    position: Object.freeze([18, 0, 156]),
    scale: Object.freeze([1, 1, 1]),
    size: Object.freeze([46, 23, 28])
  }),
  industrialYard: Object.freeze({
    // A service court behind the deep secondary parking. It remains scenery-
    // only and clear of the continued Yale Road alignment.
    x: 18,
    z: 128,
    width: 60,
    depth: 14,
    rotation: 0
  }),
  rightBuilding: Object.freeze({
    position: Object.freeze([-54, 0, 151]),
    scale: Object.freeze([1, 1, 1]),
    size: Object.freeze([58, 27, 31])
  }),
  leftBuilding: Object.freeze({
    // Sits east of the Yale Road sightline, matching the separated red-roof
    // complex in the aerial reference instead of terminating the road.
    position: Object.freeze([95, 0, 167]),
    scale: Object.freeze([1, 1, 1]),
    size: Object.freeze([42, 13, 27])
  }),
  background: Object.freeze({
    centerZ: 225,
    depth: 34
  }),
  vegetation: Object.freeze({
    density: 0.86,
    clusterCenters: Object.freeze([
      Object.freeze([-92, 126]),
      Object.freeze([-37, 126]),
      Object.freeze([18, 129]),
      Object.freeze([79, 132]),
      Object.freeze([4, 198])
    ])
  }),
  atmosphere: Object.freeze({
    fogStart: 96,
    fogEnd: 235,
    density: 0.82
  }),
  facadeColours: Object.freeze({
    tan: 0xc1875b,
    tanLight: 0xddad79,
    brick: 0xa2654e,
    brickDark: 0x825044,
    coolGrey: 0xabb1af,
    lightGrey: 0xd1d1c8,
    concrete: 0x7b817f,
    window: 0x334e58,
    roof: 0x596568
  })
});

function standardMaterial(color, roughness = 0.9, extras = {}) {
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
  if (placements.length === 0) return null;

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

function northFacadeZ(positionZ, depth) {
  return positionZ - depth / 2 - 0.07;
}

function createWindowGrid({
  centerX,
  facadeZ,
  width,
  floors,
  bays,
  firstFloorY = 3.2,
  floorPitch = 3.55,
  windowHeight = 1.45,
  inset = 3.2
}) {
  const placements = [];
  const usableWidth = width - inset * 2;
  const bayPitch = bays > 1 ? usableWidth / (bays - 1) : 0;
  const windowWidth = Math.min(2.25, bayPitch * 0.62 || usableWidth);

  for (let floor = 0; floor < floors; floor++) {
    for (let bay = 0; bay < bays; bay++) {
      placements.push({
        position: [
          centerX - usableWidth / 2 + bay * bayPitch,
          firstFloorY + floor * floorPitch,
          facadeZ
        ],
        scale: [windowWidth, windowHeight, 0.14]
      });
    }
  }
  return placements;
}

function createRoadsideDetails(root, materials) {
  const group = new THREE.Group();
  group.name = "ForegroundRoadEdge";
  root.add(group);

  const { detailZ, streetLightHeight, boundaryWallRuns } = SOUTH_DIORAMA_CONFIG.roadside;
  const poles = [-88, -47, 52, 91].map((x) => ({
    position: [x, streetLightHeight / 2, detailZ],
    scale: [0.16, streetLightHeight, 0.16]
  }));
  addInstancedBoxes(group, "south-diorama-streetlight-poles", poles, materials.metal);

  const heads = poles.map((pole) => ({
    position: [pole.position[0] + 1.15, streetLightHeight - 0.15, detailZ],
    scale: [2.4, 0.18, 0.46]
  }));
  addInstancedBoxes(group, "south-diorama-streetlight-heads", heads, materials.metal);

  // These short walls sit beyond the existing secondary parking, providing
  // scale and a visual transition without blocking its working access link.
  const walls = boundaryWallRuns.map(([start, end]) => ({
    position: [(start + end) / 2, 0.55, detailZ + 0.4],
    scale: [end - start, 1.1, 0.55]
  }));
  addInstancedBoxes(group, "south-diorama-boundary-walls", walls, materials.paleConcrete);
}

function createCentralBuilding(root, materials) {
  const group = new THREE.Group();
  group.name = "CentralTanBuilding";
  root.add(group);

  const config = SOUTH_DIORAMA_CONFIG.centralBuilding;
  const [x, , z] = config.position;
  const [width, height, depth] = config.size;

  addBox(group, config.size, [x, height / 2, z], materials.tan, {
    name: "south-central-main"
  });
  addBox(group, [11, height + 5, depth - 5], [x - 15.5, (height + 5) / 2, z + 1], materials.tanDark, {
    name: "south-central-stair-tower"
  });
  addBox(group, [12, height - 5, depth + 5], [x + 18, (height - 5) / 2, z + 1], materials.tanLight, {
    name: "south-central-east-wing"
  });
  addBox(group, [width + 1.2, 0.8, depth + 1.2], [x, height + 0.4, z], materials.roof, {
    name: "south-central-roof"
  });
  addBox(group, [9, 2.8, 8], [x - 2, height + 1.8, z + 1], materials.roofDark, {
    name: "south-central-rooftop-plant"
  });

  const windows = createWindowGrid({
    centerX: x + 1,
    facadeZ: northFacadeZ(z, depth),
    width: width - 4,
    floors: 5,
    bays: 10,
    firstFloorY: 3.1,
    floorPitch: 3.65
  }).filter((window) => window.position[0] > x - 10.8);
  addInstancedBoxes(group, "south-central-window-grid", windows, materials.window, {
    receiveShadow: false
  });

  const bands = [5.1, 8.75, 12.4, 16.05, 19.7].map((y) => ({
    position: [x + 3.7, y, northFacadeZ(z, depth) - 0.02],
    scale: [width - 14, 0.28, 0.18]
  }));
  addInstancedBoxes(group, "south-central-facade-bands", bands, materials.tanAccent);

  // Fine vertical ribs make the large front elevation read like the ribbed
  // industrial facade in the aerial reference. One instanced draw call keeps
  // the additional silhouette detail inexpensive.
  const facadeFins = Array.from({ length: 9 }, (_, index) => ({
    position: [x - 9 + index * 4.8, height / 2, northFacadeZ(z, depth) - 0.13],
    scale: [0.22, height - 1.2, 0.34]
  }));
  addInstancedBoxes(group, "south-central-facade-fins", facadeFins, materials.paleConcrete);

  const roofUnits = Array.from({ length: 6 }, (_, index) => ({
    position: [x - 13 + (index % 3) * 13, height + 1.05, z - 6 + Math.floor(index / 3) * 12],
    scale: [4.2, 1.3, 3.1]
  }));
  addInstancedBoxes(group, "south-central-rooftop-units", roofUnits, materials.lightGrey);

  // The tall service stack is a low-cost landmark visible above the roofline.
  addBox(group, [2.2, 34, 2.2], [x + 19, 17, z + 17], materials.lightGrey, {
    name: "south-central-service-stack",
    receiveShadow: false
  });
  addBox(group, [3, 1.1, 3], [x + 19, 34.4, z + 17], materials.metal, {
    name: "south-central-service-stack-cap",
    receiveShadow: false
  });
}

function createIndustrialYard(root, materials) {
  const group = new THREE.Group();
  group.name = "SouthIndustrialServiceYard";
  root.add(group);

  const yard = SOUTH_DIORAMA_CONFIG.industrialYard;
  addBox(group, [yard.width, 0.1, yard.depth], [yard.x, 0.025, yard.z], materials.asphalt, {
    name: "south-industrial-service-yard"
  });

  const bayXs = [-8, 0, 8, 16, 24, 32, 40];
  const bayLines = bayXs.map((x) => ({
    position: [x, 0.087, yard.z],
    scale: [0.075, 0.018, yard.depth - 1]
  }));
  bayLines.push({
    position: [yard.x, 0.088, yard.z + yard.depth / 2 - 0.5],
    scale: [yard.width - 1, 0.018, 0.075]
  });
  addInstancedBoxes(group, "south-industrial-yard-bay-lines", bayLines, materials.paint, {
    receiveShadow: false
  });

  // Four simple service vans provide scale without loading another vehicle
  // asset. Their bodies and dark window/roof bands use two instanced batches.
  const vanXs = [-4, 12, 28, 36];
  addInstancedBoxes(
    group,
    "south-industrial-service-vans",
    vanXs.map((x) => ({ position: [x, 0.72, yard.z], scale: [2.15, 1.35, 4.7] })),
    materials.serviceVehicle
  );
  addInstancedBoxes(
    group,
    "south-industrial-service-van-windows",
    vanXs.map((x) => ({ position: [x, 1.55, yard.z - 0.35], scale: [1.85, 0.55, 2.45] })),
    materials.glass,
    { receiveShadow: false }
  );

  const building = SOUTH_DIORAMA_CONFIG.centralBuilding;
  const [buildingX, , buildingZ] = building.position;
  const [, , buildingDepth] = building.size;
  const facadeZ = northFacadeZ(buildingZ, buildingDepth);
  addBox(group, [34, 0.34, 3.4], [buildingX + 7, 4.6, facadeZ - 1.5], materials.roofDark, {
    name: "south-industrial-loading-canopy",
    receiveShadow: false
  });
  addInstancedBoxes(
    group,
    "south-industrial-loading-canopy-posts",
    [buildingX - 9, buildingX + 1, buildingX + 11, buildingX + 21].map((x) => ({
      position: [x, 2.25, facadeZ - 2.8],
      scale: [0.18, 4.5, 0.18]
    })),
    materials.metal
  );
  addInstancedBoxes(
    group,
    "south-industrial-loading-doors",
    [buildingX + 1, buildingX + 9, buildingX + 17, buildingX + 25].map((x) => ({
      position: [x, 2.35, facadeZ - 0.1],
      scale: [4.6, 4.5, 0.18]
    })),
    materials.loadingDoor
  );
}

function createRightBuilding(root, materials) {
  const group = new THREE.Group();
  group.name = "RightGreyBuilding";
  root.add(group);

  const config = SOUTH_DIORAMA_CONFIG.rightBuilding;
  const [x, , z] = config.position;
  const [width, height, depth] = config.size;

  addBox(group, config.size, [x, height / 2, z], materials.coolGrey, {
    name: "south-right-main"
  });
  addBox(group, [19, height + 8, 23], [x + 19, (height + 8) / 2, z + 3], materials.lightGrey, {
    name: "south-right-tower"
  });
  addBox(group, [21, height - 8, depth + 4], [x - 22, (height - 8) / 2, z + 2], materials.concrete, {
    name: "south-right-west-wing"
  });
  addBox(group, [width + 2, 1.1, depth + 2], [x, height + 0.55, z], materials.roof, {
    name: "south-right-roof"
  });
  addBox(group, [16, 3.5, 13], [x + 18, height + 9.75, z + 4], materials.glass, {
    name: "south-right-rooftop-volume",
    receiveShadow: false
  });

  const bands = [4.1, 8.2, 12.3, 16.4, 20.5].map((y) => ({
    position: [x - 1, y, northFacadeZ(z, depth)],
    scale: [width - 10, 1.25, 0.16]
  }));
  addInstancedBoxes(group, "south-right-window-bands", bands, materials.glass, {
    receiveShadow: false
  });

  const fins = Array.from({ length: 11 }, (_, index) => ({
    position: [x - width / 2 + 5 + index * 4.8, height / 2, northFacadeZ(z, depth) - 0.12],
    scale: [0.28, height - 2.2, 0.38]
  }));
  addInstancedBoxes(group, "south-right-facade-fins", fins, materials.paleConcrete);
}

function createLeftBuilding(root, materials) {
  const group = new THREE.Group();
  group.name = "LeftLowBuilding";
  root.add(group);

  const config = SOUTH_DIORAMA_CONFIG.leftBuilding;
  const [x, , z] = config.position;
  const [width, height, depth] = config.size;

  addBox(group, config.size, [x, height / 2, z], materials.brick, {
    name: "south-left-main"
  });
  addBox(group, [21, height + 4, 18], [x - 13, (height + 4) / 2, z + 2], materials.brickDark, {
    name: "south-left-rear-block"
  });
  addBox(group, [17, height - 3, depth + 5], [x + 19, (height - 3) / 2, z + 2], materials.tanDark, {
    name: "south-left-east-annex"
  });
  addBox(group, [width + 1, 0.65, depth + 1], [x, height + 0.33, z], materials.roofDark, {
    name: "south-left-roof"
  });

  const windows = createWindowGrid({
    centerX: x + 1,
    facadeZ: northFacadeZ(z, depth),
    width: width,
    floors: 3,
    bays: 8,
    firstFloorY: 3,
    floorPitch: 3.5,
    windowHeight: 1.3
  });
  addInstancedBoxes(group, "south-left-window-grid", windows, materials.window, {
    receiveShadow: false
  });
}

function createBackground(root, materials) {
  const group = new THREE.Group();
  group.name = "SecondaryBackgroundBuildings";
  root.add(group);

  const baseZ = SOUTH_DIORAMA_CONFIG.background.centerZ;
  const placements = Array.from({ length: 12 }, (_, index) => {
    const width = 12 + seededValue(index, 700) * 13;
    const height = 8 + seededValue(index, 701) * 16;
    const depth = 11 + seededValue(index, 702) * 12;
    return {
      position: [
        -112 + index * 20.5,
        height / 2,
        baseZ + (seededValue(index, 703) - 0.5) * 24
      ],
      scale: [width, height, depth]
    };
  });
  addInstancedBoxes(group, "south-background-building-masses", placements, materials.background, {
    receiveShadow: false
  });

  const roofPlacements = placements.map((item) => ({
    position: [item.position[0], item.scale[1] + 0.35, item.position[2]],
    scale: [item.scale[0] + 0.7, 0.7, item.scale[2] + 0.7]
  }));
  addInstancedBoxes(group, "south-background-roofs", roofPlacements, materials.roofDark, {
    receiveShadow: false
  });
}

function createDebugHelpers(root) {
  const debug = new THREE.Group();
  debug.name = "SouthDioramaDebugHelpers";
  debug.visible = false;

  const road = SOUTH_DIORAMA_CONFIG.sharedRoad;
  const roadLineMaterial = new THREE.LineBasicMaterial({ color: 0x35e0d1 });
  const roadBounds = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(road.center[0] - road.width / 2, 0.28, road.center[1] - road.depth / 2),
    new THREE.Vector3(road.center[0] + road.width / 2, 0.28, road.center[1] - road.depth / 2),
    new THREE.Vector3(road.center[0] + road.width / 2, 0.28, road.center[1] + road.depth / 2),
    new THREE.Vector3(road.center[0] - road.width / 2, 0.28, road.center[1] + road.depth / 2),
    new THREE.Vector3(road.center[0] - road.width / 2, 0.28, road.center[1] - road.depth / 2)
  ]);
  debug.add(new THREE.Line(roadBounds, roadLineMaterial));

  const markerGeometry = new THREE.SphereGeometry(0.42, 8, 6);
  const cameraMarker = new THREE.Mesh(
    markerGeometry,
    new THREE.MeshBasicMaterial({ color: 0xffcc33 })
  );
  cameraMarker.position.set(...SOUTH_DIORAMA_CONFIG.referenceCamera.position);
  cameraMarker.name = "south-reference-camera-anchor";
  debug.add(cameraMarker);

  const buildingMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0xff6b6b });
  for (const config of [
    SOUTH_DIORAMA_CONFIG.leftBuilding,
    SOUTH_DIORAMA_CONFIG.centralBuilding,
    SOUTH_DIORAMA_CONFIG.rightBuilding
  ]) {
    const marker = new THREE.Mesh(markerGeometry, buildingMarkerMaterial);
    marker.position.set(...config.position);
    marker.position.y = 0.55;
    debug.add(marker);
  }

  const treeMarkerMaterial = new THREE.MeshBasicMaterial({ color: 0x6bea72 });
  for (const [x, z] of SOUTH_DIORAMA_CONFIG.vegetation.clusterCenters) {
    const marker = new THREE.Mesh(markerGeometry, treeMarkerMaterial);
    marker.position.set(x, 0.55, z);
    debug.add(marker);
  }

  root.add(debug);
}

function countStaticDrawCalls(root) {
  let count = 0;
  root.traverse((object) => {
    if (object.isMesh || object.isInstancedMesh) count++;
  });
  return count;
}

export function createSouthDiorama({ loadAssets = true, roadSegments = [] } = {}) {
  const root = new THREE.Group();
  root.name = "SouthDiorama";
  root.position.set(...SOUTH_DIORAMA_CONFIG.rootOffset);

  const colours = SOUTH_DIORAMA_CONFIG.facadeColours;
  const materials = {
    tan: standardMaterial(colours.tan, 0.91, {
      emissive: 0x6a3d26,
      emissiveIntensity: 0.28
    }),
    tanLight: standardMaterial(colours.tanLight, 0.88, {
      emissive: 0x6b452b,
      emissiveIntensity: 0.24
    }),
    tanDark: standardMaterial(0xa96949, 0.92, {
      emissive: 0x482419,
      emissiveIntensity: 0.24
    }),
    tanAccent: standardMaterial(0xe1b184, 0.86, {
      emissive: 0x5a3823,
      emissiveIntensity: 0.2
    }),
    brick: standardMaterial(colours.brick, 0.92, {
      emissive: 0x482219,
      emissiveIntensity: 0.2
    }),
    brickDark: standardMaterial(colours.brickDark, 0.94, {
      emissive: 0x341814,
      emissiveIntensity: 0.2
    }),
    coolGrey: standardMaterial(colours.coolGrey, 0.9, {
      emissive: 0x303535,
      emissiveIntensity: 0.12
    }),
    lightGrey: standardMaterial(colours.lightGrey, 0.86, {
      emissive: 0x393a37,
      emissiveIntensity: 0.1
    }),
    concrete: standardMaterial(colours.concrete, 0.94),
    paleConcrete: standardMaterial(0xbcb8ae, 0.9),
    roof: standardMaterial(colours.roof, 0.72, { metalness: 0.14 }),
    roofDark: standardMaterial(0x4d5557, 0.76, { metalness: 0.1 }),
    window: new THREE.MeshBasicMaterial({ color: colours.window }),
    glass: standardMaterial(0x49636b, 0.42, { metalness: 0.18 }),
    metal: standardMaterial(0x3b4447, 0.6, { metalness: 0.48 }),
    asphalt: standardMaterial(0x343738, 0.97),
    paint: new THREE.MeshBasicMaterial({ color: 0xd8d4c3 }),
    serviceVehicle: standardMaterial(0xd4d6d1, 0.66, { metalness: 0.1 }),
    loadingDoor: standardMaterial(0x44555b, 0.74, { metalness: 0.16 }),
    background: new THREE.MeshBasicMaterial({ color: 0x7f817b })
  };

  createRoadsideDetails(root, materials);
  createIndustrialYard(root, materials);

  const buildings = new THREE.Group();
  buildings.name = "Buildings";
  root.add(buildings);
  createLeftBuilding(buildings, materials);
  createCentralBuilding(buildings, materials);
  createRightBuilding(buildings, materials);
  createBackground(root, materials);

  const vegetation = new THREE.Group();
  vegetation.name = "Vegetation";
  root.add(vegetation);

  if (import.meta.env?.DEV) createDebugHelpers(root);

  const staticDrawCalls = countStaticDrawCalls(root);
  const foliageClearSegments = [...roadSegments, SOUTH_DIORAMA_CONFIG.industrialYard];
  const foliageReady = loadAssets
    ? addSouthDioramaFoliage(
      vegetation,
      SOUTH_DIORAMA_CONFIG.vegetation.density,
      foliageClearSegments
    )
    : Promise.resolve();

  return {
    root,
    ready: Promise.all([foliageReady]),
    stats: Object.freeze({
      buildingMasses: 16,
      instancedWindowPanels: 79,
      industrialDetailDrawCalls: 11,
      staticDrawCallsBeforeFoliage: staticDrawCalls,
      dynamicUpdates: 0,
      reusesExistingRoad: true,
      reusesExistingSecondaryParking: true
    })
  };
}
