import test from "node:test";
import assert from "node:assert/strict";
import {
  NORTH_DIORAMA_CONFIG,
  createNorthDiorama,
  getNorthDioramaCarPlacements,
  getNorthDioramaFoliageExclusions
} from "../src/levels/parking/NorthDiorama.js";
import { PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";
import { getNorthDioramaFoliageLayout } from "../src/levels/parking/ParkingFoliage.js";

function northM1LipZAt(x) {
  const { m1 } = PARKING_LAYOUT;
  const localZ = -m1.depth / 2;
  const cos = Math.cos(m1.rotation);
  const sin = Math.sin(m1.rotation);
  const localX = (x - m1.x - sin * localZ) / cos;
  return m1.z - sin * localX + cos * localZ;
}

test("north diorama parking stays beyond the angled M1 cutting", () => {
  const { parking, foreground } = NORTH_DIORAMA_CONFIG;
  const southEdgeZ = parking.center[1] + parking.depth / 2;
  const westX = parking.center[0] - parking.width / 2;
  const eastX = parking.center[0] + parking.width / 2;

  for (const x of [westX, parking.center[0], eastX]) {
    assert.ok(
      southEdgeZ <= northM1LipZAt(x) - 2,
      `backdrop parking clears the far M1 lip at x=${x}`
    );
    assert.ok(
      foreground.fenceZ <= northM1LipZAt(x) - 2,
      `backdrop fence clears the far M1 lip at x=${x}`
    );
  }
});

test("north diorama cars stay inside their relocated parking ground", () => {
  const parking = NORTH_DIORAMA_CONFIG.parking;
  const southEdgeZ = parking.center[1] + parking.depth / 2;
  const northEdgeZ = parking.center[1] - parking.depth / 2;

  for (const car of getNorthDioramaCarPlacements()) {
    assert.ok(car.z < southEdgeZ);
    assert.ok(car.z > northEdgeZ);
  }
});

test("north-west forecourt fills the bridge-side gap without covering the M1", () => {
  const { plaza, landing, serviceLane } = NORTH_DIORAMA_CONFIG.northWestForecourt;
  const plazaWest = plaza.center[0] - plaza.width / 2;
  const plazaEast = plaza.center[0] + plaza.width / 2;
  const plazaSouth = plaza.center[1] + plaza.depth / 2;
  const parkingWest = NORTH_DIORAMA_CONFIG.parking.center[0]
    - NORTH_DIORAMA_CONFIG.parking.width / 2;

  for (const x of [plazaWest, plaza.center[0], plazaEast]) {
    assert.ok(
      plazaSouth <= northM1LipZAt(x) - 2,
      `forecourt clears the far M1 lip at x=${x}`
    );
  }
  assert.ok(
    landing.center[0] + landing.width / 2 >= -64,
    "landing reaches the existing pedestrian bridge"
  );
  assert.equal(
    serviceLane.center[0] + serviceLane.width / 2,
    parkingWest,
    "shuttle lane meets the west edge of the backdrop parking"
  );

  const { root, stats } = createNorthDiorama({ loadVegetation: false });
  const names = [];
  root.traverse((object) => names.push(object.name));
  assert.ok(names.includes("NorthWestForecourt"));
  assert.ok(names.includes("north-west-forecourt-plaza"));
  assert.ok(names.includes("north-west-shuttle-bodies"));
  assert.ok(names.includes("north-west-forecourt-tree-canopies"));
  assert.ok(stats.northWestForecourtDrawCalls <= 14, "forecourt remains a cheap static diorama");
  assert.equal(stats.dynamicUpdates, 0);
});

test("north diorama foliage builds fuller crowns and avoids architecture", () => {
  const exclusions = getNorthDioramaFoliageExclusions();
  const layout = getNorthDioramaFoliageLayout({ exclusions });

  assert.ok(layout.giantTrees.length > 0, "landscaping contains giant hero trees");
  assert.ok(layout.treesNear.length > 0, "landscaping contains detailed near trees");
  assert.ok(layout.treesFar.length > 0, "landscaping contains lightweight distant trees");
  assert.ok(
    [...layout.giantTrees, ...layout.treesNear, ...layout.treesFar]
      .every((tree) => tree.scale >= 4.5 && tree.scale <= 13),
    "tree heights remain appropriate for the campus buildings"
  );

  for (const item of [
    ...layout.giantTrees,
    ...layout.treesNear,
    ...layout.treesFar,
    ...layout.bushes,
    ...layout.grass
  ]) {
    for (const exclusion of exclusions) {
      const buffer = exclusion.buffer ?? 0;
      const inside = Math.abs(item.x - exclusion.x) < exclusion.width / 2 + buffer
        && Math.abs(item.z - exclusion.z) < exclusion.depth / 2 + buffer;
      assert.equal(inside, false, `foliage stays outside ${exclusion.name}`);
    }
  }
});
