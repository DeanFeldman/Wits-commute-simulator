import test from "node:test";
import assert from "node:assert/strict";
import { syncSurveyPause } from "../src/ui/surveyPause.js";
import { LEVEL2_CAMERA_MODES, nextLevel2CameraMode } from "../src/levels/crossing/cameraModes.js";
import { InputManager } from "../src/core/InputManager.js";

test("pause blocks survey interaction but retains the open questionnaire", () => {
  const classes = new Set(), menu = { classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name) } };
  const quiz = { hidden: false, inert: false };
  syncSurveyPause(menu, quiz, true);
  assert.equal(quiz.inert, true);
  assert.ok(classes.has("over-survey"));
  assert.equal(quiz.hidden, false);
  syncSurveyPause(menu, quiz, false);
  assert.equal(quiz.inert, false);
  assert.equal(classes.has("over-survey"), false);
  quiz.hidden = true;
  syncSurveyPause(menu, quiz, true);
  assert.equal(quiz.inert, false);
});

test("C cycles Chase, Close, First Person, then Chase", () => {
  assert.deepEqual(LEVEL2_CAMERA_MODES, ["chase", "close", "first-person"]);
  assert.equal(nextLevel2CameraMode("chase"), "close");
  assert.equal(nextLevel2CameraMode("close"), "first-person");
  assert.equal(nextLevel2CameraMode("first-person"), "chase");
});

test("Escape works while survey text is focused without leaking movement", () => {
  const input = Object.create(InputManager.prototype);
  input.keysDown = new Set();
  input.keysPressed = new Set();
  input.keysReleased = new Set();
  input.bufferedKeys = new Map();
  input.preventDefaultKeys = new Set();
  const event = (code) => ({ code, ctrlKey: false, target: { tagName: "TEXTAREA" } });
  input.onKeyDown(event("KeyW"));
  assert.equal(input.keysPressed.size, 0);
  input.onKeyDown(event("Escape"));
  assert.ok(input.keysPressed.has("Escape"));
  input.onKeyUp(event("Escape"));
  assert.ok(input.keysReleased.has("Escape"));
  assert.equal(input.keysDown.has("Escape"), false);
});
