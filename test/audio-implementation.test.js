import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { LevelAudio } from "../src/shared/LevelAudio.js";
import { AudioSettings } from "../src/shared/AudioSettings.js";
import { getLevelOneDamageBlend } from "../src/levels/ParkingLevel.js";
import {
  CrossingLevel,
  getRoadAudioProximity,
  shouldWarnWithHorn
} from "../src/levels/crossing/CrossingLevel.js";
import { CheatingLevel } from "../src/levels/CheatingLevel.js";

test("gameplay has no level music or generic result sting trigger", () => {
  const game = readFileSync(new URL("../src/core/Game.js", import.meta.url), "utf8");
  const audio = readFileSync(new URL("../src/shared/LevelAudio.js", import.meta.url), "utf8");
  assert.doesNotMatch(game, /startMusic\(["']level[123]["']/);
  assert.doesNotMatch(game, /result-sprite\.opus/);
  assert.doesNotMatch(audio, /level[123]:\s*["']/);
  assert.doesNotMatch(audio, /createOscillator\(/);
});

test("Level 1 damaged engine crossfades only below 35 percent", () => {
  assert.equal(getLevelOneDamageBlend(42), 0);
  assert.equal(getLevelOneDamageBlend(35), 0);
  assert.equal(getLevelOneDamageBlend(22.5), 0.5);
  assert.equal(getLevelOneDamageBlend(10), 1);
  assert.equal(getLevelOneDamageBlend(0), 1);
});

test("road ambience is silent far away and clear one strip from a lane", () => {
  assert.equal(getRoadAudioProximity(8), 0);
  assert.equal(getRoadAudioProximity(2.4), 0.62);
  assert.equal(getRoadAudioProximity(0.6), 1);
});

test("horn warning requires an armed approaching car in the player's lane", () => {
  assert.equal(shouldWarnWithHorn({ dx: -4, dz: 0, direction: 1 }), true);
  assert.equal(shouldWarnWithHorn({ dx: 4, dz: 0, direction: -1 }), true);
  assert.equal(shouldWarnWithHorn({ dx: 4, dz: 0, direction: 1 }), false);
  assert.equal(shouldWarnWithHorn({ dx: -4, dz: 2, direction: 1 }), false);
  assert.equal(shouldWarnWithHorn({ dx: -1, dz: 0, direction: 1 }), false);
  assert.equal(shouldWarnWithHorn({ dx: -4, dz: 0, direction: 1, cooldown: 1 }), false);
  assert.equal(shouldWarnWithHorn({ dx: -4, dz: 0, direction: 1, hornArmed: false }), false);
});

test("Vida pickup audio fires once and only after a successful collection", () => {
  const played = [];
  const cup = { type: { id: "flatWhite", label: "Flat White", blurb: "Route collectible", glow: 0xffffff }, mesh: { position: {} } };
  const level = Object.create(CrossingLevel.prototype);
  level.player = { position: {} };
  level.cups = {
    update() {},
    collectNear: (() => {
      let available = true;
      return () => available ? (available = false, cup) : null;
    })()
  };
  level.powerUps = { apply: () => cup.type };
  level.speech = { popup() {} };
  level.game = { setMessage() {} };
  level.audio = { playSample: (path) => played.push(path) };
  level.updateCups(0.016);
  level.updateCups(0.016);
  assert.deepEqual(played, ["./assets/audio/level2/cup-pickup.opus"]);
});

test("Level 3 correct and incorrect submissions use separate immediate cues", () => {
  const played = [];
  const level = Object.create(CheatingLevel.prototype);
  Object.assign(level, {
    completed: false,
    isLookingAtPlayerDesk: true,
    activeQuestion: { correctAnswer: "stack" },
    typedAnswer: "queue",
    incorrectAnswers: 0,
    answerProgress: 0,
    audio: { playSample: (path) => played.push(path) },
    updatePlayerPaper() {},
    hideHolograms() {},
    advanceQuestion() {}
  });
  assert.equal(level.submitTypedAnswer(), false);
  level.typedAnswer = "stack";
  assert.equal(level.submitTypedAnswer(), true);
  assert.deepEqual(played, [
    "./assets/audio/level3/incorrect-answer.opus",
    "./assets/audio/level3/correct-tick.opus"
  ]);
});

test("fatal Level 2 impact uses transition-safe audio before failure disposal", () => {
  const calls = [];
  const level = Object.create(CrossingLevel.prototype);
  Object.assign(level, {
    attempts: 2,
    checkpoint: { x: 0, z: 0 },
    game: {
      flashHUD() {},
      setCheckpoint() {},
      failLevel() { calls.push("fail"); },
      playOneShotAudio(path) { calls.push(path); }
    },
    audio: { playSample() { calls.push("level-audio"); } }
  });
  level.failAtCheckpoint(false);
  assert.deepEqual(calls, ["./assets/audio/level2/vehicle-impact.opus", "fail"]);
});

test("disposing active audio is idempotent even when a source already ended", () => {
  const audio = new LevelAudio();
  audio.oneShots.add({
    source: { stop() { throw new Error("already ended"); }, disconnect() {} },
    gain: { disconnect() {} },
    panner: { disconnect() {} }
  });
  assert.doesNotThrow(() => audio.dispose());
  assert.doesNotThrow(() => audio.dispose());
});

test("every sound is tunable from AudioSettings without losing distance fades", () => {
  assert.equal(AudioSettings.gain("./assets/audio/level3/correct-tick.opus", 0.92), 0.92 * 1.7);
  assert.equal(AudioSettings.gain("./assets/audio/level1/car-door-close.opus", 1), 0.85);
  assert.equal(AudioSettings.gain("./assets/audio/level2/traffic-ambience.opus", 0.4), 0.4);
  assert.equal(AudioSettings.rate("./assets/audio/level1/idle-car.opus", 0.86), 0.86);
});

test("successful parking plays car door close once before the level transition", () => {
  const code = readFileSync(new URL("../src/levels/ParkingLevel.js", import.meta.url), "utf8");
  const marker = code.indexOf('this.parkingStatus.holdTime >= this.parkingConfirmationDuration');
  const portion = code.slice(marker, marker + 470);
  assert.match(portion, /this.completed = true;/);
  assert.match(portion, /this.game.playOneShotAudio\?\.\(LEVEL1_CAR_DOOR_CLOSE_AUDIO, 1\)/);
  assert.ok(portion.indexOf("playOneShotAudio") < portion.indexOf("completeLevel"));
});

test("correct-answer sound uses persistent UI audio when available", () => {
  const played = [];
  const level = Object.create(CheatingLevel.prototype);
  Object.assign(level, {
    completed: false,
    isLookingAtPlayerDesk: true,
    activeQuestion: { correctAnswer: "stack" },
    typedAnswer: "stack",
    incorrectAnswers: 0,
    answerProgress: 0,
    audio: { playSample() { throw new Error("level audio is not transition-safe"); } },
    game: { playOneShotAudio: (path, volume) => played.push([path, volume]) },
    updatePlayerPaper() {},
    hideHolograms() {},
    advanceQuestion() {}
  });
  assert.equal(level.submitTypedAnswer(), true);
  assert.deepEqual(played, [["./assets/audio/level3/correct-tick.opus", 0.92]]);
});
