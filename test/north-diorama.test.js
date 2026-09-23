import test from "node:test";
import assert from "node:assert/strict";
import {
  NORTH_DIORAMA_CONFIG,
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
