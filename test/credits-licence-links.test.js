import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CREDITS } from "../src/shared/creditsRegistry.js";

const gameSource = readFileSync(new URL("../src/core/Game.js", import.meta.url), "utf8");
const creditsCss = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

test("Level 2 crossing signal credits link to the original and CC BY-NC licence", () => {
  const sounds = CREDITS.find((group) => group.heading === "Sound effects");
  assert.ok(sounds, "Sound effects credits group exists");
  const crossing = sounds.entries.find((entry) => entry.name.includes("pedestrian crossing signal"));
  assert.ok(crossing, "Level 2 crossing signal credit exists");
  assert.equal(crossing.url, "https://freesound.org/people/MacFerret_20/sounds/231936/");
  assert.equal(crossing.licenceUrl, "https://creativecommons.org/licenses/by-nc/4.0/");
  assert.equal(crossing.licenceLabel, "CC BY-NC 4.0 licence terms");
  assert.match(crossing.detail, /DH14_TraffLights2\.aif/);
  assert.match(crossing.detail, /MacFerret_20/);
  assert.match(crossing.detail, /crossing-signal\.opus/);
  assert.match(crossing.detail, /noncommercial/i);
});

test("in-game Credits render optional licence links securely and visibly", () => {
  assert.match(gameSource, /entries\.map\(\(\{ name, detail, url, licenceUrl, licenceLabel \}\)/);
  assert.match(gameSource, /licenceUrl \? `<p class="credit-licence"><a href="\$\{licenceUrl\}"/);
  assert.match(gameSource, /target="_blank" rel="noopener noreferrer"/);
  assert.match(gameSource, /\$\{licenceLabel \|\| "View licence terms"\}/);
  assert.match(creditsCss, /\.credit-entry \.credit-licence a \{/);
  assert.match(creditsCss, /\.credit-entry \.credit-licence a:focus-visible \{/);
});
