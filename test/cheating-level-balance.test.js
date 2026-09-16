import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import * as CheatingLevelModule from "../src/levels/CheatingLevel.js";
import {
  QUESTION_BANK,
  buildRoundAnswers,
  validateQuestion
} from "../src/levels/cheatingQuestions.js";

import {
  CheatingLevel,
  LEVEL_THREE_BALANCE,
  isCopiedAnswerCorrect,
  updateSuspicionMeter
} from "../src/levels/CheatingLevel.js";

test("safe posture preserves accumulated suspicion", () => {
  const suspicion = updateSuspicionMeter({
    suspicion: 60,
    peeking: false,
    seen: false,
    dt: 1
  });

  assert.equal(suspicion, 60);
});


test("peeking while unseen preserves accumulated suspicion", () => {
  const result = updateSuspicionMeter({
    suspicion: 50,
    peeking: true,
    seen: false,
    dt: 2
  });

  assert.equal(result, 50);
});

test("peeking while seen raises suspicion", () => {
  const result = updateSuspicionMeter({
    suspicion: 0,
    peeking: true,
    seen: true,
    dt: 1
  });

  assert.equal(result, 30);
});

test("continuous detected peeking reaches maximum suspicion", () => {
  let suspicion = 0;

  for (let elapsed = 0; elapsed < 10 && suspicion < 100; elapsed += 0.1) {
    suspicion = updateSuspicionMeter({
      suspicion,
      peeking: true,
      seen: true,
      dt: 0.1
    });
  }

  assert.equal(suspicion, 100);
});

test("suspicion never decreases during an active attempt", () => {
  let suspicion = 40;

  suspicion = updateSuspicionMeter({
    suspicion,
    peeking: false,
    seen: false,
    dt: 2
  });

  assert.equal(suspicion, 40);

  suspicion = updateSuspicionMeter({
    suspicion,
    peeking: true,
    seen: false,
    dt: 2
  });

  assert.equal(suspicion, 40);

  suspicion = updateSuspicionMeter({
    suspicion,
    peeking: true,
    seen: true,
    dt: 1
  });

  assert.ok(suspicion > 40);

  const raisedSuspicion = suspicion;

  suspicion = updateSuspicionMeter({
    suspicion,
    peeking: false,
    seen: false,
    dt: 5
  });

  assert.equal(suspicion, raisedSuspicion);
});

test("copied answer comparison ignores case and surrounding whitespace", () => {
  assert.equal(isCopiedAnswerCorrect("  AlGoRiThM ", "algorithm"), true);
  assert.equal(isCopiedAnswerCorrect("binary", "compiler"), false);
  assert.equal(isCopiedAnswerCorrect("binary", null), false);
});

test("a correct answer advances the full question round and redistributes all tablets", () => {
  const level = new CheatingLevel({});
  const desks = Array.from({ length: 7 }, () => ({ word: "", hologram: {} }));

  level.audio = { cue() {} };
  level.drawHologramText = () => {};
  level.updatePlayerPaper = () => {};
  level.cheatDesks = desks;
  level.isLookingAtPlayerDesk = true;
  level.activeQuestion = QUESTION_BANK[0];
  level.questionOrder = [QUESTION_BANK[1]];
  level.questionIndex = 0;
  level.typedAnswer = "stack";

  assert.equal(level.submitTypedAnswer(), true);
  assert.equal(level.answerProgress, LEVEL_THREE_BALANCE.answerGainPerCorrectWord);
  assert.equal(level.activeQuestion, QUESTION_BANK[1]);
  assert.equal(new Set(desks.map((desk) => desk.word)).size, 7);
  assert.ok(desks.some((desk) => desk.word === "Queue"));

  assert.equal(level.submitTypedAnswer(), false);
  assert.equal(level.answerProgress, LEVEL_THREE_BALANCE.answerGainPerCorrectWord);
});

test("every supplied question has one correct answer and six valid distractors", () => {
  assert.equal(QUESTION_BANK.length, 50);

  for (const question of QUESTION_BANK) {
    assert.equal(validateQuestion(question), true, question.prompt);
    const answers = buildRoundAnswers(question);
    assert.equal(answers.length, 7);
    assert.equal(new Set(answers.map((answer) => answer.toLowerCase())).size, 7);
    assert.equal(
      answers.filter((answer) => answer.toLowerCase() === question.correctAnswer.toLowerCase()).length,
      1
    );
  }
});

test("typing is ignored away from the player desk and Space is not an answer action", () => {
  const level = new CheatingLevel({});
  const letterEvent = {
    key: "a",
    preventDefault() {},
    stopImmediatePropagation() {}
  };

  level.updatePlayerPaper = () => {};
  level.onTypingKeyDown(letterEvent);
  assert.equal(level.typedAnswer, "");

  level.isLookingAtPlayerDesk = true;
  level.onTypingKeyDown({ ...letterEvent, key: " " });
  assert.equal(level.typedAnswer, "");

  level.onTypingKeyDown(letterEvent);
  assert.equal(level.typedAnswer, "a");
  assert.equal(level.answerProgress, 0);
});

test("only the targeted neighbour's hologram is visible while peeking", () => {
  let pointerLocked = true;
  const level = new CheatingLevel({
    input: { isPointerLocked: () => pointerLocked }
  });
  const leftDesk = { word: "graphics", hologram: { visible: false } };
  const rightDesk = { word: "runtime", hologram: { visible: false } };

  level.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
  level.cheatDesks = [leftDesk, rightDesk];
  level.targetCheatDesk = leftDesk;
  level.leftMouseDown = true;
  level.updatePeek(0.1);

  assert.equal(level.peekActive, true);
  assert.equal(leftDesk.hologram.visible, true);
  assert.equal(rightDesk.hologram.visible, false);
  assert.equal(level.currentCopiedWord, "graphics");

  pointerLocked = false;
  level.updatePeek(0.1);
  assert.equal(level.peekActive, false);
  assert.equal(leftDesk.hologram.visible, false);
});

test("left mouse zooms even when no answer tablet is targeted", () => {
  let overlayVisible = false;
  const level = new CheatingLevel({
    input: { isPointerLocked: () => true }
  });
  const desk = { word: "graphics", hologram: { visible: false } };

  level.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
  level.zoomOverlay = {
    classList: {
      toggle(className, visible) {
        assert.equal(className, "visible");
        overlayVisible = visible;
      }
    }
  };
  level.cheatDesks = [desk];
  level.targetCheatDesk = null;
  level.leftMouseDown = true;
  level.updatePeek(0.1);

  assert.equal(level.zoomActive, true);
  assert.equal(overlayVisible, true);
  assert.equal(level.peekActive, false);
  assert.equal(desk.hologram.visible, false);
  assert.ok(level.camera.fov < 62);
});

test("ending a peek clears zoom, holograms, and restores the normal camera view", () => {
  const level = new CheatingLevel({});
  let overlayVisible = true;
  const hologram = { visible: true };

  level.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  level.zoomOverlay = {
    classList: {
      remove(className) {
        assert.equal(className, "visible");
        overlayVisible = false;
      }
    }
  };
  level.cheatDesks = [{ hologram }];
  level.leftMouseDown = true;
  level.zoomActive = true;
  level.peekActive = true;

  level.endPeek();

  assert.equal(level.leftMouseDown, false);
  assert.equal(level.zoomActive, false);
  assert.equal(level.peekActive, false);
  assert.equal(hologram.visible, false);
  assert.equal(overlayVisible, false);
  assert.equal(level.camera.fov, 62);
});

test("the player paper lifts only while it is being looked at", () => {
  const level = new CheatingLevel({});
  const paper = new THREE.Object3D();

  paper.position.y = 0.707;
  paper.rotation.x = -Math.PI / 2;
  paper.scale.setScalar(0.84);
  level.playerDesk = { paper };

  level.isLookingAtPlayerDesk = true;
  level.updatePlayerPaperPose(1);
  assert.ok(Math.abs(paper.position.y - 0.915) < 0.0001);
  assert.equal(paper.rotation.x, -Math.PI / 3);
  assert.equal(paper.scale.x, 1);

  level.isLookingAtPlayerDesk = false;
  level.updatePlayerPaperPose(1);
  assert.ok(Math.abs(paper.position.y - 0.707) < 0.0001);
  assert.equal(paper.rotation.x, -Math.PI / 2);
  assert.equal(paper.scale.x, 0.84);
});

test("tablet targeting is forgiving near the paper but bounded vertically", () => {
  const level = new CheatingLevel({});
  const target = level.createTabletInteractionTarget(0, 0);
  const desk = {
    tablet: new THREE.Group(),
    interactionTarget: target
  };

  target.userData.cheatDesk = desk;
  level.cheatDesks = [desk];
  level.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
  level.camera.position.set(0, 1.09, 2);
  level.camera.lookAt(0, 0.94, 0);
  level.updateDeskTargeting();

  assert.equal(target.visible, false);
  assert.equal(level.targetCheatDesk, desk);

  level.camera.lookAt(0, 1.35, 0);
  level.updateDeskTargeting();
  assert.equal(level.targetCheatDesk, null);

  level.camera.lookAt(0, 0.55, 0);
  level.updateDeskTargeting();
  assert.equal(level.targetCheatDesk, null);
});

test("after peeking, the HUD tells the player to look down and type", () => {
  const level = new CheatingLevel({});

  level.currentCopiedWord = "runtime";

  assert.equal(
    level.getContextInstruction(),
    "Look down at your own desk to type the answer."
  );
});

test("tutor patrol snakes through the desk aisles without diagonal shortcuts", () => {
  const points = new CheatingLevel({}).patrolPoints;
  const aisleDepths = [...new Set(points.map((point) => point.z))]
    .sort((a, b) => a - b);

  assert.deepEqual(
    aisleDepths,
    [-5.1, -2.65, -0.15, 2.35, 4.85, 7.35]
  );

  const centralAislePoints = points.filter(
    (point) => point.x === 0.95
  );

  assert.ok(
    centralAislePoints.length >= 10,
    "tutor should repeatedly patrol the central aisle in front of the player"
  );

  for (let index = 0; index < points.length; index++) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    assert.ok(
      current.x === next.x || current.z === next.z,
      `patrol segment ${index} must remain inside a row or side aisle`
    );
  }
});

test("tutor adds progressively more player-area passes as suspicion rises", () => {
  const getExtraTutorPlayerPasses =
    CheatingLevelModule.getExtraTutorPlayerPasses;

  assert.equal(typeof getExtraTutorPlayerPasses, "function");

  assert.equal(getExtraTutorPlayerPasses(0), 0);
  assert.equal(getExtraTutorPlayerPasses(29), 0);

  assert.equal(getExtraTutorPlayerPasses(30), 1);
  assert.equal(getExtraTutorPlayerPasses(59), 1);

  assert.equal(getExtraTutorPlayerPasses(60), 2);
  assert.equal(getExtraTutorPlayerPasses(79), 2);

  assert.equal(getExtraTutorPlayerPasses(80), 3);
  assert.equal(getExtraTutorPlayerPasses(99), 3);
});

test("high suspicion makes the tutor recheck the player area before continuing", () => {
  const level = new CheatingLevel({});

  level.suspicion = 85;
  level.tutorMover = {
    index: 13
  };

  level.handleTutorPatrolArrival?.(9);

  assert.equal(level.extraPlayerPassesRemaining, 3);

  level.handleTutorPatrolArrival?.(12);

  assert.equal(level.tutorMover.index, 11);
  assert.equal(level.extraPlayerPassesRemaining, 2);

  level.handleTutorPatrolArrival?.(12);

  assert.equal(level.tutorMover.index, 11);
  assert.equal(level.extraPlayerPassesRemaining, 1);

  level.handleTutorPatrolArrival?.(12);

  assert.equal(level.tutorMover.index, 11);
  assert.equal(level.extraPlayerPassesRemaining, 0);
});
test("low suspicion leaves the normal tutor patrol unchanged", () => {
  const level = new CheatingLevel({});

  level.suspicion = 20;
  level.tutorMover = {
    index: 13
  };

  level.handleTutorPatrolArrival?.(9);

  assert.equal(level.extraPlayerPassesRemaining, 0);

  level.handleTutorPatrolArrival?.(12);

  assert.equal(level.tutorMover.index, 13);
});
