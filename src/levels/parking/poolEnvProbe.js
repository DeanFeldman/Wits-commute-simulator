import * as THREE from "three";

// SPIKE: a static environment probe for the Level 1 pools.
//
// #87 point 2 asks whether reflecting the real scene instead of one constant
// colour makes the water read as a reflection rather than a sheen. This bakes
// one cube map at level load and hands it to the asphalt shader; nothing here
// is meant to survive rejection.
//
// Static is the right shape to test, not a compromise. Level 1's scene does not
// move apart from the player's car, so a probe re-baked per frame would cost six
// scene renders to reproduce the same image. What static cannot capture is the
// player's own car, and parallax: one probe is only correct at its own position,
// so every pool across a 120 m lot reflects the same viewpoint.
//
// The target is stored sRGB-encoded because the asphalt shader is display
// referred: it writes gl_FragColor with no tone mapping and no colour space
// chunk, so a linear sample would land in the wrong space and read as darkening
// that is really a bug. Three disables tone mapping when rendering to a target,
// so the probe misses the ACES highlight rolloff the canvas gets. At dusk almost
// nothing here is above 1.0, so that is second order for the question being
// asked.

// Just above the water plane, because that is where the water is: a probe at
// standing height sees over the cars a puddle sees the sides of. The caller
// picks an empty bay for the position -- the first attempt used the geometric
// centre of the lot, which is inside a parked car, and every horizontal texel
// came back black.
const PROBE_HEIGHT = 0.5;

// 256 per face is enough to see whether car bodies appear in the troughs at all.
// If this is kept it wants revisiting.
const PROBE_RESOLUTION = 256;

export function bakePoolEnvProbe(renderer, scene, centre) {
  const target = new THREE.WebGLCubeRenderTarget(PROBE_RESOLUTION, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;

  // Far plane past the fog's far distance, so the probe sees the fog resolve to
  // the background colour rather than clipping short of it.
  const camera = new THREE.CubeCamera(0.5, 400, target);
  camera.position.set(centre.x, PROBE_HEIGHT, centre.z);
  camera.update(renderer, scene);

  return target;
}
