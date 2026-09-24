import test from "node:test";
import assert from "node:assert/strict";
import {
  createEastDiorama,
  EAST_DIORAMA_CONFIG,
  getEastDioramaCanopyPlacements,
  getEastDioramaMarkerPlacements,
  getEastHighwaySouthLipZAt
} from "../src/levels/parking/EastDiorama.js";
import { getEastDioramaFoliageLayout } from "../src/levels/parking/ParkingFoliage.js";

test("east reference camera looks east from normal Level 1 chase height", () => {
  const { position, target } = EAST_DIORAMA_CONFIG.referenceCamera;
  assert.ok(target[0] > position[0], "saved view looks toward +X/east");
  assert.ok(position[1] >= 4.5 && position[1] <= 5.5, "camera uses the chase-view height");
});

test("east scenery has no redundant parking lot or replacement grass plane", () => {
  const { root, stats } = createEastDiorama({ loadAssets: false });
  const names = [];
  root.traverse((object) => names.push(object.name));

  assert.equal(stats.parkedCars, 0);
  assert.ok(!names.includes("east-diorama-overflow-parking"));
  assert.ok(!names.includes("east-diorama-parked-cars"));
  assert.ok(!names.includes("east-diorama-open-green"));
});

test("east cemetery keeps an open field before the dense tree bands", () => {
  const belt = EAST_DIORAMA_CONFIG.cemetery;
  const layout = getEastDioramaFoliageLayout();
  const fieldBackX = belt.center[0] + belt.width / 2;

  assert.ok(layout.scatteredTrees.length > 0, "field contains a few isolated trees");
  assert.ok(layout.denseTrees.length > layout.scatteredTrees.length * 10, "background reads as a tree mass");
  assert.ok(
    layout.denseTrees.every((tree) => tree.x >= fieldBackX - 5),
    "dense vegetation begins behind the open field"
  );
  assert.ok(layout.bushes.length > 0, "road and field transitions include LOD2 bushes");
});

test("east grass and low foliage stay clear of the angled M1 retaining wall", () => {
  const highway = EAST_DIORAMA_CONFIG.highway;
  const layout = getEastDioramaFoliageLayout(1);

  for (const item of [...layout.bushes, ...layout.grass]) {
    assert.ok(
      item.z >= getEastHighwaySouthLipZAt(item.x) + highway.fieldClearance,
      "grass and bushes do not protrude through the retaining wall"
    );
  }
});

test("east tree trunks and canopy silhouettes stay clear of the highway", () => {
  const highway = EAST_DIORAMA_CONFIG.highway;
  const layout = getEastDioramaFoliageLayout(1);
  const trees = [...layout.giantTrees, ...layout.scatteredTrees, ...layout.denseTrees];

  for (const tree of trees) {
    assert.ok(
      tree.z >= getEastHighwaySouthLipZAt(tree.x) + tree.scale * 0.55,
      "tree crown starts south of the M1 retaining wall"
    );
  }

  for (const canopy of getEastDioramaCanopyPlacements()) {
    assert.ok(
      canopy.z - canopy.radius >= getEastHighwaySouthLipZAt(canopy.x) + highway.fieldClearance,
      "placeholder canopy does not overhang the highway"
    );
  }
});

test("cemetery markers replace the former overflow lot and avoid the highway", () => {
  const markers = getEastDioramaMarkerPlacements();

  assert.ok(markers.length > 80, "extended cemetery has a substantial marker field");
  assert.ok(markers.some((marker) => marker.position[2] > 75), "markers extend into the former lot footprint");
  assert.ok(markers.every((marker) => (
    marker.position[2] >= getEastHighwaySouthLipZAt(marker.position[0])
      + EAST_DIORAMA_CONFIG.highway.fieldClearance
  )), "markers stay south of the M1 retaining wall");
});
