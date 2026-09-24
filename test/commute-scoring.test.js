import assert from "node:assert/strict";
import test from "node:test";
import {
  getCommuteRating,
  loadPersonalBests,
  PERSONAL_BESTS_STORAGE_KEY,
  savePersonalBests,
  scoreFastestTime,
  scoreLevel,
  scoreTime,
  summariseJourney,
  updatePersonalBests
} from "../src/core/commuteScoring.js";

test("time score gives full credit at par and zero at slow time", () => {
  assert.equal(scoreTime(45, 45, 120), 40);
  assert.equal(scoreTime(120, 45, 120), 0);
  assert.equal(scoreTime(82.5, 45, 120), 20);
});

test("Level 2 fastest-finish scoring has no slow-time cutoff", () => {
  assert.equal(scoreFastestTime(40, 40), 40);
  assert.ok(scoreFastestTime(60, 40) > scoreFastestTime(120, 40));
  assert.ok(scoreFastestTime(120, 40) > 0);
});

test("better Level 1 parking produces a better score", () => {
  const rough = scoreLevel(1, {
    time: 80,
    condition: 75,
    containmentPercent: 82,
    alignmentErrorDegrees: 10,
    failedAttempts: 1
  });
  const clean = scoreLevel(1, {
    time: 40,
    condition: 100,
    containmentPercent: 100,
    alignmentErrorDegrees: 1,
    failedAttempts: 0
  });

  assert.ok(clean.total > rough.total);
  assert.equal(clean.total <= 100, true);
});

test("Level 2 rewards faster finishes and counts impacts and backwards steps separately", () => {
  const clean = scoreLevel(2, { time: 40, impacts: 0, backwardSteps: 0 });
  const messy = scoreLevel(2, { time: 60, impacts: 2, backwardSteps: 4 });

  assert.equal(clean.total, 100);
  assert.ok(messy.components.time < clean.components.time);
  assert.ok(messy.components.mistakes < clean.components.mistakes);
  assert.ok(messy.components.quality < clean.components.quality);
});

test("Level 3 rewards low suspicion and correct submissions", () => {
  const clean = scoreLevel(3, {
    time: 45,
    incorrectAnswers: 0,
    suspicion: 0
  });
  const risky = scoreLevel(3, {
    time: 70,
    incorrectAnswers: 2,
    suspicion: 80,
    failedAttempts: 1
  });

  assert.equal(clean.total, 100);
  assert.ok(risky.total < clean.total);
});

test("commute ratings use the documented thresholds", () => {
  assert.equal(getCommuteRating(300).grade, "S");
  assert.equal(getCommuteRating(269).grade, "A");
  assert.equal(getCommuteRating(210).grade, "B");
  assert.equal(getCommuteRating(180).grade, "C");
  assert.equal(getCommuteRating(179).grade, "D");
});

test("personal bests only improve", () => {
  const summary = summariseJourney([
    scoreLevel(1, { time: 40, condition: 100, containmentPercent: 100, alignmentErrorDegrees: 0 }),
    scoreLevel(2, { time: 40, impacts: 0, backwardSteps: 0 }),
    scoreLevel(3, { time: 45, incorrectAnswers: 0, suspicion: 0 })
  ], 103);

  const records = updatePersonalBests({
    levelTimes: { "1": 35, "2": 22 },
    journeyTime: 100,
    journeyScore: 250
  }, summary);

  assert.equal(records.levelTimes["1"], 35);
  assert.equal(records.levelTimes["2"], 22);
  assert.equal(records.levelTimes["3"], 45);
  assert.equal(records.journeyTime, 100);
  assert.equal(records.journeyScore, 300);
});


test("personal bests round-trip through local storage", () => {
  const values = new Map();
  const storage = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    }
  };
  const records = {
    levelTimes: { "1": 42.5 },
    journeyTime: 110,
    journeyScore: 260
  };

  assert.equal(savePersonalBests(records, storage), true);
  assert.equal(values.has(PERSONAL_BESTS_STORAGE_KEY), true);
  assert.deepEqual(loadPersonalBests(storage), records);
});
