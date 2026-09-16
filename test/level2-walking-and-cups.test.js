import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { GridHopController } from "../src/levels/crossing/GridHopController.js";
import { CampusCrowd, CROWD_LINES, createCrowdPlan, standingCells } from "../src/levels/crossing/CampusCrowd.js";
import { PedestrianFactory } from "../src/levels/crossing/PedestrianFactory.js";
import { CUP_TYPES, CupModelKit, PowerUpState, VidaCups, planCupSpots } from "../src/levels/crossing/VidaCups.js";
import { createSeededRandom } from "../src/levels/crossing/Level2StripGenerator.js";

const STEP = 1.2;
// The authored Level 2 route, as CrossingLevel lays it out (see strip z values).
const ZONES = {
  start: { z: 25.2, depth: 9.6 },
  "bridge-entry": { z: 18, depth: 4.8 },
  bridge: { z: 6, depth: 19.2 },
  "bridge-exit": { z: -6, depth: 4.8 },
  "yale-road": { z: -13.2, depth: 9.6 },
  finish: { z: -24, depth: 12 }
};
const START_Z = 28.8;
const FINISH_Z = -28.8;

function zoneAt(z) {
  const entry = Object.entries(ZONES).find(([, zone]) => Math.abs(z - zone.z) < zone.depth / 2 - 0.01);
  return entry?.[0] ?? "boundary";
}

function allCells() {
  const cells = [];
  for (let row = 0; row <= 48; row++) {
    const z = START_Z - row * STEP;
    for (let column = -2; column <= 2; column++) cells.push({ x: column * STEP, z, zone: zoneAt(z) });
  }
  return cells;
}

test("holding a direction walks cell to cell at a constant speed without stopping", () => {
  const object = new THREE.Object3D();
  object.position.set(0, 0.95, 0);
  const controller = new GridHopController(object, { cellSize: STEP, walkSpeed: 4.8 });
  controller.setHeldDirection({ x: 0, z: -1 });

  const dt = 1 / 60;
  let previousZ = object.position.z;
  let landings = 0;
  for (let frame = 0; frame < 60; frame++) {
    if (controller.update(dt)) landings += 1;
    const travelled = previousZ - object.position.z;
    // No frame stalls between cells and no frame lunges ahead.
    assert.ok(travelled > 4.8 * dt * 0.99 && travelled < 4.8 * dt * 1.01, `frame ${frame} moved ${travelled}`);
    assert.equal(object.position.y, 0.95, "walking never lifts the player off the ground");
    previousZ = object.position.z;
  }
  assert.equal(landings, 3, "4.8 m in one second crosses three 1.2 m cells");
});

test("a tap walks exactly one cell and eases to a stop on it", () => {
  const object = new THREE.Object3D();
  const controller = new GridHopController(object, { cellSize: STEP, walkSpeed: 4.8 });
  controller.enqueue({ x: 1, z: 0 });
  for (let frame = 0; frame < 120; frame++) controller.update(1 / 60);
  assert.deepEqual(controller.gridPosition.toArray(), [STEP, 0]);
  assert.ok(Math.abs(object.position.x - STEP) < 1e-9);
  assert.equal(controller.isHopping, false);
});

test("the player turns smoothly towards the walk direction", () => {
  const object = new THREE.Object3D();
  const controller = new GridHopController(object, { cellSize: STEP, walkSpeed: 4.8 });
  controller.enqueue({ x: 1, z: 0 });
  controller.update(1 / 60);
  assert.ok(object.rotation.y > 0 && object.rotation.y < Math.PI / 2, "one frame only turns part of the way");
  for (let frame = 0; frame < 60; frame++) controller.update(1 / 60);
  assert.ok(Math.abs(object.rotation.y - Math.PI / 2) < 0.01);
});

test("walking into a person bumps back to the same cell", () => {
  const object = new THREE.Object3D();
  object.position.set(0, 0.95, 0);
  const controller = new GridHopController(object, {
    cellSize: STEP,
    walkSpeed: 4.8,
    canEnter: () => false,
    onBlocked: (x, z, direction) => controller.bump(direction)
  });
  controller.enqueue({ x: 0, z: -1 });
  controller.update(0.05);
  let leanedIn = false;
  for (let frame = 0; frame < 30; frame++) {
    controller.update(1 / 60);
    if (object.position.z < -0.1) leanedIn = true;
  }
  assert.ok(leanedIn, "the bump visibly leans into the person");
  assert.deepEqual(object.position.toArray(), [0, 0.95, 0]);
  assert.deepEqual(controller.gridPosition.toArray(), [0, 0]);
});

test("cups follow the authored plan and never sit on people, kerbs or the spawn", () => {
  const plan = createCrowdPlan({ zones: ZONES, startZ: START_Z, step: STEP });
  const reserved = standingCells(plan);
  for (let seed = 1; seed <= 40; seed++) {
    const spots = planCupSpots({ cells: allCells(), random: createSeededRandom(seed), reserved, startZ: START_Z });
    assert.equal(spots.length, 11);
    assert.deepEqual(spots.filter((spot) => spot.zone === "bridge-exit").map((spot) => spot.type).sort(), ["icedLatte", "shield"]);
    assert.equal(spots.filter((spot) => spot.zone === "yale-road").length, 2);
    for (const spot of spots) {
      assert.ok(spot.zone !== "boundary");
      assert.ok(Math.abs(spot.z - START_Z) > 1.3);
      assert.ok(!reserved.some((cell) => Math.abs(cell.x - spot.x) < 0.1 && Math.abs(cell.z - spot.z) < 0.1));
      assert.ok(CUP_TYPES[spot.type]);
    }
  }
});

test("power-ups speed the walk, slow traffic, save you once and take time off", () => {
  const state = new PowerUpState();
  assert.equal(state.speedMultiplier, 1);
  state.apply("doubleShot");
  state.apply("icedLatte");
  state.apply("flatWhite");
  state.apply("shield");
  assert.ok(state.speedMultiplier > 1);
  assert.ok(state.trafficScale < 1);
  assert.equal(state.timeBonus, CUP_TYPES.flatWhite.timeBonus);
  assert.equal(state.collected, 4);
  assert.equal(state.consumeShield(), true);
  assert.equal(state.consumeShield(), false);
  state.update(10);
  assert.equal(state.speedMultiplier, 1);
  assert.equal(state.trafficScale, 1);
  assert.equal(state.active.length, 0);
});

test("walking through a cup collects it once", () => {
  const root = new THREE.Group();
  const cups = new VidaCups({ root, kit: new CupModelKit() });
  cups.spawn([{ x: 0, z: -2.4, type: "doubleShot" }]);
  assert.equal(cups.collectNear(new THREE.Vector3(0, 0.95, 0)), null);
  const cup = cups.collectNear(new THREE.Vector3(0, 0.95, -2.2));
  assert.equal(cup.type, CUP_TYPES.doubleShot);
  assert.equal(cups.collectNear(new THREE.Vector3(0, 0.95, -2.4)), null);
  assert.equal(cups.remaining, 0);
});

test("the crowd leaves every row passable and nobody stands on Yale Road", () => {
  const plan = createCrowdPlan({ zones: ZONES, startZ: START_Z, step: STEP });
  const yale = ZONES["yale-road"];
  for (const entry of plan) {
    const zs = entry.z !== undefined ? [entry.z] : [entry.fromZ, entry.toZ];
    for (const z of zs) {
      assert.ok(Math.abs(z - yale.z) > yale.depth / 2, `${entry.kind} strays onto Yale Road`);
      assert.ok(z <= START_Z && z >= FINISH_Z);
    }
    assert.ok(Math.abs(entry.x) <= 2 * STEP + 1e-9);
  }
  // Walkers each own a column, so they never need to pass each other.
  const walkers = plan.filter((entry) => entry.fromZ !== undefined);
  for (const walker of walkers) {
    const [low, high] = [Math.min(walker.fromZ, walker.toZ), Math.max(walker.fromZ, walker.toZ)];
    const overlapping = plan.filter((other) => other !== walker && Math.abs(other.x - walker.x) < 0.1 && (
      other.z !== undefined
        ? other.z >= low - STEP && other.z <= high + STEP
        : Math.max(other.fromZ, other.toZ) >= low && Math.min(other.fromZ, other.toZ) <= high
    ));
    assert.deepEqual(overlapping, [], `${walker.kind} at x=${walker.x} shares its column`);
  }
  // Even if every walker lined up on one row, one column stays free.
  for (let row = 0; row <= 48; row++) {
    const z = START_Z - row * STEP;
    const columns = new Set();
    for (const entry of plan) {
      const covers = entry.z !== undefined
        ? Math.abs(entry.z - z) < 0.1
        : z >= Math.min(entry.fromZ, entry.toZ) - 0.1 && z <= Math.max(entry.fromZ, entry.toZ) + 0.1;
      if (covers) columns.add(Math.round(entry.x / STEP));
    }
    assert.ok(columns.size < 5, `row z=${z} could be fully blocked`);
  }
});

test("bumping a person makes them talk, drop their coffee, and lose patience", () => {
  const said = [];
  const crowd = new CampusCrowd({
    root: new THREE.Group(),
    factory: new PedestrianFactory({ createHeldCup: (type) => new CupModelKit().createCup(type) }),
    random: createSeededRandom(7),
    onSay: (person, text, tone) => said.push({ text, tone })
  });
  const person = crowd.add({ kind: "student", x: 0, z: -1.2, yaw: 0, holding: "flatWhite" });
  assert.equal(crowd.personAt(0, -1.2), person);
  assert.equal(crowd.personAt(1.2, -1.2), null);

  const player = new THREE.Vector3(0, 0.95, 0);
  const first = crowd.bump(person, player);
  assert.equal(first.droppedCup, "flatWhite");
  assert.ok(CROWD_LINES.cupDrop.includes(first.line));
  assert.equal(crowd.bump(person, player).droppedCup, null, "a cup can only be dropped once");
  const third = crowd.bump(person, player);
  assert.ok(CROWD_LINES.annoyed.includes(third.line));
  assert.equal(said.length, 3);
  assert.equal(said[2].tone, "angry");
});

test("a walker waits for the player instead of walking through them", () => {
  const crowd = new CampusCrowd({ root: new THREE.Group(), factory: new PedestrianFactory(), random: () => 0 });
  const walker = crowd.add({ kind: "commuter", x: 0, fromZ: 4, toZ: -4, speed: 1.2 });
  const player = new THREE.Vector3(0, 0.95, 2);
  for (let frame = 0; frame < 300; frame++) crowd.update(1 / 60, player);
  assert.ok(walker.mesh.position.z - player.z >= 0.9, "the walker stops short of the player");
  player.x = 2.4;
  for (let frame = 0; frame < 300; frame++) crowd.update(1 / 60, player);
  assert.ok(walker.mesh.position.z < 0, "once the player steps aside the walker carries on");
});
