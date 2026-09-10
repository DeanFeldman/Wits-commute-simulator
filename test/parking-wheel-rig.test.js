import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  rigPlayerCarWheels
} from "../src/levels/ParkingLevel.js";

test("player car wheel rig keeps all wheels attached at their original centres", () => {
  const model = new THREE.Group();
  const root = new THREE.Group();
  model.add(root);

  const positions = {
    wheel_00: [-2, 0.5, -1.3],
    wheel_01: [-2, 0.5, 1.3],
    wheel_02: [2, 0.5, 1.3],
    wheel_03: [2, 0.5, -1.3]
  };

  const originalPositions = new Map();

  for (const [name, position] of Object.entries(positions)) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(...position);
    wheel.rotation.z = 0.25;
    root.add(wheel);

    originalPositions.set(name, wheel.position.clone());
  }

  const rig = rigPlayerCarWheels(model);

  assert.equal(rig.wheels.length, 4);
  assert.equal(rig.frontWheelPivots.length, 2);

  assert.deepEqual(
    rig.frontWheelPivots.map((pivot) => pivot.name).sort(),
    [
      "wheel_00-steering-pivot",
      "wheel_03-steering-pivot"
    ]
  );

  for (const wheel of rig.wheels) {
    const expected = originalPositions.get(wheel.name);

    assert.deepEqual(
      wheel.position.toArray(),
      [0, 0, 0]
    );

    assert.deepEqual(
      wheel.parent.position.toArray(),
      expected.toArray()
    );
  }
});

test("steering pivots rotate without moving the front wheel centres", () => {
  const model = new THREE.Group();
  const root = new THREE.Group();
  model.add(root);

  for (const [name, x] of [
    ["wheel_00", -1],
    ["wheel_01", -1],
    ["wheel_02", 1],
    ["wheel_03", 1]
  ]) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.5, name.endsWith("0") || name.endsWith("1") ? -1 : 1);
    root.add(wheel);
  }

  const rig = rigPlayerCarWheels(model);

  model.updateMatrixWorld(true);

  const before = rig.frontWheelPivots.map((pivot) =>
    pivot.getWorldPosition(new THREE.Vector3()).clone()
  );

  for (const pivot of rig.frontWheelPivots) {
    pivot.rotation.y = 0.45;
  }

  model.updateMatrixWorld(true);

  rig.frontWheelPivots.forEach((pivot, index) => {
    const after = pivot.getWorldPosition(new THREE.Vector3());

    assert.ok(after.distanceTo(before[index]) < 1e-10);
  });
});
