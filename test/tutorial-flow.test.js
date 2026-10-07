import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../src/core/Game.js", import.meta.url), "utf8");
const input = readFileSync(new URL("../src/core/InputManager.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

test("all three levels define a visual tutorial", () => {
  assert.match(game, /LEVEL_TUTORIAL_CONFIG[\s\S]*?LEVEL 01 \/\/ PARK[\s\S]*?LEVEL 02 \/\/ CROSS[\s\S]*?LEVEL 03 \/\/ CHEAT/);
  assert.match(html, /id="instruction-diagram"[\s\S]*?id="instruction-controls"[\s\S]*?Start level/);
  assert.match(css, /\.tutorial-wireframe[\s\S]*?\.tutorial-controls[\s\S]*?\.tutorial-start/);
});

test("tutorial sits between intro or loading and gameplay", () => {
  assert.match(game, /onLevelIntroClick\(event\)[\s\S]*?hideLevelIntro\(\)[\s\S]*?showInstruction\(this\.currentLevel\)/);
  assert.match(game, /if \(!showIntro\) this\.showInstruction\(level\)/);
  assert.match(game, /!this\.isLevelIntroActive\s*&&\s*!this\.isTutorialActive\s*&&\s*this\.currentLevel/);
});

test("starting gameplay clears tutorial input before restoring control", () => {
  assert.match(input, /clearTransientState\(\)[\s\S]*?keysDown\.clear\(\)[\s\S]*?bufferedKeys\.clear\(\)[\s\S]*?clearMouseDelta\(\)/);
  assert.match(game, /onInstructionClick\(event\)[\s\S]*?clearTransientState\(\)[\s\S]*?requestPointerLock\(\)[\s\S]*?clock\.getDelta\(\)/);
});
