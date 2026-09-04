export const SuspicionShader = {
  name: "SuspicionShader",

  uniforms: {
    tDiffuse: { value: null },
    uSuspicion: { value: 0 }
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
    uniform float uSuspicion;

    varying vec2 vUv;

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      float suspicion = clamp(uSuspicion, 0.0, 1.0);

      float luminance = dot(
        source.rgb,
        vec3(0.299, 0.587, 0.114)
      );

      float desaturation = 0.7 * suspicion;
      vec3 colour = mix(
        source.rgb,
        vec3(luminance),
        desaturation
      );

      float distanceFromCentre = distance(vUv, vec2(0.5));
      float vignette = smoothstep(
        0.26,
        0.70,
        distanceFromCentre
      );

      colour *= 1.0 - vignette * (0.55 * suspicion);

      gl_FragColor = vec4(colour, source.a);
    }
  `
};
