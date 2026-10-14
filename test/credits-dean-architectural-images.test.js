import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { CREDITS } from "../src/shared/creditsRegistry.js";

const ledger = readFileSync(new URL("../docs/ASSETS_AND_CREDITS.md", import.meta.url), "utf8");

const expectedFiles = [
  "east-precast-wall-texture.jpg",
  "amic-fence.png",
  "amic-fence-reference.png",
  "2695c241-17bb-416d-9d1d-7f061ccf7976.png"
];

test("all four Dean-edited image textures are individually credited in-game", () => {
  const section = CREDITS.find(({ heading }) =>
    heading.includes("Dean Feldman") && heading.includes("architecture images")
  );
  assert.ok(section, "dedicated edited-image credits section exists");
  assert.equal(section.entries.length, expectedFiles.length);

  for (const filename of expectedFiles) {
    const entry = section.entries.find(({ name }) => name.includes(filename));
    assert.ok(entry, `missing in-game credit for ${filename}`);
    assert.match(entry.detail, /Dean Feldman/);
    assert.match(entry.detail, /cropped\/edited/i);
    assert.match(entry.detail, /unverified|not been established/i);
    assert.ok(entry.url?.startsWith("https://"), `missing source URL: ${filename}`);
    assert.ok(ledger.includes(filename), `missing written-ledger credit: ${filename}`);
  }
});

test("the edited AMIC deck is not misrepresented as independently created", () => {
  const section = CREDITS.find(({ heading }) => heading.includes("architecture images"));
  const deck = section.entries.find(({ name }) => name.includes("2695c241-17bb-416d-9d1d-7f061ccf7976.png"));
  assert.match(deck.detail, /not made from scratch/i);
  assert.match(ledger, /confirmed crop\/edit of an AMIC reference\/ground/i);
});

test("attribution record does not claim unverified third-party permission", () => {
  assert.match(ledger, /All \*\*four provenance\/attribution entries are\s+recorded\*\*/);
  assert.match(ledger, /\*\*not licence-cleared\*\*/);
});
