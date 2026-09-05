import test from "node:test";
import assert from "node:assert/strict";

import {
  CheatingLevel,
  LEVEL_THREE_BALANCE,
  updateStealthMeters
} from "../src/levels/CheatingLevel.js";

test("safe posture decays suspicion gradually", () => {
  const result = updateStealthMeters({
    answerProgress: 20,
    suspicion: 60,
    copying: false,
    seen: false,
    dt: 1
  });

  assert.equal(
    result.suspicion,
    60 - LEVEL_THREE_BALANCE.suspicionDecayPerSecond
  );

  assert.ok(result.suspicion > 0);
});

test("copying while unseen preserves accumulated suspicion", () => {
  const result = updateStealthMeters({
    answerProgress: 0,
    suspicion: 50,
    copying: true,
    seen: false,
    dt: 2
  });

  assert.equal(result.answerProgress, 10);
  assert.equal(result.suspicion, 50);
});

test("copying while seen raises suspicion", () => {
  const result = updateStealthMeters({
    answerProgress: 0,
    suspicion: 0,
    copying: true,
    seen: true,
    dt: 1
  });

  assert.equal(result.answerProgress, 5);
  assert.equal(result.suspicion, 30);
});

test("continuous detected copying fails before answers complete", () => {
  let answerProgress = 0;
  let suspicion = 0;

  for (let elapsed = 0; elapsed < 10 && suspicion < 100; elapsed += 0.1) {
    const result = updateStealthMeters({
      answerProgress,
      suspicion,
      copying: true,
      seen: true,
      dt: 0.1
    });

    answerProgress = result.answerProgress;
    suspicion = result.suspicion;
  }

  assert.equal(suspicion, 100);
  assert.ok(answerProgress < 25);
});

test("answer bar requires meaningful copying time", () => {
  const result = updateStealthMeters({
    answerProgress: 0,
    suspicion: 0,
    copying: true,
    seen: false,
    dt: 6.25
  });

  assert.equal(result.answerProgress, 31.25);
});

test("tutor patrol snakes through the desk aisles without diagonal shortcuts", () => {
  const points = new CheatingLevel({}).patrolPoints;
  const aisleDepths = [...new Set(points.map((point) => point.z))];

  assert.deepEqual(aisleDepths, [-5.1, -2.65, -0.15, 2.35, 4.85, 7.35]);

  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    assert.ok(
      current.x === next.x || current.z === next.z,
      `patrol segment ${index} must remain inside a row or side aisle`
    );
  }
});
