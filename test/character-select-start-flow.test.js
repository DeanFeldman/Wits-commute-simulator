import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gameSource = readFileSync(new URL("../src/core/Game.js", import.meta.url), "utf8");
const styleSource = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");
const flowSource = readFileSync(
  new URL("../src/core/CharacterSelectFlow.js", import.meta.url),
  "utf8"
);
const crossingSource = readFileSync(
  new URL("../src/levels/crossing/CrossingLevel.js", import.meta.url),
  "utf8"
);

test("Start opens character selection before the Level 1 loading flow", () => {
  assert.match(
    gameSource,
    /if\s*\(\s*action\s*===\s*"start"\s*\)[\s\S]*?showCharacterSelect\(\)/
  );
  assert.match(
    gameSource,
    /showCharacterSelect\(\)\s*\{[\s\S]*?characterSelectFlow\.show/
  );
  assert.match(flowSource, /Continue with default/);
  assert.match(flowSource, /STUDENT_MODEL_VARIANTS/);
});

test("chosen character is stored at game scope and reused by Level 2", () => {
  assert.match(
    gameSource,
    /this\.selectedPlayerVariant\s*=\s*variantIndex/
  );
  assert.match(
    crossingSource,
    /this\.game\.selectedPlayerVariant/
  );
  assert.match(
    crossingSource,
    /this\.pendingPlayerVariant\s*=\s*this\.selectedPlayerVariant/
  );
});

test("normal Start flow reaches Level 1 only after character confirmation", () => {
  assert.match(
    gameSource,
    /onContinue:[\s\S]*?this\.startJourney\(\)/
  );
  assert.match(
    gameSource,
    /startJourney\(\)\s*\{[\s\S]*?showLevelIntro\(1\)[\s\S]*?startLevel\(1/
  );
});

test("start-flow character selector includes a live 3D preview", () => {
  assert.match(flowSource, /new THREE\.WebGLRenderer/);
  assert.match(flowSource, /data-character-start-preview/);
  assert.match(flowSource, /AnimatedNpcFactory/);
  assert.match(flowSource, /factory\.create\(\{ variant \}\)/);
  assert.match(flowSource, /showCharacterPreview\(this\.pendingVariant\)/);
});


test("start selector reuses the Level 2 textured character factory", () => {
  assert.match(flowSource, /AnimatedNpcFactory/);
  assert.match(flowSource, /factory\.create\(\{ variant \}\)/);
});

test("character selector uses a readable UI font for ambiguous glyphs", () => {
  assert.match(
    styleSource,
    /Keep character-select lettering distinct[\s\S]*?\.character-start__button\s*\{[\s\S]*?font-family:\s*Inter/
  );
});
