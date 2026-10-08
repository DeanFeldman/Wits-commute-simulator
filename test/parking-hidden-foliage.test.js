import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { createSouthDiorama } from "../src/levels/parking/SouthDiorama.js";
import { createWestDiorama } from "../src/levels/parking/WestDiorama.js";

const environmentSource = readFileSync(
  new URL("../src/levels/parking/ParkingEnvironment.js", import.meta.url),
  "utf8"
);
const foliageSource = readFileSync(
  new URL("../src/levels/parking/ParkingFoliage.js", import.meta.url),
  "utf8"
);

test("Level 1 does not request permanently hidden south/west foliage assets", () => {
  assert.match(environmentSource, /createSouthDiorama\(\{\s*loadAssets: false,/);
  assert.match(environmentSource, /createWestDiorama\(\{\s*loadAssets: false\s*\}\)/);
  assert.match(environmentSource, /southDiorama\.root\.getObjectByName\("Vegetation"\)/);
  assert.match(environmentSource, /westDiorama\.root\.getObjectByName\("Vegetation"\)/);
  assert.match(
    environmentSource,
    /ready: Promise\.all\(\[\s*northDiorama\.ready,\s*eastDiorama\.ready\s*\]\)/
  );
});

test("visible north/east diorama foliage retains its normal loading path", () => {
  assert.match(environmentSource, /const northDiorama = createNorthDiorama\(\)/);
  assert.match(environmentSource, /const eastDiorama = createEastDiorama\(\)/);
});

test("empty foliage instance batches exit before requesting a GLB", () => {
  assert.match(
    foliageSource,
    /async function addPackInstances\([^)]*\) \{\s*[\s\S]*?if \(placements\.length === 0\) return;\s*const scene = await getPack\(kind\);/
  );
});

test("south/west architecture survives disabled foliage loading", async () => {
  const south = createSouthDiorama({ loadAssets: false });
  const west = createWestDiorama({ loadAssets: false });

  await Promise.all([south.ready, west.ready]);

  assert.ok(south.root.getObjectByName("CentralTanBuilding"));
  assert.ok(south.root.getObjectByName("SouthIndustrialServiceYard"));
  assert.ok(west.root.getObjectByName("west-central-grey-building"));
  assert.ok(west.root.getObjectByName("west-tower-landmark"));

  assert.equal(south.root.getObjectByName("Vegetation").children.length, 0);
  assert.equal(west.root.getObjectByName("Vegetation").children.length, 0);
});
