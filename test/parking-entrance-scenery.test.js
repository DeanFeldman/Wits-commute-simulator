import test from "node:test";
import assert from "node:assert/strict";
import {
  LEVEL_ONE_PARKING_LAYOUT,
  PARKING_AISLE_WIDTH,
  PARKING_BAY_LENGTH,
  PARKING_BAY_WIDTH,
  createDoubleParkingRow,
  createParkingRow,
  getLevelOneParkingSpaces
} from "../src/levels/ParkingLevel.js";
import { PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";
import { PARKING_CAR_SPECS } from "../src/shared/VehicleModelLibrary.js";

const EPSILON = 0.001;

test("Level 1 uses real-world parking dimensions and reusable row generators", () => {
  assert.equal(PARKING_BAY_WIDTH, 2.5);
  assert.equal(PARKING_BAY_LENGTH, 5);
  assert.equal(PARKING_AISLE_WIDTH, 6);

  const row = createParkingRow({
    name: "sample",
    start: { x: 2, z: 3 },
    count: 3,
    step: { x: 0, z: 2.6 },
    rotation: Math.PI / 2
  });
  assert.deepEqual(row.map(({ x, z }) => [x, z]), [[2, 3], [2, 5.6], [2, 8.2]]);

  const doubleRow = createDoubleParkingRow({
    name: "sample-double",
    centerX: 0,
    startZ: 0,
    endZ: 5.2,
    spacing: 2.6
  });
  assert.equal(doubleRow.length, 6);
  assert.deepEqual([...new Set(doubleRow.map((space) => space.x))], [-2.5, 2.5]);
});

test("generated rows match the annotated Wits aerial structure", () => {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const spaces = getLevelOneParkingSpaces();

  assert.equal(layout.topRow.count, 20);
  assert.equal(layout.doubleRows.length, 6);
  assert.equal(layout.verticalRoads.length, 7);
  assert.equal(spaces.length, 364);

  const topRow = spaces.filter((space) => space.rowName === "top-row");
  assert.equal(topRow.length, 20);
  assert.ok(topRow[0].z < topRow.at(-1).z, "top row follows the angled M1 boundary");
  assert.ok(topRow.every((space) => space.angle === topRow[0].angle));

  for (const row of layout.doubleRows) {
    const left = spaces.filter((space) => space.rowName === `${row.name}-left`);
    const right = spaces.filter((space) => space.rowName === `${row.name}-right`);
    assert.equal(left.length, right.length);
    assert.ok(left.length >= 18);
    assert.equal(left[0].z, right[0].z);
    assert.equal(left.at(-1).z, right.at(-1).z);
    assert.equal(right[0].x - left[0].x, PARKING_BAY_LENGTH);
    assert.equal(left[0].angle, -Math.PI / 2);
    assert.equal(right[0].angle, Math.PI / 2);
  }

  const rowStarts = layout.doubleRows.map((row) => row.startZ);
  const rowEnds = layout.doubleRows.map((row) => row.endZ);
  assert.ok(new Set(rowStarts).size > 3, "interior rows have staggered northern starts");
  assert.ok(new Set(rowEnds).size > 3, "interior rows have staggered southern ends");
  assert.ok(spaces.some((space) => space.rowName === "west-upper"));
  assert.equal(spaces.filter((space) => space.rowName === "east-row").length, 22);
  assert.ok(layout.rearRoad.depth <= 5.2, "north drive lane remains narrow");
  assert.ok(layout.topRow.step.x >= PARKING_BAY_LENGTH, "top-row bays are parallel parked");
  assert.ok(Math.abs(layout.topRow.rotation - Math.PI / 2) < 0.2, "top-row cars run along the curb");
  assert.ok(
    Math.abs(Math.abs(layout.eastRow.rotation) - Math.PI / 2) < EPSILON,
    "east bays are square to the curb, like every other row"
  );
});

test("driving aisles remain open and align with the lot entrance", () => {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const blocks = layout.doubleRows;

  for (let index = 1; index < blocks.length; index++) {
    const previousRightEdge = blocks[index - 1].centerX + PARKING_BAY_LENGTH;
    const nextLeftEdge = blocks[index].centerX - PARKING_BAY_LENGTH;
    assert.ok(nextLeftEdge - previousRightEdge + EPSILON >= PARKING_AISLE_WIDTH);
  }

  // The boom entrance is the only way in. There is deliberately no second
  // opening in the lot boundary.
  assert.equal(PARKING_LAYOUT.mainEntrance, undefined, "the disused central entrance is gone");

  // The campus checkpoint controls the street where it meets Yale Road. A gate
  // standing in the middle of an open road guards nothing, so it has to sit
  // short of the intersection and well clear of the lot entrance.
  const bridge = PARKING_LAYOUT.bridgeRoad;
  const gate = PARKING_LAYOUT.campusGate;
  assert.ok(gate.x + 7 < bridge.x - bridge.width / 2, "campus gate stops short of the intersection");
  assert.ok(
    gate.x - 7 > PARKING_LAYOUT.parkingBoomEntrance.x + PARKING_LAYOUT.parkingBoomEntrance.boundaryWidth,
    "campus gate is clear of the lot entrance"
  );

  const spawnAisle = layout.verticalRoads[1];
  assert.equal(layout.playerSpawn.x, spawnAisle.x);
  assert.equal(PARKING_LAYOUT.parkingBoomEntrance.x, spawnAisle.x);
  assert.ok(
    PARKING_LAYOUT.parkingBoomEntrance.boundaryWidth > PARKING_LAYOUT.parkingBoomEntrance.width,
    "raised curb shoulders flank the asphalt entrance"
  );
  // The exit mirrors the entrance one aisle to the east, and the two openings
  // must not meet, or the boundary between them disappears.
  const exitAisle = layout.verticalRoads[2];
  const entry = PARKING_LAYOUT.parkingBoomEntrance;
  const exit = PARKING_LAYOUT.parkingBoomExit;
  assert.equal(exit.x, exitAisle.x, "exit lines up with the third aisle");
  assert.equal(exit.width, entry.width);
  assert.equal(exit.boundaryWidth, entry.boundaryWidth);
  assert.ok(
    exit.x - exit.boundaryWidth / 2 - (entry.x + entry.boundaryWidth / 2) >= 1,
    "a run of boundary survives between the entrance and the exit"
  );

  assert.equal(layout.playerSpawn.angle, 0, "player faces north into the parking lot");
  assert.ok(layout.playerSpawn.z > PARKING_LAYOUT.mainLot.outline.at(-4)[1]);
});

test("only the playable target bay is reserved and cars fit within every bay", () => {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const spaces = getLevelOneParkingSpaces();
  const targets = spaces.filter((space) => space.isTarget);

  assert.equal(targets.length, 1);
  assert.equal(targets[0].rowName, layout.target.rowName);
  assert.equal(targets[0].rowIndex, layout.target.index);
  assert.equal(targets[0].x, 3);
  assert.ok(targets[0].z < 26, "target remains clear of the entrance turning area");

  // Every vehicle in the parking pack has to fit a square bay.
  const widest = Math.max(...PARKING_CAR_SPECS.map((spec) => spec.collider[0]));
  const longest = Math.max(...PARKING_CAR_SPECS.map((spec) => spec.collider[2]));
  assert.ok(widest < PARKING_BAY_WIDTH, "the widest packed car fits a bay");
  assert.ok(longest <= PARKING_BAY_LENGTH, "the longest packed car fits a bay");

  // Perpendicular rows only need the slot pitch to beat the car width.
  assert.ok(layout.slotSpacing > widest, "neighbouring bays clear the widest car");

  // Whatever angle a row sits at, neighbouring cars only clear each other once
  // the step measured on the car's own width axis beats the car width.
  const east = layout.eastRow;
  const rightX = Math.cos(east.rotation);
  const rightZ = -Math.sin(east.rotation);
  const eastClearance = Math.abs(east.step.x * rightX + east.step.z * rightZ);
  assert.ok(
    eastClearance >= widest,
    `east bays clear the widest car (${eastClearance.toFixed(2)} m of ${widest} m)`
  );
  for (const space of spaces) {
    assert.ok(Number.isFinite(space.x));
    assert.ok(Number.isFinite(space.z));
    assert.ok(Number.isFinite(space.angle));
  }
});

test("the parking surface keeps the irregular north, west-step, and east boundaries", () => {
  const layout = LEVEL_ONE_PARKING_LAYOUT;
  const outline = PARKING_LAYOUT.mainLot.outline;
  assert.ok(outline.length >= 8);

  const [northWest, northEast] = outline;
  assert.ok(northWest[1] < northEast[1], "north boundary slopes south toward the east");
  assert.ok(outline.some(([x, z]) => x === -56 && z === -33), "west service step is retained");
  assert.ok(outline.some(([x, z]) => x === 54 && z === 34), "east boundary narrows toward the entrance road");

  const westOuterEdge = layout.westRow.x - PARKING_BAY_LENGTH / 2;
  assert.ok(Math.abs(westOuterEdge - (-61)) <= 0.3, "west row reaches the curb");
  assert.ok(layout.eastRow.start.x >= 55, "east row reaches the upper curb");
  assert.ok(layout.topRow.start.z <= -46.5, "top row reaches the north curb");
});
