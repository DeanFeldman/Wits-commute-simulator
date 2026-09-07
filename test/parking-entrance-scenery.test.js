import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_ONE_PARKING_LAYOUT,
  getLevelOneParkingSpaces
} from "../src/levels/ParkingLevel.js";
import { PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";
import { PARKING_CAR_SPECS } from "../src/shared/VehicleModelLibrary.js";

const EPSILON = 0.001;

test("Level 1 parking uses every vehicle type from the generic passenger pack", () => {
  assert.deepEqual(
    PARKING_CAR_SPECS.map((spec) => spec.name),
    ["Compact", "Coupe", "Hatchback", "Minivan", "Off-road", "Pickup", "Sedan", "Sport", "SUV", "Wagon"]
  );
  assert.ok(PARKING_CAR_SPECS.every((spec) => spec.packRootChildren.length === 5));
});

test("Level 1 matches the dense north-south row pattern in the aerial reference", () => {
  const layout = LEVEL_ONE_PARKING_LAYOUT;

  assert.equal(layout.verticalColumns.length, 14);
  assert.equal(layout.verticalRoads.length, 7);

  const roadColumnPairs = [
    [layout.verticalColumns[0], layout.verticalColumns[1]],
    [layout.verticalColumns[2], layout.verticalColumns[3]],
    [layout.verticalColumns[4], layout.verticalColumns[5]],
    [layout.verticalColumns[6], layout.verticalColumns[7]],
    [layout.verticalColumns[8], layout.verticalColumns[9]],
    [layout.verticalColumns[10], layout.verticalColumns[11]],
    [layout.verticalColumns[12], layout.verticalColumns[13]]
  ];

  for (let index = 0; index < layout.verticalRoads.length; index++) {
    const road = layout.verticalRoads[index];
    const [columnLeft, columnRight] = roadColumnPairs[index];
    const openWidth = columnRight.x - columnLeft.x - layout.parkingSpaceDepth;

    assert.ok(openWidth + EPSILON >= road.width, `road ${index + 1} remains fully open`);
    assert.ok(Math.abs((columnLeft.x + columnRight.x) / 2 - road.x) < EPSILON);
  }
});

test("all spaces are filled except the playable target bay", () => {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const spaces = getLevelOneParkingSpaces();
  const targetSpaces = spaces.filter((space) => space.isTarget);
  const parkedSpaces = spaces.filter((space) => !space.isTarget);

  assert.equal(spaces.length, 294);
  assert.equal(parkedSpaces.length, 293);
  assert.equal(targetSpaces.length, 1);
  assert.equal(targetSpaces[0].x, layout.targetSlotX);
  assert.ok(targetSpaces[0].z >= layout.rearRow.leftZ);
  assert.ok(targetSpaces[0].z <= layout.rearRow.rightZ);
  assert.notEqual(targetSpaces[0].angle, Math.PI);

  for (const column of layout.verticalColumns) {
    const columnSpaces = spaces.filter((space) => space.x === column.x);
    assert.ok(columnSpaces.length >= 17);
    assert.ok(columnSpaces.every((space) => space.angle === column.angle));
  }

  const verticalSpaceCount = spaces.length - layout.rearRowXs.length;
  const rearRow = spaces.slice(verticalSpaceCount);
  assert.equal(rearRow.length, layout.rearRowXs.length);
  assert.ok(rearRow[0].z < rearRow.at(-1).z, "north row follows the skewed boundary");
  assert.ok(rearRow.every((space) => space.angle === rearRow[0].angle));

  const steppedPairs = [[1, 2], [3, 4], [5, 6], [7, 8], [9, 10], [11, 12]];
  const pairTopEdges = steppedPairs.map(([leftIndex, rightIndex]) => {
    const leftTop = spaces.find((space) => space.x === layout.verticalColumns[leftIndex].x);
    const rightTop = spaces.find((space) => space.x === layout.verticalColumns[rightIndex].x);
    assert.ok(Math.abs(leftTop.z - rightTop.z) < EPSILON, "each double row has a flat top step");
    return leftTop.z;
  });
  for (let index = 1; index < pairTopEdges.length; index++) {
    assert.ok(pairTopEdges[index] > pairTopEdges[index - 1], "row tops step along the north skew");
  }
});

test("parking spaces fit inside the lot without overlap and leave connected roads", () => {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const lot = PARKING_LAYOUT.mainLot;
  const spaces = getLevelOneParkingSpaces();
  const verticalSpaceCount = spaces.length - layout.rearRowXs.length;
  const lotBounds = {
    left: lot.x - lot.width / 2,
    right: lot.x + lot.width / 2,
    top: lot.z - lot.depth / 2,
    bottom: lot.z + lot.depth / 2
  };

  assert.equal(layout.playerSpawn.x, layout.verticalRoads[5].x);
  assert.ok(layout.playerSpawn.z < lotBounds.bottom);
  assert.equal(layout.playerSpawn.angle, 0);
  assert.equal(PARKING_LAYOUT.mainEntrance.x, layout.verticalRoads[5].x);

  for (const space of spaces) {
    const isRotated = Math.abs(Math.sin(space.angle)) > 0.9;
    const halfX = (isRotated ? layout.parkingSpaceDepth : layout.parkingSpaceWidth) / 2;
    const halfZ = (isRotated ? layout.parkingSpaceWidth : layout.parkingSpaceDepth) / 2;

    assert.ok(space.x - halfX >= lotBounds.left - EPSILON);
    assert.ok(space.x + halfX <= lotBounds.right + EPSILON);
    assert.ok(space.z - halfZ >= lotBounds.top - EPSILON);
    assert.ok(space.z + halfZ <= lotBounds.bottom + EPSILON);
  }

  const verticalSpaces = spaces.slice(0, verticalSpaceCount);
  const verticalParkingBack = Math.min(...verticalSpaces.map((space) => space.z)) - layout.parkingSpaceWidth / 2;
  const rearRoadFront = layout.rearRoad.leftZ + layout.rearRoad.depth / 2;
  const rearRoadBack = layout.rearRoad.leftZ - layout.rearRoad.depth / 2;
  const rearRowFront = layout.rearRow.leftZ + layout.parkingSpaceDepth / 2;

  assert.ok(verticalParkingBack > rearRoadFront, "vertical columns stop before the rear road");
  assert.ok(rearRoadBack > rearRowFront, "rear road stops before the horizontal parking row");

  for (const column of layout.verticalColumns) {
    const columnSpaces = verticalSpaces.filter((space) => space.x === column.x);
    for (let index = 1; index < columnSpaces.length; index++) {
      assert.ok(
        columnSpaces[index].z - columnSpaces[index - 1].z >= layout.parkingSpaceWidth,
        "vertical spaces do not overlap"
      );
    }
  }

  for (let index = 1; index < layout.rearRowXs.length; index++) {
    assert.ok(
      layout.rearRowXs[index] - layout.rearRowXs[index - 1] + EPSILON >= layout.parkingSpaceWidth,
      "rear-row spaces do not overlap"
    );
  }
});
