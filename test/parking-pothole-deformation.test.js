import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  applyPotholeDeformation
} from "../src/levels/ParkingLevel.js";

function makeGrid(size = 21) {
  const geometry =
    new THREE.PlaneGeometry(
      4,
      4,
      size - 1,
      size - 1
    );

  return geometry;
}

test("pothole deformation only moves road vertices downward", () => {
  const geometry = makeGrid();

  applyPotholeDeformation(
    geometry,
    {
      x: 0,
      z: 0
    },
    [
      {
        x: 0,
        z: 0,
        radius: 1
      }
    ],
    {
      maximumDepth: 0.028
    }
  );

  const position =
    geometry.getAttribute("position");

  let lowest = 0;
  let highest = -Infinity;

  for (
    let index = 0;
    index < position.count;
    index++
  ) {
    const z = position.getZ(index);

    lowest = Math.min(lowest, z);
    highest = Math.max(highest, z);
  }

  assert.ok(
    lowest < -0.02,
    `expected a real depression, got ${lowest}`
  );

  assert.ok(
    highest <= 0,
    `pothole must never rise above road level, got ${highest}`
  );
});

test("pothole deformation returns to road height outside its radius", () => {
  const geometry = makeGrid();

  applyPotholeDeformation(
    geometry,
    {
      x: 0,
      z: 0
    },
    [
      {
        x: 0,
        z: 0,
        radius: 0.7
      }
    ]
  );

  const position =
    geometry.getAttribute("position");

  const cornerZ =
    position.getZ(0);

  assert.ok(
    Math.abs(cornerZ) < 1e-8
  );
});

test("pothole deformation recomputes non-flat normals on the crater wall", () => {
  const geometry = makeGrid(31);

  applyPotholeDeformation(
    geometry,
    {
      x: 0,
      z: 0
    },
    [
      {
        x: 0,
        z: 0,
        radius: 1.2
      }
    ]
  );

  const normals =
    geometry.getAttribute("normal");

  let slopedNormals = 0;

  for (
    let index = 0;
    index < normals.count;
    index++
  ) {
    if (
      Math.abs(normals.getX(index)) > 0.01 ||
      Math.abs(normals.getY(index)) > 0.01
    ) {
      slopedNormals++;
    }
  }

  assert.ok(slopedNormals > 0);
});