import * as THREE from "three";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";

const ROAD_TEXTURE_PATH = "./assets/textures/road/";

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
  vec3 damagedPosition = position;
  damagedPosition.z -= vDamage * 0.1 + (textureHeight - 0.5) * 0.035;
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

void main() {
  vec2 tiledUv = vUv * vec2(12.0, 10.0);
  vec3 textureColour = texture2D(uRoadTexture, tiledUv).rgb;
  float roughness = texture2D(uRoughnessTexture, tiledUv).r;
  vec3 surfaceNormal = texture2D(uNormalTexture, tiledUv).xyz * 2.0 - 1.0;
  float microRelief = dot(normalize(surfaceNormal), normalize(vec3(0.35, 0.8, 0.48))) * 0.5 + 0.5;
  vec3 dryAsphalt = textureColour * mix(0.42, 0.72, microRelief);
  vec3 damagedAsphalt = mix(dryAsphalt, vec3(0.025, 0.03, 0.035), vDamage);
  float headlight = 1.0 - smoothstep(0.0, uHeadlightDistance, distance(vWorldPosition, uHeadlightPosition));
  float movingSheen = sin((vUv.x + vUv.y) * 18.0 - uTime * 1.8) * 0.5 + 0.5;
  float wetness = vDamage * movingSheen * (1.0 - roughness * 0.55) * (0.25 + headlight * 0.75);
  vec3 colour = damagedAsphalt + vec3(0.16, 0.19, 0.23) * wetness + vec3(1.0, 0.78, 0.45) * headlight * 0.12;
  gl_FragColor = vec4(colour, 1.0);
}
`;

export function createAsphaltMaterial() {
  const configureTexture = (texture, { colour = false } = {}) => {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 4;
    if (colour) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };

  const textureLoader = new THREE.TextureLoader();
  const roadTexture = configureTexture(
    textureLoader.load(`${ROAD_TEXTURE_PATH}asphalt-02-diff-2k.jpg`),
    { colour: true }
  );
  const roughnessTexture = configureTexture(
    textureLoader.load(`${ROAD_TEXTURE_PATH}asphalt-02-rough-2k.jpg`)
  );
  const displacementTexture = configureTexture(
    textureLoader.load(`${ROAD_TEXTURE_PATH}asphalt-02-disp-2k.png`)
  );
  const normalTexture = configureTexture(
    new EXRLoader().load(`${ROAD_TEXTURE_PATH}asphalt-02-nor-gl-2k.exr`)
  );

  return new THREE.ShaderMaterial({
    uniforms: {
      uRoadTexture: { value: roadTexture },
      uRoughnessTexture: { value: roughnessTexture },
      uDisplacementTexture: { value: displacementTexture },
      uNormalTexture: { value: normalTexture },
      uTime: { value: 0 },
      uHeadlightPosition: { value: new THREE.Vector3() },
      uHeadlightDistance: { value: 13 }
    },
    vertexShader,
    fragmentShader
  });
}
