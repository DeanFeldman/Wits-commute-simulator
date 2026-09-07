import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

const ROAD_TEXTURE_PATH = "./assets/textures/road/";

// World size of one asphalt texture tile. The lot shader multiplies its uvs
// by SHADER_UV_TILING, so surfaces that use the shader divide by that first.
export const ROAD_TILE_METRES = 8;
export const SHADER_UV_TILING = Object.freeze({ x: 12, y: 10 });

const vertexShader = `
uniform float uTime;
uniform sampler2D uDisplacementTexture;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDamage;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 fraction = fract(point);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), fraction.x), mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), fraction.x), fraction.y);
}
void main() {
  vUv = uv;
  float broadDamage = noise(position.xy * 0.27);
  float fineDamage = noise(position.xy * 1.4 + uTime * 0.015);
  float textureHeight = texture2D(uDisplacementTexture, uv * vec2(12.0, 10.0)).r;
  vDamage = smoothstep(0.56, 0.85, broadDamage) * mix(0.65, 1.0, fineDamage);
  // The damaged patches dish the surface downwards. The lot sits only a few
  // centimetres above the grass under it, so this stays shallow enough that a
  // puddle never sinks through the asphalt and shows the ground through it.
  vec3 damagedPosition = position;
  damagedPosition.z -= vDamage * 0.042 + (textureHeight - 0.5) * 0.016;
  vec4 worldPosition = modelMatrix * vec4(damagedPosition, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform sampler2D uRoadTexture;
uniform sampler2D uRoughnessTexture;
uniform sampler2D uNormalTexture;
uniform float uTime;
uniform vec3 uHeadlightPosition;
uniform float uHeadlightDistance;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDamage;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 fraction = fract(point);
  fraction = fraction * fraction * (3.0 - 2.0 * fraction);
  return mix(mix(hash(cell), hash(cell + vec2(1.0, 0.0)), fraction.x), mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), fraction.x), fraction.y);
}

void main() {
  vec2 tiledUv = vUv * vec2(12.0, 10.0);
  vec3 textureColour = texture2D(uRoadTexture, tiledUv).rgb;
  float roughness = texture2D(uRoughnessTexture, tiledUv).r;
  vec3 surfaceNormal = texture2D(uNormalTexture, tiledUv).xyz * 2.0 - 1.0;
  float microRelief = dot(normalize(surfaceNormal), normalize(vec3(0.35, 0.8, 0.48))) * 0.5 + 0.5;
  vec3 dryAsphalt = textureColour * mix(0.42, 0.72, microRelief);
  vec3 damagedAsphalt = mix(dryAsphalt, vec3(0.025, 0.03, 0.035), vDamage);

  float headlight = 1.0 - smoothstep(0.0, uHeadlightDistance, distance(vWorldPosition, uHeadlightPosition));

  // The outline of a pool is worked out per pixel from world position. Reading
  // it from an interpolated vertex value instead spreads the edge over metres,
  // which is what made the water look like a soft glow rather than a puddle.
  vec2 groundPosition = vWorldPosition.xz;
  float shape = noise(groundPosition * 0.09) * 0.68 + noise(groundPosition * 0.27) * 0.32;
  float lowGround = shape + vDamage * 0.16;

  // Only the low tail of that noise holds water, so pools stay occasional
  // rather than flooding the lot, and the narrow band gives each one an edge
  // about half a metre across instead of a gradient metres wide.
  float water = smoothstep(0.65, 0.672, lowGround);

  // Wet tarmac is darker than dry tarmac. What lifts a puddle is not the
  // asphalt underneath but the sky reflected off the surface of the water, and
  // that reflection grows sharply as the view flattens out.
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  float grazing = pow(1.0 - clamp(viewDirection.y, 0.0, 1.0), 4.0);
  float fresnel = mix(0.12, 0.95, grazing);

  // Slight chop, so the reflection is not a dead flat mirror.
  float chop = sin(groundPosition.x * 2.4 + uTime * 0.8) * sin(groundPosition.y * 2.9 - uTime * 0.6);
  float reflection = fresnel * (0.88 + 0.12 * chop) * (1.0 - roughness * 0.25);

  vec3 skyColour = vec3(0.16, 0.34, 0.52);
  vec3 waterColour = damagedAsphalt * 0.42 + skyColour * reflection;

  // Headlights glint off standing water instead of glowing through it.
  waterColour += vec3(1.0, 0.9, 0.72) * pow(headlight, 2.5) * (0.3 + 0.7 * grazing) * 0.8;

  vec3 colour = mix(damagedAsphalt, waterColour, water);
  colour += vec3(1.0, 0.78, 0.45) * headlight * 0.1;

  gl_FragColor = vec4(colour, 1.0);
}
`;

// One texture set is shared by the lot shader and the surrounding streets, so
// the four maps are downloaded and uploaded to the GPU only once per level load.
export function createRoadTextures() {
  const configureTexture = (texture, { colour = false } = {}) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    if (colour) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const textureLoader = new THREE.TextureLoader();

  return {
    colour: configureTexture(
      textureLoader.load(`${ROAD_TEXTURE_PATH}asphalt_02_diff_2k.jpg`),
      { colour: true }
    ),
    roughness: configureTexture(
      textureLoader.load(`${ROAD_TEXTURE_PATH}asphalt_02_rough_2k.jpg`)
    ),
    displacement: configureTexture(
      textureLoader.load(`${ROAD_TEXTURE_PATH}asphalt_02_disp_2k.png`)
    ),
    normal: configureTexture(
      new EXRLoader().load(`${ROAD_TEXTURE_PATH}asphalt_02_nor_gl_2k.exr`)
    )
  };
}

export function createAsphaltMaterial(textures = createRoadTextures()) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uRoadTexture: { value: textures.colour },
      uRoughnessTexture: { value: textures.roughness },
      uDisplacementTexture: { value: textures.displacement },
      uNormalTexture: { value: textures.normal },
      uTime: { value: 0 },
      uHeadlightPosition: { value: new THREE.Vector3() },
      uHeadlightDistance: { value: 13 }
    },
    vertexShader,
    fragmentShader
  });
}

// Lit surface for the streets around the lot. It reuses the parking textures so
// the campus roads and the M1 read as the same asphalt as the parking floor,
// without paying for a second set of 2K maps.
export function createRoadMaterial(textures) {
  return new THREE.MeshStandardMaterial({
    map: textures.colour,
    roughnessMap: textures.roughness,
    normalMap: textures.normal,
    roughness: 1,
    metalness: 0,
    // The lot shader outputs its asphalt unlit and around half brightness, so
    // the lit street material is tinted to land on the same tarmac tone under
    // the dusk sun. The normal map is eased off because these surfaces are seen
    // at grazing angles, where full strength reads as streaking.
    color: 0x86898e,
    normalScale: new THREE.Vector2(0.45, 0.45)
  });
}

// Rewrites a geometry's uv attribute so one texture tile covers
// ROAD_TILE_METRES of world surface, whatever the size of the mesh.
export function applyRoadUvs(geometry, widthMetres, depthMetres) {
  const uv = geometry.attributes.uv;
  if (!uv) return geometry;

  const scaleU = widthMetres / ROAD_TILE_METRES;
  const scaleV = depthMetres / ROAD_TILE_METRES;

  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, uv.getX(index) * scaleU, uv.getY(index) * scaleV);
  }

  uv.needsUpdate = true;
  return geometry;
}
