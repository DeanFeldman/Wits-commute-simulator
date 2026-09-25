export const Level2LightingShader = {
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 1 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    varying vec2 vUv;

    vec3 saturateImage(vec3 color, float amount) {
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(luma), color, amount);
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec3 color = source.rgb;
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));

      vec3 coolShadow = color * vec3(0.90, 0.96, 1.05);
      vec3 warmLight = color * vec3(1.08, 0.96, 0.84);
      vec3 graded = mix(coolShadow, warmLight, smoothstep(0.24, 0.78, luma));

      graded = (graded - 0.5) * 1.06 + 0.5;
      graded = saturateImage(graded, 1.05);
      graded += vec3(0.018, 0.012, 0.006);

      gl_FragColor = vec4(mix(color, graded, clamp(uStrength, 0.0, 1.0)), source.a);
    }
  `
};
