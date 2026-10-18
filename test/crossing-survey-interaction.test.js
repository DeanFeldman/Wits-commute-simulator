import test from "node:test";
import assert from "node:assert/strict";
import { canStartSurvey } from "../src/levels/crossing/surveyInteraction.js";

test("only fresh survey NPCs can trigger an interaction", () => {
  const completed = new Set();
  for (const kind of ["psychQuizzer", "ccduAdvisor"]) {
    const npc = { kind, surveyAsked: false, surveyCooldown: 0 };
    assert.equal(canStartSurvey(npc, completed), true);
    npc.surveyAsked = true; // Set immediately when opening the form.
    assert.equal(canStartSurvey(npc, completed), false);
    npc.surveyAsked = false;
    completed.add(kind);
    assert.equal(canStartSurvey(npc, completed), false);
    completed.delete(kind);
  }
});

test("ordinary pedestrians and survey cooldowns never open forms", () => {
  const completed = new Set();
  assert.equal(canStartSurvey({ kind: "student", surveyAsked: false, surveyCooldown: 0 }, completed), false);
  assert.equal(canStartSurvey({ kind: "ccduAdvisor", surveyAsked: false, surveyCooldown: 3 }, completed), false);
  assert.equal(canStartSurvey(null, completed), false);
});

test("each NPC independently tracks whether its form opened", () => {
  const completed = new Set();
  const psych = { kind: "psychQuizzer", surveyAsked: true, surveyCooldown: 0 };
  const ccdu = { kind: "ccduAdvisor", surveyAsked: false, surveyCooldown: 0 };
  assert.equal(canStartSurvey(psych, completed), false);
  assert.equal(canStartSurvey(ccdu, completed), true);
});
