import * as THREE from "three";
import { createAmicDeckMaterial } from "../crossing/CrossingStrip.js";
import { createAmicFenceSection } from "../../shared/AmicFence.js";
import { createInstancedCarField } from "../../shared/InstancedCarField.js";
import { applyRoadUvs } from "../../shaders/asphaltShader.js";
import {
  PARKING_BAY_LENGTH,
  PARKING_BAY_WIDTH,
  PARKING_SLOT_PITCH,
  createParkingBayMarkings
} from "../../shared/parking/ParkingLotStyle.js";
import {
  attachVehicleModel,
  createSeededRandom,
  PARKING_CAR_SPECS,
  pickRandomParkingCar
} from "../../shared/VehicleModelLibrary.js";
import { createNorthDiorama } from "./NorthDiorama.js";
import { createEastDiorama } from "./EastDiorama.js";
import { createSouthDiorama } from "./SouthDiorama.js";
import { createWestDiorama } from "./WestDiorama.js";

export const LEVEL_ONE_M1_TRAFFIC_CAR_SPECS = Object.freeze(
  PARKING_CAR_SPECS.filter((spec) => spec.id !== "pack-coupe")
);

export function getLevelOneM1TrafficRotation(direction) {
  return direction > 0 ? -Math.PI / 2 : Math.PI / 2;
}

export const PARKING_LAYOUT = Object.freeze({
  groundY: 0,
  // The south diorama reaches well beyond the original 150 m terrain edge.
  // Keep enough grass behind its rear buildings that the sky camera never
  // exposes the renderer clear colour before the scenery ends.
  terrain: { edge: 300, width: 420 },
  // Broad, slightly tapered footprint matching the aerial shape of the Wits
  // parking area between the ARM building, M1 and Yale Road.
  mainLot: {
    x: 0,
    z: -8,
    width: 122,
    depth: 84,
    outline: Object.freeze([
      Object.freeze([-55, -50]),
      Object.freeze([59, -38]),
      Object.freeze([54, 34]),
      Object.freeze([-61, 34]),
      Object.freeze([-61, -33]),
      Object.freeze([-56, -33]),
      Object.freeze([-56, -42]),
      Object.freeze([-61, -42]),
      Object.freeze([-61, -50])
    ])
  },

  // Wider road so it runs across the whole visible scene and fades into fog.
  campusRoad: { x: 0, z: 41, width: 185, depth: 10 },

  // The M1 runs in a cutting below the parking lot, as it does on the ground:
  // you look over the lot fence, across a verge, and down onto the carriageway.
  // y is the level of the trench floor.
  // The M1 follows the angled north edge of the real parking area and sits
  // immediately beyond its retaining ledge, rather than far out in the field.
  m1: { x: 0, z: -56.5, width: 300, depth: 18, y: -4, rotation: THREE.MathUtils.degToRad(-6) },
  // Yale Road runs diagonally beside the parking area. The resulting green
  // corridor separates its edge from the east parking bays, as in the aerial.
  bridgeRoad: { x: 69, z: -5, width: 11, depth: 150, y: 0.08, rotation: THREE.MathUtils.degToRad(-4) },
  // Continues from the bridge-road endpoint through the south diorama. Keeping
  // this separate preserves the approved bridge and parking-side alignment.
  bridgeRoadExtension: { x: 55.72, z: 184.91, width: 11, depth: 230.74, y: 0.08, rotation: THREE.MathUtils.degToRad(-4) },
  yaleCampusIntersection: { shoulder: 1.25, apronDepth: 14 },

  // Player entrance aligned with the second aisle from the west, and the exit
  // on the third. Their aisles are 16 m apart, so the boundary openings are
  // 12 m wide: any wider and the two gaps meet, leaving no fence between them.
  parkingBoomEntrance: { x: -34.5, z: 35.5, width: 7, boundaryWidth: 12 },
  parkingBoomExit: { x: -18.5, z: 35.5, width: 7, boundaryWidth: 12 },

  // Duplicate the entrance position for the opposite parking.
  otherEntrance: { x: 8, z: 46.5, width: 9 },

  // Scenery-only parking beyond the campus road. The real Entrance 9 view has
  // a long, tree-lined parking garden between the playable lot and the campus
  // buildings, rather than a shallow pair of rows pressed against a facade.
  otherParking: {
    x: 10,
    z: 82,
    width: 78,
    depth: 68,
    rotation: 0,
    stripCenters: Object.freeze([-18, -2, 22, 38])
  },

  armBuilding: { x: -86, z: -7, width: 36, depth: 62, height: 10 },
  armWalkway: { x: -64.5, z: -9.7, width: 7, depth: 88.4 },
  armWalkwayEntrance: { x: -58.5, z: -37.95, width: 5, depth: 8.0 },
  pedestrianBridge: { x: -64.8, z: -63.3, width: 6.4, depth: 23 },

  // Bigger Flower Hall so it fills the left/background scene more strongly.
  // Kept to the west side of the south parking garden and set back with the
  // rest of the campus. Its former close position filled the south camera
  // with a dark wall before the diorama could be seen.
  flowerHall: { x: -82, z: 122, width: 48, depth: 26, height: 10 },

  // Campus checkpoint on the campus street, immediately west of the Yale Road
  // junction. The connecting street stays paved while the north/south strip
  // between Yale Road and the lot remains landscaped.
  // Shifted west to sit at the campus-road approach, before the Yale Road
  // bridge structure, rather than underneath the crossing itself.
  campusGate: { x: 47.5, z: 41 }
});

const COLORS = {
  grass: 0x4f6844,
  asphalt: 0x2f343a,
  m1: 0x242a30,
  concrete: 0xa7aaa5,
  kerb: 0xbfc0b8,
  metal: 0x59636c,
  brick: 0x86513d,
  darkBrick: 0x704233,
  window: 0xf0b56b,
  paint: 0xe2ddae,
  white: 0xe9e7dc,
  witsBlue: 0x245987
};

const GRASS_TEXTURES = Object.freeze({
  albedo: "./assets/textures/ground/stylized-grass-albedo.png",
  normal: "./assets/textures/ground/stylized-grass-normal.png",
  roughness: "./assets/textures/ground/stylized-grass-roughness.png",
  ao: "./assets/textures/ground/stylized-grass-ao.png"
});

let parkingGrassMaterial = null;

function material(color, roughness = 0.9, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extras });
}

function loadGrassTexture(path, { color = false } = {}) {
  if (typeof document === "undefined") return null;

  const texture = new THREE.TextureLoader().load(path);
  texture.name = path.split("/").at(-1);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  // The same detail density holds across both terrain slabs without needing
  // large source textures. Anisotropy improves the low chase-camera angle.
  texture.repeat.set(30, 30);
  texture.anisotropy = 8;
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  texture.userData.sharedAsset = true;
  return texture;
}

function getParkingGrassMaterial() {
  if (parkingGrassMaterial) return parkingGrassMaterial;

  parkingGrassMaterial = new THREE.MeshStandardMaterial({
    // A half-strength cool-green correction offsets the warm dusk lighting
    // without pushing the dry Highveld albedo into an artificial green.
    color: 0xb7dbad,
    map: loadGrassTexture(GRASS_TEXTURES.albedo, { color: true }),
    normalMap: loadGrassTexture(GRASS_TEXTURES.normal),
    roughnessMap: loadGrassTexture(GRASS_TEXTURES.roughness),
    aoMap: loadGrassTexture(GRASS_TEXTURES.ao),
    emissive: 0x102a0d,
    emissiveIntensity: 0.08,
    roughness: 0.92,
    normalScale: new THREE.Vector2(0.32, 0.32),
    aoMapIntensity: 0.32
  });
  parkingGrassMaterial.name = "parking-stylized-grass-material";
  parkingGrassMaterial.userData.sharedAsset = true;
  return parkingGrassMaterial;
}

function box(root, size, position, mat, { castShadow = false, receiveShadow = true, name = "" } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.name = name;
  root.add(mesh);
  return mesh;
}

function plane(root, width, depth, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function addCollider(collisionWorld, root, position, size, tag, rotationY = 0) {
  const object = new THREE.Object3D();
  object.position.set(...position);
  object.rotation.y = rotationY;
  root.add(object);
  collisionWorld.add({ object, size, tag, color: 0xff6b6b });
  return object;
}


function createFenceRun(root, collisionWorld, {
  x, z, length, axis = "x", tag = "fence", collider = true
}) {
  const metal = material(COLORS.metal, 0.68, { metalness: 0.22 });
  const postSpacing = 3.2;
  const posts = Math.max(2, Math.floor(length / postSpacing) + 1);
  const start = -length / 2;
  for (let i = 0; i < posts; i++) {
    const offset = start + (i / (posts - 1)) * length;
    const px = axis === "x" ? x + offset : x;
    const pz = axis === "z" ? z + offset : z;
    box(root, [0.11, 1.35, 0.11], [px, 0.675, pz], metal, { castShadow: true });
  }
  for (const y of [0.48, 1.05]) {
    box(
      root,
      axis === "x" ? [length, 0.08, 0.08] : [0.08, 0.08, length],
      [x, y, z],
      metal,
      { castShadow: true }
    );
  }
  if (collider) {
    addCollider(
      collisionWorld,
      root,
      [x, 0.7, z],
      axis === "x" ? [length, 1.4, 0.28] : [0.28, 1.4, length],
      tag
    );
  }
}

function createAngledFenceRun(root, collisionWorld, {
  startX, startZ, endX, endZ, tag = "fence"
}) {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  const centerX = (startX + endX) / 2;
  const centerZ = (startZ + endZ) / 2;
  const rotationY = -Math.atan2(dz, dx);
  const metal = material(COLORS.metal, 0.66, { metalness: 0.28 });

  box(root, [length, 0.34, 0.42], [centerX, 0.17, centerZ], material(0x747a7c, 0.82)).rotation.y = rotationY;
  for (const y of [0.68, 1.08]) {
    const rail = box(root, [length, 0.09, 0.09], [centerX, y, centerZ], metal, { castShadow: true });
    rail.rotation.y = rotationY;
  }

  const postCount = Math.max(2, Math.floor(length / 3.4) + 1);
  for (let index = 0; index < postCount; index++) {
    const progress = index / (postCount - 1);
    box(root, [0.11, 1.25, 0.11], [
      THREE.MathUtils.lerp(startX, endX, progress),
      0.63,
      THREE.MathUtils.lerp(startZ, endZ, progress)
    ], metal, { castShadow: true });
  }

  addCollider(
    collisionWorld,
    root,
    [centerX, 0.65, centerZ],
    [length, 1.3, 0.7],
    tag,
    rotationY
  );
}

function createSeparatedGround(root) {
  const grass = getParkingGrassMaterial();
  const { m1, terrain: terrainConfig } = PARKING_LAYOUT;

  // The dev sky camera can zoom far beyond the playable lot. Keep the terrain
  // broad enough that it never reveals the clear colour at the map edges.
  const terrainEdge = terrainConfig.edge;
  const terrainWidth = terrainConfig.width;
  const halfRoadDepth = m1.depth / 2;
  const cos = Math.cos(m1.rotation);
  const sin = Math.sin(m1.rotation);

  // Build terrain in the motorway's rotated coordinate frame. Its inner edges
  // now run parallel to the M1 instead of remaining as two horizontal slabs.
  for (const [localStart, localEnd] of [
    [halfRoadDepth, terrainEdge],
    [-terrainEdge, -halfRoadDepth]
  ]) {
    const localCentreZ = (localStart + localEnd) / 2;
    const terrain = box(root, [terrainWidth, 0.14, localEnd - localStart], [
      m1.x + sin * localCentreZ,
      -0.31,
      m1.z + cos * localCentreZ
    ], grass);
    terrain.rotation.y = m1.rotation;
    // Three.js reads the AO map from uv2. The box's existing UV layout remains
    // in use for the albedo, normal, and roughness maps.
    terrain.geometry.setAttribute("uv2", terrain.geometry.attributes.uv.clone());
  }

  // This lies below the carriageway, filling the cutting itself without
  // covering the lowered M1 surface or exposing a blue void at either side.
  const cuttingFloor = box(root, [terrainWidth, 0.1, m1.depth + 8], [0, m1.y - 0.42, m1.z], material(0x253023, 0.96));
  cuttingFloor.rotation.y = m1.rotation;
}

function createNorthM1Ledge(root) {
  const { mainLot, m1 } = PARKING_LAYOUT;
  const [northWest, northEast] = mainLot.outline;
  const southLipZAt = (x) => {
    const localZ = m1.depth / 2;
    const localX = (x - m1.x - Math.sin(m1.rotation) * localZ) / Math.cos(m1.rotation);
    return m1.z - Math.sin(m1.rotation) * localX + Math.cos(m1.rotation) * localZ;
  };

  // The real north edge is a retaining ledge directly above the M1. Cover the
  // old grass wedge with a concrete apron that follows the angled parking
  // boundary, then put the vertical retaining face on that boundary.
  const apronGeometry = new THREE.BufferGeometry();
  apronGeometry.setAttribute("position", new THREE.Float32BufferAttribute([
    northWest[0], 0.025, northWest[1],
    northEast[0], 0.025, northEast[1],
    northEast[0], 0.025, southLipZAt(northEast[0]),
    northWest[0], 0.025, southLipZAt(northWest[0])
  ], 3));
  apronGeometry.setIndex([0, 1, 2, 0, 2, 3]);
  apronGeometry.computeVertexNormals();
  const apron = new THREE.Mesh(
    apronGeometry,
    material(0x6f7672, 0.9, { metalness: 0.04 })
  );
  apron.name = "m1-north-retaining-apron";
  apron.receiveShadow = true;
  root.add(apron);

  const dx = northEast[0] - northWest[0];
  const dz = northEast[1] - northWest[1];
  const length = Math.hypot(dx, dz);
  const wallHeight = Math.abs(m1.y) + 0.25;
  const ledgeWall = box(
    root,
    [length, wallHeight, 0.72],
    [(northWest[0] + northEast[0]) / 2, m1.y + wallHeight / 2, (northWest[1] + northEast[1]) / 2],
    material(0x81878a, 0.88),
    { castShadow: true, name: "m1-north-retaining-wall" }
  );
  ledgeWall.rotation.y = -Math.atan2(dz, dx);
}
function createBackdropWall(root) {
  const wallMat = material(0x6f766f, 0.92);
  const baseMat = material(0x555b56, 0.9);

  // Low base
  box(root, [90, 1.2, 1.4], [18, 0.6, 53], baseMat, {
    castShadow: true
  });

  // Main wall
  box(root, [90, 8, 1], [18, 4.6, 54], wallMat, {
    castShadow: true
  });
}

// Every break in the lot boundary: the entrance and the exit are identical
// apart from where they sit.
const LOT_OPENINGS = [PARKING_LAYOUT.parkingBoomEntrance, PARKING_LAYOUT.parkingBoomExit];

// Spans of the parking-side kerb line, skipping each entrance opening so the
// street surface runs uninterrupted into the lot.
function kerbRunsBetweenEntrances(left, right, extraOpenings = [], includeLotOpenings = true) {
  const openings = [
    ...(includeLotOpenings ? LOT_OPENINGS : [])
    .map((entrance) => {
      // Only the driving surface breaks the kerb. The raised shoulders either
      // side of the throat are themselves kerb, so the run passes under them
      // and no gap opens between the two.
      const width = entrance.width + 0.4;
      return { left: entrance.x - width / 2, right: entrance.x + width / 2 };
    }),
    ...extraOpenings
  ]
    .sort((a, b) => a.left - b.left);

  const runs = [];
  let start = left;
  for (const opening of openings) {
    if (opening.left > start) runs.push([start, Math.min(opening.left, right)]);
    start = Math.max(start, opening.right);
  }
  if (start < right) runs.push([start, right]);
  return runs;
}

function createCampusRoad(root, collisionWorld, roadMaterial) {
  const {
    campusRoad,
    bridgeRoad,
    bridgeRoadExtension,
    yaleCampusIntersection
  } = PARKING_LAYOUT;
  // The streets share the parking lot's asphalt maps, so the whole level reads
  // as one surface. Falls back to flat colour if no texture set was supplied.
  const asphalt = roadMaterial ?? material(COLORS.asphalt, 0.93);

  // Main road between the two parking areas.
  const mainRoad = box(
    root,
    [campusRoad.width, 0.12, campusRoad.depth],
    [campusRoad.x, 0.0, campusRoad.z],
    asphalt
  );
  applyRoadUvs(mainRoad.geometry, campusRoad.width, campusRoad.depth);

  // Kerbs + pavements along the main road. On the parking side they have to
  // break at every entrance, otherwise a raised kerb and a pavement run
  // straight across the driving surface and the street stops connecting to
  // the lot.
  const kerbMaterial = material(COLORS.kerb, 0.82);
  const pavementMaterial = material(COLORS.concrete, 0.9);
  const halfWidth = campusRoad.width / 2;

  for (const side of [-1, 1]) {
    const kerbZ = campusRoad.z + side * (campusRoad.depth / 2 + 0.24);
    const pavementZ = campusRoad.z + side * (campusRoad.depth / 2 + 1.28);
    const yaleCentreX = bridgeRoad.x
      + Math.tan(bridgeRoad.rotation) * (pavementZ - bridgeRoad.z);
    const yaleOpeningWidth = bridgeRoad.width / Math.cos(bridgeRoad.rotation)
      + yaleCampusIntersection.shoulder * 2;
    const yaleOpening = {
      left: yaleCentreX - yaleOpeningWidth / 2,
      right: yaleCentreX + yaleOpeningWidth / 2
    };
    const runs = kerbRunsBetweenEntrances(
      campusRoad.x - halfWidth,
      campusRoad.x + halfWidth,
      [yaleOpening],
      side < 0
    );

    for (const [start, end] of runs) {
      const length = end - start;
      if (length <= 0.2) continue;
      const centre = start + length / 2;
      box(
        root,
        [length, 0.16, 0.42],
        [centre, 0.08, kerbZ],
        kerbMaterial,
        { name: "campus-road-kerb" }
      );
      addCollider(
        collisionWorld,
        root,
        [centre, 0.22, kerbZ],
        [length, 0.5, 0.6],
        "campus-road-kerb"
      );
      box(root, [length, 0.08, 1.7], [centre, 0.06, pavementZ], pavementMaterial);
    }
  }

  // Right-side road running toward / over the M1.
  const bridge = box(
    root,
    [
      bridgeRoad.width,
      0.18,
      bridgeRoad.depth
    ],
    [
      bridgeRoad.x,
      bridgeRoad.y,
      bridgeRoad.z
    ],
    asphalt
  );
  applyRoadUvs(bridge.geometry, bridgeRoad.width, bridgeRoad.depth);
  bridge.rotation.y = bridgeRoad.rotation;

  const bridgeExtension = box(
    root,
    [bridgeRoadExtension.width, 0.18, bridgeRoadExtension.depth],
    [bridgeRoadExtension.x, bridgeRoadExtension.y, bridgeRoadExtension.z],
    asphalt,
    { name: "yale-road-south-extension" }
  );
  applyRoadUvs(
    bridgeExtension.geometry,
    bridgeRoadExtension.width,
    bridgeRoadExtension.depth
  );
  bridgeExtension.rotation.y = bridgeRoadExtension.rotation;

  // A broad, level asphalt apron unifies the crossing. The adjoining kerbs
  // and pavements stop at its shoulders instead of continuing beneath Yale
  // Road, so this reads as a junction rather than one mesh cutting another.
  const intersectionX = bridgeRoad.x
    + Math.tan(bridgeRoad.rotation) * (campusRoad.z - bridgeRoad.z);
  const intersectionWidth = bridgeRoad.width / Math.cos(bridgeRoad.rotation)
    + yaleCampusIntersection.shoulder * 2;
  const intersection = box(
    root,
    [intersectionWidth, 0.18, yaleCampusIntersection.apronDepth],
    [intersectionX, bridgeRoad.y, campusRoad.z],
    asphalt,
    { name: "yale-campus-intersection" }
  );
  applyRoadUvs(
    intersection.geometry,
    intersectionWidth,
    yaleCampusIntersection.apronDepth
  );

}

function createM1(root, roadMaterial) {
  const { m1, bridgeRoad, pedestrianBridge } = PARKING_LAYOUT;
  const highwayMat = roadMaterial ?? material(COLORS.m1, 0.88);
  const highway = box(root, [m1.width, 0.14, m1.depth], [m1.x, m1.y, m1.z], highwayMat);
  applyRoadUvs(highway.geometry, m1.width, m1.depth);
  highway.rotation.y = m1.rotation;

  const laneZ = [-5.2, -1.75, 1.75, 5.2].map((offset) => m1.z + offset);

  // Retaining walls hold the ground up on either side of the cutting. They run
  // from the trench floor to the lip, so the face of the wall is what you see
  // when you look over the edge from the lot.
  const wallMat = material(0x8f9498, 0.86);
  const wallThickness = 0.7;
  const wallHeight = Math.abs(m1.y) + 0.2;
  const lips = [m1.depth / 2 + wallThickness / 2, -m1.depth / 2 - wallThickness / 2];
  const m1Cos = Math.cos(m1.rotation);
  const m1Sin = Math.sin(m1.rotation);

  // Find the actual crossing of the two diagonal centre lines. The previous
  // bridge was centred at M1's world Z, which left its rails visibly offset.
  const m1Direction = new THREE.Vector2(m1Cos, -m1Sin);
  const yaleDirection = new THREE.Vector2(Math.sin(bridgeRoad.rotation), Math.cos(bridgeRoad.rotation));
  const betweenRoadOrigins = new THREE.Vector2(bridgeRoad.x - m1.x, bridgeRoad.z - m1.z);
  const determinant = m1Direction.x * yaleDirection.y - m1Direction.y * yaleDirection.x;
  const yaleM1LocalX = Math.abs(determinant) > 0.0001
    ? (betweenRoadOrigins.x * yaleDirection.y - betweenRoadOrigins.y * yaleDirection.x) / determinant
    : 0;
  const yaleBridgeCentre = new THREE.Vector3(
    m1.x + m1Direction.x * yaleM1LocalX,
    0,
    m1.z + m1Direction.y * yaleM1LocalX
  );
  const pedestrianM1LocalX = m1Cos * (pedestrianBridge.x - m1.x) - m1Sin * (pedestrianBridge.z - m1.z);
  const bridgeOpenings = [
    { centre: pedestrianM1LocalX, width: pedestrianBridge.width + 0.8 },
    { centre: yaleM1LocalX, width: bridgeRoad.width + 1.4 }
  ].sort((a, b) => a.centre - b.centre);

  for (const localZ of lips) {
    let runStart = -m1.width / 2;
    for (const opening of bridgeOpenings) {
      const runEnd = opening.centre - opening.width / 2;
      if (runEnd > runStart) {
        const centre = (runStart + runEnd) / 2;
        const retainingWall = box(root, [runEnd - runStart, wallHeight, wallThickness], [
          m1.x + m1Cos * centre + m1Sin * localZ,
          m1.y + wallHeight / 2,
          m1.z - m1Sin * centre + m1Cos * localZ
        ], wallMat, { castShadow: true });
        retainingWall.rotation.y = m1.rotation;
      }
      runStart = opening.centre + opening.width / 2;
    }
    if (runStart < m1.width / 2) {
      const centre = (runStart + m1.width / 2) / 2;
      const retainingWall = box(root, [m1.width / 2 - runStart, wallHeight, wallThickness], [
        m1.x + m1Cos * centre + m1Sin * localZ,
        m1.y + wallHeight / 2,
        m1.z - m1Sin * centre + m1Cos * localZ
      ], wallMat, { castShadow: true });
      retainingWall.rotation.y = m1.rotation;
    }
  }

  // The wall openings above are needed so the bridge decks do not intersect
  // the full-height retaining walls. Fill each opening only up to the deck
  // underside: this keeps the M1 cutting enclosed and removes the sky-colour
  // holes visible beneath both Level 1 bridges.
  const abutments=[
    {centre:pedestrianM1LocalX,width:pedestrianBridge.width+0.8,top:-0.03,name:"pedestrian"},
    {centre:yaleM1LocalX,width:bridgeRoad.width+1.4,top:-0.86,name:"yale"}
  ];
  for(const localZ of lips) for(const a of abutments){
    const height=Math.max(0.1,a.top-m1.y),panel=box(root,[a.width,height,wallThickness],[
      m1.x+m1Cos*a.centre+m1Sin*localZ,
      m1.y+height/2,
      m1.z-m1Sin*a.centre+m1Cos*localZ
    ],wallMat,{castShadow:true,name:`m1-${a.name}-bridge-abutment`});
    panel.rotation.y=m1.rotation;
  }

  // The right-hand road crosses the cutting, so it needs a deck under it and
  // rails along it rather than simply floating over the gap.
  // Yale Road meets the M1 at a slight angle, so its deck needs extra length
  // to clear both retaining walls instead of stopping inside the cutting.
  const bridgeSpan = m1.depth + wallThickness * 2 + 7;
  const bridgeDeck = box(
    root,
    [bridgeRoad.width + 1.2, 0.85, bridgeSpan],
    [yaleBridgeCentre.x, -0.4, yaleBridgeCentre.z],
    material(0x7d8285, 0.88),
    { castShadow: true }
  );
  bridgeDeck.rotation.y = bridgeRoad.rotation;
  for (const offsetX of [-bridgeRoad.width / 2 + 0.28, bridgeRoad.width / 2 - 0.28]) {
    const rail = box(
      root,
      [0.14, 0.86, bridgeSpan],
      [
        yaleBridgeCentre.x + Math.cos(bridgeRoad.rotation) * offsetX,
        0.54,
        yaleBridgeCentre.z - Math.sin(bridgeRoad.rotation) * offsetX
      ],
      material(COLORS.metal, 0.66, { metalness: 0.28 }),
      { castShadow: true }
    );
    rail.rotation.y = bridgeRoad.rotation;
  }

  return { laneZ };
}

function createM1Traffic(root, laneZ) {
  const { m1 } = PARKING_LAYOUT;
  const cos = Math.cos(m1.rotation);
  const sin = Math.sin(m1.rotation);
  const setTrafficPosition = (holder, localX, localZ) => {
    holder.position.set(
      m1.x + cos * localX + sin * localZ,
      m1.y + 0.08,
      m1.z - sin * localX + cos * localZ
    );
  };
  const random = createSeededRandom(30061);
  const count = 16;
  const traffic = [];

  for (let index = 0; index < count; index++) {
    const lane = index % 4;
    const direction = lane < 2 ? 1 : -1;

    const holder = new THREE.Group();

    const localX = -68 + ((index * 14.5) % 136);
    setTrafficPosition(holder, localX, laneZ[lane]);

// Match the visual forward convention used by the corrected Level 2
    // traffic, then align it to the M1's angled local X axis.
    holder.rotation.y = getLevelOneM1TrafficRotation(direction) + m1.rotation;

    root.add(holder);

    const spec =
      LEVEL_ONE_M1_TRAFFIC_CAR_SPECS[
        Math.floor(random() * LEVEL_ONE_M1_TRAFFIC_CAR_SPECS.length)
      ] ?? LEVEL_ONE_M1_TRAFFIC_CAR_SPECS[0];

    // The coupe asset is excluded from moving traffic because its authored
    // front faces backwards after normalization. Parked-car pools keep it.
    // Lite variant is intended for M1/background traffic.
    attachVehicleModel(
      holder,
      spec,
      "lite"
    ).catch((error) => {
      console.warn(
        `Unable to load M1 car ${spec.id}`,
        error
      );
    });

    traffic.push({
      holder,
      direction,
      localX,
      laneZ: laneZ[lane],
      speed:
        10.5 +
        lane * 1.25 +
        (index % 3) * 0.65
    });
  }

  const update = (dt) => {
    for (const car of traffic) {
      car.localX += car.direction * car.speed * dt;

      if (car.localX > 74) {
        car.localX = -74;
      }

      if (car.localX < -74) {
        car.localX = 74;
      }
      setTrafficPosition(car.holder, car.localX, car.laneZ);
    }
  };

  return update;
}

function createArmBuilding(root, collisionWorld) {
  const a = PARKING_LAYOUT.armBuilding;
  const brick = material(COLORS.brick, 0.88);
  const concrete = material(0xb1aaa0, 0.9);
  const roof = material(0x89979b, 0.76, { metalness: 0.12 });

  // Interlocking masses and the circular ARM roof are the dominant landmark
  // in the supplied aerial reference.
  box(root, [a.width, a.height, a.depth], [a.x, a.height / 2, a.z], brick, { castShadow: true, name: "wits-arm-main" });
  box(root, [a.width - 1, 0.45, a.depth - 1], [a.x, a.height + 0.2, a.z], roof, { castShadow: true });
  box(root, [a.width + 9, a.height - 2, 18], [a.x - 2, (a.height - 2) / 2, a.z - 23], concrete, { castShadow: true });
  box(root, [a.width + 5, 0.55, 20], [a.x - 1, a.height + 0.2, a.z + 20], roof, { castShadow: true });
  box(root, [18, a.height + 3, 24], [a.x + 8, (a.height + 3) / 2, a.z + 18], material(COLORS.darkBrick, 0.88), { castShadow: true });

  const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 4, 32), concrete);
  domeBase.position.set(a.x + 3, a.height + 2, a.z + 2);
  domeBase.castShadow = true;
  root.add(domeBase);
  const domeRoof = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 11.4, 1.1, 32), roof);
  domeRoof.position.set(a.x + 3, a.height + 4.45, a.z + 2);
  domeRoof.castShadow = true;
  root.add(domeRoof);

  box(root, [1.2, 2.1, a.depth - 4], [a.x + a.width / 2 + 0.55, 1.05, a.z], concrete);
  const windows = new THREE.MeshBasicMaterial({ color: COLORS.window });
  for (let z = -19; z <= 19; z += 5.5) {
    for (const y of [2.4, 5.1, 7.5]) {
      box(root, [0.08, 1.15, 2.4], [a.x + a.width / 2 + 0.045, y, z], windows, { receiveShadow: false });
    }
  }
  addCollider(collisionWorld, root, [a.x, a.height / 2, a.z], [a.width, a.height, a.depth], "wits-arm");
  addCollider(collisionWorld, root, [a.x + 3, 4, a.z + 2], [24, 8, 24], "wits-arm-dome");
}

function createArmPedestrianLink(root, collisionWorld) {
  const { armWalkway:w, armWalkwayEntrance:e, pedestrianBridge:b }=PARKING_LAYOUT;
  const base=createAmicDeckMaterial();

  const addPanel=(width,depth,x,z,y=0.09,height=0.08,name="amic-level1-walkway",rotation=0)=>{
    const mat=base.clone();
    if(base.map){mat.map=base.map.clone();mat.map.wrapS=THREE.RepeatWrapping;mat.map.wrapT=THREE.RepeatWrapping;mat.map.repeat.set(width/1.8,depth/1.8);mat.map.offset.set((x-width/2)/1.8,(z-depth/2)/1.8);mat.map.needsUpdate=true;}
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),mat);
    mesh.position.set(x,y-height/2,z);mesh.rotation.y=rotation;mesh.receiveShadow=true;mesh.name=name;root.add(mesh);return mesh;
  };

  // Main ARM walkway.
  addPanel(w.width,w.depth,w.x,w.z,0.09,0.08,"amic-level1-walkway");

  // Fill the open grass apron between the north end of ARM and the bridge.
  const arm=PARKING_LAYOUT.armBuilding;
  const parkingEdge=-61;
  const armWest=arm.x-arm.width/2;
  const armNorth=arm.z-arm.depth/2;
  const walkwayNorth=w.z-w.depth/2;
  const apronWidth=parkingEdge-armWest;
  const apronDepth=armNorth-walkwayNorth;

  addPanel(
    apronWidth,
    apronDepth,
    armWest+apronWidth/2,
    walkwayNorth+apronDepth/2,
    0.09,
    0.08,
    "amic-level1-north-apron"
  );

  // Clearly defined pedestrian entrance from the parking asphalt onto the walkway.
  addPanel(e.width,e.depth,e.x,e.z,0.095,0.07,"amic-level1-walkway-entrance");

  // White entrance edge markings.
  const mark=new THREE.MeshBasicMaterial({color:0xe9e7dc});
  for(const side of [-1,1]){
    box(
      root,
      [e.width,0.025,0.09],
      [e.x,0.105,e.z+side*(e.depth/2-0.045)],
      mark,
      {receiveShadow:false,name:"amic-level1-entrance-marking"}
    );
  }

  // Pedestrian-only entrance: cars stop at the asphalt/brick boundary.
  const entranceBlocker=new THREE.Object3D();
  entranceBlocker.name="amic-level1-entrance-blocker";
  entranceBlocker.position.set(e.x+e.width/2-0.05,0.55,e.z);
  root.add(entranceBlocker);
  collisionWorld.add({
    object:entranceBlocker,
    size:[0.35,1.1,e.depth],
    tag:"walkway-kerb",
    color:0xffaa00
  });

  // Bridge: turn it with the diagonal M1 and let the deck clear the entire
  // trench, not just the original horizontal cut width.
  const bridgeRotation=PARKING_LAYOUT.m1.rotation;
  addPanel(b.width,b.depth,b.x,b.z,0.17,0.34,"amic-level1-bridge-deck",bridgeRotation);

  for(const side of [-1,1]){
    const fence=createAmicFenceSection({
      length:b.depth,
      name:`amic-level1-bridge-${side<0?"left":"right"}-rail`
    });
    const offset=side*(b.width/2-0.2);
    fence.position.set(
      b.x+Math.cos(bridgeRotation)*offset,
      0.17,
      b.z-Math.sin(bridgeRotation)*offset
    );
    fence.rotation.y=bridgeRotation;
    root.add(fence);
  }
}

function createFlowerHall(root) {
  const f = PARKING_LAYOUT.flowerHall;

  const hall = new THREE.Group();
  hall.position.set(f.x, 0, f.z);
  root.add(hall);

  const brick = material(0x955b42, 0.86);
  const darkBrick = material(0x7d4a39, 0.88);
  const concrete = material(0xb0aaa0, 0.9);
  const glass = new THREE.MeshBasicMaterial({ color: 0xdcae6d });

  // Main mass
  box(hall, [f.width, f.height, f.depth], [0, f.height / 2, 0], brick, {
    castShadow: true
  });

  // Taller section so it has a stronger silhouette
  box(hall, [18, f.height + 5, 10], [-8, (f.height + 5) / 2, 0], darkBrick, {
    castShadow: true
  });

  // Long front glazing facing the road
  box(hall, [f.width - 4, 2.2, 0.12], [0, 5.2, -f.depth / 2 - 0.07], glass, {
    receiveShadow: false
  });

  // Front platform / overhang
  box(hall, [14, 0.45, 4], [8, 2.9, -f.depth / 2 - 1.4], concrete, {
    castShadow: true
  });

  // Bigger pavement in front
  box(
    root,
    [f.width + 10, 0.08, 5.0],
    [f.x, 0.05, f.z - f.depth / 2 - 2.2],
    material(COLORS.concrete, 0.9)
  );
}

function createOtherParking(root, roadMaterial) {
  const p=PARKING_LAYOUT.otherParking;
  const asphalt=roadMaterial ?? material(COLORS.asphalt,0.93);

  const surface=box(
    root,
    [p.width,0.1,p.depth],
    [p.x,0.01,p.z],
    asphalt,
    {name:"level-one-secondary-parking"}
  );
  applyRoadUvs(surface.geometry,p.width,p.depth);

  const startZ=p.z-p.depth/2+5;
  const endZ=p.z+p.depth/2-5;
  const count=Math.floor((endZ-startZ)/PARKING_SLOT_PITCH)+1;
  const spaces=[];
  for(const [stripIndex,stripX] of p.stripCenters.entries()){
    for(const [side,x,angle] of [
      ["west",stripX-PARKING_BAY_LENGTH/2,-Math.PI/2],
      ["east",stripX+PARKING_BAY_LENGTH/2,Math.PI/2]
    ]){
      for(let i=0;i<count;i++){
        spaces.push({
          x,
          z:startZ+i*PARKING_SLOT_PITCH,
          angle,
          rowName:`secondary-${stripIndex}-${side}`,
          rowIndex:i
        });
      }
    }
  }

  root.add(...createParkingBayMarkings(spaces,{y:0.075}));

  // Keep a few empty bays so it looks natural rather than perfectly packed.
  const free=new Set(spaces
    .map((_,index)=>index)
    .filter((index)=>index%17===4 || index%29===11));
  const random=createSeededRandom(20260905);
  const placements=[];

  spaces.forEach((space,index)=>{
    if(free.has(index)) return;
    placements.push({
      spec:pickRandomParkingCar(random),
      x:space.x,
      z:space.z,
      angle:space.angle,
      y:0.06
    });
  });

  createInstancedCarField(placements,{variant:"lite"})
    .then(field=>{
      field.name="level-one-secondary-parked-cars";
      root.add(field);
    })
    .catch(error=>console.warn("Secondary parking cars could not be loaded.",error));

  // The wider centre gap is the Entrance 9 approach. A small gate canopy and
  // two rows of low-poly trees sell the real parking-garden depth for only a
  // handful of draw calls; none of this scenery participates in gameplay.
  const canopyMaterial=material(0xd9d8cf,0.82);
  const postMaterial=material(0x636b6a,0.72,{metalness:0.18});
  const entranceZ=p.z-p.depth/2+3.2;
  box(root,[10,0.45,4],[p.x,3.35,entranceZ],canopyMaterial,{name:"secondary-parking-gate-canopy"});
  for(const x of [p.x-4.2,p.x+4.2]){
    box(root,[0.28,3.2,0.28],[x,1.6,entranceZ],postMaterial,{name:"secondary-parking-gate-post"});
  }
  box(root,[3.2,2.5,3.2],[p.x-5.8,1.25,entranceZ+0.8],canopyMaterial,{name:"secondary-parking-gatehouse"});

  const treePlacements=[];
  for(const x of [p.x-5.4,p.x+5.4]){
    for(let z=p.z-p.depth/2+12;z<=p.z+p.depth/2-8;z+=12.5){
      treePlacements.push([x,z]);
    }
  }
  const trunks=new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.28,0.38,3.2,6),
    material(0x5b4029,0.96),
    treePlacements.length
  );
  const crowns=new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(2.5,0),
    material(0x365f35,0.96),
    treePlacements.length
  );
  trunks.name="secondary-parking-tree-trunks";
  crowns.name="secondary-parking-tree-crowns";
  const matrix=new THREE.Matrix4();
  treePlacements.forEach(([x,z],index)=>{
    matrix.makeTranslation(x,1.6,z);
    trunks.setMatrixAt(index,matrix);
    matrix.compose(
      new THREE.Vector3(x,4.5,z),
      new THREE.Quaternion(),
      new THREE.Vector3(1.15,0.92,1.15)
    );
    crowns.setMatrixAt(index,matrix);
  });
  trunks.instanceMatrix.needsUpdate=true;
  crowns.instanceMatrix.needsUpdate=true;
  root.add(trunks,crowns);
}

function createMainParkingBoundary(root, collisionWorld) {
  const lot = PARKING_LAYOUT.mainLot;
  const front = 34;
  const left = -61;
  const right = 54;

  const openings = LOT_OPENINGS
    .map((entrance) => ({
      left: entrance.x - (entrance.boundaryWidth ?? entrance.width) / 2,
      right: entrance.x + (entrance.boundaryWidth ?? entrance.width) / 2
    }))
    .sort((a, b) => a.left - b.left);
  let runStart = left;
  for (const opening of openings) {
    const length = opening.left - runStart;
    if (length > 0.5) {
      createFenceRun(root, collisionWorld, {
        x: runStart + length / 2, z: front + 0.15, length, axis: "x"
      });
    }
    runStart = opening.right;
  }
  const finalLength = right - runStart;
  if (finalLength > 0.5) {
    createFenceRun(root, collisionWorld, {
      x: runStart + finalLength / 2, z: front + 0.15, length: finalLength, axis: "x"
    });
  }

  // Follow every non-southern segment of the irregular aerial footprint.
  const outline = lot.outline;
  const skipWalkwayFence=(startX,startZ,endX,endZ)=>{
    const eq=(a,b)=>Math.abs(a-b)<0.01;
    return (
      (eq(startX,-61)&&eq(startZ,-33)&&eq(endX,-56)&&eq(endZ,-33)) ||
      (eq(startX,-56)&&eq(startZ,-33)&&eq(endX,-56)&&eq(endZ,-42)) ||
      (eq(startX,-56)&&eq(startZ,-42)&&eq(endX,-61)&&eq(endZ,-42))
    );
  };

  for (let index = 0; index < outline.length; index++) {
    const [startX, startZ] = outline[index];
    const [endX, endZ] = outline[(index + 1) % outline.length];
    if (Math.abs(startZ - front) < 0.01 && Math.abs(endZ - front) < 0.01) continue;
    if (startX === endX && startZ === endZ) continue;
    if (skipWalkwayFence(startX,startZ,endX,endZ)) continue;
    createAngledFenceRun(root, collisionWorld, {
      startX,
      startZ,
      endX,
      endZ,
      tag: index === 0 ? "m1-barrier" : "fence"
    });
  }
}

// Throat of asphalt joining the campus road to the lot. It overlaps the lot
// edge and the road edge so neither join shows a seam, and it uses the shared
// road material so all three surfaces read as one piece of tarmac.
function createOpenParkingEntrance(root, entrance, roadMaterial) {
  const asphalt = roadMaterial ?? material(COLORS.asphalt, 0.93);
  const front = PARKING_LAYOUT.campusRoad.z - PARKING_LAYOUT.campusRoad.depth / 2;
  const back = 33.2;
  const depth = front - back + 0.8;
  const throat = box(
    root,
    [entrance.width, 0.1, depth],
    [entrance.x, 0.0, back + depth / 2],
    asphalt
  );
  applyRoadUvs(throat.geometry, entrance.width, depth);
}

function createParkingEntranceCurbs(root, collisionWorld, entrance) {
  const shoulderWidth = (entrance.boundaryWidth - entrance.width) / 2;
  const curbMaterial = material(COLORS.kerb, 0.84);
  for (const side of [-1, 1]) {
    const x = entrance.x + side * (entrance.width / 2 + shoulderWidth / 2);
    box(
      root,
      [shoulderWidth, 0.28, 2.5],
      [x, 0.14, 34.7],
      curbMaterial,
      { castShadow: true, name: "parking-entrance-curb" }
    );
    addCollider(
      collisionWorld,
      root,
      [x, 0.2, 34.7],
      [shoulderWidth, 0.5, 2.5],
      "parking-entrance-curb"
    );
  }
}

function createParkingBoomEntrance(root, collisionWorld, playerCar, entrance) {
  const boomRed = material(0xc34842, 0.62);
  const boomWhite = material(0xe7e1d2, 0.62);
  const baseX = entrance.x - entrance.width / 2 + 0.35;
  const boomZ = 36.1;
  const boomLength = entrance.width - 0.7;
  const pivot = new THREE.Group();
  pivot.position.set(baseX, 1.05, boomZ);
  root.add(pivot);
  box(pivot, [boomLength, 0.18, 0.2], [boomLength / 2, 0, 0], boomWhite, { castShadow: true });
  for (let x = 0.55; x < boomLength; x += 1.05) {
    box(pivot, [0.5, 0.19, 0.21], [x, 0.01, 0], boomRed, { castShadow: true });
  }
  box(root, [0.52, 1.2, 0.52], [baseX, 0.6, boomZ], material(0x545b61, 0.7), { castShadow: true });

  const boomCollider = addCollider(
    collisionWorld,
    root,
    [baseX + boomLength / 2, 0.95, boomZ],
    [boomLength, 1, 0.36],
    "parking-entrance-boom"
  );
  let angle = 0;
  return (dt) => {
    const dx = playerCar.position.x - entrance.x;
    const dz = playerCar.position.z - boomZ;
    // Keep the barrier visible at spawn, then raise it as the player rolls up.
    const target = dx * dx + dz * dz < 14 ? Math.PI * 0.46 : 0;
    angle = THREE.MathUtils.lerp(angle, target, 1 - Math.exp(-4.5 * dt));
    pivot.rotation.z = angle;
    boomCollider.position.y = angle > 0.62 ? 3 : 0.9;
  };
}

// Entrance 9-style checkpoint on the campus street.
//
// The whole structure is modelled in a local frame where +X runs across the
// lanes and +Z runs the way traffic travels, then the group is turned a quarter
// turn so it lines up with a street that runs east to west. Without that turn
// the boom lies along the road instead of across it, and the canopy spans the
// wrong axis. Colliders are added in root space because CollisionWorld reads
// local positions and ignores parent transforms.
function createCampusBoomGate(root, collisionWorld, playerCar) {
  const checkpoint = PARKING_LAYOUT.campusGate;
  const road = PARKING_LAYOUT.campusRoad;

  const gate = new THREE.Group();
  gate.name = "campus-checkpoint";
  gate.position.set(checkpoint.x, 0, road.z);
  gate.rotation.y = Math.PI / 2;
  root.add(gate);

  // A local offset, in world space.
  const toWorld = (localX, localZ) => [checkpoint.x + localZ, road.z - localX];

  const roofMat = material(0xd5d9da, 0.54, { metalness: 0.25 });
  const supportMat = material(0x747b7c, 0.6, { metalness: 0.35 });
  const islandMat = material(0xb89f83, 0.82);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x90b5bf,
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.72
  });

  // Broad metal canopy with two clear lanes beneath it.
  box(gate, [13.5, 0.55, 10.8], [0, 4.75, 0], roofMat, { castShadow: true });
  box(gate, [14.0, 0.16, 11.3], [0, 5.1, 0], material(0xe8ebea, 0.48, { metalness: 0.3 }), { castShadow: true });
  for (const x of [-5.5, 5.5]) {
    for (const z of [-4.15, 4.15]) {
      box(gate, [0.32, 4.5, 0.32], [x, 2.25, z], supportMat, { castShadow: true });
    }
  }
  // Blue fascia faces each approach, so the gate reads as the Wits entrance.
  for (const z of [-5.48, 5.48]) {
    box(gate, [13.7, 0.65, 0.18], [0, 4.65, z], material(COLORS.witsBlue, 0.58), { castShadow: true });
  }

  // Guard booth on its island, beside the controlled lane.
  const boothLocalX = 3.8;
  box(gate, [2.15, 0.24, 5.2], [boothLocalX, 0.12, 0], islandMat, { castShadow: true });
  box(gate, [1.75, 2.55, 2.7], [boothLocalX, 1.4, 0], material(0xb8b0a3, 0.76), { castShadow: true });
  for (const z of [-1.38, 1.38]) {
    box(gate, [1.45, 0.92, 0.05], [boothLocalX, 1.65, z], glassMat, { receiveShadow: false });
  }
  const [boothX, boothZ] = toWorld(boothLocalX, 0);
  addCollider(
    collisionWorld,
    root,
    [boothX, 1.4, boothZ],
    [2.15, 2.8, 5.2],
    "entrance-nine-booth",
    Math.PI / 2
  );

  // Kerb islands along both road edges.
  for (const x of [-6.2, 6.2]) {
    box(
      gate,
      [0.42, 0.24, 10.5],
      [x, 0.12, 0],
      islandMat,
      { castShadow: true, name: "campus-gate-kerb" }
    );

    const [kerbX, kerbZ] = toWorld(x, 0);
    addCollider(
      collisionWorld,
      root,
      [kerbX, 0.2, kerbZ],
      [10.5, 0.5, 0.6],
      "campus-gate-kerb"
    );
  }

  // The boom itself, hinged at the kerb and reaching across the lane.
  const boomRed = material(0xc34842, 0.62);
  const boomWhite = material(0xe7e1d2, 0.62);
  const boomLength = 6.9;
  const pivotLocalX = -5.1;
  const pivotLocalZ = -2.25;

  const pivot = new THREE.Group();
  pivot.position.set(pivotLocalX, 1.05, pivotLocalZ);
  gate.add(pivot);
  box(pivot, [boomLength, 0.18, 0.2], [boomLength / 2, 0, 0], boomWhite, { castShadow: true });
  for (let x = 0.6; x < boomLength; x += 1.15) {
    box(pivot, [0.55, 0.19, 0.21], [x, 0.01, 0], boomRed, { castShadow: true });
  }
  box(gate, [0.48, 1.15, 0.48], [pivotLocalX, 0.575, pivotLocalZ], material(0x545b61, 0.7), { castShadow: true });

  // The arm sweeps from the kerb towards the middle of the road, so its
  // blocking volume runs across the lanes in world space.
  const [armStartX, armStartZ] = toWorld(pivotLocalX, pivotLocalZ);
  const [armEndX, armEndZ] = toWorld(pivotLocalX + boomLength, pivotLocalZ);
  const boomCollider = addCollider(
    collisionWorld,
    root,
    [(armStartX + armEndX) / 2, 0.95, (armStartZ + armEndZ) / 2],
    [0.36, 1.0, boomLength],
    "campus-boom"
  );

  let angle = 0;
  const update = (dt) => {
    const dx = playerCar.position.x - boomCollider.position.x;
    const dz = playerCar.position.z - (armStartZ + armEndZ) / 2;
    const near = dx * dx + dz * dz < 90;
    const target = near ? Math.PI * 0.46 : 0;
    angle = THREE.MathUtils.lerp(angle, target, 1 - Math.exp(-4.5 * dt));
    pivot.rotation.z = angle;
    // CollisionWorld ignores Z rotation, so move the blocking volume above the
    // car once the arm is clearly up.
    boomCollider.position.y = angle > 0.62 ? 3.0 : 0.9;
  };

  return update;
}


function createSecondaryParkingLink(root, roadMaterial) {
  const e=PARKING_LAYOUT.otherEntrance;
  const p=PARKING_LAYOUT.otherParking;
  const road=PARKING_LAYOUT.campusRoad;
  const asphalt=roadMaterial ?? material(COLORS.asphalt,0.93);

  const startZ=road.z+road.depth/2-0.2;
  const endZ=p.z-p.depth/2+0.2;
  const depth=endZ-startZ;

  const link=box(
    root,
    [e.width,0.1,depth],
    [e.x,0.02,startZ+depth/2],
    asphalt,
    {name:"secondary-parking-entrance"}
  );
  applyRoadUvs(link.geometry,e.width,depth);
}


export function createParkingEnvironment({ collisionWorld, playerCar, roadMaterial = null }) {
  const root = new THREE.Group();
  root.name = "parking-environment";

  createSeparatedGround(root);
  createNorthM1Ledge(root);
  createCampusRoad(root, collisionWorld, roadMaterial);
  const { laneZ } = createM1(root, roadMaterial);
  const updateM1Traffic = createM1Traffic(root, laneZ);
  createArmBuilding(root, collisionWorld);
  createArmPedestrianLink(root, collisionWorld);
  createFlowerHall(root);
  createOtherParking(root, roadMaterial);
  createSecondaryParkingLink(root, roadMaterial);
  createMainParkingBoundary(root, collisionWorld);
  for (const opening of LOT_OPENINGS) {
    createOpenParkingEntrance(root, opening, roadMaterial);
    createParkingEntranceCurbs(root, collisionWorld, opening);
  }
  const updateCampusBoom = createCampusBoomGate(root, collisionWorld, playerCar);
  const updateLotBooms = LOT_OPENINGS.map(
    (opening) => createParkingBoomEntrance(root, collisionWorld, playerCar, opening)
  );

  // The north vista is a scenery-only stage beyond the playable boundary. It
  // deliberately contributes no colliders and no per-frame update work.
  const northDiorama = createNorthDiorama();
  root.add(northDiorama.root);

  // The east vista extends the same scenery-only diorama pattern. Existing
  // playable parking, Entrance 9, Yale Road, the M1 and its bridge remain the
  // foreground landmarks; this root supplies the staged field and horizon.
  const eastDiorama = createEastDiorama();
  root.add(eastDiorama.root);

  // South reuses the existing campus road, pavement and secondary parking as
  // its foreground. Its sibling root begins beyond those systems and adds the
  // close architectural stage visible from the normal playable area.
  const southDiorama = createSouthDiorama({
    roadSegments: [
      PARKING_LAYOUT.bridgeRoad,
      PARKING_LAYOUT.bridgeRoadExtension,
      PARKING_LAYOUT.otherParking
    ]
  });
  root.add(southDiorama.root);

  // The playable parking lot itself is the foreground of the west view. This
  // sibling begins beyond its west boundary and supplies the dense campus
  // architecture, curved roofs and skyline without duplicating gameplay cars.
  const westDiorama = createWestDiorama();
  root.add(westDiorama.root);

  const update = (dt) => {
    updateM1Traffic(dt);
    updateCampusBoom(dt);
    for (const updateBoom of updateLotBooms) updateBoom(dt);
  };

  return {
    root,
    update,
    ready: Promise.all([
      northDiorama.ready,
      eastDiorama.ready,
      southDiorama.ready,
      westDiorama.ready
    ]),
    northDiorama: northDiorama.root,
    northDioramaStats: northDiorama.stats,
    eastDiorama: eastDiorama.root,
    eastDioramaStats: eastDiorama.stats,
    southDiorama: southDiorama.root,
    southDioramaStats: southDiorama.stats,
    westDiorama: westDiorama.root,
    westDioramaStats: westDiorama.stats
  };
}
