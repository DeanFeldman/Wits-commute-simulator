import test from "node:test";
import assert from "node:assert/strict";
import { chooseSharkPothole, sharkEmergence, SHARK_TOTAL_SECONDS } from "../src/levels/parking/witsSharkEncounter.js";

const hole = (x, z, isWet = true) => ({ position: { x, z }, userData: { isWet, waterMesh: isWet ? {} : null } });

test("shark chooses nearest visible wet pothole within eight units", () => {
  const dry = hole(1, 0, false);
  const hidden = hole(2, 0);
  const visible = hole(5, 0);
  const far = hole(11, 0);
  assert.equal(chooseSharkPothole([dry, hidden, far, visible], 0, 0, p => p !== hidden), visible);
  assert.equal(chooseSharkPothole([far], 0, 0, () => true), null);
});

test("shark rises, holds, and fully disappears", () => {
  assert.equal(sharkEmergence(0), 0);
  assert.ok(sharkEmergence(0.3) > 0);
  assert.equal(sharkEmergence(1.5), 1);
  assert.ok(sharkEmergence(SHARK_TOTAL_SECONDS - 0.25) < 1);
  assert.equal(sharkEmergence(SHARK_TOTAL_SECONDS), 0);
  assert.equal(sharkEmergence(SHARK_TOTAL_SECONDS + 5), 0);
});
