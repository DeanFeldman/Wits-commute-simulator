import test from "node:test";
import assert from "node:assert/strict";
import { getParkingEntranceThroatBounds, PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";

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
