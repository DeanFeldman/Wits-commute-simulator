import * as THREE from "three";
import { createPoolCoverageMaterial } from "../../shaders/asphaltShader.js";

// How much of the Level 1 lot holds standing water, measured on the GPU.
//
// The guard that runs on every commit is test/parking-water-coverage.test.js,
// which mirrors the mask in JavaScript so that it needs no browser. This is the
// instrument that makes the mirror trustworthy: it draws the lot from straight
// above through the shipping asphalt shader, cut short at the mask, so what it
// reports is the mask the player sees rather than a second implementation of
// the noise agreeing with itself.
//
// The two were expected to disagree. The hash is
// fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453123), and over this lot
// the dot product reaches four figures, where a float32 sine has lost enough of
// its argument that the fractional part should decorrelate from the float64 one
// JavaScript computes. Measured, they agree: 24.3 % here against the mirror's
// 25.4 %, close enough that the mirror can carry the guard.
//
// Run this again after any change to the noise or to the lot geometry, and move
// the mirror to match if the two have drifted apart. Open the level with
// ?waterCoverage=1 and call window.__poolCoverage().

// One texel is about 6 cm of tarmac, which resolves the half-metre pool edge
// well enough that the partial coverage in the edge band is integrated rather
// than rounded to nothing.
const PROBE_WIDTH = 2048;

export function measurePoolCoverage(renderer, asphaltMeshes, textures) {
  // Taken from the meshes rather than from the layout constants, so the probe
  // frames whatever floor was actually laid down and cannot be pointed at a
  // footprint the level no longer has.
  const bounds = new THREE.Box3();
  for (const mesh of asphaltMeshes) bounds.expandByObject(mesh);
  const minX = bounds.min.x;
  const maxX = bounds.max.x;
  const minZ = bounds.min.z;
  const maxZ = bounds.max.z;
  const width = maxX - minX;
  const depth = maxZ - minZ;
  const height = Math.round((PROBE_WIDTH * depth) / width);
  const centreX = (minX + maxX) / 2;
  const centreZ = (minZ + maxZ) / 2;

  // An orthographic view from straight above is area-preserving in world x/z,
  // so a mean over the texels covering the lot is the area fraction with no
  // weighting needed.
  const camera = new THREE.OrthographicCamera(-width / 2, width / 2, depth / 2, -depth / 2, 1, 400);
  camera.position.set(centreX, 200, centreZ);
  camera.up.set(0, 0, -1);
  camera.lookAt(centreX, 0, centreZ);

  const material = createPoolCoverageMaterial(textures);
  const scene = new THREE.Scene();
  for (const mesh of asphaltMeshes) {
    // The geometry is shared rather than rebuilt, so the probe cannot drift
    // from the floor the level actually laid down.
    const probe = new THREE.Mesh(mesh.geometry, material);
    probe.position.copy(mesh.position);
    probe.rotation.copy(mesh.rotation);
    probe.scale.copy(mesh.scale);
    scene.add(probe);
  }

  const target = new THREE.WebGLRenderTarget(PROBE_WIDTH, height, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType
  });
  const previousTarget = renderer.getRenderTarget();
  const previousClear = renderer.getClearColor(new THREE.Color());
  const previousClearAlpha = renderer.getClearAlpha();

  renderer.setRenderTarget(target);
  renderer.setClearColor(0x000000, 1);
  renderer.clear();
  renderer.render(scene, camera);

  const pixels = new Uint8Array(PROBE_WIDTH * height * 4);
  renderer.readRenderTargetPixels(target, 0, 0, PROBE_WIDTH, height, pixels);

  renderer.setRenderTarget(previousTarget);
  renderer.setClearColor(previousClear, previousClearAlpha);

  let lotTexels = 0;
  let waterSum = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    // Green is 1.0 on every lot fragment and nowhere else, so it separates the
    // lot from the background inside the camera's rectangle.
    if (pixels[index + 1] < 128) continue;
    lotTexels++;
    waterSum += pixels[index] / 255;
  }

  target.dispose();
  material.dispose();

  return {
    coverage: lotTexels === 0 ? 0 : waterSum / lotTexels,
    lotAreaSquareMetres: (lotTexels * width * depth) / (PROBE_WIDTH * height)
  };
}
