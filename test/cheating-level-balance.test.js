import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import {
  CheatingLevel,
  LEVEL_THREE_BALANCE,
  isCopiedAnswerCorrect,
  updateSuspicionMeter
} from "../src/levels/CheatingLevel.js";

test("safe posture decays suspicion gradually", () => {
  const result = updateSuspicionMeter({
    suspicion: 60,
    peeking: false,
    seen: false,
    dt: 1
  });

  assert.equal(
    result,
    60 - LEVEL_THREE_BALANCE.suspicionDecayPerSecond
  );

  assert.ok(result > 0);
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

test("copied answer comparison ignores case and surrounding whitespace", () => {
  assert.equal(isCopiedAnswerCorrect("  AlGoRiThM ", "algorithm"), true);
  assert.equal(isCopiedAnswerCorrect("binary", "compiler"), false);
  assert.equal(isCopiedAnswerCorrect("binary", null), false);
});

test("a copied challenge awards once and rerolls that neighbour's word", () => {
  const level = new CheatingLevel({});
  const copiedDesk = {
    word: "compiler",
    hologram: {}
  };

  level.audio = { cue() {} };
  level.drawHologramText = () => {};
  level.updatePlayerPaper = () => {};
  level.cheatDesks = [
    copiedDesk,
    { word: "binary", hologram: {} }
  ];
  level.isLookingAtPlayerDesk = true;
  level.currentCopiedWord = "compiler";
  level.currentCopiedDesk = copiedDesk;
  level.typedAnswer = "compiler";

  assert.equal(level.submitTypedAnswer(), true);
  assert.equal(level.answerProgress, LEVEL_THREE_BALANCE.answerGainPerCorrectWord);
  assert.notEqual(copiedDesk.word, "compiler");
  assert.notEqual(copiedDesk.word, "binary");

  assert.equal(level.submitTypedAnswer(), false);
  assert.equal(level.answerProgress, LEVEL_THREE_BALANCE.answerGainPerCorrectWord);
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
