import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { snapFacingYaw, turnFacingYaw, directionFromFacing } from "../src/levels/crossing/firstPersonMovement.js";
import { GridHopController } from "../src/levels/crossing/GridHopController.js";

test("first-person W and S follow the camera for every grid heading", () => {
  const cases = [[0, [0, 1]], [Math.PI / 2, [1, 0]], [Math.PI, [0, -1]], [-Math.PI / 2, [-1, 0]]];
  for (const [yaw, [x, z]] of cases) {
    assert.deepEqual(directionFromFacing(yaw), { x, z });
    assert.deepEqual(directionFromFacing(yaw, true), { x: -x, z: -z });
  }
});

test("A and D steer 90 degrees without switching forward and reverse", () => {
  const north = snapFacingYaw(Math.PI + 0.1);
  assert.deepEqual(directionFromFacing(turnFacingYaw(north, 1)), { x: -1, z: 0 });
  assert.deepEqual(directionFromFacing(turnFacingYaw(north, -1)), { x: 1, z: 0 });
  assert.deepEqual(directionFromFacing(turnFacingYaw(turnFacingYaw(north, 1), -1)), { x: 0, z: -1 });
  assert.deepEqual(directionFromFacing(turnFacingYaw(-Math.PI / 2, 1)), { x: 0, z: -1 });
});

test("grid movement keeps first-person facing while reversing", () => {
  const player = new THREE.Group();
  player.rotation.y = Math.PI;
  const hop = new GridHopController(player, { cellSize: 1 });
  hop.lockedFacingYaw = Math.PI;
  hop.enqueue(directionFromFacing(Math.PI, true));
  hop.update(0.1);
  assert.ok(hop.gridPosition.y > 0);
  assert.equal(player.rotation.y, Math.PI);
  hop.lockedFacingYaw = null;
  assert.equal(hop.lockedFacingYaw, null);
});
