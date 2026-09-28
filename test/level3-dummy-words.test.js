import test from "node:test";
import assert from "node:assert/strict";

import {
  LEVEL_THREE_DUMMY_WORDS,
  buildVariedRoundAnswers
} from "../src/levels/CheatingLevel.js";
import { normaliseAnswer } from "../src/levels/cheatingQuestions.js";

const QUESTION = Object.freeze({
  correctAnswer: "algorithm"
});

function distractors(answers) {
  const correctKey = normaliseAnswer(QUESTION.correctAnswer);
  return answers.filter(
    (answer) => normaliseAnswer(answer) !== correctKey
  );
}

test("Level 3 has a wider rubbish-answer pool than the six visible distractors", () => {
  assert.ok(
    LEVEL_THREE_DUMMY_WORDS.length > 6,
    "dummy-word pool should contain more than six words"
  );
});

test("successive Level 3 rounds do not reuse the same six rubbish answers", () => {
  const first = buildVariedRoundAnswers(QUESTION, null, 0);
  const second = buildVariedRoundAnswers(QUESTION, null, 1);

  assert.equal(first.length, 7);
  assert.equal(second.length, 7);
  assert.notDeepEqual(
    new Set(distractors(first)),
    new Set(distractors(second))
  );
});

test("every wrong Level 3 answer comes from the obviously-wrong dummy pool", () => {
  const answers = buildVariedRoundAnswers(QUESTION, null, 3);
  const rubbish = new Set(LEVEL_THREE_DUMMY_WORDS.map(normaliseAnswer));

  for (const answer of distractors(answers)) {
    assert.ok(
      rubbish.has(normaliseAnswer(answer)),
      `${answer} should come from the rubbish-answer pool`
    );
  }
});

test("a Level 3 round contains one real answer and six unique rubbish answers", () => {
  const answers = buildVariedRoundAnswers(QUESTION, null, 4);
  const normalised = answers.map(normaliseAnswer);
  const correctKey = normaliseAnswer(QUESTION.correctAnswer);

  assert.equal(answers.length, 7);
  assert.equal(new Set(normalised).size, 7);
  assert.equal(
    normalised.filter((answer) => answer === correctKey).length,
    1
  );
});
