import assert from "node:assert/strict";
import test from "node:test";
import {
  generateLevelOneRun,
  normalizeLevelOneSeed,
  parkingBayKey,
  resolveLevelOneSeed
} from "../src/levels/ParkingLevel.js";

test("Level 1 seed normalization matches numeric URL values and supports labels", () => {
  assert.equal(normalizeLevelOneSeed(4242), 4242);
  assert.equal(normalizeLevelOneSeed("4242"), 4242);
  assert.equal(normalizeLevelOneSeed(0x1_0000_0001), 1);

  const named = normalizeLevelOneSeed("screenshot-baseline");
  assert.equal(named, normalizeLevelOneSeed("screenshot-baseline"));
  assert.notEqual(named, normalizeLevelOneSeed("another-baseline"));
});

test("an explicit level1Seed URL value wins over fresh random generation", () => {
  let randomCalls = 0;
  const cryptoSource = {
    getRandomValues(values) {
      randomCalls += 1;
      values[0] = 123456789;
      return values;
    }
  };

  assert.equal(resolveLevelOneSeed("?level1Seed=3006", cryptoSource), 3006);
  assert.equal(randomCalls, 0);
});

test("Level 1 generates a fresh seed when level1Seed is absent", () => {
  let randomCalls = 0;
  const cryptoSource = {
    getRandomValues(values) {
      randomCalls += 1;
      values[0] = 0xdecafbad;
      return values;
    }
  };

  assert.equal(resolveLevelOneSeed("?waterCoverage=1", cryptoSource), 0xdecafbad);
  assert.equal(randomCalls, 1);
});

test("the same Level 1 seed reproduces both free bays and potholes", () => {
  const first = generateLevelOneRun(4242);
  const second = generateLevelOneRun("4242");

  assert.equal(first.seed, 4242);
  assert.deepEqual(first.freeBays.map(parkingBayKey), second.freeBays.map(parkingBayKey));
  assert.deepEqual(first.potholes, second.potholes);
});

test("different Level 1 seeds produce different authored runs", () => {
  const first = generateLevelOneRun(4242);
  const second = generateLevelOneRun(4243);

  assert.notDeepEqual(first.freeBays.map(parkingBayKey), second.freeBays.map(parkingBayKey));
  assert.notDeepEqual(first.potholes, second.potholes);
});
