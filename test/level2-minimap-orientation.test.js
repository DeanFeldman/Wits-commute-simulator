import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../src/levels/crossing/CrossingLevel.js", import.meta.url), "utf8");

test("level 2 minimap faces 180 degrees from the previous orientation", () => {
  const matches = source.match(/minimapCamera\.up\.set\(0, 0, -1\)/g) ?? [];
  assert.equal(matches.length, 2);
});
