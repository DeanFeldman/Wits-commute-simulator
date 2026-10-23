import test from "node:test";
import assert from "node:assert/strict";
import { Achievements, ACHIEVEMENTS_STORAGE_KEY } from "../src/shared/Achievements.js";
import { Game } from "../src/core/Game.js";
import { CheatingLevel } from "../src/levels/CheatingLevel.js";

function setup() {
  const saved = new Map();
  const notifications = [];
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const achievements = new Achievements({ storage, now: () => 1234, onUnlock: (entry) => notifications.push(entry.id) });
  return { achievements, storage, saved, notifications };
}

function finish(achievements, performance = {}) {
  achievements.completeLevel(1, { condition: 70 });
  achievements.completeLevel(2);
  achievements.completeLevel(3, { suspicion: 20, peakSuspicion: 20, ...performance });
}

test("low-condition parking has strict living-car boundaries and persists only once", () => {
  const { achievements, storage, notifications } = setup();
  for (const condition of [0, 10, 100, undefined]) {
    achievements.startRun();
    achievements.completeLevel(1, { condition });
    assert.equal(achievements.unlocked["buff-out"], undefined);
  }
  for (let i = 0; i < 2; i++) {
    achievements.startRun();
    achievements.completeLevel(1, { condition: 9.99 });
  }
  assert.deepEqual(notifications.filter(id => id === "buff-out"), ["buff-out"]);
  assert.equal(new Achievements({ storage }).unlocked["buff-out"], 1234);
});

test("Academic Comeback uses the attempt's peak, including exactly 90 but excluding detection", () => {
  for (const [peakSuspicion, earns] of [[89.99, false], [90, true], [99.99, true], [100, false]]) {
    const { achievements } = setup();
    achievements.startRun();
    finish(achievements, { peakSuspicion, suspicion: 5 });
    assert.equal(Boolean(achievements.unlocked["academic-comeback"]), earns);
  }
});

test("only a complete ordered journey earns the full-game badges", () => {
  const { achievements } = setup();
  finish(achievements); // Practice has no active achievement run.
  assert.deepEqual(achievements.unlocked, {});
  achievements.startRun();
  achievements.completeLevel(3);
  assert.deepEqual(achievements.unlocked, {});
  achievements.startRun();
  achievements.addPlayTime(299.99);
  achievements.completeLevel(1);
  achievements.completeLevel(2);
  assert.equal(achievements.unlocked["ordinary-tuesday"], undefined);
  achievements.completeLevel(3);
  assert.equal(achievements.unlocked["ordinary-tuesday"], 1234);
  assert.equal(achievements.unlocked["its-756"], 1234);
});

test("a failure or restart prevents the flawless badge while preserving speedrun time", () => {
  const { achievements } = setup();
  achievements.startRun();
  achievements.addPlayTime(180);
  achievements.recordFailure();
  achievements.addPlayTime(120);
  finish(achievements);
  assert.equal(achievements.unlocked["ordinary-tuesday"], undefined);
  assert.equal(achievements.unlocked["its-756"], undefined, "exactly five minutes does not qualify");
  achievements.startRun();
  achievements.recordFailure();
  achievements.addPlayTime(299);
  finish(achievements);
  assert.equal(achievements.unlocked["its-756"], 1234);
});

test("secret ending reveals only its own badge, requires a journey, and ends the run", () => {
  const { achievements } = setup();
  achievements.completeSecretEnding(1);
  assert.deepEqual(achievements.unlocked, {});
  achievements.startRun();
  achievements.completeSecretEnding(2);
  assert.deepEqual(achievements.unlocked, {});
  achievements.startRun();
  achievements.completeSecretEnding(1);
  finish(achievements);
  assert.deepEqual(achievements.unlocked, { "secret-ending": 1234 });
});

test("leaving a journey clears eligibility and elapsed time", () => {
  const { achievements } = setup();
  achievements.startRun();
  achievements.addPlayTime(500);
  achievements.endRun();
  finish(achievements);
  assert.deepEqual(achievements.unlocked, {});
  achievements.startRun();
  assert.equal(achievements.run.seconds, 0);
});

test("blocked, damaged, and unrecognised storage cannot crash unlocks", () => {
  const storage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  const achievements = new Achievements({ storage });
  achievements.startRun();
  achievements.completeSecretEnding(1);
  assert.ok(achievements.unlocked["secret-ending"]);
  assert.equal(achievements.storageAvailable, false);
  const { storage: valid, saved } = setup();
  saved.set(ACHIEVEMENTS_STORAGE_KEY, '{"buff-out":"bad","secret-ending":1234,"unknown":12}');
  assert.deepEqual(new Achievements({ storage: valid }).unlocked, { "secret-ending": 1234 });
  saved.set(ACHIEVEMENTS_STORAGE_KEY, "broken json");
  assert.doesNotThrow(() => new Achievements({ storage: valid }));
});

test("achievement timing uses real frame duration only during active gameplay", () => {
  const { achievements } = setup();
  achievements.startRun();
  const game = {
    achievements, isScoredJourney: true, journeyTime: 0,
    updateGlobalControls() {}, currentLevel: { update() {} }
  };
  Game.prototype.update.call(game, 0.05, 0.5);
  assert.equal(achievements.run.seconds, 0.5, "low FPS cannot shorten a speedrun");
  assert.equal(game.journeyTime, 0.5, "results and speedrun timing agree");
  for (const flag of ["isPaused", "isLoading", "isTransitioning", "isLevelIntroActive", "isTutorialActive"]) {
    game[flag] = true;
    Game.prototype.update.call(game, 0.05, 5);
    game[flag] = false;
  }
  assert.equal(achievements.run.seconds, 0.5);
  game.isScoredJourney = false;
  Game.prototype.update.call(game, 0.05, 5);
  assert.equal(achievements.run.seconds, 0.5);
});

test("real Game completion and failure events reach the achievement service", () => {
  const { achievements } = setup();
  achievements.startRun();
  const game = {
    achievements, currentLevelNumber: 1, isScoredJourney: true,
    journeyFailureCounts: new Map(), journeyLevelResults: new Map(),
    personalBests: {}, journeyTime: 80,
    setMessage() {}, fadeTransition() {},
    recordFailedAttempt: Game.prototype.recordFailedAttempt
  };
  Game.prototype.completeLevel.call(game, "Parked", { condition: 5 });
  assert.equal(achievements.unlocked["buff-out"], 1234);
  game.isTransitioning = false;
  game.currentLevelNumber = 2;
  Game.prototype.failLevel.call(game, "Hit by traffic");
  assert.equal(achievements.run.failures, 1);
  game.isTransitioning = false;
  Game.prototype.completeLevel.call(game, "Crossed", { impacts: 1 });
  game.isTransitioning = false;
  game.currentLevelNumber = 3;
  Game.prototype.completeLevel.call(game, "Finished", { peakSuspicion: 95, suspicion: 95 });
  assert.equal(achievements.unlocked["academic-comeback"], 1234);
  assert.equal(achievements.unlocked["ordinary-tuesday"], undefined);
  assert.equal(achievements.unlocked["its-756"], 1234);
});

test("the real secret-ending event unlocks only during a scored Level 1 journey", () => {
  const { achievements } = setup();
  achievements.startRun();
  const game = { achievements, currentLevelNumber: 1, isScoredJourney: false, journeyScore: 0, setMessage() {}, fadeTransition() {} };
  Game.prototype.completeGameEasterEgg.call(game);
  assert.deepEqual(achievements.unlocked, {});
  game.isTransitioning = false;
  game.isScoredJourney = true;
  Game.prototype.completeGameEasterEgg.call(game);
  assert.deepEqual(achievements.unlocked, { "secret-ending": 1234 });
});

test("Level 3 records peak suspicion before a later lower value", () => {
  const level = {
    canTutorSeePlayer: () => true, suspicion: 89, peakSuspicion: 0,
    peekActive: true, timeRemaining: 80, audio: { setLoopParameters() {} }
  };
  CheatingLevel.prototype.updateSuspicion.call(level, 0.1);
  assert.ok(level.peakSuspicion >= 90);
  const peak = level.peakSuspicion;
  level.suspicion = 5;
  level.peekActive = false;
  CheatingLevel.prototype.updateSuspicion.call(level, 0.1);
  assert.equal(level.peakSuspicion, peak);
});

test("new milestone and challenge badges use actual results", () => {
  const { achievements: a } = setup();
  a.recordFailure(1);
  assert.equal(a.unlocked.insurance, undefined);
  a.startRun();
  a.recordFailure(1);
  a.completeLevel(1, { condition: 100 });
  a.completeLevel(2, { impacts: 0, cupsCollected: 11, cupsTotal: 11, shieldSaves: 0 });
  a.completeLevel(3, { peakSuspicion: 49.9, suspicion: 0, incorrectAnswers: 0, timeRemaining: 4.9 });
  for (const id of ["insurance", "between-lines", "showroom", "mind-gap", "vida-regular", "look-both-ways", "nothing-to-see", "first-time-pass", "last-minute", "made-it"]) {
    assert.equal(a.unlocked[id], 1234, id);
  }
  assert.equal(a.unlocked["ordinary-tuesday"], undefined);
});

test("Campus Spirit needs all four mascot greetings during the same journey", () => {
  const { achievements: a } = setup();
  a.startRun();
  for (const id of ["shark", "Kudu Sis", "robot", "robot"]) a.recordGreeting(id);
  assert.equal(a.unlocked["campus-spirit"], undefined);
  a.recordGreeting("Kudu Bro");
  assert.equal(a.unlocked["campus-spirit"], 1234);
});

test("survey and tutor events require real qualifying events in a journey", () => {
  const { achievements: a } = setup();
  a.recordCorrectAnswer(true);
  assert.equal(a.unlocked["under-nose"], undefined);
  a.startRun();
  a.recordCorrectAnswer(false);
  a.recordSurveys(new Set(["psychQuizzer"]));
  assert.equal(a.unlocked["under-nose"], undefined);
  assert.equal(a.unlocked["student-support"], undefined);
  a.recordCorrectAnswer(true);
  a.recordSurveys(new Set(["psychQuizzer", "ccduAdvisor"]));
  assert.equal(a.unlocked["under-nose"], 1234);
  assert.equal(a.unlocked["student-support"], 1234);
});

test("challenge boundaries exclude hits, shield saves, wrong answers and five seconds", () => {
  const { achievements: a } = setup();
  a.startRun();
  a.completeLevel(1, { condition: 99 });
  a.completeLevel(2, { impacts: 1, cupsCollected: 10, cupsTotal: 11, shieldSaves: 1 });
  a.completeLevel(3, { peakSuspicion: 50, suspicion: 0, incorrectAnswers: 1, timeRemaining: 5 });
  for (const id of ["showroom", "mind-gap", "vida-regular", "look-both-ways", "nothing-to-see", "first-time-pass", "last-minute"]) assert.equal(a.unlocked[id], undefined, id);
});

test("reset clears saved achievements and ends current journey", () => {
  const { achievements, storage } = setup();
  achievements.startRun();
  achievements.completeLevel(1, { condition: 100 });
  achievements.resetProgress();
  assert.deepEqual(achievements.unlocked, {});
  assert.equal(achievements.run, null);
  assert.deepEqual(new Achievements({ storage }).unlocked, {});
});
