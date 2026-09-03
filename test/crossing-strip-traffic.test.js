import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CrossingStrip } from "../src/levels/crossing/CrossingStrip.js";
import {
  CUSTOM_HAZARD_STRIPS,
  createSeededRandom,
  generateLevel2Layout
} from "../src/levels/crossing/Level2StripGenerator.js";

test("traffic strips orient, space, and recycle their fixed vehicle pools", () => {
  const layout = generateLevel2Layout("traffic-runtime");
  const parent = new THREE.Group();
  const strips = layout.strips
    .filter((definition) => definition.traffic)
    .map((definition) => new CrossingStrip({
      definition,
      z: -definition.index * layout.depth,
      parent,
      random: createSeededRandom(layout.seed ^ definition.index),
      audio: null
    }));

  for (const strip of strips) {
    assert.equal(strip.traffic.length, strip.lanes.reduce((total, lane) => total + lane.vehicleCount, 0));
    for (const vehicle of strip.traffic) {
      assert.ok(vehicle.lane.allowedVehicleTypes.includes(vehicle.type));
      assert.equal(vehicle.root.rotation.y, vehicle.lane.direction > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
  }

  for (let frame = 0; frame < 1800; frame++) {
    for (const strip of strips) {
      strip.update(1 / 60);
      for (let first = 0; first < strip.traffic.length; first++) {
        for (let second = first + 1; second < strip.traffic.length; second++) {
          const a = strip.traffic[first];
          const b = strip.traffic[second];
          if (a.lane !== b.lane) continue;
          const minimumDistance = (a.length + b.length) / 2 + 0.79;
          assert.ok(Math.abs(a.root.position.x - b.root.position.x) >= minimumDistance);
        }
      }
    }
  }
});

test("busyRoad owns two independent lanes moving in opposite directions", () => {
  const preset = CUSTOM_HAZARD_STRIPS.find((strip) => strip.id === "busyRoad");
  const definition = {
    ...preset,
    index: 0,
    rowStart: 0,
    width: 22,
    depth: 3.2
  };
  const strip = new CrossingStrip({
    definition,
    z: 0,
    parent: new THREE.Group(),
    random: createSeededRandom(42),
    audio: null
  });

  assert.equal(strip.lanes.length, 2);
  assert.deepEqual(strip.lanes.map((lane) => lane.direction), [1, -1]);
  assert.deepEqual(strip.lanes.map((lane) => lane.localZ), [0.8, -0.8]);
  assert.equal(strip.traffic.length, 6);
  for (const lane of strip.lanes) {
    const vehicles = strip.traffic.filter((vehicle) => vehicle.lane === lane);
    assert.equal(vehicles.length, lane.vehicleCount);
    assert.ok(vehicles.every((vehicle) => vehicle.root.position.z === lane.localZ));
  }
});

test("a multi-row strip can load and position declared GLB scenery", async () => {
  const parent = new THREE.Group();
  const definition = {
    id: "custom-campus-strip",
    type: "safe",
    surface: "pavement",
    index: 0,
    rowStart: 0,
    rowSpan: 2,
    width: 22,
    depth: 3.2,
    models: [{
      name: "campus-prop",
      path: "./assets/models/campus-prop.glb",
      position: [4, 0.5, -0.8],
      rotation: [0, Math.PI / 2, 0],
      scale: 1.5
    }]
  };
  const strip = new CrossingStrip({
    definition,
    z: 3,
    parent,
    random: () => 0.5,
    audio: null
  });
  const template = new THREE.Group();
  template.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  const loader = { loadAsync: async () => ({ scene: template }) };

  await strip.loadModels(loader, new Map());

  const model = strip.root.getObjectByName("campus-prop");
  assert.deepEqual(model.position.toArray(), [4, 0.5, -0.8]);
  assert.equal(model.rotation.y, Math.PI / 2);
  assert.deepEqual(model.scale.toArray(), [1.5, 1.5, 1.5]);
  assert.equal(strip.containsZ(4.59), true);
  assert.equal(strip.containsZ(4.7), false);
});
