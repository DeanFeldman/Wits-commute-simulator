import * as THREE from "three";


const vertexShader = `
uniform float uPixelRatio;

attribute float aSize;
attribute float aAlpha;
attribute float aStretch;

varying float vAlpha;
varying float vStretch;


void main() {
  vAlpha =
    aAlpha;

  vStretch =
    aStretch;


  vec4 viewPosition =
    modelViewMatrix *
    vec4(
      position,
      1.0
    );


  float distanceScale =
    6.0 /
    max(
      2.0,
      -viewPosition.z
    );


  gl_PointSize =
    clamp(
      aSize *
      uPixelRatio *
      distanceScale,
      2.0,
      22.0 *
      uPixelRatio
    );


  gl_Position =
    projectionMatrix *
    viewPosition;
}
`;


const fragmentShader = `
precision highp float;

varying float vAlpha;
varying float vStretch;


void main() {
  vec2 point =
    gl_PointCoord *
    2.0 -
    1.0;


  vec2 shapedPoint;


  // Narrow airborne droplets.
  if (
    vStretch <
    1.0
  ) {
    float taper =
      mix(
        0.52,
        1.0,
        clamp(
          (
            1.0 -
            point.y
          ) *
          0.5,
          0.0,
          1.0
        )
      );


    shapedPoint =
      vec2(
        point.x /
        (
          vStretch *
          taper
        ),

        point.y *
        0.78
      );
  }

  // Low, flatter sideways spray.
  else {
    shapedPoint =
      vec2(
        point.x /
        vStretch,

        point.y *
        1.75
      );
  }


  float distanceSquared =
    dot(
      shapedPoint,
      shapedPoint
    );


  if (
    distanceSquared >
    1.0
  ) {
    discard;
  }


  float softEdge =
    1.0 -
    smoothstep(
      0.58,
      1.0,
      distanceSquared
    );


  // Thin highlight along one side so the particle looks like
  // a water streak rather than a glowing circular bubble.
  float highlight =
    smoothstep(
      0.20,
      -0.55,
      point.x
    ) *
    (
      1.0 -
      smoothstep(
        0.25,
        0.92,
        abs(
          point.y
        )
      )
    );


  vec3 waterBlue =
    vec3(
      0.30,
      0.62,
      0.88
    );


  vec3 paleGlint =
    vec3(
      0.76,
      0.91,
      1.0
    );


  vec3 colour =
    mix(
      waterBlue,
      paleGlint,
      highlight *
      0.48
    );


  gl_FragColor =
    vec4(
      colour,
      vAlpha *
      softEdge
    );
}
`;


export function createPotholeSplashMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: {
        value:
          Math.min(
            globalThis.devicePixelRatio ??
              1,
            2
          )
      }
    },

    vertexShader,
    fragmentShader,

    transparent: true,

    depthTest: true,
    depthWrite: false,

    blending:
      THREE.NormalBlending,

    toneMapped: false
  });
}