import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CREDITS } from "../src/shared/creditsRegistry.js";

const ledger = readFileSync(new URL("../docs/ASSETS_AND_CREDITS.md", import.meta.url), "utf8");

test("Gabriel's AI-assisted models and images have grouped in-game credits and file inventory", () => {
  const section = CREDITS.find(({ heading }) => heading === "AI-generated and project-created assets");
  assert.ok(section);
  const models = section.entries.find(({ name }) => name.includes("Gabriel Raz — AI-assisted 3D"));
  const images = section.entries.find(({ name }) => name.includes("Gabriel Raz — AI-generated UI"));
  assert.ok(models);
  assert.match(models.detail, /Modly by Lightning Pixel/);
  assert.match(models.detail, /ChatGPT/);
  assert.equal(models.url, "https://github.com/lightningpixel/modly");
  assert.ok(images);
  assert.match(images.detail, /ChatGPT/);

  const expectedFiles = [
    "begin-journey-selected.png", "begin-journey-unselected.png",
    "credits-selected.png", "credits-unselected.png",
    "settings-selected.png", "settings-unselected.png",
    "level3-stopwatch-base.png", "level3-stopwatch-hand.png",
    "at-wits-end-logo-v2.png", "main-menu-v3-background.png",
    "level2-story-loading-screen.png", "suspicion-meter.png"
  ];
  for (const filename of expectedFiles) {
    assert.ok(ledger.includes(`public/assets/images/ui/${filename}`), `Missing UI attribution: ${filename}`);
  }
  for (const name of ["stylized-grass-", "classroom-desk.glb", "classroom-plastic-chair.glb"]) {
    assert.ok(ledger.includes(name), `Missing model/texture attribution: ${name}`);
  }
});

test("Level 1 car-door close has its documented source in-game", () => {
  const sound = CREDITS.find(({ heading }) => heading === "Sound effects");
  const door = sound?.entries.find(({ name }) => name === "Level 1 car door closing");
  assert.ok(door);
  assert.match(door.detail, /BlondPanda/);
  assert.match(door.detail, /CC0/);
  assert.equal(door.url, "https://freesound.org/people/BlondPanda/sounds/778421/");
});

test("credits do not misrepresent unresolved image permissions as cleared", () => {
  const section = CREDITS.find(({ heading }) => heading === "Outstanding rights and final-release checks");
  assert.ok(section);
  assert.ok(section.entries.some(({ name }) => name.includes("architecture")));
  assert.ok(section.entries.some(({ name }) => name.includes("Sharks")));
  assert.ok(section.entries.some(({ name }) => name.includes("NonCommercial")));
});
