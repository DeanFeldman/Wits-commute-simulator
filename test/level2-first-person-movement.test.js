import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { normalizeFacingYaw, turnFacingYaw, directionFromFacing, FIRST_PERSON_TURN_STEP, FIRST_PERSON_TURN_SPEED } from "../src/levels/crossing/firstPersonMovement.js";
import { GridHopController } from "../src/levels/crossing/GridHopController.js";
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test("first-person W and S follow exact camera yaw, including noncardinal angles", () => {
  for (const angle of [0, Math.PI / 15, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI * 0.67]) {
    const forward = directionFromFacing(angle), reverse = directionFromFacing(angle, true);
    near(forward.x, Math.sin(angle));
    near(forward.z, Math.cos(angle));
    near(reverse.x, -forward.x);
    near(reverse.z, -forward.z);
    near(Math.hypot(forward.x, forward.z), 1);
  }
});

test("turns remain 12 degrees per tap, continuous while held", () => {
  near(FIRST_PERSON_TURN_STEP, Math.PI / 15);
  const yaw = normalizeFacingYaw(Math.PI + 0.08);
  near(normalizeFacingYaw(turnFacingYaw(yaw, 1) - yaw), FIRST_PERSON_TURN_STEP);
  near(normalizeFacingYaw(turnFacingYaw(yaw, -1) - yaw), -FIRST_PERSON_TURN_STEP);
  near(turnFacingYaw(turnFacingYaw(yaw, 1), -1), yaw);
  near(turnFacingYaw(0, -1, FIRST_PERSON_TURN_SPEED / 60), -Math.PI / 90);
});

const makeWalker = (options = {}) => {
  const player = new THREE.Group();
  player.rotation.y = Math.PI;
  const controller = new GridHopController(player, { cellSize: 1, gridOriginZ: 0, walkSpeed: 3,
    minX: -5, maxX: 5, minZ: -5, maxZ: 5, ...options });
  controller.setFreeMovement(true);
  controller.lockedFacingYaw = player.rotation.y;
  return { player, controller };
};

test("first-person moves diagonally at the actual facing angle, not grid snapped", () => {
  const { player, controller } = makeWalker();
  controller.lockedFacingYaw = Math.PI + Math.PI / 15;
  controller.freeThrottle = 1;
  const travelled = controller.update(0.1);
  const expectedYaw = player.rotation.y;
  assert.ok(travelled && player.position.x < 0 && player.position.z < 0);
  near(travelled.x, Math.sin(expectedYaw));
  near(travelled.z, Math.cos(expectedYaw));
  near(controller.gridPosition.x, player.position.x);
  near(controller.gridPosition.y, player.position.z);
  near(controller.distanceWalked, 0.3);
  assert.equal(controller.freeMoving, true);
});

test("reverse and stationary turning preserve heading", () => {
  const { player, controller } = makeWalker();
  controller.freeThrottle = -1;
  controller.update(0.1);
  assert.ok(player.position.z > 0);
  near(player.rotation.y, Math.PI);
  controller.freeThrottle = 0;
  controller.lockedFacingYaw = Math.PI / 2;
  const before = player.position.clone();
  controller.update(0.1);
  near(player.position.distanceTo(before), 0);
  assert.ok(player.rotation.y < Math.PI);
  assert.equal(controller.freeMoving, false);
});

test("first-person motion honours geometry and NPC blocking without tunnelling", () => {
  let blocked = 0;
  const { player, controller } = makeWalker({
    minX: -0.4, canEnter: (x, z) => z >= -0.35,
    onBlocked: () => { blocked++; }
  });
  controller.freeThrottle = 1;
  controller.update(0.5);
  assert.ok(player.position.z >= -0.35);
  assert.equal(blocked, 1);
  controller.update(0.1);
  assert.equal(blocked, 1, "blocked collisions must be throttled");
});

test("first-person reaches the exact finish boundary on a partial step", () => {
  const { player, controller } = makeWalker({ minZ: -0.25 });
  controller.freeThrottle = 1;
  controller.update(0.2);
  near(player.position.z, -0.25);
  near(controller.gridPosition.y, -0.25);
  near(controller.distanceWalked, 0.25);
});

test("switching out of first-person restores the third-person grid controller", () => {
  const { player, controller } = makeWalker();
  controller.lockedFacingYaw = Math.PI / 15;
  controller.freeThrottle = 1;
  controller.update(0.1);
  controller.setFreeMovement(false);
  assert.equal(controller.freeMovement, false);
  assert.equal(controller.hop, null);
  controller.lockedFacingYaw = null;
  controller.enqueue({ x: 0, z: -1 });
  controller.update(0.1);
  assert.ok(controller.hop !== null);
});
