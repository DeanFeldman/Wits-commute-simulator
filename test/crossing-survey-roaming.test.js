import test from "node:test";
import assert from "node:assert/strict";
import { CampusCrowd } from "../src/levels/crossing/CampusCrowd.js";

const makeCrowd = (canOccupy = () => true) => {
  const crowd = Object.create(CampusCrowd.prototype);
  crowd.grid = { step: 1, originZ: 0, minX: -6, maxX: 6, minZ: -6, maxZ: 6 };
  crowd.canOccupy = canOccupy;
  crowd.random = () => 0.5;
  crowd.animate = () => {};
  crowd.turnTo = () => {};
  crowd.people = [{
    kind: "psychQuizzer", surveyAsked: true, surveyCooldown: 0, caught: false, chasing: false,
    chaseArmed: false, leaving: false, returning: false, route: [], roamWait: 0,
    reactTimer: 0, recoil: 0, talkCooldown: 0, moving: false, stride: 0,
    mesh: { position: { x: 0, z: 0 } }
  }];
  crowd.time = 0;
  crowd.greetCooldown = 0;
  return crowd;
};

test("completed survey NPC walks around rather than freezing or chasing", () => {
  const crowd = makeCrowd(), npc = crowd.people[0], player = { x: 5, z: 5 };
  let routePlans = 0;
  const plan = crowd.planRoute.bind(crowd);
  crowd.planRoute = (...args) => { routePlans++; return plan(...args); };
  for (let i = 0; i < 8; i++) crowd.update(0.05, player);
  assert.ok(Math.hypot(npc.mesh.position.x, npc.mesh.position.z) > 0);
  assert.ok(npc.stride > 0 && npc.moving);
  assert.equal(npc.chasing, false);
  assert.equal(npc.caught, false);
  assert.equal(npc.chaseArmed, false);
  assert.equal(routePlans, 1, "pathfinding should not repeat every frame");
});

test("completed NPCs back off route planning when no walkable route exists", () => {
  const crowd = makeCrowd((x, z) => x === 0 && z === 0), player = { x: 5, z: 5 };
  let plans = 0;
  crowd.planRoute = () => { plans++; return []; };
  for (let i = 0; i < 10; i++) crowd.update(0.05, player);
  assert.equal(plans, 1);
  assert.ok(crowd.people[0].roamWait > 0);
  assert.equal(crowd.people[0].caught, false);
});
