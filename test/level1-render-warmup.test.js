import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../src/core/Game.js", import.meta.url), "utf8");

test("Level 1 graphics must warm up before its tutorial Start is enabled", () => {
  assert.match(game, /levelOneGraphicsReady = levelNumber !== 1/);
  assert.match(game, /const levelReady = !this\.isLoading && !!this\.currentLevel && this\.currentLevelNumber === 1 && this\.levelOneGraphicsReady/);
  assert.match(game, /this\.levelOneWarmupFrames < 3/);
});

test("real frames render through the existing pipeline before Level 1 is ready", () => {
  assert.match(game, /this\.render\(\);\s*this\.advanceLevelOneWarmup\(\)/);
  assert.match(game, /if \(this\.isLoading\) return;[\s\S]*?this\.currentLevelNumber !== 1 \|\| !this\.currentLevel/);
  assert.match(game, /if \(this\.isLevelIntroActive\) this\.setLevelIntroLoadState\("ready"\)/);
});

test("Level 1 warmup does not advance gameplay while tutorial is open", () => {
  assert.match(game, /if \(this\.isTutorialActive\) \{[\s\S]*?return;/);
  assert.match(game, /!this\.isLevelIntroActive\s*&&\s*!this\.isTutorialActive\s*&&\s*this\.currentLevel/);
});

test("each new load invalidates Level 1 graphics readiness", () => {
  assert.match(game, /const loadVersion = \+\+this\.loadVersion;\s*this\.levelOneWarmupFrames = 0;\s*this\.levelOneGraphicsReady = levelNumber !== 1/);
});
