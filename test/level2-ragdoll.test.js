import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { PlayerRagdoll } from "../src/levels/crossing/PlayerRagdoll.js";
import { CrossingLevel } from "../src/levels/crossing/CrossingLevel.js";
import { GridHopController } from "../src/levels/crossing/GridHopController.js";

function setup(direction = 1) {
  const player = new THREE.Group();
  player.position.set(0, 0.95, 0);
  const bone = new THREE.Bone();
  bone.name = "mixamorigLeftArm";
  bone.rotation.x = 0.3;
  player.add(bone);
  const mixer = { timeScale: 1 };
  const vehicle = { lane: { direction }, root: new THREE.Group(), controller: { speed: 7 } };
  return { player, bone, mixer, vehicle };
}

test("a hit launches in either lane direction, tumbles, lands and restores the rig", () => {
  for (const direction of [-1, 1]) {
    const { player, bone, mixer, vehicle } = setup(direction);
    const pose = bone.quaternion.clone();
    const body = player.quaternion.clone();
    const ragdoll = new PlayerRagdoll(player, mixer);
    ragdoll.launch(vehicle);
    for (let frame = 0; frame < 25; frame++) ragdoll.update(1 / 60);
    assert.ok(player.position.y > 2.5, "the player visibly flies above the road");
    assert.ok(player.position.x * direction > 2, "the car pushes along its lane");
    assert.ok(body.angleTo(player.quaternion) > 0.5, "the body spins");
    assert.ok(pose.angleTo(bone.quaternion) > 0.1, "limbs flail");
    assert.equal(mixer.timeScale, 0, "walking does not overwrite the pose");
    for (let frame = 0; frame < 100; frame++) ragdoll.update(1 / 60);
    assert.ok(Math.abs(player.position.y - ragdoll.floorY) < 0.001, "the body settles on the road");
    assert.ok(Math.abs(ragdoll.velocity.x) < 0.1, "the slide stops");
    ragdoll.restore();
    assert.ok(pose.angleTo(bone.quaternion) < 1e-6);
    assert.ok(body.angleTo(player.quaternion) < 1e-6);
    assert.equal(mixer.timeScale, 1);
  }
});

test("checkpoint recovery cancels an in-flight step and restores upright control after the tumble", () => {
  const { player, mixer, vehicle } = setup();
  const level = Object.create(CrossingLevel.prototype);
  const controller = new GridHopController(player);
  controller.enqueue({ x: 0, z: -1 });
  controller.update(0.05);
  Object.assign(level, {
    player, playerMixer: mixer, hopController: controller,
    checkpoint: { x: 1.2, z: 4.8 }, attempts: 0,
    aura: {}, shieldBubble: {},
    game: { flashHUD() {}, input: { clearTransientState() {} } },
    audio: { playSample() {} }
  });
  level.failAtCheckpoint(false, vehicle);
  assert.equal(controller.isHopping, false);
  for (let frame = 0; frame < 120; frame++) level.updateImpact(1 / 60);
  assert.equal(level.playerRagdoll, null);
  assert.equal(level.pendingRespawn, null);
  assert.deepEqual(controller.gridPosition.toArray(), [1.2, 4.8]);
  assert.equal(player.rotation.x, 0);
  assert.equal(player.rotation.z, 0);
  assert.equal(mixer.timeScale, 1);
  assert.equal(level.attempts, 1);
});
