import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { VehicleController } from "../shared/VehicleController.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import {
  ROAD_TILE_METRES,
  SHADER_UV_TILING,
  createAsphaltMaterial,
  createRoadMaterial,
  createRoadTextures
} from "../shaders/asphaltShader.js";

import {
  createPotholeSplashMaterial
} from "../shaders/potholeSplashShader.js";
import {
  createPotholeWaterMaterial
} from "../shaders/potholeWaterShader.js";
import { LevelAudio } from "../shared/LevelAudio.js";
import { createInstancedCarField } from "../shared/InstancedCarField.js";
import {
  PARKING_AISLE_WIDTH,
  PARKING_BAY_LENGTH,
  PARKING_BAY_WIDTH,
  PARKING_LINE_WIDTH,
  createParkingBayMarkings
} from "../shared/parking/ParkingLotStyle.js";
import {
  attachPlayerCarModel,
  createSeededRandom,
  pickRandomParkingCar
} from "../shared/VehicleModelLibrary.js";
import {
  createParkingEnvironment,
  PARKING_LAYOUT
} from "./parking/ParkingEnvironment.js";
import { measurePoolCoverage } from "./parking/poolCoverage.js";

const LEVEL_ONE_ASPHALT_Y = 0.035;
const WATER_FILLED_FRACTION = 0.35;
const POTHOLE_WATER_DEPTH_RATIO = 0.42;

const POTHOLE_SPLASH_CAPACITY = 192;
const POTHOLE_SPLASH_GRAVITY = 10.5;
export { PARKING_AISLE_WIDTH, PARKING_BAY_LENGTH, PARKING_BAY_WIDTH, PARKING_LINE_WIDTH };

export const LEVEL_ONE_DAMAGE = Object.freeze({
  small: 4,
  medium: 10,
  high: 20
});
function potholeWaterScore(
  seed,
  index
) {
  let value =
    (
      Number(seed) >>> 0
    ) ^
    Math.imul(
      index + 1,
      0x9e3779b1
    );

  value =
    (
      Math.imul(
        value,
        1664525
      ) +
      1013904223
    ) >>> 0;

  value ^=
    value >>> 16;

  return value >>> 0;
}


  export function selectWaterFilledPotholes(
    seed,
    count,
    fraction = WATER_FILLED_FRACTION
  ) {
    if (count <= 0) {
      return new Set();
    }

    if (count === 1) {
      return new Set([0]);
    }

    // Pick an exact deterministic number so every normal run
    // contains both wet and dry potholes.
    const targetCount =
      THREE.MathUtils.clamp(
        Math.round(
          count *
          fraction
        ),
        1,
        count - 1
      );

    const ranked =
      Array.from(
        {
          length: count
        },
        (_, index) => ({
          index,

          score:
            potholeWaterScore(
              seed,
              index
            )
        })
      );

    ranked.sort(
      (a, b) =>
        a.score -
        b.score
    );

    return new Set(
      ranked
        .slice(
          0,
          targetCount
        )
        .map(
          ({ index }) =>
            index
        )
    );
  }


  function getPotholePhysicalDepth(
    radius
  ) {
    // Must match applyPotholeDeformation().
    return THREE.MathUtils.clamp(
      0.11 +
        radius *
        0.05,
      0.14,
      0.18
    );
  }

function inverseSmoothstep(
  value
) {
  let low = 0;
  let high = 1;

  for (
    let iteration = 0;
    iteration < 12;
    iteration++
  ) {
    const midpoint =
      (low + high) / 2;

    const smoothed =
      midpoint *
      midpoint *
      (
        3 -
        2 * midpoint
      );

    if (smoothed < value) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  return (
    low + high
  ) / 2;
}

export function createPotholeWaterGeometry(
  radius,
  potholeIndex,
  x,
  z
) {
  const segments =
    64;

  const positions = [
    0,
    0,
    0
  ];

  const edgeFactors = [
    0
  ];

  const indices = [];

  const seed =
    potholeIndex * 1.731 +
    x * 0.041 +
    z * 0.067;


  // The real crater wall uses:
  //
  // depthProfile =
  // lerp(0.94, 0.045, smoothstep wall)
  //
  // Work backwards from the chosen water height to find
  // where that horizontal plane intersects the crater wall.

  const requiredSmoothstep =
    THREE.MathUtils.clamp(
      (
        0.94 -
        POTHOLE_WATER_DEPTH_RATIO
      ) /
      (
        0.94 -
        0.045
      ),
      0,
      1
    );

  const wallIntersection =
    inverseSmoothstep(
      requiredSmoothstep
    );


  for (
    let index = 0;
    index < segments;
    index++
  ) {
    const angle =
      (
        index /
        segments
      ) *
      Math.PI *
      2;


    // EXACTLY the same broken-mouth variation used by
    // applyPotholeDeformation().
    const edgeVariation =
      1 +
      Math.sin(
        angle * 3 +
        seed
      ) * 0.16 +
      Math.sin(
        angle * 5 +
        seed * 1.7
      ) * 0.085 +
      Math.sin(
        angle * 8 +
        seed * 2.3
      ) * 0.050 +
      Math.sin(
        angle * 13 +
        seed * 3.1
      ) * 0.025;


    const outerRadius =
      radius *
      1.04 *
      edgeVariation;


    // These are also exactly the same wall boundaries
    // used by the actual pothole geometry.
    const floorEdge =
      0.61 +
      Math.sin(
        angle * 4 +
        seed * 1.4
      ) * 0.025;

    const wallOuter =
      0.80 +
      Math.sin(
        angle * 7 +
        seed * 2.2
      ) * 0.030;


    const normalizedWaterRadius =
      THREE.MathUtils.lerp(
        floorEdge,
        wallOuter,
        wallIntersection
      );


    const localRadius =
      outerRadius *
      normalizedWaterRadius;


    positions.push(
      Math.cos(angle) *
        localRadius,

      0,

      Math.sin(angle) *
        localRadius
    );

    edgeFactors.push(
      1
    );
  }


  for (
    let index = 0;
    index < segments;
    index++
  ) {
    indices.push(
      0,
      index + 1,
      (
        (
          index + 1
        ) %
        segments
      ) +
        1
    );
  }


  const geometry =
    new THREE.BufferGeometry();


  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      positions,
      3
    )
  );


  geometry.setAttribute(
    "edgeFactor",
    new THREE.Float32BufferAttribute(
      edgeFactors,
      1
    )
  );


  geometry.setIndex(
    indices
  );

  geometry.computeBoundingSphere();

  return geometry;
}

export function parkingAxisAngleError(rotation, bayAngle) {
  const delta = rotation - bayAngle;
  const facingError = Math.abs(
    Math.atan2(Math.sin(delta), Math.cos(delta))
  );

  // A parking bay has an axis rather than a single facing direction:
  // nose-in and reverse-in are both valid.
  return Math.min(
    facingError,
    Math.abs(Math.PI - facingError)
  );
}

export function getLevelOneCollisionDamage(tag = "") {
  const normalizedTag = String(tag).toLowerCase();

  if (normalizedTag === "pothole") {
    return LEVEL_ONE_DAMAGE.small;
  }

  if (normalizedTag === "parked-car") {
    return LEVEL_ONE_DAMAGE.high;
  }

  if (
    normalizedTag.includes("sign") ||
    normalizedTag.includes("curb") ||
    normalizedTag.includes("kerb") ||
    normalizedTag.includes("tree")
  ) {
    return LEVEL_ONE_DAMAGE.medium;
  }

  if (
    normalizedTag.includes("wall") ||
    normalizedTag.includes("barrier") ||
    normalizedTag.includes("fence") ||
    normalizedTag.includes("boom") ||
    normalizedTag.includes("booth") ||
    normalizedTag.startsWith("wits-arm")
  ) {
    return LEVEL_ONE_DAMAGE.high;
  }

  // Unknown solid obstacles are still damaging, but not catastrophically so.
  return LEVEL_ONE_DAMAGE.medium;
}

export function revertToSafePose(car, vehicle, safePosition, safeRotationY) {
  car.position.copy(safePosition);
  car.rotation.y = safeRotationY;
  vehicle.stop();
}

export function applyLevelOneDamage(condition, tag) {
  return Math.max(
    0,
    condition - getLevelOneCollisionDamage(tag)
  );
}

const DOUBLE_ROW_CONFIGS = Object.freeze([
  Object.freeze({ name: "row-a", centerX: -42.5, startZ: -38.9, endZ: 32 }),
  Object.freeze({ name: "row-b", centerX: -26.5, startZ: -37.2, endZ: 32 }),
  Object.freeze({ name: "row-c", centerX: -10.5, startZ: -35.5, endZ: 25 }),
  Object.freeze({ name: "row-d", centerX: 5.5, startZ: -33.8, endZ: 25 }),
  Object.freeze({ name: "row-e", centerX: 21.5, startZ: -32.1, endZ: 28 }),
  Object.freeze({ name: "row-f", centerX: 37.5, startZ: -30.5, endZ: 26 })
]);

export const LEVEL_ONE_PARKING_LAYOUT = Object.freeze({
  parkingSpaceWidth: PARKING_BAY_WIDTH,
  parkingSpaceDepth: PARKING_BAY_LENGTH,
  aisleWidth: PARKING_AISLE_WIDTH,
  lineWidth: PARKING_LINE_WIDTH,
  slotSpacing: 2.6,
  topRow: Object.freeze({
    name: "top-row",
    start: Object.freeze({ x: -50, z: -48.2 }),
    step: Object.freeze({ x: 5.15, z: 0.542 }),
    count: 20,
    rotation: Math.atan2(5.15, 0.542)
  }),
  westUpperRow: Object.freeze({ name: "west-upper", x: -58.2, startZ: -48.6, endZ: -43.4 }),
  westRow: Object.freeze({ name: "west-row", x: -58.25, startZ: -32.5, endZ: 26 }),
  doubleRows: DOUBLE_ROW_CONFIGS,
  // Square bays along the east curb, facing into the lot like every other row.
  // The x step follows the curb as the boundary narrows from x = 58.4 at the
  // north end to x = 54.7 at the south, holding each car 0.15 m clear of it.
  eastRow: Object.freeze({
    name: "east-row",
    start: Object.freeze({ x: 56.04, z: -30 }),
    step: Object.freeze({ x: -0.1805, z: 2.6 }),
    count: 22,
    rotation: -Math.PI / 2
  }),
  verticalRoads: Object.freeze([
    Object.freeze({ x: -50.7, width: 6, startZ: -39.5, endZ: 28 }),
    Object.freeze({ x: -34.5, width: 6, startZ: -39.5, endZ: 29 }),
    Object.freeze({ x: -18.5, width: 6, startZ: -38, endZ: 29 }),
    Object.freeze({ x: -2.5, width: 6, startZ: -36.5, endZ: 34 }),
    Object.freeze({ x: 13.5, width: 6, startZ: -34.5, endZ: 29 }),
    Object.freeze({ x: 29.5, width: 6, startZ: -33, endZ: 29 }),
    Object.freeze({ x: 45.5, width: 6, startZ: -31.5, endZ: 27 })
  ]),
  rearRoad: Object.freeze({ leftZ: -40.4, rightZ: -30.2, depth: 5.2, width: 108 }),
  // Every bay is taken except this many. They are drawn at random on each run
  // and held apart, so the player always has a real choice of where to go
  // rather than one scripted slot.
  freeBayCount: 3,
  freeBaySeparation: 18,
  potholeCount: 40,
  potholeMinSeparation: 5,
  potholeRadiusMin: 0.55,
  potholeRadiusMax: 1.35,
  potholeSpawnClearance: 9,
  potholeEntranceClearance: 5.5,
  potholeFreeBayClearance: 4.5,
  playerSpawn: Object.freeze({ x: -34.5, z: 41, angle: 0 }),
  skyViewScale: 1.05
});

export function createParkingRow({ name, start, count, step, rotation }) {
  return Array.from({ length: count }, (_, index) => ({
    x: start.x + step.x * index,
    z: start.z + step.z * index,
    angle: rotation,
    rowName: name,
    rowIndex: index
  }));
}

export function createDoubleParkingRow({ name, centerX, startZ, endZ, spacing }) {
  const count = Math.floor((endZ - startZ) / spacing) + 1;
  const halfLength = PARKING_BAY_LENGTH / 2;
  return [
    ...createParkingRow({
      name: `${name}-left`,
      start: { x: centerX - halfLength, z: startZ },
      count,
      step: { x: 0, z: spacing },
      rotation: -Math.PI / 2
    }),
    ...createParkingRow({
      name: `${name}-right`,
      start: { x: centerX + halfLength, z: startZ },
      count,
      step: { x: 0, z: spacing },
      rotation: Math.PI / 2
    })
  ];
}

export function getLevelOneParkingSpaces() {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const spacing = layout.slotSpacing;
  const verticalRow = (row, rotation = Math.PI / 2) => createParkingRow({
    name: row.name,
    start: { x: row.x, z: row.startZ },
    count: Math.floor((row.endZ - row.startZ) / spacing) + 1,
    step: { x: 0, z: spacing },
    rotation
  });

  return [
    ...createParkingRow(layout.topRow),
    ...verticalRow(layout.westUpperRow),
    ...verticalRow(layout.westRow),
    ...layout.doubleRows.flatMap((row) => createDoubleParkingRow({ ...row, spacing })),
    ...createParkingRow(layout.eastRow)
  ];
}


// ShapeGeometry emits only the outline vertices and writes raw shape
// coordinates straight into its uv attribute. That left the asphalt shader with
// no interior vertices to displace and made it tile the road textures more than
// a thousand times across the lot, which reads as flat grey noise. Each convex
// piece is therefore built here as a subdivided quad carrying world-scaled uvs.
// The pieces stay convex and visually continuous, as the layout contract
// requires.
export function applyPotholeDeformation(
  geometry,
  lot,
  potholes,
  {
    maximumDepth = 0.18
  } = {}
) {
  const position =
    geometry.getAttribute("position");

  for (
    let index = 0;
    index < position.count;
    index++
  ) {
    const localX =
      position.getX(index);

    const localY =
      position.getY(index);

    // createAsphaltQuadGeometry stores the road in local X/Y.
    // After the mesh rotates -90deg around X:
    //   local X -> world X
    //   local Y -> -world Z
    //   local Z -> world height
    const worldX =
      lot.x + localX;

    const worldZ =
      lot.z - localY;

    let deformation = 0;

    for (
      let potholeIndex = 0;
      potholeIndex < potholes.length;
      potholeIndex++
    ) {
      const pothole =
        potholes[potholeIndex];

      const dx =
        worldX - pothole.x;

      const dz =
        worldZ - pothole.z;

      const distance =
        Math.hypot(dx, dz);

      const angle =
        Math.atan2(dz, dx);

      const seed =
        potholeIndex * 1.731 +
        pothole.x * 0.041 +
        pothole.z * 0.067;

      // Strong multi-frequency edge variation.
      // This deliberately creates chipped / broken mouths rather
      // than slightly wobbly circles.
      const edgeVariation =
        1 +
        Math.sin(
          angle * 3 +
          seed
        ) * 0.16 +
        Math.sin(
          angle * 5 +
          seed * 1.7
        ) * 0.085 +
        Math.sin(
          angle * 8 +
          seed * 2.3
        ) * 0.050 +
        Math.sin(
          angle * 13 +
          seed * 3.1
        ) * 0.025;

      const outerRadius =
        pothole.radius *
        1.04 *
        edgeVariation;

      const normalized =
        distance / outerRadius;

      if (normalized >= 1) {
        continue;
      }

      // The references are NOT smooth bowls.
      //
      //        road
      // ---------\_
      //            \
      //             |____ floor
      //
      // Keep a broad deep basin, then climb to road height
      // across a narrow wall region.
      const floorEdge =
        0.61 +
        Math.sin(
          angle * 4 +
          seed * 1.4
        ) * 0.025;

      const wallOuter =
        0.80 +
        Math.sin(
          angle * 7 +
          seed * 2.2
        ) * 0.030;

      let depthProfile;

      if (normalized <= floorEdge) {
        // Broad uneven floor instead of a cone point.
        const floorNoise =
          Math.sin(
            dx * 8.0 +
            seed
          ) *
          Math.sin(
            dz * 9.5 -
            seed * 0.7
          );

        depthProfile =
          THREE.MathUtils.clamp(
            0.94 +
            floorNoise * 0.055,
            0.87,
            1.0
          );
      } else if (normalized <= wallOuter) {
        // VERY short transition = steep cliff-like wall.
        const wallT =
          (normalized - floorEdge) /
          (wallOuter - floorEdge);

        const eased =
          wallT *
          wallT *
          (
            3 -
            2 * wallT
          );

        depthProfile =
          THREE.MathUtils.lerp(
            0.94,
            0.045,
            eased
          );
      } else {
        // Thin broken shoulder immediately inside the intact road.
        const lipT =
          (normalized - wallOuter) /
          (1 - wallOuter);

        depthProfile =
          0.045 *
          (
            1 -
            THREE.MathUtils.clamp(
              lipT,
              0,
              1
            )
          );
      }

      // Bigger potholes are physically deeper.
      // Rough range: 14cm -> 18cm.
      const physicalDepth =
        THREE.MathUtils.clamp(
          0.11 +
          pothole.radius * 0.05,
          0.14,
          maximumDepth
        );

      const potholeDepth =
        physicalDepth *
        depthProfile;

      deformation =
        Math.max(
          deformation,
          potholeDepth
        );
    }

    // Negative local Z becomes DOWN once the road is laid flat.
    position.setZ(
      index,
      -deformation
    );
  }

  position.needsUpdate = true;

  // Critical: wall normals now follow the actual cliff-like geometry.
  geometry.deleteAttribute("normal");
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}
export function createAsphaltQuadGeometry(
  corners,
  lot,
  potholes = []
) {
  const local = corners.map(([x, z]) => new THREE.Vector2(x - lot.x, -(z - lot.z)));
  const [p0, p1, p2, p3] = local;

const segmentsFor = (a, b) =>
  THREE.MathUtils.clamp(
    Math.ceil(a.distanceTo(b) / 0.20),
    2,
    560
  );
  const segmentsU = Math.max(segmentsFor(p0, p1), segmentsFor(p3, p2));
  const segmentsV = Math.max(segmentsFor(p0, p3), segmentsFor(p1, p2));

  const positions = [];
  const normals = [];
  const uvs = [];
  const tileU = ROAD_TILE_METRES * SHADER_UV_TILING.x;
  const tileV = ROAD_TILE_METRES * SHADER_UV_TILING.y;

  for (let j = 0; j <= segmentsV; j++) {
    const v = j / segmentsV;
    for (let i = 0; i <= segmentsU; i++) {
      const u = i / segmentsU;
      const top = p0.clone().lerp(p1, u);
      const bottom = p3.clone().lerp(p2, u);
      const point = top.lerp(bottom, v);

      positions.push(point.x, point.y, 0);
      normals.push(0, 0, 1);
      uvs.push(point.x / tileU, point.y / tileV);
    }
  }

  // Keep the winding facing up once the mesh is laid flat.
  const edgeA = p1.clone().sub(p0);
  const edgeB = p3.clone().sub(p0);
  const counterClockwise = edgeA.x * edgeB.y - edgeA.y * edgeB.x > 0;

  const indices = [];
  for (let j = 0; j < segmentsV; j++) {
    for (let i = 0; i < segmentsU; i++) {
      const a = j * (segmentsU + 1) + i;
      const b = a + 1;
      const c = a + segmentsU + 2;
      const d = a + segmentsU + 1;

      if (counterClockwise) indices.push(a, b, c, a, c, d);
      else indices.push(a, c, b, a, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  applyPotholeDeformation(
    geometry,
    lot,
    potholes
  );

  return geometry;
  }


// The lot floor, as convex pieces. Convex avoids the concave polygon
// triangulation artefacts that let the grass ground show through the parking
// floor. Corners are in world x/z; createAsphaltQuadGeometry converts them.
// Exported because the water-coverage test integrates the pool mask over this
// exact footprint, and a second copy of it would drift.
export const LEVEL_ONE_ASPHALT_PIECES = Object.freeze([
  {
    name: "level-one-parking-asphalt-main",
    corners: [[-56, -50], [59, -38], [54, 34], [-56, 34]]
  },
  {
    name: "level-one-parking-asphalt-west-main",
    corners: [[-61, -33], [-56, -33], [-56, 34], [-61, 34]]
  },
  {
    name: "level-one-parking-asphalt-west-upper",
    corners: [[-61, -50], [-56, -50], [-56, -42], [-61, -42]]
  },
  {
    name: "level-one-parking-asphalt-west-notch",
    corners: [[-61, -42], [-56, -42], [-56, -33], [-61, -33]]
  }
]);
// Chooses the bays left empty. Shuffling first and then filtering keeps the
// draw uniform, and the separation check stops the three landing on top of
// each other. If the separation cannot be satisfied the quota is topped up
// anyway, so this always returns the number asked for while any bays remain.
export function pickFreeParkingBays(spaces, random = Math.random, {
  count = LEVEL_ONE_PARKING_LAYOUT.freeBayCount,
  separation = LEVEL_ONE_PARKING_LAYOUT.freeBaySeparation
} = {}) {
  const shuffled = [...spaces];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }

  const chosen = [];
  const farEnough = (candidate) => chosen.every(
    (bay) => Math.hypot(bay.x - candidate.x, bay.z - candidate.z) >= separation
  );

  for (const candidate of shuffled) {
    if (chosen.length >= count) break;
    if (farEnough(candidate)) chosen.push(candidate);
  }

  for (const candidate of shuffled) {
    if (chosen.length >= count) break;
    if (!chosen.includes(candidate)) chosen.push(candidate);
  }

  return chosen;
}

export function parkingBayKey(space) {
  return `${space.rowName}:${space.rowIndex}`;
}

export function isPointInsideLevelOneLot(x, z, outline = PARKING_LAYOUT.mainLot.outline) {
  // Standard ray-casting point-in-polygon test in the X/Z plane.
  let inside = false;
  for (let current = 0, previous = outline.length - 1; current < outline.length; previous = current++) {
    const [currentX, currentZ] = outline[current];
    const [previousX, previousZ] = outline[previous];
    const crosses = ((currentZ > z) !== (previousZ > z)) &&
      (x < (previousX - currentX) * (z - currentZ) / (previousZ - currentZ) + currentX);
    if (crosses) inside = !inside;
  }
  return inside;
}

function levelOnePotholeRegions(layout = LEVEL_ONE_PARKING_LAYOUT) {
  const radiusMargin = layout.potholeRadiusMax + 0.2;
  const mouthInset = 2.25;
  const regions = layout.verticalRoads.map((road) => ({
    type: "vertical",
    road,
    area: Math.max(0, road.width - radiusMargin * 2) *
      Math.max(0, road.endZ - road.startZ - mouthInset * 2)
  }));

  regions.push({
    type: "rear",
    area: Math.max(0, layout.rearRoad.width - radiusMargin * 2) *
      Math.max(0, layout.rearRoad.depth - radiusMargin * 2)
  });

  // The small pieces of asphalt immediately inside the entry and exit are
  // included as candidate road surface. Fairness clearances below normally
  // reject points in the actual throat, but keeping these regions explicit
  // means the sampler follows the real drivable geometry rather than row math.
  for (const opening of [PARKING_LAYOUT.parkingBoomEntrance, PARKING_LAYOUT.parkingBoomExit]) {
    regions.push({
      type: "apron",
      opening,
      area: Math.max(0, opening.width - radiusMargin * 2) * 5
    });
  }

  return regions.filter((region) => region.area > 0);
}

function sampleLevelOnePotholePosition(random, layout = LEVEL_ONE_PARKING_LAYOUT) {
  const regions = levelOnePotholeRegions(layout);
  const totalArea = regions.reduce((sum, region) => sum + region.area, 0);
  let draw = random() * totalArea;
  let region = regions.at(-1);
  for (const candidate of regions) {
    draw -= candidate.area;
    if (draw <= 0) {
      region = candidate;
      break;
    }
  }

  const radiusMargin = layout.potholeRadiusMax + 0.2;
  if (region.type === "vertical") {
    const { road } = region;
    const halfUsableWidth = road.width / 2 - radiusMargin;
    const mouthInset = 2.25;
    return {
      x: road.x + (random() * 2 - 1) * halfUsableWidth,
      z: THREE.MathUtils.lerp(road.startZ + mouthInset, road.endZ - mouthInset, random())
    };
  }

  if (region.type === "rear") {
    const halfWidth = layout.rearRoad.width / 2 - radiusMargin;
    const x = (random() * 2 - 1) * halfWidth;
    const progress = (x + layout.rearRoad.width / 2) / layout.rearRoad.width;
    const centreZ = THREE.MathUtils.lerp(layout.rearRoad.leftZ, layout.rearRoad.rightZ, progress);
    const halfUsableDepth = layout.rearRoad.depth / 2 - radiusMargin;
    return {
      x,
      z: centreZ + (random() * 2 - 1) * halfUsableDepth
    };
  }

  const halfUsableWidth = region.opening.width / 2 - radiusMargin;
  return {
    x: region.opening.x + (random() * 2 - 1) * halfUsableWidth,
    z: THREE.MathUtils.lerp(29, 34, random())
  };
}

export function generateLevelOnePotholes({
  random = Math.random,
  freeBays = [],
  layout = LEVEL_ONE_PARKING_LAYOUT,
  count = layout.potholeCount,
  minSeparation = layout.potholeMinSeparation
} = {}) {
  const chosen = [];
  const fallbackCandidates = [];
  const maxAttempts = Math.max(1200, count * 220);
  const entrancePoints = [PARKING_LAYOUT.parkingBoomEntrance, PARKING_LAYOUT.parkingBoomExit];

  const clearOf = (candidate, point, clearance) =>
    Math.hypot(candidate.x - point.x, candidate.z - point.z) >= clearance + candidate.radius;

  const fairCandidate = (candidate) => {
    if (!isPointInsideLevelOneLot(candidate.x, candidate.z)) return false;
    if (!clearOf(candidate, layout.playerSpawn, layout.potholeSpawnClearance)) return false;
    if (entrancePoints.some((point) => !clearOf(candidate, point, layout.potholeEntranceClearance))) return false;
    if (freeBays.some((bay) => !clearOf(candidate, bay, layout.potholeFreeBayClearance))) return false;
    return true;
  };

  const separated = (candidate) => chosen.every((pothole) =>
    Math.hypot(pothole.x - candidate.x, pothole.z - candidate.z) >= minSeparation
  );

  for (let attempt = 0; attempt < maxAttempts && chosen.length < count; attempt++) {
    const point = sampleLevelOnePotholePosition(random, layout);
    const candidate = {
      ...point,
      radius: THREE.MathUtils.lerp(layout.potholeRadiusMin, layout.potholeRadiusMax, random())
    };
    if (!fairCandidate(candidate)) continue;
    fallbackCandidates.push(candidate);
    if (separated(candidate)) chosen.push(candidate);
  }

  // A valid layout has ample room for 25 hazards, so the normal path above
  // satisfies every spacing rule. Keep a best-effort top-up for deliberately
  // hostile test/options values rather than ever returning hundreds or looping.
  while (chosen.length < count && fallbackCandidates.length > 0) {
    let bestIndex = 0;
    let bestDistance = -Infinity;
    for (let index = 0; index < fallbackCandidates.length; index++) {
      const candidate = fallbackCandidates[index];
      if (chosen.includes(candidate)) continue;
      const nearest = chosen.length === 0 ? Infinity : Math.min(...chosen.map((pothole) =>
        Math.hypot(pothole.x - candidate.x, pothole.z - candidate.z)
      ));
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    const next = fallbackCandidates.splice(bestIndex, 1)[0];
    if (next && !chosen.includes(next)) chosen.push(next);
    else break;
  }

  return chosen.slice(0, count);
}

export function normalizeLevelOneSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  if (typeof seed === "string" && /^\d+$/.test(seed)) return Number(seed) >>> 0;

  const text = String(seed ?? "level-1");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function resolveLevelOneSeed(
  search = globalThis.location?.search ?? "",
  cryptoSource = globalThis.crypto
) {
  const requestedSeed = new URLSearchParams(search).get("level1Seed");
  if (requestedSeed !== null) return normalizeLevelOneSeed(requestedSeed);

  if (cryptoSource?.getRandomValues) {
    const values = new Uint32Array(1);
    cryptoSource.getRandomValues(values);
    return values[0];
  }

  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

export function generateLevelOneRun(seed) {
  const normalizedSeed = normalizeLevelOneSeed(seed);
  const random = createSeededRandom(normalizedSeed);
  const freeBays = pickFreeParkingBays(getLevelOneParkingSpaces(), random);
  const potholes = generateLevelOnePotholes({ random, freeBays });

  return {
    seed: normalizedSeed,
    freeBays,
    potholes
  };
}

export function getPotholeImpact(radius, layout = LEVEL_ONE_PARKING_LAYOUT) {
  const range = Math.max(0.001, layout.potholeRadiusMax - layout.potholeRadiusMin);
  const severity = clamp((radius - layout.potholeRadiusMin) / range, 0, 1);
  return {
    damage: Math.round(THREE.MathUtils.lerp(2, 8, severity)),
    speedMultiplier: THREE.MathUtils.lerp(0.9, 0.7, severity),
    cameraShake: THREE.MathUtils.lerp(0.22, 0.42, severity),
    suspensionKick: THREE.MathUtils.lerp(0.55,1.0,severity),
    cooldown: THREE.MathUtils.lerp(0.85, 1.25, severity)
  };
}

export const PLAYER_CAR_WHEEL_NAMES = Object.freeze([
  "wheel_00",
  "wheel_01",
  "wheel_02",
  "wheel_03"
]);

export const PLAYER_CAR_FRONT_WHEEL_NAMES = Object.freeze([
  "wheel_00",
  "wheel_03"
]);

export function rigPlayerCarWheels(model) {
  const wheels = [];
  const frontWheelPivots = [];
  const frontNames = new Set(PLAYER_CAR_FRONT_WHEEL_NAMES);

  for (const name of PLAYER_CAR_WHEEL_NAMES) {
    const wheel = model.getObjectByName(name);

    if (!wheel?.parent) {
      continue;
    }

    const parent = wheel.parent;
    const pivot = new THREE.Group();

    pivot.name = `${name}-steering-pivot`;

    // The GLB stores wheel placement in the wheel node transform while the
    // wheel geometry itself is centred on the origin. Move that translation
    // onto a wrapper so steering happens around the actual wheel centre.
    pivot.position.copy(wheel.position);

    parent.add(pivot);
    pivot.add(wheel);

    wheel.position.set(0, 0, 0);

    wheels.push(wheel);

    if (frontNames.has(name)) {
      frontWheelPivots.push(pivot);
    }
  }

  return {
    wheels,
    frontWheelPivots
  };
}

export class ParkingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 1 — Park at Wits";

    this.root = new THREE.Group();

    this.car = null;
    this.controls = null;

    this.vehicle = null;
    this.wheels = [];
    this.frontWheelPivots = [];
    this.suspension = null;
    this.collisionWorld = null;
    this.cameraShake = 0;
    // One-shot pothole feedback state.
    this.potholePitch = 0;
    this.potholePitchVelocity = 0;
    this.activePothole = null;
    this.chaseCamera = null;
    this.skyCamera = null;
    this.skyViewActive = false;
    this.viewToggle = null;
    this.chaseFog = null;
    this.onViewToggle = this.toggleSkyView.bind(this);
    this.asphaltUniforms = null;
    this.potholeWaterUniforms = null;
    this.potholeSplash = null;
    this.headlightWorldPosition =new THREE.Vector3();
    this.audio = new LevelAudio();
    this.carIdleAudio = null;
    this.environment = null;
    this.impactCooldown = 0;

    this.condition = 100;
    this.elapsedTime = 0;
    this.potholes = [];
    this.potholeCooldown = 0;

    // A requested seed pins both open bays and potholes for screenshots,
    // measurements and bug reproduction. Without one, resolveLevelOneSeed()
    // draws a fresh seed so normal play keeps varying between runs.
    const run = generateLevelOneRun(resolveLevelOneSeed());
    this.seed = run.seed;
    this.freeBays = run.freeBays;
    this.freeBayKeys = new Set(this.freeBays.map(parkingBayKey));
    this.parkingBays = this.freeBays.map((space) => ({
      x: space.x,
      z: space.z,
      width: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceWidth,
      depth: LEVEL_ONE_PARKING_LAYOUT.parkingSpaceDepth,
      angle: space.angle
    }));

    this.generatedPotholes = run.potholes;

    this.waypoints = [];
    this.waypointTime = 0;

    this.parkingStatus = { containment: false, alignment: false, rest: false, containmentPercent: 0, holdTime: 0 };
    this.parkingConfirmationDuration = 0.75;

    this.completed = false;
  }

async load() {
  const scene = this.game.scene;

  const skyColor = new THREE.Color(0x8ec9ee);
  scene.background = skyColor;
  scene.fog = null;
  this.chaseFog = null;

  scene.add(this.root);
  this.audio.startDrone(74, 0.012);

  // Raised from 0.75 for ACES, 2026-09-08, with the dusk sun below. Level 1
  // is the darkest scene in the game, and three's ACES curve is sub-unity
  // down there, so the level lost 41.7% of its viewport luminance when tone
  // mapping went in. Both lights are scaled by 2.172, solved against the
  // measured response rather than guessed: with Level 1's free bays pinned so
  // every frame held identical content, viewport luma read 0.0635 at the old
  // intensities and 0.1019 at double them, and 2.172 is the interpolation
  // onto the 0.1085 the level measured before the curve. With the pin still in
  // it measures 0.1079; shipped, without the pin, 0.1100.
  //
  // The loss is in the lit geometry only. The lot floor is drawn by
  // asphaltShader.js, a raw ShaderMaterial with no light uniforms - nothing
  // here reaches it, and it was measured separately and needed no change.
  // See docs/DECISIONS.md, 2026-09-08.
  const hemi = new THREE.HemisphereLight(
    0x5e7898,
    0x170d09,
    1.63
  );
  this.root.add(hemi);

  const duskSun = new THREE.DirectionalLight(
    0xffb56a,
    // 1.8 before ACES. Same 2.172 scale as the hemisphere above.
    3.91
  );

  duskSun.position.set(-18, 11, 8);
  duskSun.castShadow = true;
  duskSun.shadow.mapSize.set(1536, 1536);
  duskSun.shadow.camera.left = -18;
  duskSun.shadow.camera.right = 18;
  duskSun.shadow.camera.top = 18;
  duskSun.shadow.camera.bottom = -18;
  duskSun.shadow.bias = -0.0004;

  this.root.add(duskSun);

  this.collisionWorld = new CollisionWorld(this.root);

  this.createParkingSurface(this.generatedPotholes);
  this.createRoadMarkings();
  const parkedCarsReady = this.createParkedCars();
  this.createPotholes();
  this.createPotholeSplashSystem();
  this.createParkingWaypoints();
  const playerCarReady = this.createPlayerCar();

  this.environment = createParkingEnvironment({
    collisionWorld: this.collisionWorld,
    playerCar: this.car,
    roadMaterial: createRoadMaterial(this.roadTextures)
  });

  this.root.add(this.environment.root);


  this.collisionWorld.rebuild();

  const camera = new THREE.PerspectiveCamera(
    58,
    1,
    0.1,
    150
  );

  const initialBehind = new THREE.Vector3(
    Math.sin(this.car.rotation.y) * 8,
    5,
    Math.cos(this.car.rotation.y) * 8
  );
  camera.position.copy(this.car.position).add(initialBehind);
  const initialLookTarget = this.car.position.clone();
  initialLookTarget.y += 1;
  camera.lookAt(initialLookTarget);
  this.chaseCamera = camera;

  this.skyCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 180);
  this.skyCamera.position.set(PARKING_LAYOUT.mainLot.x, 90, PARKING_LAYOUT.mainLot.z);
  this.skyCamera.up.set(0, 0, -1);
  this.skyCamera.lookAt(PARKING_LAYOUT.mainLot.x, 0, PARKING_LAYOUT.mainLot.z);
  this.updateSkyCameraFrustum();

  this.game.setCamera(camera);

  this.controls = this.game.input.registerBindings({
    accelerate: ["KeyW", "ArrowUp"],
    brake: ["KeyS", "ArrowDown"],
    steerLeft: ["KeyA", "ArrowLeft"],
    steerRight: ["KeyD", "ArrowRight"]
  });

  this.game.setMessage(
    "Every bay is taken but three. Follow a purple marker. W/S = throttle, A/D = steer, Ctrl+R = restart."
  );

  this.viewToggle = document.querySelector("#level1-view-toggle");
  this.viewToggle.hidden = false;
  this.viewToggle.addEventListener("click", this.onViewToggle);

  await Promise.all([
    parkedCarsReady,
    playerCarReady,
    this.roadTextures.ready
  ]);
}

  updateSkyCameraFrustum() {
    if (!this.skyCamera) return;

    const lot = PARKING_LAYOUT.mainLot;
    const aspect = window.innerWidth / window.innerHeight;
    this.skyCamera.userData.viewHeight = LEVEL_ONE_PARKING_LAYOUT.skyViewScale * Math.max(
      lot.depth + 10,
      (lot.width + 10) / aspect
    );
  }

  toggleSkyView() {
    this.skyViewActive = !this.skyViewActive;

    if (this.skyViewActive) {
      this.updateSkyCameraFrustum();
      this.game.setCamera(this.skyCamera);
    } else {
      this.game.setCamera(this.chaseCamera);
    }

    this.viewToggle.textContent = this.skyViewActive ? "Chase view" : "Sky view";
    this.viewToggle.setAttribute("aria-pressed", String(this.skyViewActive));
  }


createParkingSurface(potholes = []) {
  const lot = PARKING_LAYOUT.mainLot;

  this.roadTextures = createRoadTextures();
  const asphaltMaterial = createAsphaltMaterial(this.roadTextures);
  this.asphaltUniforms = asphaltMaterial.uniforms;

  this.asphaltMeshes = LEVEL_ONE_ASPHALT_PIECES.map((piece) => {
    const road = new THREE.Mesh(
      createAsphaltQuadGeometry(
        piece.corners,
        lot,
        potholes
      ),
      asphaltMaterial
      );
    road.rotation.x = -Math.PI / 2;
    road.position.set(lot.x,LEVEL_ONE_ASPHALT_Y,lot.z);
    road.receiveShadow = true;
    road.name = piece.name;
    this.root.add(road);
    return road;
  });

  // Opt-in pool coverage probe, for the coverage guard and for tuning
  // uPoolEdgeStart / uPoolEdgeEnd. A normal session never renders it.
  if (new URLSearchParams(window.location.search).has("waterCoverage")) {
    window.__poolCoverage = () =>
      measurePoolCoverage(this.game.renderer, this.asphaltMeshes, this.roadTextures);
  }
}

  // Bay outlines are the only paint in Level 1. The lot floor and the streets
  // are left unmarked on purpose.
  createRoadMarkings() {
    const spaces = getLevelOneParkingSpaces();
    this.root.add(...createParkingBayMarkings(spaces));

  }

  createParkedCars() {
    const random = createSeededRandom(3006);
    const placements = [];

    for (const space of getLevelOneParkingSpaces()) {
      // The lot is full apart from the bays the player is being sent to.
      if (this.freeBayKeys.has(parkingBayKey(space))) continue;

      // Every vehicle in the pack is modelled at its own heading. The loader
      // normalises each one to a 4.2 m length, grounds it and turns it to +Z
      // forward, so a bay only has to supply its own rotation here.
      const spec = pickRandomParkingCar(random);
      placements.push({ spec, x: space.x, z: space.z, angle: space.angle });

      const [colliderWidth, colliderHeight, colliderLength] = spec.collider;
      const collider = new THREE.Object3D();
      collider.position.set(space.x, colliderHeight / 2, space.z);
      collider.rotation.y = space.angle;
      this.root.add(collider);
      this.collisionWorld.add({
        object: collider,
        size: [colliderWidth, colliderHeight, colliderLength],
        color: 0xff6b6b,
        tag: "parked-car"
      });
    }

    return createInstancedCarField(placements, { variant: "lite" })
      .then((field) => {
        field.name = "level-one-parked-cars";
        this.root.add(field);
      })
      .catch((error) => {
        console.warn("Parked car models could not be loaded.", error);
      });
  }

  createPotholes() {
    const wetIndices =
      selectWaterFilledPotholes(
        this.seed,
        this.generatedPotholes.length
      );

    const waterMaterial =
      createPotholeWaterMaterial();

    this.potholeWaterUniforms =
      waterMaterial.uniforms;

    for (
      let index = 0;
      index <
      this.generatedPotholes.length;
      index++
    ) {
      const {
        x,
        z,
        radius
      } =
        this.generatedPotholes[index];

      // Invisible gameplay anchor.
      const pothole =
        new THREE.Object3D();

      pothole.position.set(
        x,
        0,
        z
      );

      pothole.userData.radius =
        radius;

      const isWet =
        wetIndices.has(
          index
        );

      // Keep this on the gameplay anchor.
      // Later, splash effects can simply ask:
      // contactedPothole.userData.isWet
      pothole.userData.isWet =
        isWet;

      this.root.add(
        pothole
      );

      this.potholes.push(
        pothole
      );


      // ----------------------------------------------------
      // OPTIONAL WATER SURFACE
      // ----------------------------------------------------

      if (isWet) {
        const physicalDepth =
          getPotholePhysicalDepth(
            radius
          );

        const water =
          new THREE.Mesh(
            createPotholeWaterGeometry(
              radius,
              index,
              x,
              z
            ),
            waterMaterial
          );

        // The crater road surface starts at LEVEL_ONE_ASPHALT_Y.
        //
        // Put the water well below the broken lip but noticeably
        // above the crater floor.
        water.position.y =
          LEVEL_ONE_ASPHALT_Y -
          physicalDepth *
            POTHOLE_WATER_DEPTH_RATIO +
          0.002;

        water.name =
          `pothole-water-${index}`;

        water.castShadow =
          false;

        water.receiveShadow =
          false;

        water.renderOrder =
          3;

        pothole.add(
          water
        );

        pothole.userData.waterMesh =
          water;
      }


      const colliderDiameter =
        radius *
        2;

      this.collisionWorld.add({
        object:
          pothole,

        size: [
          colliderDiameter,
          0.15,
          colliderDiameter
        ],

        color:
          0xffc857,

        tag:
          "pothole"
      });
    }
  }

  // A marker over every free bay: the painted outline on the ground, a column
  // of light tall enough to clear the parked cars, and a floating pin. Without
  // the column the free bays are invisible from anywhere but right beside them.
  createParkingWaypoints() {
    const markerColour = 0xa855f7;
    const outlineGeometry = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(
        LEVEL_ONE_PARKING_LAYOUT.parkingSpaceWidth,
        0.05,
        LEVEL_ONE_PARKING_LAYOUT.parkingSpaceDepth
      )
    );
    const outlineMaterial = new THREE.LineBasicMaterial({ color: markerColour });

    const beamHeight = 7;
    const beamGeometry = new THREE.CylinderGeometry(0.17, 0.17, beamHeight, 8, 1, true);
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: markerColour,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const pinGeometry = new THREE.OctahedronGeometry(0.55);
    const pinMaterial = new THREE.MeshBasicMaterial({ color: markerColour });

    for (const bay of this.parkingBays) {
      const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
      outline.position.set(bay.x, 0.05, bay.z);
      outline.rotation.y = bay.angle;
      this.root.add(outline);

      const beam = new THREE.Mesh(beamGeometry, beamMaterial);
      beam.position.set(bay.x, beamHeight / 2, bay.z);
      beam.renderOrder = 2;
      this.root.add(beam);

      const pin = new THREE.Mesh(pinGeometry, pinMaterial);
      pin.position.set(bay.x, beamHeight + 0.6, bay.z);
      pin.userData.baseY = pin.position.y;
      this.root.add(pin);
      this.waypoints.push(pin);
    }
  }

  updateParkingWaypoints(dt) {
    this.waypointTime += dt;

    this.waypoints.forEach((pin, index) => {
      pin.rotation.y += dt * 1.3;
      pin.position.y = pin.userData.baseY + Math.sin(this.waypointTime * 1.7 + index) * 0.35;
    });
  }


  createPlayerCar() {
    const carRoot = new THREE.Group();
    const suspension = new THREE.Group();
    suspension.position.y = 0.04;
    carRoot.add(suspension);
    this.suspension = suspension;

    const modelReady = attachPlayerCarModel(suspension)
      .then((model) => {
        const wheelRig = rigPlayerCarWheels(model);

        this.wheels = wheelRig.wheels;
        this.frontWheelPivots = wheelRig.frontWheelPivots;

        if (
          this.wheels.length !== 4 ||
          this.frontWheelPivots.length !== 2
        ) {
          console.warn(
            `Player car wheel rig incomplete: ${this.wheels.length} wheels, ` +
            `${this.frontWheelPivots.length} front pivots.`
          );
        }

        return model;
      })
      .catch((error) => {
        console.warn("Player car model could not be loaded.", error);
      });

    for (const x of [-0.65, 0.65]) {
      const beam = new THREE.SpotLight(0xfff0bd, 16, 22, Math.PI / 7, 0.45, 1.4);
      beam.position.set(x, 0.65, -2.05);
      beam.target.position.set(x, -0.15, -11);
      beam.castShadow = x < 0;
      if (beam.castShadow) {
        beam.shadow.mapSize.set(1024, 1024);
        beam.shadow.bias = -0.00035;
      }
      suspension.add(beam, beam.target);
    }

    const spawn = LEVEL_ONE_PARKING_LAYOUT.playerSpawn;
    carRoot.position.set(spawn.x, 0, spawn.z);
    carRoot.rotation.y = spawn.angle;
    this.car = carRoot;
    this.vehicle = new VehicleController(carRoot);
    this.root.add(carRoot);
    return modelReady.then((model) => {
      // Start the recorded idle loop only once the player car is visible.
      // This level is entered from a user interaction, so playback can begin
      // immediately in browsers that enforce an audio-gesture policy.
      this.startCarIdleAudio();
      return model;
    });
  }

  startCarIdleAudio() {
    if (this.carIdleAudio) return;

    const idleAudio = new Audio("./assets/audio/level1/idle-car.wav");
    idleAudio.loop = true;
    idleAudio.volume = 0.5;
    this.carIdleAudio = idleAudio;
    idleAudio.play().catch(() => {
      // A browser can still refuse playback if the level was not started from
      // a trusted user gesture. Keep the level playable in that case.
    });
  }


  update(dt) {
    if (this.completed) {
      return;
    }

   const controls = this.controls;

this.elapsedTime += dt;
this.impactCooldown = Math.max(
  0,
  this.impactCooldown - dt
);

const previousPosition = this.car.position.clone();
const previousRotationY = this.car.rotation.y;

this.vehicle.update(dt, {
  throttle:
    (controls.isDown("accelerate") ? 1 : 0) -
    (controls.isDown("brake") ? 1 : 0),

  steering:
    (controls.isDown("steerLeft") ? 1 : 0) -
    (controls.isDown("steerRight") ? 1 : 0)
});

this.audio.updateEngine(this.vehicle.speed);

this.environment?.update(dt);

// Keep Level 1 contained, but allow the actual fence/barriers
// to be reached rather than clamping before them.
this.car.position.x = clamp(
  this.car.position.x,
  PARKING_LAYOUT.mainLot.x - PARKING_LAYOUT.mainLot.width / 2 + 0.5,
  PARKING_LAYOUT.mainLot.x + PARKING_LAYOUT.mainLot.width / 2 - 0.5
);

this.car.position.z = clamp(
  this.car.position.z,
  PARKING_LAYOUT.mainLot.z - PARKING_LAYOUT.mainLot.depth / 2 + 0.5,
  44.5
);

const hit = this.collisionWorld.firstHit(
  this.car,
  [2.1, 1.1, 4],
  (collider) => collider.tag !== "pothole"
);

if (hit) {
  revertToSafePose(this.car, this.vehicle, previousPosition, previousRotationY);

  if (this.impactCooldown <= 0) {
    this.condition = applyLevelOneDamage(this.condition, hit.tag);

    this.cameraShake = Math.max(
      this.cameraShake,
      0.28
    );

    this.game.flashHUD();
    this.audio.cue(78, 0.12, 0.15);

    this.impactCooldown = 0.55;
  }
}

    this.updateVehicleVisuals(dt);
    this.updateAsphalt(dt);

    this.potholeCooldown = Math.max(0, this.potholeCooldown - dt);
    this.checkPotholes();
    this.updatePotholeSplashes(dt);
    if (this.checkCampusEscapeEasterEgg()) return;
    this.checkParking(dt);
    this.updateParkingWaypoints(dt);
    this.updateCamera(dt);

    this.game.setHUD(`
      <strong>Park at Wits</strong><br>
      <span class="hud-label">CONDITION</span><div class="meter condition"><i style="width: ${this.condition}%"></i></div>${Math.round(this.condition)}%<br>
      Time: ${this.elapsedTime.toFixed(1)}s<br>
      Speed: ${Math.abs(this.vehicle.speed).toFixed(1)}<br>
      Goal: park in any of the ${this.parkingBays.length} marked bays<br>
      Containment (${Math.round(this.parkingStatus.containmentPercent)}%): ${this.parkingStatus.containment ? "PASS" : "FAIL"}<br>
      Alignment (12 degrees): ${this.parkingStatus.alignment ? "PASS" : "FAIL"}<br>
      Rest (0.3 m/s): ${this.parkingStatus.rest ? "PASS" : "FAIL"}<br>
      ${this.parkingStatus.holdTime > 0 ? `Confirming: ${Math.round(this.parkingStatus.holdTime / this.parkingConfirmationDuration * 100)}%` : "All three tests must pass"}
    `);

    if (this.condition <= 0) {
      this.completed = true;
      this.game.failLevel("YOUR CAR BROKE DOWN — You missed your exam. Restarting Level 1…");
    }
  }

  updateAsphalt(dt) {
    if (!this.car) { return;  }
    // Reuse one vector instead of allocating a new Vector3 every frame.
    this.headlightWorldPosition.set(
      0,
      0.9,
      -2
    );

    this.car.localToWorld(
      this.headlightWorldPosition
    );


    if (this.asphaltUniforms) {
      this.asphaltUniforms
        .uTime
        .value +=
        dt;

      this.asphaltUniforms
        .uHeadlightPosition
        .value
        .copy(
          this.headlightWorldPosition
        );
    }


    if (this.potholeWaterUniforms) {
      this.potholeWaterUniforms
        .uTime
        .value +=
        dt;

      this.potholeWaterUniforms
        .uHeadlightPosition
        .value
        .copy(
          this.headlightWorldPosition
        );
    }
  }
  createPotholeSplashSystem() {
    const capacity =
      POTHOLE_SPLASH_CAPACITY;

    const positions =
      new Float32Array(
        capacity * 3
      );

    const velocities =
      new Float32Array(
        capacity * 3
      );

    const ages =
      new Float32Array(
        capacity
      );

    const lifetimes =
      new Float32Array(
        capacity
      );

    const sizes =
      new Float32Array(
        capacity
      );

    const alphas =
      new Float32Array(
        capacity
      );

    const stretches =
      new Float32Array(
        capacity
      );


    for (
      let index = 0;
      index < capacity;
      index++
    ) {
      positions[
        index * 3 + 1
      ] =
        -1000;

      sizes[index] =
        1;

      alphas[index] =
        0;

      stretches[index] =
        1;
    }


    const geometry =
      new THREE.BufferGeometry();


    const positionAttribute =
      new THREE.BufferAttribute(
        positions,
        3
      );

    const sizeAttribute =
      new THREE.BufferAttribute(
        sizes,
        1
      );

    const alphaAttribute =
      new THREE.BufferAttribute(
        alphas,
        1
      );

    const stretchAttribute =
      new THREE.BufferAttribute(
        stretches,
        1
      );


    positionAttribute.setUsage(
      THREE.DynamicDrawUsage
    );

    sizeAttribute.setUsage(
      THREE.DynamicDrawUsage
    );

    alphaAttribute.setUsage(
      THREE.DynamicDrawUsage
    );

    stretchAttribute.setUsage(
      THREE.DynamicDrawUsage
    );


    geometry.setAttribute(
      "position",
      positionAttribute
    );

    geometry.setAttribute(
      "aSize",
      sizeAttribute
    );

    geometry.setAttribute(
      "aAlpha",
      alphaAttribute
    );

    geometry.setAttribute(
      "aStretch",
      stretchAttribute
    );


    geometry.setDrawRange(
      0,
      capacity
    );


    const points =
      new THREE.Points(
        geometry,
        createPotholeSplashMaterial()
      );


    points.name =
      "level-one-pothole-splash";

    points.frustumCulled =
      false;

    points.renderOrder =
      5;


    this.root.add(
      points
    );


    this.potholeSplash = {
      capacity,
      points,

      positions,
      velocities,
      ages,
      lifetimes,
      sizes,
      alphas,
      stretches,

      positionAttribute,
      sizeAttribute,
      alphaAttribute,
      stretchAttribute,

      cursor: 0
    };
  }


  triggerPotholeSplash(
    pothole,
    impactSpeed,
    radius
  ) {
    const splash =
      this.potholeSplash;

    if (
      !splash ||
      !pothole.userData.isWet
    ) {
      return;
    }


    if (
      impactSpeed < 0.18
    ) {
      return;
    }


    const radiusRange =
      Math.max(
        0.001,
        LEVEL_ONE_PARKING_LAYOUT.potholeRadiusMax -
          LEVEL_ONE_PARKING_LAYOUT.potholeRadiusMin
      );


    const severity =
      THREE.MathUtils.clamp(
        (
          radius -
          LEVEL_ONE_PARKING_LAYOUT.potholeRadiusMin
        ) /
          radiusRange,
        0,
        1
      );


    const speedFactor =
      THREE.MathUtils.clamp(
        impactSpeed / 6,
        0,
        1
      );


    const particleCount =
      Math.round(
        14 +
        severity * 10 +
        speedFactor * 30
      );


    const contactDx =
      this.car.position.x -
      pothole.position.x;

    const contactDz =
      this.car.position.z -
      pothole.position.z;

    const contactDistance =
      Math.hypot(
        contactDx,
        contactDz
      );

    const maximumContactOffset =
      radius * 0.48;


    let contactScale =
      1;


    if (
      contactDistance >
        maximumContactOffset &&
      contactDistance >
        0.0001
    ) {
      contactScale =
        maximumContactOffset /
        contactDistance;
    }


    const impactX =
      pothole.position.x +
      contactDx *
        contactScale;

    const impactZ =
      pothole.position.z +
      contactDz *
        contactScale;


    const physicalDepth =
      getPotholePhysicalDepth(
        radius
      );


    const fallbackWaterY =
      LEVEL_ONE_ASPHALT_Y -
      physicalDepth *
        POTHOLE_WATER_DEPTH_RATIO +
      0.002;


    const waterY =
      pothole.userData
        .waterMesh
        ?.position
        .y ??
      fallbackWaterY;


    const travelDirection =
      Math.sign(
        this.vehicle.speed
      ) || 1;


    const carAngle =
      this.car.rotation.y;


    const forwardX =
      -Math.sin(
        carAngle
      ) *
      travelDirection;

    const forwardZ =
      -Math.cos(
        carAngle
      ) *
      travelDirection;


    for (
      let particle = 0;
      particle <
      particleCount;
      particle++
    ) {
      const slot =
        splash.cursor;


      splash.cursor =
        (
          splash.cursor + 1
        ) %
        splash.capacity;


      const offset =
        slot * 3;


      const spawnAngle =
        Math.random() *
        Math.PI *
        2;


      const spawnRadius =
        Math.sqrt(
          Math.random()
        ) *
        radius *
        0.12;


      splash.positions[
        offset
      ] =
        impactX +
        Math.cos(
          spawnAngle
        ) *
        spawnRadius;


      splash.positions[
        offset + 1
      ] =
        waterY +
        0.025 +
        Math.random() *
          0.035;


      splash.positions[
        offset + 2
      ] =
        impactZ +
        Math.sin(
          spawnAngle
        ) *
        spawnRadius;


      const sprayAngle =
        Math.random() *
        Math.PI *
        2;


      const radialX =
        Math.cos(
          sprayAngle
        );

      const radialZ =
        Math.sin(
          sprayAngle
        );


      const radialSpeed =
        (
          1.1 +
          Math.random() *
            1.5
        ) *
        (
          0.70 +
          speedFactor
        ) *
        (
          0.90 +
          severity *
            0.25
        );


      const forwardSpeed =
        (
          0.50 +
          Math.random() *
            0.80
        ) *
        speedFactor *
        2.2;


      splash.velocities[
        offset
      ] =
        radialX *
          radialSpeed +
        forwardX *
          forwardSpeed;


      splash.velocities[
        offset + 2
      ] =
        radialZ *
          radialSpeed +
        forwardZ *
          forwardSpeed;


      const highDroplet =
        Math.random() <
        0.32;


      splash.velocities[
        offset + 1
      ] =
        highDroplet
          ? 3.2 +
            Math.random() *
              2.6 +
            speedFactor *
              0.9
          : 1.4 +
            Math.random() *
              1.8 +
            speedFactor *
              0.7;


      splash.ages[
        slot
      ] =
        0;


      splash.lifetimes[
        slot
      ] =
        highDroplet
          ? 0.56 +
            Math.random() *
              0.20
          : 0.42 +
            Math.random() *
              0.20;


      // High droplets become thin vertical streaks.
      // Low particles become flatter sideways spray.
      splash.stretches[
        slot
      ] =
        highDroplet
          ? THREE.MathUtils.lerp(
              0.34,
              0.52,
              Math.random()
            )
          : THREE.MathUtils.lerp(
              1.15,
              1.75,
              Math.random()
            );


      // Smaller than the old round "bubble" particles.
      splash.sizes[
        slot
      ] =
        highDroplet
          ? 10 +
            Math.random() *
              7 +
            speedFactor *
              3
          : 8 +
            Math.random() *
              6 +
            speedFactor *
              3;


      splash.alphas[
        slot
      ] =
        0.72 +
        Math.random() *
          0.22;
    }


    splash.positionAttribute.needsUpdate =
      true;

    splash.sizeAttribute.needsUpdate =
      true;

    splash.alphaAttribute.needsUpdate =
      true;

    splash.stretchAttribute.needsUpdate =
      true;
  }


  updatePotholeSplashes(
    dt
  ) {
    const splash =
      this.potholeSplash;

    if (!splash) {
      return;
    }


    const horizontalDrag =
      Math.exp(
        -1.7 * dt
      );


    let changed =
      false;


    for (
      let index = 0;
      index <
      splash.capacity;
      index++
    ) {
      const lifetime =
        splash.lifetimes[
          index
        ];


      if (
        lifetime <= 0
      ) {
        continue;
      }


      splash.ages[
        index
      ] +=
        dt;


      const age =
        splash.ages[
          index
        ];


      const offset =
        index * 3;


      if (
        age >= lifetime
      ) {
        splash.lifetimes[
          index
        ] =
          0;

        splash.alphas[
          index
        ] =
          0;

        splash.positions[
          offset + 1
        ] =
          -1000;

        changed =
          true;

        continue;
      }


      splash.velocities[
        offset
      ] *=
        horizontalDrag;

      splash.velocities[
        offset + 2
      ] *=
        horizontalDrag;


      splash.velocities[
        offset + 1
      ] -=
        POTHOLE_SPLASH_GRAVITY *
        dt;


      splash.positions[
        offset
      ] +=
        splash.velocities[
          offset
        ] *
        dt;

      splash.positions[
        offset + 1
      ] +=
        splash.velocities[
          offset + 1
        ] *
        dt;

      splash.positions[
        offset + 2
      ] +=
        splash.velocities[
          offset + 2
        ] *
        dt;


      const progress =
        THREE.MathUtils.clamp(
          age /
            lifetime,
          0,
          1
        );


      const fadeIn =
        Math.min(
          1,
          age / 0.045
        );

      const fadeOut =
        1 -
        progress;


      splash.alphas[
        index
      ] =
        fadeIn *
        fadeOut *
        fadeOut;


      changed =
        true;
    }


    if (!changed) {
      return;
    }


    splash.positionAttribute.needsUpdate =
      true;

    splash.alphaAttribute.needsUpdate =
      true;
  }


  checkPotholes() {
    let contactedPothole = null;

    // Work out which pothole we are currently inside.
    // This lets the feedback fire on ENTER rather than every frame.
    for (const pothole of this.potholes) {
      const radius =
        pothole.userData.radius ??
        0.8;

      const distance =
        pothole.position.distanceTo(
          this.car.position
        );

      if (
        distance <
        radius + 0.65
      ) {
        contactedPothole =
          pothole;

        break;
      }
    }

    // Leaving all potholes arms the next impact.
    if (!contactedPothole) {
      this.activePothole = null;
      return;
    }

    // Remaining inside the same pothole must not continuously
    // retrigger camera shake / suspension feedback.
    if (
      this.activePothole ===
      contactedPothole
    ) {
      return;
    }

    this.activePothole =
      contactedPothole;

    if (this.potholeCooldown > 0) {
      return;
    }

    const radius =
      contactedPothole.userData.radius ??
      0.8;

    const impact =
      getPotholeImpact(radius);

    // Radius controls the basic severity, while actual driving speed
    // controls how violently the car experiences it.
    const impactSpeed =
      Math.abs(
        this.vehicle.speed
      );

    const speedFactor =
      THREE.MathUtils.clamp(
        impactSpeed / 6,
        0,
        1
      );

    const feedbackScale =
      THREE.MathUtils.lerp(
        0.55,
        1.10,
        speedFactor
      );

    if (
      contactedPothole.userData.isWet
    ) {
      this.triggerPotholeSplash(
        contactedPothole,
        impactSpeed,
        radius
      );
    }

    const travelDirection =
      Math.sign(
        this.vehicle.speed
      ) || 1;

    this.vehicle.speed *=
      impact.speedMultiplier;

    this.cameraShake =
      Math.max(
        this.cameraShake,
        impact.cameraShake *
          feedbackScale
      );

    // Give the suspension pivot an impulse.
    // Positive forward travel produces a nose-down kick;
    // the spring update then rebounds naturally.
    this.potholePitchVelocity -=
      impact.suspensionKick *
      feedbackScale *
      travelDirection;

    this.game.flashHUD();

    this.audio.cue(
      92,
      0.12,
      0.14
    );

    this.condition =
      Math.max(
        0,
        this.condition -
          impact.damage
      );

    this.potholeCooldown =
      impact.cooldown;
  }

  checkCampusEscapeEasterEgg() {
    const gate=PARKING_LAYOUT.campusGate;
    const road=PARKING_LAYOUT.campusRoad;
    if (
      this.car.position.x > gate.x + 0.75 &&
      Math.abs(this.car.position.z-road.z) < road.depth/2
    ) {
      this.completed=true;
      this.vehicle.stop();
      this.game.completeGameEasterEgg();
      return true;
    }
    return false;
  }

  checkParking(dt) {
    // Any of the free bays will do, so score the car against all of them and
    // judge it on whichever one it is closest to filling.
    let best = null;
    for (const bay of this.parkingBays) {
      const containment = this.getParkingContainment(bay);
      if (!best || containment > best.containment) best = { bay, containment };
    }

    const containmentPercent = (best?.containment ?? 0) * 100;
    const angleError = parkingAxisAngleError(
      this.car.rotation.y,
      best?.bay.angle ?? 0
    );

    this.parkingStatus.containment = containmentPercent >= 80;
    this.parkingStatus.alignment = angleError <= THREE.MathUtils.degToRad(12);
    this.parkingStatus.rest = Math.abs(this.vehicle.speed) < 0.3;
    this.parkingStatus.containmentPercent = containmentPercent;

    if (
      this.parkingStatus.containment &&
      this.parkingStatus.alignment &&
      this.parkingStatus.rest
    ) {
      this.parkingStatus.holdTime += dt;
    } else {
      this.parkingStatus.holdTime = 0;
    }

    if (this.parkingStatus.holdTime >= this.parkingConfirmationDuration) {
      this.completed = true;
      this.game.completeLevel("Parked! Heading to Level 2.");
    }
  }

  getParkingContainment(bay) {
    const bayCos = Math.cos(-bay.angle);
    const baySin = Math.sin(-bay.angle);
    const dx = this.car.position.x - bay.x;
    const dz = this.car.position.z - bay.z;
    const center = { x: dx * bayCos - dz * baySin, z: dx * baySin + dz * bayCos };
    const carAngle = this.car.rotation.y - bay.angle;
    const halfWidth = 1.05;
    const halfDepth = 2;
    const corners = [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [halfWidth, halfDepth], [-halfWidth, halfDepth]].map(([x, z]) => ({
      x: center.x + x * Math.cos(carAngle) - z * Math.sin(carAngle),
      z: center.z + x * Math.sin(carAngle) + z * Math.cos(carAngle)
    }));
    const bounds = [
      { axis: "x", value: -bay.width / 2, greater: true }, { axis: "x", value: bay.width / 2, greater: false },
      { axis: "z", value: -bay.depth / 2, greater: true }, { axis: "z", value: bay.depth / 2, greater: false }
    ];
    const clipped = bounds.reduce((polygon, bound) => this.clipParkingPolygon(polygon, bound), corners);
    return this.polygonArea(clipped) / (halfWidth * 2 * halfDepth * 2);
  }

  clipParkingPolygon(polygon, bound) {
    const result = [];
    for (let index = 0; index < polygon.length; index++) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = bound.greater ? current[bound.axis] >= bound.value : current[bound.axis] <= bound.value;
      const previousInside = bound.greater ? previous[bound.axis] >= bound.value : previous[bound.axis] <= bound.value;
      if (currentInside !== previousInside) {
        const otherAxis = bound.axis === "x" ? "z" : "x";
        const t = (bound.value - previous[bound.axis]) / (current[bound.axis] - previous[bound.axis]);
        result.push({ [bound.axis]: bound.value, [otherAxis]: previous[otherAxis] + t * (current[otherAxis] - previous[otherAxis]) });
      }
      if (currentInside) result.push(current);
    }
    return result;
  }

  polygonArea(polygon) {
    return Math.abs(polygon.reduce((area, point, index) => {
      const next = polygon[(index + 1) % polygon.length];
      return area + point.x * next.z - next.x * point.z;
    }, 0)) / 2;
  }

  updateVehicleVisuals(dt) {
    const wheelSpin =
      this.vehicle.speed /
      0.38 *
      dt;

    // The imported wheel mesh is thin on local Y, so Y is its axle.
    // rotateY preserves the wheel's authored base orientation.
    for (const wheel of this.wheels) {
      wheel.rotateY(
        -wheelSpin
      );
    }

    for (
      const pivot of
      this.frontWheelPivots
    ) {
      pivot.rotation.y =
        this.vehicle.steering;
    }

    // ------------------------------------------------------
    // POTHOLE SUSPENSION SPRING
    // ------------------------------------------------------
    //
    // The hit injects velocity once.
    // A damped spring then produces:
    //
    //   dip -> rebound -> settle
    //
    // rather than holding the car at a fixed pitch angle.

    const springStiffness =
      55;

    const springDamping =
      10.5;

    const pitchAcceleration =
      -this.potholePitch *
        springStiffness -
      this.potholePitchVelocity *
        springDamping;

    this.potholePitchVelocity +=
      pitchAcceleration *
      dt;

    this.potholePitch +=
      this.potholePitchVelocity *
      dt;

    // Avoid tiny floating-point movement once the spring has settled.
    if (
      Math.abs(
        this.potholePitch
      ) < 0.0001 &&
      Math.abs(
        this.potholePitchVelocity
      ) < 0.0001
    ) {
      this.potholePitch = 0;
      this.potholePitchVelocity = 0;
    }

    this.suspension.rotation.x =
      -this.vehicle.speed *
        0.012 +
      this.potholePitch;
  }

  toggleCollisionDebug(visible) {
    this.collisionWorld.setDebugVisible(visible);
  }
  updateCamera(dt) {
    if (this.skyViewActive) {
      const previousViewHeight =
        this.skyCamera.userData
          .viewHeight;

      this.updateSkyCameraFrustum();

      if (
        this.skyCamera.userData
          .viewHeight !==
        previousViewHeight
      ) {
        this.game.onResize();
      }

      return;
    }

    const camera =
      this.game.camera;

    const carAngle =
      this.car.rotation.y;

    const behind =
      new THREE.Vector3(
        Math.sin(carAngle) * 8,
        5,
        Math.cos(carAngle) * 8
      );

    const targetPosition =
      this.car.position
        .clone()
        .add(behind);

    camera.position.lerp(
      targetPosition,
      1 -
        Math.exp(
          -5 * dt
        )
    );

    let cameraRoll = 0;

    if (this.cameraShake > 0) {
      // A large pothole now lasts roughly half a second.
      this.cameraShake =
        Math.max(
          0,
          this.cameraShake -
            dt * 0.78
        );

      const time =
        performance.now() *
        0.001;

      const verticalShake =
        Math.sin(
          time * 52
        ) *
        this.cameraShake *
        0.32;

      const lateralShake =
        Math.sin(
          time * 67 +
          1.1
        ) *
        this.cameraShake *
        0.18;

      camera.position.y +=
        verticalShake;

      // Lateral movement is relative to the car,
      // not an arbitrary world X direction.
      camera.position.x +=
        Math.cos(carAngle) *
        lateralShake;

      camera.position.z -=
        Math.sin(carAngle) *
        lateralShake;

      // Very small roll sells the impact without making the
      // camera unpleasant to use.
      cameraRoll =
        Math.sin(
          time * 61 +
          0.4
        ) *
        this.cameraShake *
        0.035;
    }

    const lookTarget =
      this.car.position.clone();

    lookTarget.y += 1;

    camera.lookAt(
      lookTarget
    );

    // lookAt resets orientation each frame, so this cannot drift.
    camera.rotation.z +=
      cameraRoll;
  }

  dispose() {
    this.carIdleAudio?.pause();
    this.carIdleAudio = null;
    this.audio.dispose();
    this.controls?.dispose();
    this.viewToggle?.removeEventListener("click", this.onViewToggle);
    if (this.viewToggle) {
      this.viewToggle.hidden = true;
      this.viewToggle.textContent = "Sky view";
      this.viewToggle.setAttribute("aria-pressed", "false");
    }
    disposeObject3D(this.root);
    this.potholeSplash = null;
  }
}
