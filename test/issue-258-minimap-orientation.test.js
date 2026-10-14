import test from "node:test";
import assert from "node:assert/strict";
import { CrossingLevel } from "../src/levels/crossing/CrossingLevel.js";

test("Level 2 minimap faces the same direction as the full map", () => {
  const level = { startZ: 20, finishZ: -20, gridSize: 8, mapViewScale: 1, updateMapCameraFrustum() {}, updateMinimapCameraFrustum() {} };
  CrossingLevel.prototype.createMapCamera.call(level);
  CrossingLevel.prototype.createMinimapCamera.call(level);
  assert.deepEqual(level.minimapCamera.up.toArray(), level.mapCamera.up.toArray());
});
