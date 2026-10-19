import assert from "node:assert/strict";
import test from "node:test";
import { getFlowerHallGardenFoliageLayout } from "../src/levels/parking/ParkingFoliage.js";

test("issue #299: keep existing trees, crowd the bare path edge with new foliage", () => {
  const { trees, bushes, grass } = getFlowerHallGardenFoliageLayout();
  assert.deepEqual({ trees, bushes, grass }, getFlowerHallGardenFoliageLayout(), "repeatable random layout");
  assert.equal(trees.length, 84); // Original 36, plus 48 near the path.
  assert.equal(bushes.length, 330); // Original 220, plus 110 by the path.
  assert.equal(grass.length, 120);
  for (const item of [...trees, ...bushes, ...grass]) {
    assert.ok(item.x > -50.2 && item.x < -29, "kept inside lawn between parking lots");
    assert.ok(item.z > 46 && item.z < 119, "clear of campus road and garden boundary");
    assert.ok(Math.abs(item.x + 39.5) > 2.5, "tree trunks stay off the longitudinal path");
    assert.ok(Math.hypot(item.x + 39.5, item.z - 91) > 7, "circular plaza stays clear");
    assert.ok(Math.abs(item.z - 91) > 3 && Math.abs(item.z - 108) > 3, "cross paths stay clear");
  }
  assert.ok(trees.every(item => item.y === -0.235), "previous tree elevation preserved");
  assert.ok(trees.slice(36).every(item => Math.abs(item.x + 39.5) < 4.01), "new trees fill the path-side gaps");
  assert.ok(bushes.every(item => item.y === -0.09), "raised bushes above lawn");
  assert.ok(grass.every(item => item.y === -0.14 && item.scale <= 0.33), "grass raised but stays subtle");
  for (const side of [trees.slice(0, 18), trees.slice(18, 36)]) {
    for (let i = 0; i < side.length; i++) for (let j = i + 1; j < side.length; j++)
      assert.ok(Math.hypot(side[i].x-side[j].x,side[i].z-side[j].z) >= 3.65 - 1e-8, "original trees untouched");
  }
});
