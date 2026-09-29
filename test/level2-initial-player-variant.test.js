import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/levels/crossing/CrossingLevel.js", import.meta.url), "utf8");
const body = (name) => {
  const start = source.indexOf(`${name}(`, source.indexOf("resolveSelectedPlayerVariant() {"));
  assert.ok(start >= 0, `${name} exists`);
  return source.slice(start, start + 2600);
};

test("Level 2 load resolves the initial variant from game.selectedPlayerVariant", () => {
  assert.match(source, /resolveSelectedPlayerVariant\(\)\s*\{[\s\S]*?this\.game\.selectedPlayerVariant/);
  assert.match(source, /this\.selectedPlayerVariant\s*=\s*this\.resolveSelectedPlayerVariant\(\);\s*this\.pendingPlayerVariant[\s\S]*?await this\.createPlayer\(\)/);
});

test("missing or invalid selection falls back to the default student (direct dev launch)", () => {
  assert.match(source, /Number\.isInteger\(variant\)\s*&&\s*STUDENT_MODEL_VARIANTS\[variant\]\s*\?\s*variant\s*:\s*0/);
});

test("initial player is built from the selected variant via AnimatedNpcFactory, before the legacy player", () => {
  const create = source.slice(source.indexOf("async createPlayer()"), source.indexOf("createSelectedPlayer(variant) {"));
  assert.ok(create.indexOf("createSelectedPlayer(this.selectedPlayerVariant)") >= 0);
  assert.ok(create.indexOf("createSelectedPlayer(") < create.indexOf("createAnimatedPlayer()"));
  assert.match(create, /if \(!created\)[\s\S]*?createAnimatedPlayer\(\)[\s\S]*?createFallbackPlayer\(\)/);
  const selected = body("createSelectedPlayer");
  assert.match(selected, /this\.animatedNpcs\.create\(\{ variant \}\)/);
  assert.match(selected, /this\.playerModelCache\.set\(variant, visual\)/);
});

test("selected player keeps the stable root, animations and backpack", () => {
  const selected = body("createSelectedPlayer");
  assert.match(selected, /this\.player\s*=\s*new THREE\.Group\(\);\s*this\.player\.add\(visual\)/);
  assert.match(selected, /userData\.backpack\s*=\s*visual\.userData\.rig\?\.backpack/);
  assert.match(selected, /idle:\s*animation\.idle,\s*running:\s*animation\.run/);
  assert.match(source, /this\.player\.name\s*=\s*"level2-player"/);
});

test("dev-panel swaps persist to the game so restarts keep the character", () => {
  assert.match(source, /this\.game\.selectedPlayerVariant\s*=\s*variant/);
});