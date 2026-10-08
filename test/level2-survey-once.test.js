import assert from "node:assert/strict";
import test from "node:test";

import { CrossingLevel, getCrowdSpeakerLabel } from "../src/levels/crossing/CrossingLevel.js";

test("Level 2 player survey replies use You rather than an undefined speaker name (#265)", () => {
  const eventPlayer = { kind: "player", mesh: {}, talkCooldown: 0 };
  assert.equal(getCrowdSpeakerLabel(eventPlayer), "You");
  assert.doesNotMatch(getCrowdSpeakerLabel(eventPlayer), /undefined/);
});

test("named NPC speakers retain their names and titles; missing names fall back to roles", () => {
  assert.equal(getCrowdSpeakerLabel({ kind: "psychQuizzer", name: "Lerato" }), "Lerato · Psych Elective");
  assert.equal(getCrowdSpeakerLabel({ kind: "guard", name: "Thabo" }), "Thabo · Campus Protection");
  assert.equal(getCrowdSpeakerLabel({ kind: "guard" }), "Campus Protection");
  assert.equal(getCrowdSpeakerLabel({ kind: "student", name: "Ayesha" }), "Ayesha");
  assert.equal(getCrowdSpeakerLabel({ kind: "commuter" }), "");
});

function createHarness(completed = []) {
  const openedQuizzes = [];
  const openedPsychology = [];
  const sentOff = [];
  const messages = [];
  const speech = [];
  const crowdSpeech = [];

  const level = {
    completedSurveys: new Set(completed),
    surveyConversation: null,
    quizPaused: false,
    startCompletedSurveyConversation:
      CrossingLevel.prototype.startCompletedSurveyConversation,
    updateSurveyConversation:
      CrossingLevel.prototype.updateSurveyConversation,
    crowd: {
      random: () => 0,
      say(person, text) {
        crowdSpeech.push({ person, text });
      },
      sendOff(person) {
        sentOff.push(person);
      }
    },
    quiz: {
      open(quiz, onComplete) {
        openedQuizzes.push({ quiz, onComplete });
      },
      openPsychologyQuestionnaire(random, onComplete) {
        openedPsychology.push({ random, onComplete });
      }
    },
    player: {
      position: { x: 0, y: 0, z: 0 }
    },
    speech: {
      popup(position, text) {
        speech.push({ position, text });
      }
    },
    game: {
      setMessage(text) {
        messages.push(text);
      }
    }
  };

  return {
    level,
    openedQuizzes,
    openedPsychology,
    sentOff,
    messages,
    speech,
    crowdSpeech
  };
}

test("a completed CCDU survey becomes a two-bubble conversation instead of reopening", () => {
  const harness = createHarness(["ccduAdvisor"]);
  const person = {
    kind: "ccduAdvisor",
    chasing: true,
    caught: true,
    chaseArmed: true,
    surveyCooldown: 0
  };

  CrossingLevel.prototype.startQuiz.call(harness.level, person);

  assert.equal(harness.openedQuizzes.length, 0);
  assert.equal(harness.openedPsychology.length, 0);
  assert.equal(harness.level.quizPaused, true);
  assert.equal(harness.crowdSpeech.length, 1);
  assert.equal(
    harness.crowdSpeech[0].text,
    "Hi! Got 30 seconds for a CCDU wellness question?"
  );
  assert.equal(harness.speech.length, 0, "player should answer after a short beat");
  assert.equal(harness.sentOff.length, 0);

  CrossingLevel.prototype.updateSurveyConversation.call(harness.level, 0.91);

  assert.equal(harness.level.quizPaused, false);
  assert.equal(harness.crowdSpeech.length, 2);
  assert.equal(harness.crowdSpeech[1].person.kind, "player");
  assert.equal(
    harness.crowdSpeech[1].text,
    "I already did the CCDU check-in. I promise!"
  );
  assert.equal(harness.sentOff[0], person);
  assert.equal(harness.level.surveyConversation, null);
});

test("CCDU completion is recorded only after the form is submitted", () => {
  const harness = createHarness();
  const person = { kind: "ccduAdvisor" };

  CrossingLevel.prototype.startQuiz.call(harness.level, person);

  assert.equal(harness.openedQuizzes.length, 1);
  assert.equal(harness.level.quizPaused, true);
  assert.equal(harness.level.completedSurveys.has("ccduAdvisor"), false);

  harness.openedQuizzes[0].onComplete();

  assert.equal(harness.level.completedSurveys.has("ccduAdvisor"), true);
  assert.equal(harness.level.quizPaused, false);
  assert.equal(harness.sentOff[0], person);
});

test("psychology questionnaire completion is tracked separately from CCDU", () => {
  const harness = createHarness(["ccduAdvisor"]);
  const person = { kind: "psychQuizzer" };

  CrossingLevel.prototype.startQuiz.call(harness.level, person);

  assert.equal(harness.openedPsychology.length, 1);
  assert.equal(harness.level.completedSurveys.has("psychQuizzer"), false);
  assert.equal(harness.level.completedSurveys.has("ccduAdvisor"), true);

  harness.openedPsychology[0].onComplete();

  assert.equal(harness.level.completedSurveys.has("psychQuizzer"), true);
  assert.equal(harness.level.completedSurveys.has("ccduAdvisor"), true);
  assert.equal(harness.level.quizPaused, false);
  assert.equal(harness.sentOff[0], person);
});

test("completed psychology questionnaire also uses NPC then player speech bubbles", () => {
  const harness = createHarness(["psychQuizzer"]);
  const person = {
    kind: "psychQuizzer",
    chasing: true,
    caught: true,
    chaseArmed: true,
    surveyCooldown: 0
  };

  CrossingLevel.prototype.startQuiz.call(harness.level, person);

  assert.equal(harness.openedPsychology.length, 0);
  assert.equal(harness.openedQuizzes.length, 0);
  assert.equal(
    harness.crowdSpeech[0].text,
    "Oh — perfect, you're just the person I needed!"
  );
  assert.equal(harness.speech.length, 0);

  CrossingLevel.prototype.updateSurveyConversation.call(harness.level, 0.91);

  assert.equal(harness.crowdSpeech.length, 2);
  assert.equal(harness.crowdSpeech[1].person.kind, "player");
  assert.equal(harness.crowdSpeech[1].text, "I already did your survey 😭");
  assert.equal(harness.sentOff[0], person);
  assert.equal(harness.level.quizPaused, false);
});
