import assert from "node:assert/strict";
import test from "node:test";
import { createSeededRandom } from "../src/levels/crossing/Level2StripGenerator.js";
import { QUIZ_BANK, isValidAnswer, pickQuiz } from "../src/levels/crossing/quizBank.js";
import {
  AGREE_DISAGREE_QUESTIONS,
  YES_NO_UNDECIDED_QUESTIONS,
  createPsychologyQuestionnaireSession,
  isQuestionnaireComplete
} from "../src/levels/crossing/psychologyQuestionnaire.js";

test("psychology questionnaire selects three unique questions from each pool", () => {
  const session = createPsychologyQuestionnaireSession(createSeededRandom(4));
  assert.equal(session.yesNoQuestions.length, 3);
  assert.equal(session.scaleQuestions.length, 3);
  assert.equal(new Set(session.yesNoQuestions.map((question) => question.id)).size, 3);
  assert.equal(new Set(session.scaleQuestions.map((question) => question.id)).size, 3);
  assert.ok(session.yesNoQuestions.every((question) => YES_NO_UNDECIDED_QUESTIONS.includes(question)));
  assert.ok(session.scaleQuestions.every((question) => AGREE_DISAGREE_QUESTIONS.includes(question)));
});

test("psychology questionnaire completion requires all six responses", () => {
  const session = createPsychologyQuestionnaireSession(createSeededRandom(2));
  assert.equal(isQuestionnaireComplete(session), false);
  session.questions.forEach((question) => session.responses.set(question.id, question.possibleAnswers[0]));
  assert.equal(isQuestionnaireComplete(session), true);
});

test("pickQuiz returns a quiz from the CCDU pool only", () => {
  const random = createSeededRandom(1);
  for (let i = 0; i < 20; i++) {
    const quiz = pickQuiz("ccduAdvisor", random);
    assert.ok(quiz, "expected a ccduAdvisor quiz");
    assert.equal(quiz.giver, "ccduAdvisor");
  }
});

test("pickQuiz returns null for a giver kind with no quizzes", () => {
  const random = createSeededRandom(1);
  assert.equal(pickQuiz("psychQuizzer", random), null);
  assert.equal(pickQuiz("guard", random), null);
});

test("a choice quiz is only valid once a listed option is given", () => {
  const quiz = { type: "choice", options: ["Yes", "No"] };

  assert.equal(isValidAnswer(quiz, null), false);
  assert.equal(isValidAnswer(quiz, ""), false);
  assert.equal(isValidAnswer(quiz, "Not a real option"), false);
  assert.equal(isValidAnswer(quiz, quiz.options[0]), true);
});

test("a text quiz is only valid once trimmed length meets minLength", () => {
  const quiz = QUIZ_BANK.find((entry) => entry.type === "text");
  assert.ok(quiz, "expected at least one text quiz in the bank");

  assert.equal(isValidAnswer(quiz, ""), false);
  assert.equal(isValidAnswer(quiz, "   "), false, "whitespace-only answers should not count");
  assert.equal(isValidAnswer(quiz, "hi"), quiz.minLength <= 2);
  assert.equal(isValidAnswer(quiz, "I plan my week every Sunday."), true);
});

test("checking an answer never mutates the quiz bank", () => {
  const before = JSON.parse(JSON.stringify(QUIZ_BANK));

  const choiceQuiz = { type: "choice", options: ["Yes", "No"] };
  isValidAnswer(choiceQuiz, choiceQuiz.options[0]);
  isValidAnswer(choiceQuiz, "garbage");

  const textQuiz = QUIZ_BANK.find((entry) => entry.type === "text");
  isValidAnswer(textQuiz, "I use a planner every morning.");
  isValidAnswer(textQuiz, "");

  const random = createSeededRandom(7);
  pickQuiz("psychQuizzer", random);
  pickQuiz("ccduAdvisor", random);

  assert.deepEqual(QUIZ_BANK, before, "answering or picking quizzes must not change the question bank");
});

test("repeated valid/invalid checks on the same quiz produce fresh results, not accumulated state", () => {
  const quiz = QUIZ_BANK.find((entry) => entry.type === "text");

  // A bad answer followed by a good one, then bad again: each call stands alone.
  assert.equal(isValidAnswer(quiz, ""), false);
  assert.equal(isValidAnswer(quiz, "A real answer about my schedule."), true);
  assert.equal(isValidAnswer(quiz, ""), false, "an earlier valid answer must not linger");
});
