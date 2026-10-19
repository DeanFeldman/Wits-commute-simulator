import assert from "node:assert/strict";
import test from "node:test";
import { getFlowerHallGardenFoliageLayout } from "../src/levels/parking/ParkingFoliage.js";

test("issue #299: dense seeded garden preserves paths, parking and natural spacing", () => {
  const layout = getFlowerHallGardenFoliageLayout();
  assert.deepEqual(layout, getFlowerHallGardenFoliageLayout(), "reproducible random scatter");
  const { trees, bushes, grass } = layout;
  assert.equal(trees.length, 36);
  assert.equal(bushes.length, 220);
  assert.equal(grass.length, 120);
  for (const item of [...trees, ...bushes, ...grass]) {
    assert.ok(item.x > -50.2 && item.x < -29, "outside both parking surfaces");
    assert.ok(item.z > 46 && item.z < 119, "outside campus road and garden end");
    assert.ok(Math.abs(item.x + 39.5) > 2.5, "outside north-south pedestrian path");
    assert.ok(Math.hypot(item.x + 39.5, item.z - 91) > 7, "outside circular island");
    assert.ok(Math.abs(item.z - 91) > 3 && Math.abs(item.z - 108) > 3, "outside cross paths");
  }
  assert.ok(trees.every((tree) => tree.y === -0.235 && tree.scale >= 4.8), "trees retain the normal lawn height");
  assert.ok(grass.every((tuft) => tuft.y === -0.205 && tuft.scale <= 0.33), "grass stays small and close to the lawn");
  for (const side of [trees.slice(0, 18), trees.slice(18)]) {
    for (let i = 0; i < side.length; i++) for (let j = i + 1; j < side.length; j++) {
      assert.ok(Math.hypot(side[i].x - side[j].x, side[i].z - side[j].z) >= 3.65 - 1e-8, "tree trunks have clearance");
    }
    assert.ok(new Set(side.map(({ x }) => Math.round(x * 10))).size >= 12, "not arranged in a straight line");
  }
});
