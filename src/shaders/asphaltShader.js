import * as THREE from "three";

const vertexShader = `
uniform float uTime;
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
  vDamage = smoothstep(0.56, 0.85, broadDamage) * mix(0.65, 1.0, fineDamage);
  vec3 damagedPosition = position;
  damagedPosition.z -= vDamage * 0.13;
  vec4 worldPosition = modelMatrix * vec4(damagedPosition, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const fragmentShader = `
uniform sampler2D uRoadTexture;
uniform float uTime;
uniform vec3 uHeadlightPosition;
uniform float uHeadlightDistance;
varying vec2 vUv;
varying vec3 vWorldPosition;
varying float vDamage;

void main() {
  float textureGrain = texture2D(uRoadTexture, vUv * 8.0).r;
  vec3 dryAsphalt = mix(vec3(0.11, 0.13, 0.15), vec3(0.24, 0.26, 0.29), textureGrain);
  vec3 damagedAsphalt = mix(dryAsphalt, vec3(0.025, 0.03, 0.035), vDamage);
  float headlight = 1.0 - smoothstep(0.0, uHeadlightDistance, distance(vWorldPosition, uHeadlightPosition));
  float movingSheen = sin((vUv.x + vUv.y) * 18.0 - uTime * 1.8) * 0.5 + 0.5;
  float wetness = vDamage * movingSheen * (0.25 + headlight * 0.75);
  vec3 colour = damagedAsphalt + vec3(0.16, 0.19, 0.23) * wetness + vec3(1.0, 0.78, 0.45) * headlight * 0.12;
  gl_FragColor = vec4(colour, 1.0);
}
`;

export function createAsphaltMaterial() {
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index++) {
    const value = 52 + ((index * 37 + Math.floor(index / size) * 17) % 38);
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  }
  const roadTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  roadTexture.wrapS = THREE.RepeatWrapping;
  roadTexture.wrapT = THREE.RepeatWrapping;
  roadTexture.needsUpdate = true;

  return new THREE.ShaderMaterial({
    uniforms: {
      uRoadTexture: { value: roadTexture },
      uTime: { value: 0 },
      uHeadlightPosition: { value: new THREE.Vector3() },
      uHeadlightDistance: { value: 13 }
    },
    vertexShader,
    fragmentShader
  });
}