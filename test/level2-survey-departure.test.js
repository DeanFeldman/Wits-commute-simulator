import test from "node:test";
import assert from "node:assert/strict";
import { CampusCrowd } from "../src/levels/crossing/CampusCrowd.js";

function harness(target = { x: 0, z: -4 }) {
  const calls = [];
  const crowd = Object.create(CampusCrowd.prototype);
  crowd.animatedFactory = {
    setMoving(_animation, moving, speed, running) {
      calls.push({ moving, speed, running });
    }
  };
  crowd.lastPlayer = { x: 0, z: 1 };
  crowd.planRoute = () => [target];
  const person = {
    kind: "psychQuizzer",
    mesh: { position: { x: 0, z: 0 }, rotation: { y: 0 } },
    moving: false,
    chasing: false,
    leaving: false,
    returning: false,
    route: [],
    stride: 0,
    restYaw: 0,
    reactTimer: 0,
    recoil: 0,
    animation: { mixer: { update() {} } }
  };
  return { crowd, person, calls };
}

test("survey NPC turns around before starting to walk away (#275)", () => {
  const { crowd, person, calls } = harness();
  crowd.sendOff(person);

  const completed = crowd.followRoute(person, 1 / 60, { x: 0, z: 1 });
  assert.equal(completed, false);
  assert.equal(person.moving, false, "turning in place must not translate the NPC");
  assert.deepEqual(person.mesh.position, { x: 0, z: 0 });
  assert.ok(person.mesh.rotation.y > 0, "NPC starts turning towards its departure waypoint");
  crowd.animate(person, 1 / 60);
  assert.equal(calls.at(-1).moving, false, "don't walk in place while turning");

  let firstMovementFacingError = null;
  for (let tick = 0; tick < 120; tick++) {
    const previousZ = person.mesh.position.z;
    crowd.followRoute(person, 1 / 60, { x: 0, z: 1 });
    if (person.mesh.position.z !== previousZ) {
      firstMovementFacingError = Math.abs(
        Math.atan2(
          Math.sin(Math.PI - person.mesh.rotation.y),
          Math.cos(Math.PI - person.mesh.rotation.y)
        )
      );
      break;
    }
  }
  assert.notEqual(firstMovementFacingError, null, "NPC eventually walks away");
  assert.ok(firstMovementFacingError <= 0.31, "NPC faces its destination before walking");
  assert.equal(person.moving, true);
  crowd.animate(person, 1 / 60);
  assert.equal(calls.at(-1).moving, true, "walking clip plays when the NPC actually moves");
  assert.equal(calls.at(-1).running, false, "departure uses walking, not chasing animation");
});

test("survey departure resets stale bump reactions that suppress footsteps", () => {
  const { crowd, person } = harness();
  person.reactTimer = 1.8;
  person.recoil = 1;
  person.facePlayer = { x: 0, z: 1 };
  person.chasing = true;
  crowd.sendOff(person);

  assert.equal(person.reactTimer, 0);
  assert.equal(person.recoil, 0);
  assert.equal(person.facePlayer, null);
  assert.equal(person.chasing, false);
  assert.equal(person.leaving, true);
  assert.equal(person.route.length, 1);
});

test("blocked departure waypoint stops footstep animation without losing its route", () => {
  const { crowd, person, calls } = harness({ x: 0, z: 3 });
  crowd.sendOff(person);
  const completed = crowd.followRoute(person, 1 / 60, { x: 0, z: 3 });
  assert.equal(completed, false);
  assert.equal(person.moving, false);
  assert.equal(person.route.length, 1);
  crowd.animate(person, 1 / 60);
  assert.equal(calls.at(-1).moving, false);
});

test("already facing the next waypoint walks at normal departure speed", () => {
  const { crowd, person, calls } = harness({ x: 0, z: 3 });
  crowd.sendOff(person);
  crowd.followRoute(person, 0.25, { x: 5, z: 5 });
  assert.equal(person.mesh.position.x, 0);
  assert.ok(Math.abs(person.mesh.position.z - 0.4) < 1e-6);
  assert.equal(person.moving, true);
  crowd.animate(person, 0.25);
  assert.deepEqual(calls.at(-1), { moving: true, speed: 1.6, running: false });
});
