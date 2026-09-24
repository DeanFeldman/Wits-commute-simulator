import test from "node:test";
import assert from "node:assert/strict";
import {
  createSouthDiorama,
  SOUTH_DIORAMA_CONFIG
} from "../src/levels/parking/SouthDiorama.js";
import { PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";
import { getSouthDioramaFoliageLayout } from "../src/levels/parking/ParkingFoliage.js";

test("south reference camera uses chase height and looks toward +Z", () => {
  const { position, target, fov, yaw } = SOUTH_DIORAMA_CONFIG.referenceCamera;

  assert.ok(target[2] > position[2], "saved view looks south toward +Z");
  assert.ok(position[1] >= 4.5 && position[1] <= 5.5, "camera uses normal chase height");
  assert.equal(fov, 58, "saved view preserves the Level 1 chase-camera FOV");
  assert.equal(yaw, Math.PI, "south yaw is 180 degrees from the Level 1 north heading");
});

test("south diorama reuses the existing campus road instead of covering it", () => {
  const sharedRoad = SOUTH_DIORAMA_CONFIG.sharedRoad;
  const { root, stats } = createSouthDiorama({ loadAssets: false });
  const names = [];
  root.traverse((object) => names.push(object.name));

  assert.deepEqual(sharedRoad.center, [PARKING_LAYOUT.campusRoad.x, PARKING_LAYOUT.campusRoad.z]);
  assert.equal(sharedRoad.width, PARKING_LAYOUT.campusRoad.width);
  assert.equal(sharedRoad.depth, PARKING_LAYOUT.campusRoad.depth);
  assert.equal(stats.reusesExistingRoad, true);
  assert.equal(stats.reusesExistingSecondaryParking, true);
  assert.ok(!names.includes("south-diorama-road-surface"));
});

test("south architecture has three distinct anchors and layered background", () => {
  const { root, stats } = createSouthDiorama({ loadAssets: false });
  const names = [];
  root.traverse((object) => names.push(object.name));

  assert.ok(names.includes("LeftLowBuilding"));
  assert.ok(names.includes("CentralTanBuilding"));
  assert.ok(names.includes("RightGreyBuilding"));
  assert.ok(names.includes("SecondaryBackgroundBuildings"));
  assert.ok(names.includes("south-central-window-grid"));
  assert.ok(names.includes("south-right-window-bands"));
  assert.ok(names.includes("south-left-window-grid"));
  assert.ok(names.includes("SouthIndustrialServiceYard"));
  assert.ok(names.includes("south-industrial-service-vans"));
  assert.ok(names.includes("south-industrial-loading-canopy"));
  assert.ok(names.includes("south-central-rooftop-units"));
  assert.ok(names.includes("south-central-service-stack"));
  assert.ok(stats.buildingMasses > 12, "the scene is more than three placeholder boxes");
  assert.ok(stats.industrialDetailDrawCalls <= 12, "industrial detail remains inexpensive");
  assert.equal(stats.dynamicUpdates, 0, "static scenery adds no update loop");

  const leftX = SOUTH_DIORAMA_CONFIG.leftBuilding.position[0];
  const centralX = SOUTH_DIORAMA_CONFIG.centralBuilding.position[0];
  const rightX = SOUTH_DIORAMA_CONFIG.rightBuilding.position[0];
  // A camera facing +Z shows positive world X on screen-left.
  assert.ok(rightX < centralX && centralX < leftX, "anchors preserve the screen-space hierarchy");
});

test("industrial service yard fills the foreground gap without blocking its neighbours", () => {
  const yard = SOUTH_DIORAMA_CONFIG.industrialYard;
  const secondaryParking = PARKING_LAYOUT.otherParking;
  const central = SOUTH_DIORAMA_CONFIG.centralBuilding;
  const road = PARKING_LAYOUT.bridgeRoadExtension;

  const parkingSouthEdge = secondaryParking.z + secondaryParking.depth / 2;
  const yardNorthEdge = yard.z - yard.depth / 2;
  const yardSouthEdge = yard.z + yard.depth / 2;
  const buildingNorthEdge = central.position[2] - central.size[2] / 2;
  assert.ok(yardNorthEdge > parkingSouthEdge, "yard starts beyond the reused secondary parking");
  assert.ok(yardSouthEdge < buildingNorthEdge, "yard stops before the central building");

  const roadCenterX = road.x + Math.tan(road.rotation) * (yard.z - road.z);
  const roadWestEdge = roadCenterX - road.width / Math.cos(road.rotation) / 2;
  const yardEastEdge = yard.x + yard.width / 2;
  assert.ok(roadWestEdge - yardEastEdge >= 6, "yard leaves a landscaped verge beside Yale Road");
  assert.ok(secondaryParking.depth >= 60, "secondary parking creates a deep campus midground");
  assert.ok(
    central.position[2] - secondaryParking.z >= 70,
    "principal buildings remain visibly set back from the middle of the parking garden"
  );
  const flowerHall = PARKING_LAYOUT.flowerHall;
  assert.ok(
    secondaryParking.x - secondaryParking.width / 2
      - (flowerHall.x + flowerHall.width / 2) >= 20,
    "the Flower Hall stays beside rather than across the south parking garden"
  );
});

test("south terrain continues behind the buildings and Yale Road misses the low-rise", () => {
  const terrain = PARKING_LAYOUT.terrain;
  const background = SOUTH_DIORAMA_CONFIG.background;
  const lowRise = SOUTH_DIORAMA_CONFIG.leftBuilding;
  const road = PARKING_LAYOUT.bridgeRoad;
  const roadExtension = PARKING_LAYOUT.bridgeRoadExtension;

  assert.ok(
    terrain.edge > background.centerZ + background.depth / 2 + 40,
    "grass continues well behind the rear building layer"
  );

  const localRoadZ = (lowRise.position[2] - road.z) / Math.cos(road.rotation);
  const roadCenterX = road.x + Math.sin(road.rotation) * localRoadZ;
  const roadEastEdgeX = roadCenterX + Math.cos(road.rotation) * road.width / 2;
  const buildingWestEdgeX = lowRise.position[0] - lowRise.size[0] / 2;
  assert.ok(
    buildingWestEdgeX - roadEastEdgeX >= 6,
    "the low-rise leaves a visible verge beside the projected Yale Road alignment"
  );

  const roadSouthEdge = roadExtension.z
    + Math.cos(roadExtension.rotation) * roadExtension.depth / 2;
  assert.ok(
    roadSouthEdge >= terrain.edge - 1,
    "Yale Road continues to the southern terrain boundary"
  );

  const roadEnd = [
    road.x + Math.sin(road.rotation) * road.depth / 2,
    road.z + Math.cos(road.rotation) * road.depth / 2
  ];
  const extensionStart = [
    roadExtension.x - Math.sin(roadExtension.rotation) * roadExtension.depth / 2,
    roadExtension.z - Math.cos(roadExtension.rotation) * roadExtension.depth / 2
  ];
  assert.ok(
    Math.hypot(roadEnd[0] - extensionStart[0], roadEnd[1] - extensionStart[1]) < 0.03,
    "the Yale Road continuation has no visible seam"
  );
});

test("the southern boundary wall leaves Yale Road unobstructed", () => {
  const { detailZ, boundaryWallRuns } = SOUTH_DIORAMA_CONFIG.roadside;
  const road = PARKING_LAYOUT.bridgeRoadExtension;
  const wallZ = detailZ + 0.4;
  const roadCenterX = road.x + Math.tan(road.rotation) * (wallZ - road.z);
  const clearance = road.width / Math.cos(road.rotation) / 2 + 0.5;

  assert.ok(
    boundaryWallRuns.every(([start, end]) => (
      end <= roadCenterX - clearance || start >= roadCenterX + clearance
    )),
    "no boundary-wall run crosses the extended Yale Road"
  );
});

test("south vegetation uses organic close and rear layers", () => {
  const roads = [
    PARKING_LAYOUT.bridgeRoad,
    PARKING_LAYOUT.bridgeRoadExtension,
    PARKING_LAYOUT.otherParking,
    SOUTH_DIORAMA_CONFIG.industrialYard
  ];
  const layout = getSouthDioramaFoliageLayout(
    SOUTH_DIORAMA_CONFIG.vegetation.density,
    roads
  );
  const trees = [...layout.giantTrees, ...layout.lod2Trees];

  assert.ok(layout.giantTrees.length >= 3, "hero trees break the principal facades");
  // The service yard deliberately replaces part of the former planted strip
  // with hardscape, while retaining dense planting on both sides.
  assert.ok(layout.lod2Trees.length >= 36, "bulk trees create a mature campus edge");
  assert.ok(layout.bushes.length >= 50, "LOD2 understory hides hard scenery seams");
  assert.ok(layout.grass.length >= 20, "grass remains a sparse accent layer");
  assert.ok(trees.some((tree) => tree.z < 90), "trees overlap the front building layer");
  assert.ok(trees.some((tree) => tree.z > 190), "trees continue behind the architecture");
  assert.ok(
    trees.every((tree) => tree.scale >= 5.5 && tree.scale <= 12),
    "tree scale remains credible against the campus buildings"
  );

  for (const [kind, placements, margin] of [
    ["tree", trees, 4],
    ["bush", layout.bushes, 1.4],
    ["grass", layout.grass, 0.9]
  ]) {
    for (const item of placements) {
      for (const road of roads) {
        const dx = item.x - road.x;
        const dz = item.z - road.z;
        const cos = Math.cos(road.rotation);
        const sin = Math.sin(road.rotation);
        const localX = dx * cos - dz * sin;
        const localZ = dx * sin + dz * cos;
        if (Math.abs(localZ) > road.depth / 2 + margin) continue;
        assert.ok(
          Math.abs(localX) > road.width / 2 + margin,
          `${kind} at (${item.x}, ${item.z}) stays clear of Yale Road`
        );
      }
    }
  }
});
