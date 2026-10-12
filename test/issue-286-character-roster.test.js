import test from "node:test";
import assert from "node:assert/strict";
import { STUDENT_DISPLAY_NAMES, STUDENT_MODEL_VARIANTS } from "../src/levels/crossing/AnimatedNpcFactory.js";

test("character selection has six distinct names without gender-number labels", () => {
  assert.equal(STUDENT_MODEL_VARIANTS.length, 6);
  assert.equal(new Set(STUDENT_DISPLAY_NAMES).size, 6);
  assert.deepEqual(STUDENT_MODEL_VARIANTS.map((student) => student.label), STUDENT_DISPLAY_NAMES);
  assert.ok(STUDENT_MODEL_VARIANTS.every((student) => !/^(male|female)\\s*\\d+$/i.test(student.label)));
});

test("renaming player options does not change existing model ids or order", () => {
  assert.deepEqual(STUDENT_MODEL_VARIANTS.map((student) => student.id), [
    "male-1", "male-2", "male-3", "female-1", "female-2", "female-3"
  ]);
});
