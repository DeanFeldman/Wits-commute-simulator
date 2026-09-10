import test from "node:test";
import assert from "node:assert/strict";

import {
  LEVEL_ONE_DAMAGE,
  applyLevelOneDamage,
  getLevelOneCollisionDamage,
  parkingAxisAngleError
} from "../src/levels/ParkingLevel.js";

const degrees = (value) => value * Math.PI / 180;

test("parking treats positive and negative 180 degrees as equivalent", () => {
  assert.ok(
    parkingAxisAngleError(Math.PI, -Math.PI) < 1e-10
  );

  assert.ok(
    parkingAxisAngleError(-Math.PI, Math.PI) < 1e-10
  );
});

test("parking angle comparison wraps cleanly across the rotation boundary", () => {
  const error = parkingAxisAngleError(
    degrees(179),
    degrees(-179)
  );

  assert.ok(
    Math.abs(error - degrees(2)) < 1e-10
  );
});

test("parking accepts either direction along the bay axis", () => {
  assert.ok(
    parkingAxisAngleError(0, Math.PI) < 1e-10
  );
});

test("Level 1 collision tags map to the requested damage severities", () => {
  assert.equal(
    getLevelOneCollisionDamage("pothole"),
    LEVEL_ONE_DAMAGE.small
  );

  assert.equal(
    getLevelOneCollisionDamage("parking-entrance-curb"),
    LEVEL_ONE_DAMAGE.medium
  );

  assert.equal(
    getLevelOneCollisionDamage("sign"),
    LEVEL_ONE_DAMAGE.medium
  );

  assert.equal(
    getLevelOneCollisionDamage("parked-car"),
    LEVEL_ONE_DAMAGE.high
  );

  assert.equal(
    getLevelOneCollisionDamage("fence"),
    LEVEL_ONE_DAMAGE.high
  );

  assert.equal(
    getLevelOneCollisionDamage("campus-boom"),
    LEVEL_ONE_DAMAGE.high
  );
});

test("condition damage never drops below zero", () => {
  assert.equal(
    applyLevelOneDamage(100, "pothole"),
    96
  );

  assert.equal(
    applyLevelOneDamage(100, "parking-entrance-curb"),
    90
  );

  assert.equal(
    applyLevelOneDamage(100, "parked-car"),
    80
  );

  assert.equal(
    applyLevelOneDamage(5, "parked-car"),
    0
  );
});
