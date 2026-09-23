import assert from "node:assert/strict";
import test from "node:test";
import { describeFailure } from "../src/core/FailureReport.js";

test("a structured failure keeps all three lines", () => {
  const details = describeFailure({
    title: "Time is up",
    reason: "The test ended with your answer sheet 40% full.",
    next: "Retry restarts the test with a fresh 75 seconds."
  });

  assert.equal(details.title, "Time is up");
  assert.equal(details.reason, "The test ended with your answer sheet 40% full.");
  assert.equal(details.next, "Retry restarts the test with a fresh 75 seconds.");
});

test("a plain sentence becomes the reason, never a blank card", () => {
  const details = describeFailure("Caught by the tutor. Try again?");

  assert.equal(details.title, "Run ended");
  assert.equal(details.reason, "Caught by the tutor. Try again?");
  assert.equal(details.next, "");
});

test("missing copy still produces a titled card instead of empty text", () => {
  for (const input of [undefined, null, {}, { title: "   " }]) {
    const details = describeFailure(input);
    assert.equal(details.title, "Run ended");
    assert.equal(details.reason, "");
    assert.equal(details.next, "");
  }
});
