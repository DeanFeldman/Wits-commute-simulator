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


test("tutorial controls update real level previews without advancing the journey timer", () => {
  assert.match(game, /if \(this\.isTutorialActive\) \{[\s\S]*?updateTutorial/);
  assert.match(game, /syncTutorialPreviewFrame\(\)[\s\S]*?ctx\.drawImage\(source/);
  assert.match(css, /\.tutorial-controls li\.is-active[\s\S]*?\.tutorial-preview\.is-typing-demo/);
  assert.match(html, /Try the controls here/);
});


test("level 2 and level 3 tutorials use real gameplay interaction", () => {
  const crossing = readFileSync(new URL("../src/levels/crossing/CrossingLevel.js", import.meta.url), "utf8");
  const cheating = readFileSync(new URL("../src/levels/CheatingLevel.js", import.meta.url), "utf8");
  assert.match(crossing, /beginTutorial\(\)[\s\S]*?tutorialPose/);
  assert.match(crossing, /updateTutorial\(dt\)[\s\S]*?capturePlayerInput\(\)[\s\S]*?hopController\.update\(dt\)/);
  assert.match(crossing, /endTutorial\(\)[\s\S]*?hopController\.reset\(position\)/);
  assert.match(cheating, /moveTutorialLook\(dx, dy\)[\s\S]*?this\.camera\.rotation/);
  assert.match(cheating, /updateTutorial\(dt\)[\s\S]*?this\.peekActive/);
  assert.match(cheating, /endTutorial\(\)[\s\S]*?currentCopiedWord = null[\s\S]*?typedAnswer = ""/);
  assert.match(game, /MOVE THE ACTUAL PLAYER/);
  assert.match(game, /MOVE MOUSE OVER PREVIEW/);
});


test("level 1 tutorial drives the real car and restores its start pose", () => {
  const parking = readFileSync(new URL("../src/levels/ParkingLevel.js", import.meta.url), "utf8");
  assert.match(parking, /beginTutorial\(\)[\s\S]*?tutorialPose/);
  assert.match(parking, /updateTutorial\(dt\)[\s\S]*?this\.vehicle\.update\(dt/);
  assert.match(parking, /endTutorial\(\)[\s\S]*?this\.car\.position\.copy\(position\)[\s\S]*?this\.vehicle\.stop\(\)/);
  assert.match(game, /if \(this\.isTutorialActive\)[\s\S]*?updateTutorial/);
  assert.match(game, /syncTutorialPreviewFrame\(\)[\s\S]*?ctx\.drawImage\(source/);
});

test("level 1 tutorial explains the purple parking markers", () => {
  assert.match(game, /Drive to any purple marker/);
  assert.match(game, /Purple markers are your parking goals/);
});
