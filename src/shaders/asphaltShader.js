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
  (-position.z) / 0.18,
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
    vDamage * 0.003 +
    (textureHeight - 0.5) *
    0.007
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

// One consistent, lighter asphalt base.
// Fine texture variation remains, but broad procedural damage no longer
// turns sections of the parking lot almost black.
// Lift the asphalt midtones while preserving the real texture detail.
// This gives us the lighter road appearance without pretending the
// entire parking lot is covered in reflective water.
vec3 liftedAsphalt =
  pow(
    max(textureColour, vec3(0.001)),
    vec3(0.90)
  ) * 0.48;

vec3 dryAsphalt =
  liftedAsphalt *
  mix(
    0.88,
    0.98,
    microRelief
  );

vec3 damagedAsphalt =
  dryAsphalt *
  (
    0.98 +
    microRelief * 0.02
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
#ifndef POOL_COVERAGE_PROBE
  // The parking surface is now one continuous dry asphalt material.
  // Water will later be reintroduced only inside selected potholes.
  water = 0.0;
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
// PROCEDURAL PHYSICAL POTHOLE
// --------------------------------------------------------
//
// Geometry provides the real depression.
// The fragment shader separates the crater into:
//
//   broken asphalt lip
//        -> steep wall
//        -> occluded basin
//
// Procedural noise fractures the boundary so it does not read
// as a smooth painted circle.

float depth =
  clamp(
    vPotholeDepth,
    0.0,
    1.0
  );

// Two noise frequencies keep the edge irregular at both
// medium and small scales.
float fractureLarge =
  noise(
    vWorldPosition.xz *
    5.5
  );

float fractureFine =
  noise(
    vWorldPosition.xz *
    17.0
  );

float fracture =
  fractureLarge * 0.62 +
  fractureFine * 0.38;

// Shift the mouth thresholds slightly around the crater.
// This produces chipped/jagged asphalt rather than one
// perfectly smooth contour.
float edgeOffset =
  (fracture - 0.5) *
  0.045;


// --------------------------------------------------------
// BROKEN LIP
// --------------------------------------------------------

float brokenLip =
  smoothstep(
    0.025 + edgeOffset,
    0.090 + edgeOffset,
    depth
  ) *
  (
    1.0 -
    smoothstep(
      0.18 + edgeOffset,
      0.30 + edgeOffset,
      depth
    )
  );


// The underside of the lip is deliberately dark.
// That narrow dark band is one of the strongest visual depth cues.
float innerLip =
  smoothstep(
    0.14,
    0.24,
    depth
  ) *
  (
    1.0 -
    smoothstep(
      0.31,
      0.42,
      depth
    )
  );


// --------------------------------------------------------
// STEEP CRATER WALL
// --------------------------------------------------------

float wallBand =
  smoothstep(
    0.12,
    0.24,
    depth
  ) *
  (
    1.0 -
    smoothstep(
      0.68,
      0.84,
      depth
    )
  );


// --------------------------------------------------------
// CRATER FLOOR
// --------------------------------------------------------

float potholeCore =
  smoothstep(
    0.54,
    0.82,
    depth
  );


// --------------------------------------------------------
// SURFACE NORMAL / LIGHT DIRECTION
// --------------------------------------------------------

vec3 realNormal =
  normalize(
    vRoadNormal
  );

// Visually exaggerate the wall normal.
// We are not quantising the lighting like cel shading;
// the lighting remains continuous and directional.
vec3 visualNormal =
  normalize(
    vec3(
      realNormal.x * 11.0,
      max(
        realNormal.y,
        0.12
      ),
      realNormal.z * 11.0
    )
  );

float slopeAmount =
  clamp(
    length(
      realNormal.xz
    ) *
    38.0,
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
    duskFacing * 0.78,
    headlightFacing *
    mix(
      0.62,
      1.20,
      headlight
    )
  );


// --------------------------------------------------------
// START WITH THE REAL ROAD COLOUR
// --------------------------------------------------------

vec3 craterColour =
  colour;


// --------------------------------------------------------
// CHIPPED ASPHALT LIP
// --------------------------------------------------------
//
// Aggregate fragments alternate slightly lighter/darker
// depending on procedural fracture and illumination.

vec3 darkBrokenAsphalt =
  colour *
  mix(
    0.42,
    0.58,
    fracture
  );

vec3 exposedAggregate =
  colour *
  mix(
    1.05,
    1.34,
    fracture
  );


vec3 lipColour =
  mix(
    darkBrokenAsphalt,
    exposedAggregate,
    clamp(
      directionalLight * 0.72 +
      fracture * 0.30,
      0.0,
      1.0
    )
  );


craterColour =
  mix(
    craterColour,
    lipColour,
    brokenLip * 0.96
  );


// Thin shadow directly beneath the broken lip.
// This makes the top surface appear to overhang the crater.
craterColour *=
  1.0 -
  innerLip * 0.48;


// --------------------------------------------------------
// CRATER WALL
// --------------------------------------------------------

float wallLight =
  mix(
    0.18,
    1.12,
    directionalLight
  );


vec3 wallColour =
  colour *
  wallLight;


// Preserve rough aggregate variation down the wall.
wallColour *=
  mix(
    0.78,
    1.06,
    fracture
  );


// Small headlight glint on wall facets facing the car.
wallColour +=
  vec3(
    0.070,
    0.060,
    0.045
  ) *
  headlightFacing *
  headlight *
  slopeAmount;


craterColour =
  mix(
    craterColour,
    wallColour,
    wallBand * 0.96
  );


// --------------------------------------------------------
// SELF-OCCLUSION
// --------------------------------------------------------
//
// Walls that face away from both the dusk light and headlights
// become substantially darker. This gives the crater volume.

float wallOcclusion =
  wallBand *
  (
    1.0 -
    directionalLight
  );


craterColour *=
  1.0 -
  wallOcclusion * 0.56;


// --------------------------------------------------------
// CRATER FLOOR
// --------------------------------------------------------
//
// Dark, but not pure black. Retaining asphalt texture is what
// prevents it from looking like a black decal painted on the road.

vec3 craterFloor =
  colour *
  mix(
    0.13,
    0.22,
    fracture
  );


// Slight cool occlusion in the deepest area.
craterFloor =
  mix(
    craterFloor,
    vec3(
      0.018,
      0.021,
      0.024
    ),
    0.44
  );


craterColour =
  mix(
    craterColour,
    craterFloor,
    potholeCore * 0.96
  );


// Deepest centre receives extra ambient occlusion.
float deepOcclusion =
  smoothstep(
    0.68,
    1.0,
    depth
  );


craterColour *=
  1.0 -
  deepOcclusion * 0.24;


// --------------------------------------------------------
// FINAL POTHOLE COMPOSITE
// --------------------------------------------------------

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

export function createRoadMaterial(textures) {
  // Roads share the lot texture set, but use the standard material path rather
  // than the wet/damaged shader. Tint that path to the same charcoal range so
  // entrance throats and surrounding roads do not read as a lighter brown.
  return new THREE.MeshStandardMaterial({
    map: textures.colour,
    roughnessMap: textures.roughness,
    normalMap: textures.normal,
    normalScale: new THREE.Vector2(0.45, 0.45),
    color: 0x55595b,
    roughness: 0.94,
    metalness: 0.01
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
