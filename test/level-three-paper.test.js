import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";

import { CheatingLevel } from "../src/levels/CheatingLevel.js";

test("player paper stays the same scale when raised for reading", () => {
  const paper = {
    position: { y: 0.7 },
    rotation: { x: -Math.PI / 2 },
    scale: {
      x: 0.9,
      calls: 0,
      setScalar(value) {
        this.x = value;
        this.calls += 1;
      }
    }
  };

  const level = Object.create(CheatingLevel.prototype);
  level.playerDesk = { paper };
  level.isLookingAtPlayerDesk = true;
  level.completed = false;

  level.updatePlayerPaperPose(1 / 60);

  assert.equal(
    paper.scale.calls,
    0,
    "raising the paper should use position/rotation without resizing it"
  );
});

test("answer area stays close to the active question while typing", () => {
  const calls = [];

  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    textAlign: "",
    textBaseline: "",
    fillRect() {},
    strokeRect(...args) {
      calls.push({ type: "strokeRect", args });
    },
    fillText(text, x, y, maxWidth) {
      calls.push({ type: "fillText", text, x, y, maxWidth });
    },
    measureText(text) {
      return { width: text.length * 14 };
    }
  };

  const paper = {
    userData: {
      paperContext: context,
      paperCanvas: { width: 512, height: 600 },
      paperColor: 0xeef7ff,
      paperTexture: { needsUpdate: false }
    }
  };

  const level = Object.create(CheatingLevel.prototype);
  level.activeQuestion = {
    prompt: "What does CPU stand for?"
  };
  level.typedAnswer = "central";
  level.playerDesk = { paper };

  level.drawPaperText(paper, level.typedAnswer);

  const answerBox = calls
    .filter((call) => call.type === "strokeRect")
    .at(-1);

  assert.ok(
    answerBox.args[1] < 330,
    `answer box should sit close to the question; got y=${answerBox.args[1]}`
  );

  assert.ok(
    calls.some(
      (call) =>
        call.type === "fillText" &&
        call.text.includes("What does CPU")
    ),
    "active question should remain rendered while typing"
  );

  assert.ok(
    calls.some(
      (call) =>
        call.type === "fillText" &&
        call.text.includes("central")
    ),
    "typed answer should remain rendered"
  );
});

test("player paper is physically shorter than the previous layout", () => {
  const originalDocument = globalThis.document;

  globalThis.document = {
    createElement() {
      return {
        width: 0,
        height: 0,
        getContext() {
          return {};
        }
      };
    }
  };

  try {
    const level = Object.create(CheatingLevel.prototype);

    level.game = {
      renderer: {
        capabilities: {
          getMaxAnisotropy: () => 1
        }
      }
    };

    level.root = new THREE.Group();
    level.drawPaperText = () => {};

    const paper = level.createDeskPaper(
      "YOUR ANSWER",
      0,
      0,
      0xeef7ff
    );

    assert.ok(
      paper.geometry.parameters.height < 0.62,
      "paper should be shorter than the old 0.62 height"
    );
  } finally {
    if (originalDocument === undefined) {
      delete globalThis.document;
    } else {
      globalThis.document = originalDocument;
    }
  }
});