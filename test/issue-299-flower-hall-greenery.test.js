import assert from "node:assert/strict";
import test from "node:test";
import { getFlowerHallGardenFoliageLayout } from "../src/levels/parking/ParkingFoliage.js";

test("issue #299: Flower Hall greenery uses deterministic shared foliage clear of asphalt and walkways", () => {
  const first = getFlowerHallGardenFoliageLayout(), second = getFlowerHallGardenFoliageLayout();
  assert.deepEqual(first, second);
  assert.equal(first.trees.length, 16);
  assert.equal(first.bushes.length, 66);
  assert.equal(first.grass.length, 112);
  for (const item of [...first.trees, ...first.bushes, ...first.grass]) {
    assert.ok(item.x > -50.2 && item.x < -29, "inside the grass corridor, not either car park");
    assert.ok(item.z > 46 && item.z < 119, "clear of campus road and garden end");
    assert.ok(Math.abs(item.x + 39.5) > 2.5, "clear of the north-south pedestrian path");
    assert.ok(Math.hypot(item.x + 39.5, item.z - 91) > 7, "clear of the circular plaza");
    assert.ok(Math.abs(item.z - 108) > 3, "clear of the east-west walkway");
    assert.equal(item.y, first.grass.includes(item) ? -0.10 : -0.235, "grass is slightly raised above the lawn");
    assert.ok(Math.abs(item.z - 91) > 3 || Math.abs(item.x + 39.5) > 7, "keep the circular cross path clear");
  }
  assert.ok(first.trees.every(({ x }) => Math.abs(x + 39.5) > 4.5), "tree trunks and crowns stay outside the path");
});
