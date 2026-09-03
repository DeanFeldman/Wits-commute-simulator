import assert from "node:assert/strict";
import test from "node:test";
import {
  LEVEL_2_ROW_COUNT,
  LEVEL_2_STRIPS,
  STRIP_DEPTH,
  STRIP_WIDTH,
  generateLevel2Layout,
  validateGeneratedLayouts,
  validateLevel2Layout
} from "../src/levels/crossing/Level2StripGenerator.js";

test("every generated piece comes from the editable strip library", () => {
  const libraryIds = new Set([
    LEVEL_2_STRIPS.start.id,
    LEVEL_2_STRIPS.finish.id,
    LEVEL_2_STRIPS.checkpoint.id,
    ...LEVEL_2_STRIPS.safe.map((strip) => strip.id),
    ...Object.values(LEVEL_2_STRIPS.hazards).flat().map((strip) => strip.id)
  ]);

  for (let seed = 0; seed < 100; seed++) {
    const layout = generateLevel2Layout(seed);
    assert.ok(layout.strips.every((strip) => libraryIds.has(strip.id)));
  }
});

test("a seed reproduces the same Level 2 layout", () => {
  const layout = generateLevel2Layout("demo-seed");
  assert.deepEqual(layout, generateLevel2Layout("demo-seed"));
  assert.deepEqual(layout, generateLevel2Layout(String(layout.seed)));
});

test("different seeds provide controlled layout variation", () => {
  const signatures = new Set();
  for (let seed = 1; seed <= 20; seed++) {
    signatures.add(generateLevel2Layout(seed).strips.map((strip) => strip.id).join("|"));
  }
  assert.ok(signatures.size > 1);
});

test("generated layouts begin safely and never place hazards together", () => {
  for (let seed = 0; seed < 100; seed++) {
    const layout = generateLevel2Layout(seed);
    // Multi-row custom hazards may make a generated crossing longer than the baseline.
    assert.ok(layout.rowCount >= LEVEL_2_ROW_COUNT);
    assert.ok((layout.rowCount - 1) * layout.depth >= 38.4);
    assert.equal(layout.strips[0].type, "start");
    assert.equal(layout.strips[0].traffic, null);
    assert.equal(layout.strips[0].rowSpan, 2);
    assert.equal(layout.strips.at(-1).type, "finish");
    assert.deepEqual(
      layout.strips.filter((strip) => strip.checkpoint).map((strip) => strip.type),
      ["start", "median"]
    );
    assert.deepEqual(validateLevel2Layout(layout), []);

    let trafficRun = 0;
    for (const strip of layout.strips) {
      assert.equal(strip.width, STRIP_WIDTH);
      assert.equal(strip.depth, STRIP_DEPTH * strip.rowSpan);
      trafficRun = strip.traffic || strip.crowd ? trafficRun + 1 : 0;
      assert.ok(trafficRun <= 1);
    }
  }
});

test("crowds are configured only on dedicated hazard strips", () => {
  let generatedCrowdHazard = false;
  for (let seed = 0; seed < 100; seed++) {
    const layout = generateLevel2Layout(seed);
    for (let index = 0; index < layout.strips.length; index++) {
      const strip = layout.strips[index];
      if (!strip.crowd) continue;
      generatedCrowdHazard = true;
      assert.equal(strip.type, "crowd-hazard");
      assert.equal(index % 2, 1);
      assert.equal(strip.traffic, null);
    }
  }
  assert.equal(generatedCrowdHazard, true);
});

test("traffic rows expose bounded configuration and taxi rows follow a median", () => {
  for (let seed = 100; seed < 200; seed++) {
    const layout = generateLevel2Layout(seed);
    const taxiIndex = layout.strips.findIndex((strip) => strip.type === "taxi-hazard");
    assert.ok(taxiIndex >= 3 && taxiIndex <= layout.strips.length - 4);
    assert.equal(layout.strips[taxiIndex - 1].type, "median");

    for (const strip of layout.strips.filter((candidate) => candidate.traffic)) {
      const lanes = strip.traffic.lanes ?? [strip.traffic];
      for (const lane of lanes) {
        assert.ok([-1, 1].includes(lane.direction));
        assert.ok(lane.speed > 0);
        assert.ok(lane.gapRange[0] <= lane.gapRange[1]);
        assert.ok(lane.gapRange[0] - 2.6 >= 3.2);
        assert.ok(lane.allowedVehicleTypes.length > 0);
      }
    }
  }
});

test("debug validation accepts at least 100 consecutive generated layouts", () => {
  assert.deepEqual(validateGeneratedLayouts(250, 5000), []);
});

test("the validator rejects structurally unfair layouts", () => {
  const layout = generateLevel2Layout(42);
  layout.strips[2] = { ...layout.strips[1], index: 2, rowStart: layout.strips[2].rowStart };
  assert.ok(validateLevel2Layout(layout).some((error) => error.includes("Traffic strips are adjacent")));
});
