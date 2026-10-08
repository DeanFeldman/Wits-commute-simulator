import assert from "node:assert/strict";
import test from "node:test";
import { CrossingLevel } from "../src/levels/crossing/CrossingLevel.js";

// Issue #263: opening a survey releases pointer lock so the form can be
// clicked. Game must not treat that release as an Escape-pause.
test("an open Level 2 survey tells Game the pointer release is expected", () => {
  const level = { quiz: { isOpen: true } };
  assert.equal(CrossingLevel.prototype.isPointerReleaseExpected.call(level), true);

  level.quiz.isOpen = false;
  assert.equal(CrossingLevel.prototype.isPointerReleaseExpected.call(level), false);

  assert.equal(CrossingLevel.prototype.isPointerReleaseExpected.call({}), false);
});
