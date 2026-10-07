import * as THREE from "three";

/**
 * A light illustrative post-process used after each level's own rendering
 * pass. It gives scenes a coherent warm grade and a little separation at
 * strong silhouettes without posterising texture detail or making low-poly
 * assets look harsher than their source geometry.
 */
export const ToonStyleShader = {
  name: "ToonStyleShader",
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) }
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
    uniform vec2 uResolution;
    varying vec2 vUv;

    float toonLuminance(vec3 colour) {
      return dot(colour, vec3(0.299, 0.587, 0.114));
    }

    void main() {
      vec4 source = texture2D(tDiffuse, vUv);
      vec2 texel = 1.0 / max(uResolution, vec2(1.0));

      vec3 sourceColour = max(source.rgb, vec3(0.0));
      float centre = toonLuminance(sourceColour);
      float north = toonLuminance(texture2D(tDiffuse, vUv + vec2(0.0, texel.y)).rgb);
      float south = toonLuminance(texture2D(tDiffuse, vUv - vec2(0.0, texel.y)).rgb);
      float east = toonLuminance(texture2D(tDiffuse, vUv + vec2(texel.x, 0.0)).rgb);
      float west = toonLuminance(texture2D(tDiffuse, vUv - vec2(texel.x, 0.0)).rgb);
      float edge = abs(centre - north) + abs(centre - south) + abs(centre - east) + abs(centre - west);
      // Ignore the fine contrast inside bricks, terrazzo, grass and road
      // textures. Only broad object and silhouette boundaries get a line.
      edge = smoothstep(0.62, 1.18, edge);

      float luminance = toonLuminance(sourceColour);
      // Lift the deepest shadows enough to retain clothing and chair detail,
      // then gently compress highlights so bright windows remain soft.
      vec3 colour = sourceColour * 0.94 + vec3(0.018, 0.016, 0.014);
      colour = mix(vec3(luminance), colour, 1.06);
      colour = colour / (vec3(1.0) + colour * 0.10);

      // A nearly imperceptible warm highlight / cool shadow split supports the
      // game's stylised lighting without tinting neutral UI-facing surfaces.
      float highlight = smoothstep(0.38, 0.9, luminance);
      colour += vec3(0.012, 0.006, -0.004) * highlight;
      colour += vec3(-0.004, 0.002, 0.008) * (1.0 - highlight);

      // Keep contours readable, but do not paint the heavy black seams that
      // previously made furniture legs and character facets look dirty.
      colour *= 1.0 - edge * 0.035;

      gl_FragColor = vec4(colour, source.a);
    }
  `
};
