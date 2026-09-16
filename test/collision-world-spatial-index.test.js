import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { CollisionWorld } from "../src/shared/CollisionWorld.js";

function createColliderObject(x = 0, y = 0, z = 0, rotationY = 0) {
  const object = new THREE.Object3D();
  object.position.set(x, y, z);
  object.rotation.y = rotationY;
  return object;
}

test("long collider is detected near its far end", () => {
  const root = new THREE.Group();
  const world = new CollisionWorld(root, 5);

  const fence = createColliderObject(0, 0, 0);

  world.add({
    object: fence,
    size: [30, 2, 0.5],
    tag: "fence"
  });

  world.rebuild();

  const car = createColliderObject(14, 0, 0);

  const hit = world.firstHit(
    car,
    [1, 1, 1],
    (collider) => collider.tag === "fence"
  );

  assert.ok(hit);
  assert.equal(hit.tag, "fence");
});

test("rotated long collider is detected near its far end", () => {
  const root = new THREE.Group();
  const world = new CollisionWorld(root, 5);

  const fence = createColliderObject(0, 0, 0, Math.PI / 4);

  world.add({
    object: fence,
    size: [30, 2, 0.5],
    tag: "fence"
  });

  world.rebuild();

  const distanceAlongFence = 13;
  const car = createColliderObject(
    Math.cos(Math.PI / 4) * distanceAlongFence,
    0,
    -Math.sin(Math.PI / 4) * distanceAlongFence
  );

  const hit = world.firstHit(
    car,
    [1, 1, 1],
    (collider) => collider.tag === "fence"
  );

  assert.ok(hit);
  assert.equal(hit.tag, "fence");
});
