import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { revertToSafePose } from "../src/levels/ParkingLevel.js";
import { VehicleController } from "../src/shared/VehicleController.js";
import { CollisionWorld } from "../src/shared/CollisionWorld.js";

// Reproduces the Level 1 "stuck on cars" bug: a player nosed up against a
// parked car who turns the wheel while holding the throttle (e.g. trying to
// angle into a bay next to one) has their rotation.y updated every frame by
// VehicleController, even on frames where the resulting translation gets
// rejected by the collision check. If only position is reverted on a hit,
// rotation keeps drifting while position stays frozen, so the frozen
// position can stop matching any collision-free rotation. After that, the
// car can never move again, in any direction — reverting always restores
// the same (now only-valid-by-accident, or already-borderline) position,
// forever.
function buildScene() {
  const root = new THREE.Group();
  const world = new CollisionWorld(root);

  const parkedCar = new THREE.Object3D();
  parkedCar.position.set(0, 0.6, 0);
  world.add({ object: parkedCar, size: [2.1, 1.2, 4.4], tag: "parked-car" });
  world.rebuild();

  const car = new THREE.Object3D();
  // Sitting flush against the parked car's west face, facing it (+X).
  car.position.set(-3.05, 0.6, 0);
  car.rotation.y = -Math.PI / 2;

  return { world, car, vehicle: new VehicleController(car) };
}

function driveFor(frames, input, world, car, vehicle, revert) {
  const dt = 1 / 60;
  let everMoved = false;
  const startX = car.position.x;

  for (let frame = 0; frame < frames; frame++) {
    const previousPosition = car.position.clone();
    const previousRotationY = car.rotation.y;

    vehicle.update(dt, input);

    const hit = world.firstHit(car, [2.1, 1.1, 4], () => true);
    if (hit) {
      revert(car, vehicle, previousPosition, previousRotationY);
    } else if (car.position.x !== startX) {
      everMoved = true;
    }
  }

  return everMoved;
}

test("reverting only position lets rotation drift and can weld the car in place forever", () => {
  const { world, car, vehicle } = buildScene();
  const positionOnlyRevert = (theCar, theVehicle, previousPosition) => {
    theCar.position.copy(previousPosition);
    theVehicle.stop();
  };

  // Player jams the wheel + throttle into the parked car for 3 seconds.
  driveFor(180, { throttle: 1, steering: 1 }, world, car, vehicle, positionOnlyRevert);

  const jammedX = car.position.x;
  const jammedRotation = car.rotation.y;
  assert.notEqual(jammedRotation, -Math.PI / 2, "rotation should have drifted away from its starting heading");

  // Player then lets go and holds reverse straight for a further 5 seconds,
  // trying to back away.
  const escaped = driveFor(300, { throttle: -1, steering: 0 }, world, car, vehicle, positionOnlyRevert);

  assert.equal(escaped, false, "with position-only revert the car should never move again, even holding reverse");
  assert.equal(car.position.x, jammedX, "the car should be frozen exactly where it jammed");
});

test("revertToSafePose keeps the car's heading valid so it can always back away", () => {
  const { world, car, vehicle } = buildScene();

  driveFor(180, { throttle: 1, steering: 1 }, world, car, vehicle, revertToSafePose);

  assert.equal(car.rotation.y, -Math.PI / 2, "rotation should stay pinned to the last collision-free heading");

  const escaped = driveFor(300, { throttle: -1, steering: 0 }, world, car, vehicle, revertToSafePose);

  assert.equal(escaped, true, "the car should be able to move again once it holds reverse");
  assert.ok(
    car.position.x < -10,
    `expected the car to back cleanly away from the parked car, got x=${car.position.x}`
  );
});