import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createWindowDaylight, WINDOW_SUN_SLOPE } from "../src/levels/level3/WindowDaylight.js";
import { disposeObject3D } from "../src/shared/disposeObject3D.js";

function setup() {
  const root = new THREE.Group();
  return { root, daylight: createWindowDaylight({
    root, halfWidth: 11, windowCentersZ: [-4.7, 1.7, 8.1],
    windowBottom: 1.4, windowTop: 4.8, windowWidth: 3.6, roomCenterZ: 1.7
  }) };
}

test("shaft volumes share the real sun direction and originate within the window openings", () => {
  const { daylight } = setup();
  const direction = daylight.sun.target.position.clone().sub(daylight.sun.position);
  assert.equal(direction.y / direction.x, WINDOW_SUN_SLOPE.y);
  assert.ok(Math.abs(direction.z / direction.x - WINDOW_SUN_SLOPE.z) < 1e-10);
  assert.equal(daylight.shafts.children.length, 3);
  for (const beam of daylight.shafts.children) {
    const positions = beam.geometry.getAttribute("position");
    const { uHalfOpening, uSlope, uOrigin } = beam.material.uniforms;
    assert.deepEqual(uOrigin.value, beam.position);
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const sourceY = positions.getY(i) - uSlope.value.x * x;
      const sourceZ = positions.getZ(i) - uSlope.value.y * x;
      assert.ok(Math.abs(sourceY) <= uHalfOpening.value.x + 1e-6);
      assert.ok(Math.abs(sourceZ) <= uHalfOpening.value.y + 1e-6);
    }
    assert.equal(beam.castShadow, false, "the haze cannot block the real sun");
    assert.equal(beam.material.depthWrite, false, "haze cannot occlude desk targets");
  }
});

test("daylight uses one bounded shadow map and reusable, non-interactive shaft geometry", () => {
  const { daylight, root } = setup();
  const shadowLights = root.children.filter((object) => object.isLight && object.castShadow);
  assert.equal(shadowLights.length, 1);
  assert.equal(daylight.sun.shadow.mapSize.x, 1024);
  const [first, second] = daylight.shafts.children;
  assert.equal(first.geometry, second.geometry);
  const hits = [];
  first.raycast(new THREE.Raycaster(), hits);
  assert.deepEqual(hits, []);
});

test("effects toggle hides atmospheric shafts without removing real illumination, and resources dispose", () => {
  const { daylight, root } = setup();
  const [first, second] = daylight.shafts.children;
  const time = first.material.uniforms.uTime;
  assert.equal(time, second.material.uniforms.uTime);
  daylight.update(0.5);
  assert.equal(time.value, 0.5);
  daylight.update(0.5, false);
  assert.equal(time.value, 0.5);
  assert.equal(first.material.uniforms.uEnabled.value, 0);
  assert.equal(daylight.sun.visible, true);
  daylight.update(0.25, true);
  assert.equal(daylight.shafts.visible, true);
  assert.equal(first.material.uniforms.uEnabled.value, 1);
  assert.equal(time.value, 0.75);
  let disposed = 0;
  first.geometry.addEventListener("dispose", () => disposed++);
  let shadowDisposed = false;
  daylight.sun.shadow.map = { dispose() { shadowDisposed = true; } };
  daylight.dispose();
  disposeObject3D(root);
  assert.equal(disposed, 1);
  assert.ok(shadowDisposed);
});

test("atmospheric haze is excluded from the tutor minimap", () => {
  const { daylight } = setup();
  const beam = daylight.shafts.children[0];
  beam.onBeforeRender(null, null, new THREE.OrthographicCamera());
  assert.equal(beam.material.uniforms.uEnabled.value, 0);
  beam.onBeforeRender(null, null, new THREE.PerspectiveCamera());
  assert.equal(beam.material.uniforms.uEnabled.value, 1);
});
