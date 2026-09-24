import test from "node:test";
import assert from "node:assert/strict";
import {
  createWestDiorama,
  getWestDioramaFoliageExclusions,
  WEST_DIORAMA_CONFIG
} from "../src/levels/parking/WestDiorama.js";
import { getWestDioramaFoliageLayout } from "../src/levels/parking/ParkingFoliage.js";
import { PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";

test("west reference camera stays at chase height and looks toward -X", () => {
  const { position, target, fov, yaw } = WEST_DIORAMA_CONFIG.referenceCamera;

  assert.ok(target[0] < position[0], "saved view looks west toward -X");
  assert.ok(position[1] >= 4.5 && position[1] <= 5.5, "camera uses normal chase height");
  assert.equal(fov, 58, "west view keeps the gameplay field of view");
  assert.equal(yaw, Math.PI / 2, "west yaw is a quarter turn from north");
});

test("west diorama reuses the red-box playable parking foreground", () => {
  const { root, stats } = createWestDiorama({ loadAssets: false });
  const names = [];
  root.traverse((object) => names.push(object.name));

  assert.equal(WEST_DIORAMA_CONFIG.playableParking.reusedAsForeground, true);
  assert.equal(stats.reusesPlayableParking, true);
  assert.ok(!names.includes("west-diorama-parking-ground"));
  assert.ok(!names.includes("west-diorama-parked-cars"));
});

test("west architecture contains every reference-defining landmark", () => {
  const { root, stats } = createWestDiorama({ loadAssets: false });
  const names = [];
  root.traverse((object) => names.push(object.name));

  assert.ok(names.includes("west-central-grey-building"));
  assert.ok(names.includes("west-red-vertical-section"));
  assert.ok(names.includes("west-right-grey-annex"));
  assert.ok(names.includes("west-campus-service-road"));
  assert.ok(names.includes("west-m1-continuation"));
  assert.ok(names.includes("west-tower-landmark"));
  assert.ok(names.includes("west-background-window-bands"));
  assert.equal(stats.curvedRoofs, 3);
  assert.equal(stats.dynamicUpdates, 0);

  const curvedRoofs = names.filter((name) => /^west-curved-roof-\d+$/.test(name));
  assert.equal(curvedRoofs.length, 3, "three real curved roof surfaces define the left silhouette");
});

test("west service road extends the campus road without buildings crossing it", () => {
  const serviceRoad = WEST_DIORAMA_CONFIG.serviceRoad;
  const campusRoad = PARKING_LAYOUT.campusRoad;
  const roadSouthEdge = serviceRoad.center[1] + serviceRoad.depth / 2;

  assert.equal(serviceRoad.center[1], campusRoad.z, "road centres align at the west seam");
  assert.equal(serviceRoad.depth, campusRoad.depth, "road widths match at the west seam");

  for (const hall of WEST_DIORAMA_CONFIG.curvedRoofs) {
    const hallNorthEdge = hall.position[2] - hall.size[2] / 2;
    assert.ok(
      hallNorthEdge > roadSouthEdge,
      `curved-roof hall at Z ${hall.position[2]} stays south of the road`
    );
  }
});

test("central west facade dominates and its warm section remains readable", () => {
  const central = WEST_DIORAMA_CONFIG.centralBuilding;
  const red = WEST_DIORAMA_CONFIG.redSection;
  const annex = WEST_DIORAMA_CONFIG.annex;

  assert.ok(central.size[1] >= 26, "central grey building is a tall multi-storey anchor");
  assert.ok(central.size[2] >= 60, "central facade spans a broad screen-space width");
  assert.ok(red.size[1] >= central.size[1] * 0.8, "red section reads as a vertical mass, not trim");
  assert.ok(red.position[0] > central.position[0], "red section sits on the player-facing east facade");
  assert.ok(annex.position[2] < central.position[2], "annex occupies screen-right when looking west");
});

test("west foliage stays out of architecture while retaining a dense horizon", () => {
  const exclusions = getWestDioramaFoliageExclusions();
  const layout = getWestDioramaFoliageLayout({
    density: WEST_DIORAMA_CONFIG.vegetation.density,
    exclusions
  });
  const trees = [...layout.giantTrees, ...layout.lod2Trees];

  assert.ok(trees.length >= 45, "bulk LOD2 trees create a dense campus horizon");
  assert.ok(layout.giantTrees.length >= 3, "large foreground trees break up building bases");
  assert.ok(layout.bushes.length >= 45, "understory softens architectural seams");
  assert.ok(layout.grass.length >= 50, "grass accents continue through the deep scene");

  for (const item of [...trees, ...layout.bushes, ...layout.grass]) {
    for (const exclusion of exclusions) {
      const buffer = exclusion.buffer ?? 0;
      const inside = Math.abs(item.x - exclusion.x) < exclusion.width / 2 + buffer
        && Math.abs(item.z - exclusion.z) < exclusion.depth / 2 + buffer;
      assert.equal(inside, false, `foliage at (${item.x}, ${item.z}) avoids ${exclusion.name}`);
    }
  }
});
