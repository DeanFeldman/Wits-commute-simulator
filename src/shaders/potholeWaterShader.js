import * as THREE from "three";

const vertexShader = `
attribute float edgeFactor;

varying vec3 vWorldPosition;
varying float vEdgeFactor;

void main() {
  vEdgeFactor = edgeFactor;

  vec4 worldPosition =
    modelMatrix *
    vec4(
      position,
      1.0
    );

  vWorldPosition =
    worldPosition.xyz;

  gl_Position =
    projectionMatrix *
    viewMatrix *
    worldPosition;
}
`;

const fragmentShader = `
precision highp float;

uniform float uTime;
uniform vec3 uHeadlightPosition;

varying vec3 vWorldPosition;
varying float vEdgeFactor;

void main() {
  // ------------------------------------------------------
  // MOVING WATER NORMAL
  // ------------------------------------------------------
  //
  // Three intersecting wave directions keep the water from
  // looking like one animated sine stripe.

  float waveA =
    sin(
      vWorldPosition.x * 7.0 +
      vWorldPosition.z * 2.1 +
      uTime * 1.55
    );

  float waveB =
    sin(
      vWorldPosition.z * 8.5 -
      vWorldPosition.x * 1.7 -
      uTime * 1.15
    );

  float waveC =
    sin(
      (
        vWorldPosition.x +
        vWorldPosition.z
      ) *
      11.0 +
      uTime * 0.82
    );

  float slopeX =
    cos(
      vWorldPosition.x * 7.0 +
      vWorldPosition.z * 2.1 +
      uTime * 1.55
    ) *
    0.035 +

    cos(
      (
        vWorldPosition.x +
        vWorldPosition.z
      ) *
      11.0 +
      uTime * 0.82
    ) *
    0.014;

  float slopeZ =
    cos(
      vWorldPosition.z * 8.5 -
      vWorldPosition.x * 1.7 -
      uTime * 1.15
    ) *
    0.060 +

    cos(
      (
        vWorldPosition.x +
        vWorldPosition.z
      ) *
      11.0 +
      uTime * 0.82
    ) *
    0.026;

  vec3 waterNormal =
    normalize(
      vec3(
        -slopeX,
        1.0,
        -slopeZ
      )
    );


  // ------------------------------------------------------
  // VIEW-ANGLE REFLECTION / FRESNEL
  // ------------------------------------------------------

  vec3 viewDirection =
    normalize(
      cameraPosition -
      vWorldPosition
    );

  float facing =
    clamp(
      dot(
        waterNormal,
        viewDirection
      ),
      0.0,
      1.0
    );

float fresnel =
  pow(
    1.0 - facing,
    2.2
  );

// ------------------------------------------------------
// ROUGH / BLURRED SKY REFLECTION
// ------------------------------------------------------
//
// Standing pothole water reflects the blue sky strongly enough
// to remain readable from gameplay distance, but high roughness
// keeps the reflection soft rather than mirror-like.

vec3 reflectedView =
  reflect(
    -viewDirection,
    waterNormal
  );


float reflectedHeight =
  clamp(
    reflectedView.y * 0.5 +
    0.5,
    0.0,
    1.0
  );


vec3 horizonSky =
  vec3(
    0.22,
    0.43,
    0.68
  );

vec3 upperSky =
  vec3(
    0.08,
    0.27,
    0.58
  );


vec3 directionalSky =
  mix(
    horizonSky,
    upperSky,
    smoothstep(
      0.10,
      0.90,
      reflectedHeight
    )
  );


// High roughness approximates a blurred reflection.
// This deliberately dominates over directional variation.
vec3 averageSky =
  vec3(
    0.16,
    0.37,
    0.63
  );


vec3 blurredSky =
  mix(
    directionalSky,
    averageSky,
    0.88
  );


// Dark water underneath the reflection.
vec3 deepWater =
  vec3(
    0.018,
    0.050,
    0.105
  );


// Keep a substantial reflection even when looking almost
// straight down. Fresnel now adds only a modest extra amount.
float reflectionAmount =
  0.30 +
  fresnel * 0.16;


vec3 colour =
  mix(
    deepWater,
    blurredSky,
    reflectionAmount
  );
  // ------------------------------------------------------
  // DIRT / MURKINESS
  // ------------------------------------------------------
  //
  // Pothole water should not look perfectly clean.
  // Add subtle cloudy sediment variation and make the water
  // slightly murkier near the edge where it meets the crater wall.
float dirtNoiseA =
  sin(
    vWorldPosition.x * 5.5 +
    vWorldPosition.z * 4.2
  ) *
  0.5 +
  0.5;

float dirtNoiseB =
  sin(
    vWorldPosition.x * 11.0 -
    vWorldPosition.z * 8.0 +
    1.7
  ) *
  0.5 +
  0.5;

float dirtNoise =
  dirtNoiseA * 0.65 +
  dirtNoiseB * 0.35;

float edgeMurk =
  smoothstep(
    0.50,
    1.0,
    vEdgeFactor
  );

vec3 muddyWater =
  vec3(
    0.075,
    0.070,
    0.050
  );

float murkAmount =
  0.10 +
  dirtNoise * 0.18 +
  edgeMurk * 0.12;

colour =
  mix(
    colour,
    muddyWater,
    murkAmount
  );
// Soft animated variation rather than bright wave stripes.
float rippleSheen =
  (
    waveA +
    waveB +
    waveC
  ) /
  3.0 *
  0.5 +
  0.5;


colour +=
  vec3(
    0.010,
    0.022,
    0.040
  ) *
  rippleSheen;
  // ------------------------------------------------------
  // HEADLIGHT GLINT
  // ------------------------------------------------------

  vec3 toHeadlight =
    uHeadlightPosition -
    vWorldPosition;

  float headlightDistance =
    length(
      toHeadlight
    );

  vec3 headlightDirection =
    normalize(
      toHeadlight
    );

  vec3 halfwayDirection =
    normalize(
      headlightDirection +
      viewDirection
    );

  float headlightFacing =
    max(
      dot(
        waterNormal,
        halfwayDirection
      ),
      0.0
    );

  float headlightFalloff =
    1.0 -
    smoothstep(
      2.0,
      18.0,
      headlightDistance
    );

  float glint =
    pow(
      headlightFacing,
      54.0
    ) *
    headlightFalloff;

  colour +=
    vec3(
      1.0,
      0.86,
      0.65
    ) *
    glint *
    1.25;


  // ------------------------------------------------------
  // SOFT WATER EDGE
  // ------------------------------------------------------
  //
  // Keep almost all of the water visible, with only a very
  // narrow fade right at the outer edge.

float edgeAlpha =
  1.0 -
  smoothstep(
    0.94,
    1.0,
    vEdgeFactor
  );

float alpha =
  (
    0.78 +
    fresnel * 0.08
  ) *
  edgeAlpha;
colour *=
  1.0 -
  edgeMurk * 0.06;
gl_FragColor =
  vec4(
    colour,
    alpha
  );
}
`;

export function createPotholeWaterMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: {
        value: 0
      },

      uHeadlightPosition: {
        value:
          new THREE.Vector3()
      }
    },

    vertexShader,
    fragmentShader,

    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide
  });
}