import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const game = readFileSync(new URL("../src/core/Game.js", import.meta.url), "utf8");
const input = readFileSync(new URL("../src/core/InputManager.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

test("all three levels define a visual tutorial", () => {
  assert.match(game, /LEVEL_TUTORIAL_CONFIG[\s\S]*?LEVEL 01 \/\/ PARK[\s\S]*?LEVEL 02 \/\/ CROSS[\s\S]*?LEVEL 03 \/\/ CHEAT/);
  assert.match(html, /id="instruction-preview"[\s\S]*?id="instruction-controls"[\s\S]*?Start level/);
  assert.match(css, /\.tutorial-preview-frame[\s\S]*?\.tutorial-controls[\s\S]*?\.tutorial-start/);
  assert.match(game, /LEVEL 01 \/\/ PARK[\s\S]*?\["C", "Camera view"\]/);
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


test("tutorial preview is captured from the loaded game renderer", () => {
  assert.match(game, /captureTutorialPreview\(\)[\s\S]*?this\.render\(\)[\s\S]*?ctx\.drawImage\(source/);
});


test("camera tutorial control is shown on Levels 1 and 2 only", () => {
  const config = game.slice(game.indexOf("const LEVEL_TUTORIAL_CONFIG"), game.indexOf("export class Game"));
  assert.match(config, /LEVEL 01 \/\/ PARK[\s\S]*?\["C", "Camera view"\]/);
  assert.match(config, /LEVEL 02 \/\/ CROSS[\s\S]*?\["C", "Camera view"\]/);
  const level3 = config.slice(config.indexOf("LEVEL 03 \/\/ CHEAT"));
  assert.doesNotMatch(level3, /\["C",/);
});


test("tutorial controls animate the preview without advancing gameplay", () => {
  assert.match(game, /onTutorialDemoKeyDown\(event\)[\s\S]*?tutorialDemoKeys[\s\S]*?applyTutorialDemoMotion\(\)/);
  assert.match(game, /onTutorialDemoPointerMove\(event\)[\s\S]*?currentLevelNumber !== 3/);
  assert.match(game, /if \(this\.isLevelIntroActive \|\| this\.isTutorialActive\) return/);
  assert.match(css, /\.tutorial-controls li\.is-active[\s\S]*?\.tutorial-preview\.is-typing-demo/);
  assert.match(html, /Try the controls here/);
});


test("level 2 and level 3 tutorials expose visible interaction feedback", () => {
  assert.match(html, /id="instruction-demo"[\s\S]*?id="instruction-demo-marker"[\s\S]*?id="instruction-demo-status"/);
  assert.match(game, /moveTutorialDemo\(code\)[\s\S]*?tutorialDemoPosition/);
  assert.match(game, /currentLevelNumber === 2[\s\S]*?WALK:/);
  assert.match(game, /onTutorialDemoPointerDown\(event\)[\s\S]*?PEEKING/);
  assert.match(game, /TYPING:/);
  assert.match(css, /\.tutorial-demo-layer\[data-level="2"\][\s\S]*?\.tutorial-demo-layer\.is-level3/);
});
