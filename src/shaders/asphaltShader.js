import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

const ROAD_TEXTURE_PATH = "./assets/textures/road/";

// World size of one asphalt texture tile. The lot shader multiplies its uvs
// by SHADER_UV_TILING, so surfaces that use the shader divide by that first.
export const ROAD_TILE_METRES = 8;
export const SHADER_UV_TILING = Object.freeze({ x: 12, y: 10 });

// Pool coverage bounds.
export const POOL_EDGE_START = 0.65;
export const POOL_EDGE_END = 0.672;

const vertexShader = `
uniform float uTime;
uniform sampler2D uDisplacementTexture;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDamage;

varying vec3 vRoadNormal;
varying float vPotholeDepth;

float hash(vec2 point) {
  return fract(
    sin(
      dot(
        point,
        vec2(127.1, 311.7)
      )
    ) * 43758.5453123
  );
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 fraction = fract(point);

  fraction =
    fraction *
    fraction *
    (3.0 - 2.0 * fraction);

  return mix(
    mix(
      hash(cell),
      hash(cell + vec2(1.0, 0.0)),
      fraction.x
    ),
    mix(
      hash(cell + vec2(0.0, 1.0)),
      hash(cell + vec2(1.0, 1.0)),
      fraction.x
    ),
    fraction.y
  );
}

void main() {
  vUv = uv;

  // CPU pothole depth: 0 = ordinary road, 1 = deepest point.
  vPotholeDepth = clamp(
    (-position.z) / 0.026,
    0.0,
    1.0
  );

  // Real normals generated from the CPU-deformed road mesh.
  vRoadNormal = normalize(
    mat3(modelMatrix) *
    normal
  );

  float broadDamage =
    noise(
      position.xy *
      0.27
    );

  float fineDamage =
    noise(
      position.xy *
      1.4 +
      uTime *
      0.015
    );

  float textureHeight =
    texture2D(
      uDisplacementTexture,
      uv *
      vec2(12.0, 10.0)
    ).r;

  vDamage =
    smoothstep(
      0.56,
      0.85,
      broadDamage
    ) *
    mix(
      0.65,
      1.0,
      fineDamage
    );

  vec3 damagedPosition =
    position;

  // IMPORTANT:
  // Ordinary asphalt displacement is reduced inside potholes.
  //
  // Otherwise the existing road-damage shader pushes our
  // already-deformed crater through the ground beneath the lot.
  float generalDisplacementScale =
    1.0 -
    vPotholeDepth *
    0.88;

  damagedPosition.z -=
    (
      vDamage * 0.042 +
      (textureHeight - 0.5) *
      0.016
    ) *
    generalDisplacementScale;

  vec4 worldPosition =
    modelMatrix *
    vec4(
      damagedPosition,
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
uniform sampler2D uRoadTexture;
uniform sampler2D uRoughnessTexture;
uniform sampler2D uNormalTexture;

uniform float uTime;

uniform vec3 uHeadlightPosition;
uniform float uHeadlightDistance;

uniform float uRippleSlope;

uniform float uPoolEdgeStart;
uniform float uPoolEdgeEnd;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDamage;

varying vec3 vRoadNormal;
varying float vPotholeDepth;

float hash(vec2 point) {
  return fract(
    sin(
      dot(
        point,
        vec2(127.1, 311.7)
      )
    ) * 43758.5453123
  );
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 fraction = fract(point);

  fraction =
    fraction *
    fraction *
    (3.0 - 2.0 * fraction);

  return mix(
    mix(
      hash(cell),
      hash(cell + vec2(1.0, 0.0)),
      fraction.x
    ),
    mix(
      hash(cell + vec2(0.0, 1.0)),
      hash(cell + vec2(1.0, 1.0)),
      fraction.x
    ),
    fraction.y
  );
}

void main() {
  vec2 tiledUv =
    vUv *
    vec2(12.0, 10.0);

  vec3 textureColour =
    texture2D(
      uRoadTexture,
      tiledUv
    ).rgb;

  float roughness =
    texture2D(
      uRoughnessTexture,
      tiledUv
    ).r;

  vec3 textureNormal =
    texture2D(
      uNormalTexture,
      tiledUv
    ).xyz *
    2.0 -
    1.0;

  float microRelief =
    dot(
      normalize(textureNormal),
      normalize(
        vec3(
          0.35,
          0.8,
          0.48
        )
      )
    ) *
    0.5 +
    0.5;

  vec3 dryAsphalt =
    textureColour *
    mix(
      0.42,
      0.72,
      microRelief
    );

  vec3 damagedAsphalt =
    mix(
      dryAsphalt,
      vec3(
        0.025,
        0.03,
        0.035
      ),
      vDamage
    );

  float headlight =
    1.0 -
    smoothstep(
      0.0,
      uHeadlightDistance,
      distance(
        vWorldPosition,
        uHeadlightPosition
      )
    );

  // --------------------------------------------------------
  // EXISTING WATER
  // --------------------------------------------------------

  vec2 groundPosition =
    vWorldPosition.xz;

  float shape =
    noise(
      groundPosition *
      0.09
    ) *
    0.68 +
    noise(
      groundPosition *
      0.27
    ) *
    0.32;

  float lowGround =
    shape +
    vDamage *
    0.16;

  float water =
    smoothstep(
      uPoolEdgeStart,
      uPoolEdgeEnd,
      lowGround
    );

#ifdef POOL_COVERAGE_PROBE

  gl_FragColor =
    vec4(
      water,
      1.0,
      0.0,
      1.0
    );

  return;

#endif

  // Gameplay hazards must not disappear beneath bright water.
  float potholeMask =
    smoothstep(
      0.012,
      0.09,
      vPotholeDepth
    );

  water *=
    1.0 -
    potholeMask *
    0.78;

  float edgesInside =
    (
      lowGround -
      uPoolEdgeStart
    ) /
    (
      uPoolEdgeEnd -
      uPoolEdgeStart
    );

  float rim =
    1.0 -
    smoothstep(
      0.0,
      2.5,
      edgesInside
    );

  vec3 viewDirection =
    normalize(
      cameraPosition -
      vWorldPosition
    );

  vec3 waterNormal =
    vec3(
      0.0,
      1.0,
      0.0
    );

  if (water > 0.0) {
    float slowX =
      groundPosition.x *
      2.4 +
      uTime *
      0.8;

    float slowZ =
      groundPosition.y *
      2.9 -
      uTime *
      0.6;

    float fastX =
      groundPosition.x *
      5.1 -
      uTime *
      1.3;

    float fastZ =
      groundPosition.y *
      4.3 +
      uTime *
      1.1;

    float viewDistance =
      distance(
        cameraPosition,
        vWorldPosition
      );

    float broad =
      1.0 -
      smoothstep(
        55.0,
        95.0,
        viewDistance
      );

    float fine =
      1.0 -
      smoothstep(
        25.0,
        50.0,
        viewDistance
      );

    float slopeX =
      2.4 *
      cos(slowX) *
      sin(slowZ) *
      0.62 *
      broad +
      5.1 *
      cos(fastX) *
      sin(fastZ) *
      0.38 *
      fine;

    float slopeZ =
      2.9 *
      sin(slowX) *
      cos(slowZ) *
      0.62 *
      broad +
      4.3 *
      sin(fastX) *
      cos(fastZ) *
      0.38 *
      fine;

    float ripple =
      uRippleSlope *
      (1.0 - rim);

    waterNormal =
      normalize(
        vec3(
          -slopeX * ripple,
          1.0,
          -slopeZ * ripple
        )
      );
  }

  float grazing =
    pow(
      1.0 -
      clamp(
        dot(
          viewDirection,
          waterNormal
        ),
        0.0,
        1.0
      ),
      4.0
    );

  float fresnel =
    mix(
      0.12,
      0.95,
      grazing
    );

  float reflection =
    fresnel *
    0.88 *
    (
      1.0 -
      roughness *
      0.25
    );

  vec3 skyColour =
    vec3(
      0.557,
      0.788,
      0.933
    );

  vec3 waterColour =
    damagedAsphalt *
    0.42 +
    skyColour *
    reflection *
    (
      1.0 -
      0.8 *
      rim
    );

  waterColour +=
    vec3(
      1.0,
      0.9,
      0.72
    ) *
    pow(
      headlight,
      2.5
    ) *
    (
      0.3 +
      0.7 *
      grazing
    ) *
    0.8;

  vec3 colour =
    mix(
      damagedAsphalt,
      waterColour,
      water
    );
// --------------------------------------------------------
// EXAGGERATED REAL POTHOLE
// --------------------------------------------------------
//
// The actual road geometry forms the crater.
// These values deliberately exaggerate its readability,
// without painting one enormous black shadow over the road.

float wallBand =
  smoothstep(
    0.025,
    0.17,
    vPotholeDepth
  ) *
  (
    1.0 -
    smoothstep(
      0.48,
      0.70,
      vPotholeDepth
    )
  );

float potholeCore =
  smoothstep(
    0.30,
    0.68,
    vPotholeDepth
  );

float brokenEdge =
  smoothstep(
    0.012,
    0.085,
    vPotholeDepth
  ) *
  (
    1.0 -
    smoothstep(
      0.28,
      0.42,
      vPotholeDepth
    )
  );

vec3 realNormal =
  normalize(
    vRoadNormal
  );

// Physical crater stays shallow enough not to expose the
// ground below it. Only the visual normal is exaggerated.
vec3 visualNormal =
  normalize(
    vec3(
      realNormal.x * 16.0,
      max(
        realNormal.y,
        0.10
      ),
      realNormal.z * 16.0
    )
  );

float slopeAmount =
  clamp(
    length(
  realNormal.xz
    ) * 30.0,
    0.0,
    1.0
  );

vec3 duskDirection =
  normalize(
    vec3(
      -0.79,
      0.48,
      0.35
    )
  );

vec3 headlightDirection =
  normalize(
    uHeadlightPosition -
    vWorldPosition
  );

float duskFacing =
  clamp(
    dot(
      visualNormal,
      duskDirection
    ),
    0.0,
    1.0
  );

float headlightFacing =
  clamp(
    dot(
      visualNormal,
      headlightDirection
    ),
    0.0,
    1.0
  );

float directionalLight =
  max(
    duskFacing * 0.90,
    headlightFacing *
    mix(
      0.60,
      1.15,
      headlight
    )
  );

vec3 craterColour =
  colour;
// Make the pothole mouth readable against both bright and dark asphalt.
// This changes only the boundary contrast — not the crater centre or geometry.
float roadLuminance =
  dot(
    colour,
    vec3(0.2126, 0.7152, 0.0722)
  );

float darkRoad =
  1.0 -
  smoothstep(
    0.10,
    0.26,
    roadLuminance
  );

vec3 edgeContrastColour =
  mix(
    colour * 0.58,       // darker edge on pale asphalt
    colour * 1.42,       // lighter broken edge on dark asphalt
    darkRoad
  );

// Only affect the real wall / mouth, never the centre.
craterColour =
  mix(
    craterColour,
    edgeContrastColour,
    brokenEdge * 0.42
  );
// Damaged asphalt around the mouth.
// Noticeably darker, but NOT the huge dark patch from before.
craterColour *=
  mix(
    1.0,
    0.68,
    brokenEdge * 0.78
  );

// Strong directional lighting on the actual crater wall.
float wallLighting =
  mix(
    0.14,
    1.65,
    directionalLight
  );

vec3 wallColour =
  colour *
  wallLighting;

// Give the lit wall a restrained highlight.
// This is important when the surrounding road is already dark.
wallColour +=
  vec3(
    0.050,
    0.045,
    0.038
  ) *
  directionalLight *
  slopeAmount;

craterColour =
  mix(
    craterColour,
    wallColour,
    wallBand * 0.92
  );

// Clearly dark centre, while retaining a little asphalt texture.
vec3 craterFloor =
  mix(
    colour * 0.11,
    vec3(
      0.006,
      0.008,
      0.010
    ),
    0.76
  );

craterColour =
  mix(
    craterColour,
    craterFloor,
    potholeCore * 0.93
  );

// Small contact-darkening where wall meets floor.
float innerOcclusion =
  wallBand *
  smoothstep(
    0.20,
    0.48,
    vPotholeDepth
  );

craterColour *=
  1.0 -
  innerOcclusion * 0.16;

colour =
  mix(
    colour,
    craterColour,
    potholeMask
  );
  colour +=
    vec3(
      1.0,
      0.78,
      0.45
    ) *
    headlight *
    0.1;

  gl_FragColor =
    vec4(
      colour,
      1.0
    );
}
`;

export function createRoadTextures() {
  const configureTexture = (
    texture,
    {
      colour = false
    } = {}
  ) => {
    texture.wrapS =
      THREE.RepeatWrapping;

    texture.wrapT =
      THREE.RepeatWrapping;

    texture.anisotropy = 4;

    if (colour) {
      texture.colorSpace =
        THREE.SRGBColorSpace;
    }

    return texture;
  };

  const pending = [];

  const loadTexture = (
    loader,
    file,
    options
  ) => {
    let resolveLoad;
    let rejectLoad;

    const ready =
      new Promise(
        (
          resolve,
          reject
        ) => {
          resolveLoad = resolve;
          rejectLoad = reject;
        }
      );

    const texture =
      loader.load(
        file,
        resolveLoad,
        undefined,
        rejectLoad
      );

    pending.push(
      ready
    );

    return configureTexture(
      texture,
      options
    );
  };

  const textureLoader =
    new THREE.TextureLoader();

  const textures = {
    colour:
      loadTexture(
        textureLoader,
        `${ROAD_TEXTURE_PATH}asphalt-02-diff-2k.jpg`,
        {
          colour: true
        }
      ),

    roughness:
      loadTexture(
        textureLoader,
        `${ROAD_TEXTURE_PATH}asphalt-02-rough-2k.jpg`
      ),

    displacement:
      loadTexture(
        textureLoader,
        `${ROAD_TEXTURE_PATH}asphalt-02-disp-2k.png`
      ),

    normal:
      loadTexture(
        new EXRLoader(),
        `${ROAD_TEXTURE_PATH}asphalt-02-nor-gl-2k.exr`
      )
  };

  Object.defineProperty(
    textures,
    "ready",
    {
      value:
        Promise.all(
          pending
        ),

      enumerable: false
    }
  );

  return textures;
}

export function createAsphaltMaterial(
  textures = createRoadTextures()
) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRoadTexture: {
        value:
          textures.colour
      },

      uRoughnessTexture: {
        value:
          textures.roughness
      },

      uDisplacementTexture: {
        value:
          textures.displacement
      },

      uNormalTexture: {
        value:
          textures.normal
      },

      uTime: {
        value: 0
      },

      uHeadlightPosition: {
        value:
          new THREE.Vector3()
      },

      uHeadlightDistance: {
        value: 13
      },

      uRippleSlope: {
        value: 0.03
      },

      uPoolEdgeStart: {
        value:
          POOL_EDGE_START
      },

      uPoolEdgeEnd: {
        value:
          POOL_EDGE_END
      }
    },

    vertexShader,
    fragmentShader
  });
}

export function createPoolCoverageMaterial(
  textures = createRoadTextures()
) {
  const material =
    createAsphaltMaterial(
      textures
    );

  material.defines = {
    POOL_COVERAGE_PROBE: ""
  };

  return material;
}

export function createRoadMaterial(
  textures
) {
  return new THREE.MeshStandardMaterial({
    map:
      textures.colour,

    roughnessMap:
      textures.roughness,

    normalMap:
      textures.normal,

    roughness: 1,
    metalness: 0,

    color:
      0x86898e,

    normalScale:
      new THREE.Vector2(
        0.45,
        0.45
      )
  });
}

export function applyRoadUvs(
  geometry,
  widthMetres,
  depthMetres
) {
  const uv =
    geometry.attributes.uv;

  if (!uv) {
    return geometry;
  }

  const scaleU =
    widthMetres /
    ROAD_TILE_METRES;

  const scaleV =
    depthMetres /
    ROAD_TILE_METRES;

  for (
    let index = 0;
    index < uv.count;
    index++
  ) {
    uv.setXY(
      index,
      uv.getX(index) *
        scaleU,

      uv.getY(index) *
        scaleV
    );
  }

  uv.needsUpdate = true;

  return geometry;
}
