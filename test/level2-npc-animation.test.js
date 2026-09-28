import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { AnimatedNpcFactory } from "../src/levels/crossing/AnimatedNpcFactory.js";

test("the chase run keeps its hips at the grounded idle height", () => {
  const factory = new AnimatedNpcFactory();
  const idle = new THREE.AnimationClip("idle", 1, [
    new THREE.VectorKeyframeTrack("mixamorigHips.position", [0, 1], [0, 0.92, 0, 0, 0.92, 0])
  ]);
  const run = new THREE.AnimationClip("run", 1, [
    new THREE.VectorKeyframeTrack("mixamorigHips.position", [0, 0.5, 1], [0, 0.2, 0, 0, 1.8, 0, 0, -0.4, 0])
  ]);

  factory.alignHipHeight(run, idle, true);

  for (const height of [run.tracks[0].values[1], run.tracks[0].values[4], run.tracks[0].values[7]]) {
    assert.ok(Math.abs(height - 0.92) < 1e-6);
  }
});
