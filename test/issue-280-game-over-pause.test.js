import test from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/core/Game.js";

for (const [state, completed] of [["failed", false], ["results", false], ["level3", true]]) {
  test(`pause is ignored in ${state} state (completed: ${completed})`, () => {
    const game = { isPaused: false, currentLevelNumber: 3, currentLevel: { completed }, state, isLoading: false, isTransitioning: false };
    Game.prototype.pause.call(game);
    assert.equal(game.isPaused, false);
  });
}
