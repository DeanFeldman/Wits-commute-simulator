import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ParkingLevel } from "../src/levels/ParkingLevel.js";
import { CollisionWorld } from "../src/shared/CollisionWorld.js";
import { disposeObject3D } from "../src/shared/disposeObject3D.js";

test("entrance scenery leaves a connected driveway and separates cars from Flower Hall", () => {
  const level = new ParkingLevel({});
  level.collisionWorld = new CollisionWorld(level.root);
  level.createSideAccessRoad();
  level.createSecondaryParkingContext();
  level.root.updateMatrixWorld(true);
  const bounds = (name) => new THREE.Box3().setFromObject(level.root.getObjectByName(name));
  const lot = bounds("secondary-parking");
  const hall = bounds("flower-hall");
  const entrance = bounds("secondary-entrance");
  const { roadEdgeX, z, entranceWidth } = level.entranceScenery;
  assert.ok(entrance.min.x <= roadEdgeX && entrance.max.x >= lot.min.x);
  assert.ok(hall.min.x > lot.max.x, "hall must stand behind all parking");
  const cars = level.root.children.find((child) => child.isInstancedMesh && child.geometry.parameters.height === 0.76);
  assert.equal(cars.count, 12);
  const matrix = new THREE.Matrix4();
  const carBounds = new THREE.Box3();
  cars.geometry.computeBoundingBox();
  for (let index = 0; index < cars.count; index++) {
    cars.getMatrixAt(index, matrix);
    carBounds.copy(cars.geometry.boundingBox).applyMatrix4(matrix);
    assert.ok(carBounds.min.x >= lot.min.x && carBounds.max.x <= lot.max.x);
    assert.ok(carBounds.min.z >= lot.min.z && carBounds.max.z <= lot.max.z);
    assert.ok(carBounds.max.z < z - entranceWidth / 2 || carBounds.min.z > z + entranceWidth / 2,
      "parked cars must leave the entrance aisle open");
  }
  for (const mesh of level.root.children.filter((child) => child.isMesh && !child.isInstancedMesh)) {
    if (mesh.position.x < roadEdgeX || mesh.position.x > lot.min.x || mesh.name === "secondary-entrance") continue;
    const box = new THREE.Box3().setFromObject(mesh);
    assert.ok(box.max.z <= z - entranceWidth / 2 + 0.001 || box.min.z >= z + entranceWidth / 2 - 0.001,
      "kerb and pavement must not close the driveway");
  }
  assert.ok(level.collisionWorld.colliders.every((collider) => collider.tag === "side-road-fence"));
  disposeObject3D(level.root);
});

test("extra main-lot cars preserve the gate approach, side driving aisle, and target bay", () => {
  const level = new ParkingLevel({});
  level.collisionWorld = new CollisionWorld(level.root);
  level.createParkedCars();
  level.collisionWorld.rebuild();
  assert.equal(level.collisionWorld.colliders.length, 55);
  const edgeCars = level.collisionWorld.colliders.filter((car) => car.object.position.x > 19);
  assert.equal(edgeCars.length, 8);
  assert.ok(edgeCars.every((car) => car.object.position.x + car.size.x / 2 < level.entranceScenery.fenceX));
  const car = new THREE.Object3D();
  for (const [x, z] of [[-5, 42], [-5, 31], [5, 31], [15, -20], ...Array.from({ length: 51 }, (_, i) => [18, 27 - i])]) {
    car.position.set(x, 0.55, z);
    assert.ok(!level.collisionWorld.firstHit(car, [2.2, 1.1, 4.2]), `clear driving space at ${x}, ${z}`);
  }
  disposeObject3D(level.root);
});
