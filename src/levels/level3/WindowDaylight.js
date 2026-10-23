import * as THREE from "three";
import { windowLightVertexShader, windowLightFragmentShader } from "../../shaders/windowLightShader.js";

export const WINDOW_SUN_SLOPE = Object.freeze({ y: -0.5, z: 0.24 });

export function createWindowDaylight({
  root, halfWidth, windowCentersZ, windowBottom, windowTop, windowWidth,
  roomCenterZ, effectsEnabled = true, getEffectsEnabled = null
}) {
  // One sunlight shadow map serves every opening, desk and student.
  const sun = new THREE.DirectionalLight(0xffe2ad, 3.8);
  sun.name = "classroom-window-sun";
  sun.target.position.set(0, 0, roomCenterZ);
  sun.position.set(-26, -26 * WINDOW_SUN_SLOPE.y, roomCenterZ - 26 * WINDOW_SUN_SLOPE.z);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 70 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.00015;
  sun.shadow.normalBias = 0.025;
  root.add(sun, sun.target);

  const shafts = new THREE.Group();
  shafts.name = "classroom-window-light-shafts";
  root.add(shafts);
  const time = { value: 0 };
  const enabledUniform = { value: effectsEnabled ? 1 : 0 };
  let enabled = effectsEnabled;
  const height = windowTop - windowBottom - 0.16;
  const width = windowWidth - 0.16;
  const length = 12;
  const geometry = new THREE.BoxGeometry(length, height, width);
  geometry.translate(length / 2, 0, 0);
  const positions = geometry.getAttribute("position");
  for (let index = 0; index < positions.count; index++) {
    const x = positions.getX(index);
    positions.setY(index, positions.getY(index) + WINDOW_SUN_SLOPE.y * x);
    positions.setZ(index, positions.getZ(index) + WINDOW_SUN_SLOPE.z * x);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  for (const z of windowCentersZ) {
    const origin = new THREE.Vector3(-halfWidth + 0.15, (windowTop + windowBottom) / 2, z);
    const material = new THREE.ShaderMaterial({
      name: "window-daylight-haze",
      uniforms: {
        uOrigin: { value: origin },
        uHalfOpening: { value: new THREE.Vector2(height / 2, width / 2) },
        uSlope: { value: new THREE.Vector2(WINDOW_SUN_SLOPE.y, WINDOW_SUN_SLOPE.z) },
        uLength: { value: length },
        uTime: time,
        uEnabled: enabledUniform
      },
      vertexShader: windowLightVertexShader,
      fragmentShader: windowLightFragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      // Only the exit faces: no doubling when the camera enters a shaft.
      side: THREE.BackSide,
      depthWrite: false
    });
    const beam = new THREE.Mesh(geometry, material);
    beam.name = `window-sun-shaft-${z}`;
    beam.position.copy(origin);
    beam.renderOrder = 2;
    // Atmospheric decoration must never become a tablet or tutor ray target.
    beam.raycast = () => {};
    // Read the setting at draw time so it also applies while paused. The
    // orthographic tutor minimap needs clear silhouettes, not atmospheric haze.
    beam.onBeforeRender = (_renderer, _scene, camera) => {
      enabledUniform.value = (getEffectsEnabled?.() ?? enabled) && camera.isPerspectiveCamera ? 1 : 0;
    };
    shafts.add(beam);
  }

  return {
    sun, shafts,
    update(dt, effectsOn = true) {
      enabled = effectsOn;
      enabledUniform.value = enabled ? 1 : 0;
      if (enabled) time.value += dt;
    },
    dispose() {
      // Geometry/materials are released with the level's scene graph.
      // Light shadow render targets require their own explicit cleanup.
      sun.shadow.dispose();
    }
  };
}
