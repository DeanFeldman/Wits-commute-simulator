import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { getLevelOneDamageStage } from "../src/levels/ParkingLevel.js";

test("visible damage increases as condition falls",()=>{assert.deepEqual([100,80,60,40,20,0].map(getLevelOneDamageStage),[0,1,2,3,4,4]);});

test("Level 1 references the licensed impact sprite",()=>{
  const source=readFileSync(new URL("../src/levels/ParkingLevel.js",import.meta.url),"utf8");
  assert.match(source,/assets\/audio\/level1\/impact-sprite\.opus/);
  assert.equal(existsSync(new URL("../public/assets/audio/level1/impact-sprite.opus",import.meta.url)),true);
});
