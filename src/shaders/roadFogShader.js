export const RoadFogShader = {
  name: "RoadFogShader",
  uniforms: {
    uColor: { value: null },
    uOpacity: { value: 0.25 },
    uTime: { value: 0 }
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    uniform float uOpacity;
    uniform float uTime;

    varying vec2 vUv;
    varying vec3 vWorldPosition;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);

      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    void main() {
      float verticalFade=1.0-smoothstep(0.55,1.0,vUv.y);

        float sideFade=
        smoothstep(0.0,0.08,vUv.x)*
        smoothstep(0.0,0.08,1.0-vUv.x);

        float largeNoise=noise(vWorldPosition.xz*0.06+uTime*0.012);
        float fineNoise=noise(vWorldPosition.xz*0.18-uTime*0.02);

        float density=0.78+(largeNoise*0.16+fineNoise*0.06);

        float alpha=clamp(
        uOpacity*
        verticalFade*
        sideFade*
        density*
        1.65,
        0.0,
        0.92
        );

        gl_FragColor=vec4(uColor,alpha);
    }
  `
};