import test from "node:test";
import assert from "node:assert/strict";
import { getFlowerHallSideCurbBounds, getParkingEntranceThroatBounds, PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";

test("entrance and exit throats meet the lot edge without covering the asphalt", () => {
  const lotFront = Math.max(...PARKING_LAYOUT.mainLot.outline.map(([, z]) => z));
  const roadBack = PARKING_LAYOUT.campusRoad.z - PARKING_LAYOUT.campusRoad.depth / 2;
  for (const opening of [PARKING_LAYOUT.parkingBoomEntrance, PARKING_LAYOUT.parkingBoomExit]) {
    const throat = getParkingEntranceThroatBounds(opening);
    assert.equal(throat.back, lotFront);
    assert.ok(Math.abs(throat.centerZ - throat.depth / 2 - lotFront) < 1e-9);
    assert.ok(throat.centerZ + throat.depth / 2 > roadBack, "the road-side join stays covered");
    assert.equal(throat.x, opening.x);
    assert.equal(throat.width, opening.width);
  }
});

test("Flower Hall side curb ends flush with the first and last occupied row bays", () => {
  const spaces = Array.from({ length: 23 }, (_, i) => ({ x: -52.7, z: 48.8 + i * 3.05 }));
  const curb = getFlowerHallSideCurbBounds(spaces);
  assert.ok(Math.abs(curb.nearZ - (spaces[0].z - 1.25)) < 1e-9);
  assert.ok(Math.abs(curb.farZ - (spaces.at(-1).z + 1.25)) < 1e-9);
  assert.ok(Math.abs(curb.centerZ - (curb.nearZ + curb.farZ) / 2) < 1e-9);
  assert.ok(curb.nearZ > 46.2, "side curb no longer sticks out into the parking approach");
  assert.ok(curb.farZ < 119, "side curb does not extend past the final bay");
});
