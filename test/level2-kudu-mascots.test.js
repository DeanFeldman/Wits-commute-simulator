import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CampusCrowd } from "../src/levels/crossing/CampusCrowd.js";

test("kudu NPCs greet, react and idle without a human rig or becoming selectable students", () => {
  const root = new THREE.Group();
  const mesh = new THREE.Group();
  const visual = new THREE.Group();
  mesh.add(visual);
  mesh.userData.kuduVisual = visual;
  mesh.userData.soleOffset = 0;
  const lines = [];
  const crowd = new CampusCrowd({
    root, random: () => 0.5, playerVariant: 0, variantCount: 6,
    factory: { create() { assert.fail("Mascots must use the supplied model"); } },
    animatedFactory: { create() { assert.fail("Mascots must not use student variants"); } },
    onSay: (person, line) => lines.push(line)
  });
  const npc = crowd.add({ kind: "kudu", name: "Kudu Sis", mesh, x: -3.8, z: 0 });
  const position = mesh.position.clone();
  const player = new THREE.Vector3(-2.4, 0, 0);
  crowd.update(0.1, player);
  assert.equal(npc.greeted, true);
  assert.match(lines[0], /cross safely/);
  assert.equal(npc.variant, null);
  crowd.setPlayerVariant(1);
  assert.equal(npc.mesh, mesh);
  assert.equal(npc.variant, null);
  crowd.bump(npc, player);
  crowd.update(0.1, player);
  assert.match(lines[1], /kudu|exam/);
  assert.ok(visual.rotation.x < 0, "bumping triggers the mascot recoil");
  assert.ok(Number.isFinite(visual.rotation.z));
  assert.deepEqual(mesh.position, position, "stationary mascots stay out of traffic");
  crowd.dispose();
});
