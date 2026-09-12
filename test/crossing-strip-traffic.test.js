import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { CrossingStrip, createAmicDeckMaterial } from "../src/levels/crossing/CrossingStrip.js";
import { GridHopController } from "../src/levels/crossing/GridHopController.js";
import { PARKING_CAR_SPECS } from "../src/shared/VehicleModelLibrary.js";
import {
  CUSTOM_HAZARD_STRIPS,
  CUSTOM_SAFE_STRIPS,
  createSeededRandom,
  generateLevel2Layout
} from "../src/levels/crossing/Level2StripGenerator.js";

test("tree strips place a seeded set of trees on unique allowed blocks", () => {
  const preset = CUSTOM_SAFE_STRIPS.find((strip) => strip.id === "tree-lined-safe-zone");
  const definition = { ...preset, index: 3, rowStart: 4, width: 22, depth: 3.2 };
  const createStrip = () => new CrossingStrip({
    definition,
    z: 0,
    parent: new THREE.Group(),
    random: createSeededRandom(1234),
    audio: null
  });
  const positionsFor = (strip) => strip.root.children
    .filter((child) => child.name.startsWith("strip-tree-"))
    .map((tree) => [tree.userData.gridColumn, tree.userData.rowOffset]);

  const firstPositions = positionsFor(createStrip());
  const secondPositions = positionsFor(createStrip());
  assert.deepEqual(firstPositions, secondPositions);
  assert.ok(firstPositions.length >= 6 && firstPositions.length <= 9);
  assert.equal(new Set(firstPositions.map((position) => position.join(":"))).size, firstPositions.length);
  assert.ok(firstPositions.every(([column, row]) => Math.abs(column) >= 4 && [0, 1].includes(row)));
  const trees = createStrip().root.children.filter((child) => child.name.startsWith("strip-tree-"));
  assert.ok(trees.every((tree) => tree.scale.x === 1 && tree.scale.y === 1 && tree.scale.z === 1));
});

test("a tree-occupied grid cell rejects player movement", () => {
  const object = new THREE.Object3D();
  object.position.set(0, 0.9, 0);
  let blockedCalls = 0;
  const controller = new GridHopController(object, {
    cellSize: 1.6,
    hopDuration: 0.16,
    canEnter: (x, z) => x !== 1.6 || z !== 0,
    onBlocked: () => { blockedCalls += 1; }
  });

  controller.enqueue({ x: 1, z: 0 });
  controller.update(0.2);

  assert.deepEqual(controller.gridPosition.toArray(), [0, 0]);
  assert.deepEqual(object.position.toArray(), [0, 0.9, 0]);
  assert.equal(blockedCalls, 1);
});

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
      assert.ok(PARKING_CAR_SPECS.includes(vehicle.spec));
      assert.equal(vehicle.root.userData.vehicleSpecId, vehicle.spec.id);
      // In DOM-free tests the GLB is deliberately not loaded. The empty wrapper
      // proves Level 2 no longer builds or repositions primitive child meshes.
      assert.equal(vehicle.root.children.length, 0);
    }
  }

  const usedVehicleSpecs = new Set(strips.flatMap((strip) => strip.traffic.map((vehicle) => vehicle.spec.id)));
  assert.ok(usedVehicleSpecs.size >= 4, "seeded traffic should exercise multiple Level 1 vehicle models");

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

test("authored walkways share the AMIC texture and both parking areas exist", () => {
  const layout = generateLevel2Layout(3006);
  const parent = new THREE.Group();
  const walkwayMaterial = createAmicDeckMaterial();
  const strips = layout.strips.map((definition) => new CrossingStrip({
    definition,
    z: -definition.rowStart * layout.depth,
    parent,
    random: createSeededRandom(layout.seed ^ definition.index),
    audio: null,
    walkwayMaterial
  }));

  const walkableMeshes = [];
  parent.traverse((child) => {
    if (child.isMesh && child.name.startsWith("amic-") && !child.name.startsWith("amic-fence-")) {
      walkableMeshes.push(child);
    }
  });
  assert.ok(walkableMeshes.length >= 10);
  assert.ok(walkableMeshes.every((mesh) => mesh.material === walkwayMaterial));
  assert.equal(walkwayMaterial.map.name, "amic-deck-texture");

  const start = strips.find((strip) => strip.definition.type === "start");
  const finish = strips.find((strip) => strip.definition.type === "finish");
  const farSideLanding = strips.find((strip) => strip.definition.type === "bridge-exit");
  assert.ok(start.root.getObjectByName("arm-side-parking"));
  assert.ok(finish.root.getObjectByName("opposite-side-parking"));
  assert.equal(start.root.children.filter((child) => child.name.startsWith("level-two-parked-car-")).length, 7);
  assert.equal(finish.root.children.filter((child) => child.name.startsWith("level-two-parked-car-")).length, 7);

  const armBuilding = start.root.getObjectByName("arm-building");
  assert.equal(armBuilding.position.x, -15.2);
  assert.ok(armBuilding.position.x + armBuilding.geometry.parameters.width / 2 < -12.3);
  const courtyard = start.root.getObjectByName("amic-arm-courtyard");
  assert.ok(courtyard);
  assert.equal(courtyard.material, walkwayMaterial);
  assert.equal(start.root.getObjectByName("vida-courtyard-container"), undefined);
  assert.equal(finish.root.getObjectByName("vida-courtyard-container"), undefined);
  const vidaContainer = farSideLanding.root.getObjectByName("vida-courtyard-container");
  assert.ok(vidaContainer);
  assert.equal(vidaContainer.position.x, -7.2);
  assert.equal(vidaContainer.rotation.y, Math.PI / 2);
  assert.equal(farSideLanding.root.getObjectByName("vida-container-shell").material.color.getHex(), 0xb8322d);
  assert.ok(farSideLanding.root.getObjectByName("vida-container-label"));
  const vidaCourtyard = farSideLanding.root.getObjectByName("amic-vida-courtyard");
  assert.ok(vidaCourtyard);
  assert.equal(vidaCourtyard.material, walkwayMaterial);
  const adjacentLot = start.root.getObjectByName("arm-side-parking");
  assert.equal(adjacentLot.geometry.parameters.width, 16);
  assert.equal(start.root.children.filter((child) => child.name === "level-one-style-parking-kerb").length, 2);
  const baySideLines = start.root.getObjectByName("parking-bay-side-lines");
  assert.equal(baySideLines.geometry.parameters.width, 0.08);
  assert.equal(baySideLines.geometry.parameters.depth, 5);

  const bridge = strips.find((strip) => strip.definition.section === "m1-bridge");
  const bridgeFences = bridge.root.children.filter((child) => child.name.startsWith("amic-fence-"));
  assert.equal(bridgeFences.length, 2);
  assert.equal(bridge.boundaryVolumes.length, 2);
  assert.ok(bridgeFences.every((fence) => fence.position.y > 3.5));
  assert.ok(bridgeFences.every((fence) => fence.children.some((child) => child.isInstancedMesh)));
  assert.ok(bridgeFences.every((fence) => fence.children.filter((child) => child.name.endsWith("horizontal-rail")).length === 2));
  assert.ok(bridge.boundaryVolumes.every((volume) => volume.type === "amic-fence"));
  assert.ok(strips.filter((strip) => strip !== bridge).every((strip) =>
    strip.root.children.every((child) => !child.name.startsWith("amic-fence-"))
      && strip.boundaryVolumes.length === 0
  ));
});
