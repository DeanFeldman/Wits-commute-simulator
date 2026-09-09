import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  LEVEL_ONE_ASPHALT_PIECES,
  createAsphaltQuadGeometry
} from "../src/levels/ParkingLevel.js";
import { PARKING_LAYOUT } from "../src/levels/parking/ParkingEnvironment.js";
import { POOL_EDGE_END, POOL_EDGE_START } from "../src/shaders/asphaltShader.js";

// docs/LEVEL_1_PARKING_LAYOUT.md warns that widening the pool threshold floods
// the lot. Nothing enforced it, so the bounds could be nudged and the lot
// turned into a lake without a single test noticing.
//
// The lot floor is built from fixed corner lists and the mask is a function of
// world position only, so coverage does not depend on which bays are left free.
// That is why this needs no seed pin and is not affected by #95.
//
// The mask is mirrored in JavaScript below rather than measured on the GPU,
// because a guard that only runs when somebody remembers to open a browser is
// not a guard. The mirror was calibrated against the real thing:
// src/levels/parking/poolCoverage.js renders this same mask through the
// shipping shader and reported 24.3 % where the mirror reports 25.4 %. Re-run
// that probe if the noise in the shader is ever changed.

// Coverage is roughly 1.8 points per 0.01 of threshold, so this band tolerates
// deliberate tuning between about 0.62 and 0.71 and trips on anything past it.
// It is tighter above than below on purpose: flooding is the failure the layout
// document actually warns about.
const MIN_COVERAGE = 0.12;
const MAX_COVERAGE = 0.33;

// The fine damage term drifts with uTime, so coverage is checked over a spread
// of elapsed times rather than only at level load.
const SAMPLE_TIMES = [0, 30, 300, 1800];

const fract = (value) => value - Math.floor(value);
const mix = (a, b, t) => a + (b - a) * t;

function hash(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
}

function noise(x, y) {
  const cellX = Math.floor(x);
  const cellY = Math.floor(y);
  let fx = x - cellX;
  let fy = y - cellY;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  return mix(
    mix(hash(cellX, cellY), hash(cellX + 1, cellY), fx),
    mix(hash(cellX, cellY + 1), hash(cellX + 1, cellY + 1), fx),
    fy
  );
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

// Barycentric samples per triangle. vDamage is a varying, so it is interpolated
// across the triangle exactly as the rasteriser would, and the world position
// with it.
const SAMPLES_PER_EDGE = 8;

function measureCoverage(elapsedSeconds, edgeStart = POOL_EDGE_START, edgeEnd = POOL_EDGE_END) {
  const lot = PARKING_LAYOUT.mainLot;
  let waterArea = 0;
  let totalArea = 0;

  for (const piece of LEVEL_ONE_ASPHALT_PIECES) {
    const geometry = createAsphaltQuadGeometry(piece.corners, lot);
    const position = geometry.attributes.position.array;
    const index = geometry.index.array;

    // vDamage is computed per vertex in the vertex shader, from the mesh's
    // local x/y, then interpolated. Sampling the noise per point instead would
    // be a different field: the vertex grid is 2.5 m and the fine term has a
    // 0.7 m wavelength, so the mesh aliases it heavily and that aliasing is
    // part of what the player sees.
    const damage = new Float64Array(geometry.attributes.position.count);
    for (let vertex = 0; vertex < damage.length; vertex++) {
      const localX = position[vertex * 3];
      const localY = position[vertex * 3 + 1];
      const broadDamage = noise(localX * 0.27, localY * 0.27);
      const fineDamage = noise(
        localX * 1.4 + elapsedSeconds * 0.015,
        localY * 1.4 + elapsedSeconds * 0.015
      );
      damage[vertex] = smoothstep(0.56, 0.85, broadDamage) * mix(0.65, 1.0, fineDamage);
    }

    for (let triangle = 0; triangle < index.length; triangle += 3) {
      const a = index[triangle];
      const b = index[triangle + 1];
      const c = index[triangle + 2];
      const ax = position[a * 3];
      const ay = position[a * 3 + 1];
      const bx = position[b * 3];
      const by = position[b * 3 + 1];
      const cx = position[c * 3];
      const cy = position[c * 3 + 1];
      const area = Math.abs((bx - ax) * (cy - ay) - (cx - ax) * (by - ay)) / 2;

      let sum = 0;
      let samples = 0;
      for (let i = 0; i < SAMPLES_PER_EDGE; i++) {
        for (let j = 0; j < SAMPLES_PER_EDGE - i; j++) {
          const wa = (i + 1 / 3) / SAMPLES_PER_EDGE;
          const wb = (j + 1 / 3) / SAMPLES_PER_EDGE;
          const wc = 1 - wa - wb;
          if (wc < 0) continue;

          const localX = wa * ax + wb * bx + wc * cx;
          const localY = wa * ay + wb * by + wc * cy;
          const pointDamage = wa * damage[a] + wb * damage[b] + wc * damage[c];

          // The mesh is laid flat by rotation.x = -PI/2 at the lot centre, so a
          // local x/y lands at this world x/z.
          const worldX = lot.x + localX;
          const worldZ = lot.z - localY;
          const shape =
            noise(worldX * 0.09, worldZ * 0.09) * 0.68 +
            noise(worldX * 0.27, worldZ * 0.27) * 0.32;

          sum += smoothstep(edgeStart, edgeEnd, shape + pointDamage * 0.16);
          samples++;
        }
      }

      waterArea += area * (sum / samples);
      totalArea += area;
    }
  }

  return { coverage: waterArea / totalArea, lotAreaSquareMetres: totalArea };
}

test("Level 1 pool coverage stays inside a sane band", (t) => {
  for (const elapsedSeconds of SAMPLE_TIMES) {
    const { coverage, lotAreaSquareMetres } = measureCoverage(elapsedSeconds);
    const percent = (coverage * 100).toFixed(2);
    t.diagnostic(
      `t=${elapsedSeconds}s: ${percent}% of ${lotAreaSquareMetres.toFixed(0)} m2 of lot holds water`
    );

    assert.ok(
      coverage >= MIN_COVERAGE && coverage <= MAX_COVERAGE,
      `Level 1 pool coverage is ${percent}% at t=${elapsedSeconds}s, outside the ` +
        `${MIN_COVERAGE * 100}-${MAX_COVERAGE * 100}% band. POOL_EDGE_START/END in ` +
        `src/shaders/asphaltShader.js are ${POOL_EDGE_START}/${POOL_EDGE_END}; raising ` +
        `them dries the lot out and lowering them floods it, at roughly 1.8 points of ` +
        `coverage per 0.01. If this change is deliberate, move the band and say why.`
    );
  }
});

test("moving the pool bounds moves coverage in the direction the guard assumes", () => {
  // If this fails the guard's failure message is lying about which way to turn
  // the knob, which is worse than having no message.
  const dry = measureCoverage(0, 0.75, 0.772).coverage;
  const shipped = measureCoverage(0).coverage;
  const flooded = measureCoverage(0, 0.6, 0.622).coverage;

  assert.ok(dry < shipped, "raising the threshold should dry the lot out");
  assert.ok(flooded > shipped, "lowering the threshold should flood the lot");
  assert.ok(flooded > MAX_COVERAGE, "a 0.05 widening should trip the guard");
});

test("the shader still computes the mask this test mirrors", () => {
  // The mirror above is a second implementation, so it can silently stop
  // matching the shader. These are the exact lines it reproduces: if one of
  // them changes, the coverage number becomes fiction and this fails first,
  // pointing at the line that moved.
  const source = readFileSync(new URL("../src/shaders/asphaltShader.js", import.meta.url), "utf8");
  const mirrored = [
    "return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);",
    "float broadDamage = noise(position.xy * 0.27);",
    "float fineDamage = noise(position.xy * 1.4 + uTime * 0.015);",
    "vDamage = smoothstep(0.56, 0.85, broadDamage) * mix(0.65, 1.0, fineDamage);",
    "float shape = noise(groundPosition * 0.09) * 0.68 + noise(groundPosition * 0.27) * 0.32;",
    "float lowGround = shape + vDamage * 0.16;",
    "float water = smoothstep(uPoolEdgeStart, uPoolEdgeEnd, lowGround);"
  ];

  for (const line of mirrored) {
    assert.ok(
      source.includes(line),
      `asphaltShader.js no longer contains "${line}", which test/parking-water-coverage.test.js ` +
        `mirrors in JavaScript. Update the mirror, then re-calibrate it against the GPU probe in ` +
        `src/levels/parking/poolCoverage.js before trusting the coverage figure again.`
    );
  }
});
