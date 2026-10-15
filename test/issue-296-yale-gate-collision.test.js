import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CrossingStrip } from "../src/levels/crossing/CrossingStrip.js";
import { LEVEL_2_STRIPS } from "../src/levels/crossing/Level2StripLibrary.js";
import { STRIP_DEPTH, createSeededRandom } from "../src/levels/crossing/Level2StripGenerator.js";

// Issue #296: the open black gate leaves at the Engineering entrance had no
// collider, so the player walked through them and Vida cups spawned inside.
test("Yale entrance gate leaves block their walk cells but keep the opening clear", () => {
  const preset = LEVEL_2_STRIPS.finish;
  const stripZ = -30;
  const strip = new CrossingStrip({
    definition: { ...preset, index: 9, rowStart: 0, width: 22, depth: preset.rowSpan * STRIP_DEPTH },
    z: stripZ,
    parent: new THREE.Group(),
    random: createSeededRandom(1),
    audio: null
  });

  const leaves = [];
  strip.root.traverse((child) => { if (child.name === "yale-entrance-gate-leaf") leaves.push(child); });
  assert.equal(leaves.length, 2);

  const blocked = (x, z) => strip.boundaryVolumes.some((v) =>
    x >= v.minX && x <= v.maxX && z >= v.minZ && z <= v.maxZ);
  const step = STRIP_DEPTH / 2;

  for (const leaf of leaves) {
    const column = Math.round(leaf.position.x / step) * step;
    // Every walk cell along the leaf's length must be blocked.
    for (const z of [-1.2, -2.4]) {
      assert.ok(blocked(column, stripZ + z), `leaf cell (${column}, ${z}) should be blocked`);
    }
  }
  // The gate opening between the leaves stays walkable.
  for (const x of [-step, 0, step]) {
    for (const z of [0, -1.2, -2.4, -3.6]) assert.ok(!blocked(x, stripZ + z), `opening (${x}, ${z}) must stay open`);
  }
});
