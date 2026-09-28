import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const crossingSource = await readFile(new URL("../src/levels/crossing/CrossingLevel.js", import.meta.url), "utf8");
const factorySource = await readFile(new URL("../src/levels/crossing/AnimatedNpcFactory.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

test("Level 2 dev panel exposes all six player model choices", () => {
  assert.match(html, /id="level2-player-model-toggle"/);
  assert.match(html, /id="level2-character-select"/);
  assert.match(html, /id="level2-character-preview"/);
  assert.match(html, /id="level2-character-confirm"/);
  assert.match(crossingSource, /STUDENT_MODEL_VARIANTS\.map/);
  assert.match(factorySource, /label: `Male\$\{index\}`/);
  assert.match(factorySource, /label: `Female\$\{index\}`/);
});

test("the selected fighter previews the supplied stance before confirmation", () => {
  assert.match(factorySource, /selection-fight-idle\.fbx/);
  assert.match(crossingSource, /animation\.selection\.setLoop\(THREE\.LoopOnce, 1\)/);
  assert.match(crossingSource, /confirmPlayerModel\(\)[\s\S]*?applyPlayerModel\(this\.pendingPlayerVariant\)/);
});

test("changing player model keeps the stable grid-controlled player root", () => {
  assert.match(crossingSource, /const previousVisual = this\.player\.children\[0\]/);
  assert.match(crossingSource, /this\.player\.add\(visual\)/);
  assert.doesNotMatch(crossingSource, /applyPlayerModel[\s\S]*?this\.player\s*=\s*visual/);
});
