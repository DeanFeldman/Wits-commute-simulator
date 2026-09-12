import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LEVEL_2_ROW_COUNT,
  LEVEL_2_STRIPS,
  STRIP_DEPTH,
  STRIP_WIDTH,
  createSeededRandom,
  generateLevel2Layout,
  validateGeneratedLayouts,
  validateLevel2Layout
} from "../src/levels/crossing/Level2StripGenerator.js";

test("the authored route uses only named library sections", () => {
  const libraryIds = new Set([
    LEVEL_2_STRIPS.start.id,
    LEVEL_2_STRIPS.yaleRoad.id,
    LEVEL_2_STRIPS.bridgeEntry.id,
    LEVEL_2_STRIPS.bridgeCheckpoint.id,
    LEVEL_2_STRIPS.engineeringCheckpoint.id,
    LEVEL_2_STRIPS.finish.id
  ]);
  const layout = generateLevel2Layout(3006);
  assert.ok(layout.strips.every((strip) => libraryIds.has(strip.id)));
});

test("Level 2 uses a perspective third-person camera", () => {
  const source = readFileSync(new URL("../src/levels/crossing/CrossingLevel.js", import.meta.url), "utf8");
  assert.match(source, /new THREE\.PerspectiveCamera\(/);
  assert.doesNotMatch(source, /new THREE\.OrthographicCamera\(/);
  assert.match(source, /player\.position\.z \+ 7\.5/);
});

test("the Wits route order is fixed while seeded scene variation stays reproducible", () => {
  const layout = generateLevel2Layout("demo-seed");
  assert.deepEqual(layout, generateLevel2Layout("demo-seed"));
  assert.deepEqual(layout.strips.map((strip) => strip.type), [
    "start",
    "bridge-entry",
    "bridge",
    "bridge-exit",
    "yale-road",
    "finish"
  ]);
  const first = createSeededRandom(layout.seed);
  const second = createSeededRandom(layout.seed);
  assert.deepEqual([first(), first(), first()], [second(), second(), second()]);
});

test("the route has a safe ARM start and reaches Engineering after the M1 bridge", () => {
  const layout = generateLevel2Layout(42);
  assert.equal(layout.rowCount, LEVEL_2_ROW_COUNT);
  assert.ok(Math.abs((layout.rowCount - 1) * layout.depth - 57.6) < 1e-9);
  assert.equal(layout.strips[0].rowSpan, 4);
  assert.equal(layout.strips[0].traffic, null);
  assert.equal(layout.strips.at(-1).section, "engineering-finish");
  assert.ok(
    layout.strips.findIndex((strip) => strip.type === "bridge")
      < layout.strips.findIndex((strip) => strip.type === "yale-road"),
    "the pedestrian bridge must come before Yale Road"
  );
  assert.deepEqual(layout.strips.filter((strip) => strip.checkpoint).map((strip) => strip.type), [
    "start",
    "bridge-entry",
    "bridge-exit"
  ]);
  for (const strip of layout.strips) {
    assert.equal(strip.width, STRIP_WIDTH);
    assert.equal(strip.depth, STRIP_DEPTH * strip.rowSpan);
  }
  assert.deepEqual(validateLevel2Layout(layout), []);
});

test("Yale traffic is lethal and M1 traffic is environmental", () => {
  const layout = generateLevel2Layout(7);
  const yale = layout.strips.find((strip) => strip.type === "yale-road");
  const bridge = layout.strips.find((strip) => strip.type === "bridge");
  assert.equal(yale.traffic.lanes.length, 4);
  assert.ok(yale.traffic.lanes.every((lane) => !lane.isHighway));
  assert.ok(yale.traffic.lanes.some((lane) => lane.taxiStops));
  assert.ok(bridge.traffic.lanes.length >= 4);
  assert.ok(bridge.traffic.lanes.every((lane) => lane.isHighway));
  for (const lane of [...yale.traffic.lanes, ...bridge.traffic.lanes]) {
    assert.ok([-1, 1].includes(lane.direction));
    assert.ok(lane.speed > 0);
    assert.ok(lane.gapRange[0] - 4.5 >= 3.2);
    assert.ok(lane.allowedVehicleTypes.length > 0);
  }
});

test("debug validation accepts consecutive authored layouts", () => {
  assert.deepEqual(validateGeneratedLayouts(250, 5000), []);
});

test("the validator rejects a route that skips the bridge entry", () => {
  const layout = generateLevel2Layout(42);
  layout.strips[1] = { ...layout.strips[1], type: "safe" };
  assert.ok(validateLevel2Layout(layout).some((error) => error.includes("ARM walkway")));
});

test("the validator rejects interactive traffic in the recessed M1", () => {
  const layout = generateLevel2Layout(42);
  const bridge = layout.strips.find((strip) => strip.type === "bridge");
  bridge.traffic.lanes[0].isHighway = false;
  assert.ok(validateLevel2Layout(layout).some((error) => error.includes("environmental only")));
});
