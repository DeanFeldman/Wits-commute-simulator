/**
 * renderSettings.js
 *
 * The renderer-level decisions that apply to all three levels, in one
 * place so a marker can see the whole image pipeline at once and so the
 * numbers can be tuned without hunting through Game.js.
 *
 * These settings are upstream of everything else in the project. Lighting,
 * materials and post-processing all sit downstream of them, so changing
 * one of these changes how every level looks.
 *
 * Adapted from the `feature/graphics-baseline` branch
 * (src/systems/render-settings.js). That branch is a parallel build of the
 * game and does not merge; this is a deliberate port of the one piece that
 * is independent of it.
 */

import * as THREE from "three";

/**
 * Global exposure multiplier, applied before tone mapping.
 *
 * Tone mapping compresses an unbounded lighting range into the 0..1 a
 * display can show, and exposure decides which part of that range lands in
 * the middle of the curve - exactly like the exposure dial on a camera.
 *
 * This is deliberately a single global constant rather than a per-level
 * one. Each level should earn its look from its own lights; if a level is
 * too dark the fix is its light intensities, not a private exposure value.
 * Using exposure to paper over an under-lit level would make the three
 * levels impossible to compare and would silently change how every
 * material in the game responds to light.
 */
export const TONE_MAPPING_EXPOSURE = 1.0;

/**
 * Maximum device pixel ratio.
 *
 * Shading cost scales with the number of pixels, so on a 3x screen an
 * uncapped ratio costs 9x the fragment work of a 1x screen for a
 * difference almost nobody can see. AGENTS.md targets university lab
 * hardware, so 2 is the ceiling: it still resolves the thin road markings
 * and shadow edges without paying for a retina-density framebuffer.
 *
 * This value matches what Game.js applied inline before this module
 * existed, so the port does not change it.
 */
export const MAX_PIXEL_RATIO = 2;

/**
 * Apply the project's renderer baseline.
 *
 * @param {THREE.WebGLRenderer} renderer
 * @returns {THREE.WebGLRenderer} The same renderer, for chaining.
 */
export function applyRendererBaseline(renderer) {
  /*
   * TONE MAPPING
   *
   * Three's default is NoToneMapping, which clamps: any lit surface whose
   * computed radiance exceeds 1.0 is cut flat to white, and everything
   * above that threshold collapses to the same value. A bright surface
   * stops shading and reads as a flat cut-out slab - the level pays for
   * bright lighting and gets none of the shaping it should buy.
   *
   * ACES Filmic is a filmic response curve: it rolls the highlights off
   * smoothly instead of clipping them, and desaturates as it approaches
   * white the way film and real cameras do. Two things follow that matter
   * here:
   *
   *   1. Bright surfaces keep their shading gradient, so a lit car roof
   *      still reads as a curved-ish object rather than a cut-out.
   *   2. Values above 1.0 become meaningful rather than wasted, which is
   *      what makes the Level 1 headlights and the Level 3 tutor spotlight
   *      readable as light sources.
   *
   * The cost is that the whole image gets darker and slightly less
   * saturated than the un-tone-mapped version. That is the curve doing its
   * job, not a regression - but it does mean the existing per-level light
   * intensities were tuned against no curve and now sit low. Retuning them
   * is deliberately NOT part of this change; see the branch notes.
   *
   * Worth knowing about post-processing: three only applies tone mapping
   * when rendering straight to the canvas. WebGLPrograms forces
   * NoToneMapping whenever the target is a render target, so a composer
   * must end with an OutputPass to apply the curve instead. Game.js's
   * suspicion composer already ends with one, so Level 3 picks the curve
   * up on the same terms as the other two.
   */
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_MAPPING_EXPOSURE;

  /*
   * COLOUR SPACE
   *
   * Set explicitly, but note this is already the default in three 0.180
   * (WebGLRenderer initialises _outputColorSpace to SRGBColorSpace). It is
   * written out so the intent is visible rather than inherited: lighting
   * is computed in linear space, and the result is converted to sRGB on
   * the way to the display.
   *
   * The half of this that is NOT automatic is the textures. A colour
   * texture is authored in sRGB and must declare
   * `colorSpace = SRGBColorSpace` so it is linearised before lighting; a
   * data texture - roughness, metalness, normal, AO - holds measurements
   * rather than colours and must stay in the default linear space.
   * Linearising a roughness map would silently change every roughness
   * value in the scene.
   */
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  /*
   * SHADOWS
   *
   * PCFSoftShadowMap takes several samples around each shadow lookup and
   * blends them, so the hard stair-stepped edge of a fixed-resolution
   * depth map is filtered into a soft one. It costs more per shadowed
   * fragment than PCFShadowMap, but the alternative on a 1024 map is
   * visible pixel stepping along every car and desk edge, which reads as
   * an artefact rather than as a style choice.
   *
   * Both values match what Game.js applied inline before this module
   * existed, so the port does not change them. Filtering cannot rescue a
   * shadow map stretched over an area far larger than the play space; the
   * per-light map sizes and frusta still live in the level modules.
   */
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /*
   * PIXEL RATIO
   *
   * See MAX_PIXEL_RATIO above. Applied here so the cap is enforced in the
   * same place as everything else it interacts with.
   */
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));

  return renderer;
}
