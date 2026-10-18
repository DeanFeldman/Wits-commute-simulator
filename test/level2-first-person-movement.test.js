import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { normalizeFacingYaw, turnFacingYaw, directionFromFacing, FIRST_PERSON_TURN_STEP, FIRST_PERSON_TURN_SPEED } from "../src/levels/crossing/firstPersonMovement.js";
import { GridHopController } from "../src/levels/crossing/GridHopController.js";

const near = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-8, `${value} != ${expected}`);

test("W and S move along the nearest grid axis at every facing", () => {
  for (const [yaw, x, z] of [[0, 0, 1], [Math.PI / 2, 1, 0], [Math.PI, 0, -1], [-Math.PI / 2, -1, 0]]) {
    assert.deepEqual(directionFromFacing(yaw), { x, z });
    assert.deepEqual(directionFromFacing(yaw, true), { x: x === 0 ? 0 : -x, z: z === 0 ? 0 : -z });
  }
});

test("left/right taps turn by 12°, not 90°, without snapping camera facing", () => {
  near(FIRST_PERSON_TURN_STEP, Math.PI / 15);
  const start = normalizeFacingYaw(Math.PI + 0.08);
  near(start, -Math.PI + 0.08);
  const left = turnFacingYaw(start, 1), right = turnFacingYaw(start, -1);
  near(normalizeFacingYaw(left - start), FIRST_PERSON_TURN_STEP);
  near(normalizeFacingYaw(right - start), -FIRST_PERSON_TURN_STEP);
  near(turnFacingYaw(left, -1), start);
  assert.deepEqual(directionFromFacing(turnFacingYaw(Math.PI, 1)), { x: 0, z: -1 });
});

test("holding a turn smoothly advances by elapsed time instead of 90° jumps", () => {
  const dt = 1 / 60, yaw = turnFacingYaw(0, -1, FIRST_PERSON_TURN_SPEED * dt);
  near(yaw, -Math.PI / 90);
  near(FIRST_PERSON_TURN_SPEED, Math.PI * 2 / 3);
  // Cardinal walking stays collision-safe until facing crosses a grid boundary.
  let facing = 0;
  for (let i = 0; i < 3; i++) facing = turnFacingYaw(facing, -1);
  assert.deepEqual(directionFromFacing(facing), { x: 0, z: 1 });
  facing = turnFacingYaw(facing, -1);
  assert.deepEqual(directionFromFacing(facing), { x: -1, z: 0 });
});

test("walking backwards retains current first-person facing", () => {
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
