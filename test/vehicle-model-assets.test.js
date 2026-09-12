import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as THREE from "three";
import {
  PARKING_CAR_SPECS,
  cloneVehicleHierarchy
} from "../src/shared/VehicleModelLibrary.js";

test("the shared Level 1 parking pack contains all ten complete vehicle groups", async () => {
  const bytes = await readFile(new URL("../public/assets/cars/generic-passenger-car-pack.glb", import.meta.url));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(view.getUint32(0, true), 0x46546c67, "asset is a binary GLTF");
  const jsonLength = view.getUint32(12, true);
  assert.equal(view.getUint32(16, true), 0x4e4f534a, "first GLB chunk is JSON");
  const json = JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)).trim());
  const root = json.nodes.find((node) => node.name === "RootNode");
  assert.ok(root?.children);

  const countMeshes = (nodeIndex) => {
    const node = json.nodes[nodeIndex];
    return Number.isInteger(node.mesh)
      + (node.children ?? []).reduce((sum, childIndex) => sum + countMeshes(childIndex), 0);
  };

  for (const spec of PARKING_CAR_SPECS) {
    const selectedNodes = spec.packRootChildren.map((index) => root.children[index]);
    assert.ok(selectedNodes.every(Boolean), `${spec.id} has every declared body/wheel node`);
    const meshCount = selectedNodes.reduce((sum, nodeIndex) => sum + countMeshes(nodeIndex), 0);
    assert.ok(meshCount > 0, `${spec.id} contains renderable meshes`);
  }
});

test("vehicle hierarchy cloning preserves nested wheel and body transforms", () => {
  const prototype = new THREE.Group();
  const body = new THREE.Group();
  const wheel = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  body.position.set(1.25, 0.4, -0.75);
  body.rotation.set(0.1, 0.2, 0.3);
  wheel.position.set(-0.8, -0.45, 1.4);
  wheel.scale.set(0.7, 0.7, 0.35);
  body.add(wheel);
  prototype.add(body);

  const clone = cloneVehicleHierarchy(prototype);
  assert.deepEqual(clone.children[0].position.toArray(), body.position.toArray());
  assert.ok(clone.children[0].quaternion.angleTo(body.quaternion) < 1e-7);
  assert.deepEqual(clone.children[0].children[0].position.toArray(), wheel.position.toArray());
  assert.deepEqual(clone.children[0].children[0].scale.toArray(), wheel.scale.toArray());
});
