import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CampusCrowd } from "../src/levels/crossing/CampusCrowd.js";
import { AnimatedNpcFactory } from "../src/levels/crossing/AnimatedNpcFactory.js";
import { CrossingLevel } from "../src/levels/crossing/CrossingLevel.js";

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

function makeMixerActions() {
  const root = new THREE.Group();
  const mixer = new THREE.AnimationMixer(root);
  const action = (name) => mixer.clipAction(new THREE.AnimationClip(name, 1, []));
  const idle = action("idle");
  const walk = action("walk");
  const run = action("run");
  idle.play();
  mixer.update(0);
  return { root, mixer, idle, walk, run, active: idle };
}

test("repeated completed-survey replies restart a full-weight walk before translation", () => {
  for (const kind of ["psychQuizzer", "ccduAdvisor"]) {
    const { crowd, person } = harness();
    const factory = new AnimatedNpcFactory();
    crowd.animatedFactory = factory;
    const animation = makeMixerActions();
    person.mesh = animation.root;
    person.animation = animation;
    person.kind = kind;

    const level = {
      quizPaused: false,
      surveyConversation: null,
      crowd: {
        random: () => 0,
        say() {},
        sendOff: (surveyNpc) => crowd.sendOff(surveyNpc)
      },
      player: { position: new THREE.Vector3(0, 0, 1) }
    };

    // First completed conversation, then the player bumps the same surveyor
    // again. Chasing had put the NPC into its run action on both encounters.
    for (let encounter = 1; encounter <= 2; encounter++) {
      person.mesh.position.set(0, 0, 0);
      person.mesh.rotation.y = 0;
      person.chasing = true;
      person.leaving = false;
      person.returning = false;
      person.moving = false;
      factory.setMoving(animation, true, 3.3, true);
      animation.mixer.update(1 / 60);

      CrossingLevel.prototype.startCompletedSurveyConversation.call(level, person);
      assert.equal(level.quizPaused, true);
      CrossingLevel.prototype.updateSurveyConversation.call(level, 0.91);
      assert.equal(level.quizPaused, false);
      assert.equal(person.leaving, true);
      assert.equal(person.moving, false);

      let startedWalking = false;
      for (let frame = 0; frame < 180; frame++) {
        crowd.followRoute(person, 1 / 60, level.player.position);
        crowd.animate(person, 1 / 60);
        if (!person.moving) continue;

        assert.equal(animation.active, animation.walk,
          `${kind} encounter ${encounter}: the actual walk action must be active`);
        assert.ok(Math.abs(animation.walk.getEffectiveWeight() - 1) < 1e-6,
          `${kind} encounter ${encounter}: walk must reach full weight before the NPC translates`);
        assert.ok(animation.walk.time > 0,
          `${kind} encounter ${encounter}: the foot animation must advance`);
        startedWalking = true;
        break;
      }
      assert.equal(startedWalking, true,
        `${kind} encounter ${encounter}: should walk after turning`);
    }
  }
});

test("ordinary NPC walks still blend from idle instead of snapping", () => {
  const factory = new AnimatedNpcFactory();
  const animation = makeMixerActions();
  factory.setMoving(animation, true, 1.1, false);
  assert.equal(animation.active, animation.walk);
  assert.ok(animation.idle.isRunning(), "ordinary walk transitions still crossfade");
  animation.mixer.update(0.2);
  assert.ok(animation.walk.getEffectiveWeight() > 0.9);
});
