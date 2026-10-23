// A small, bounded volume integral for sunlit haze. The box is sheared along
// the SAME direction as the real sunlight, so shafts follow the window holes.
export const windowLightVertexShader = /* glsl */ `
  varying vec3 vWorldPosition;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPosition = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

export const windowLightFragmentShader = /* glsl */ `
  uniform vec3 uOrigin;
  uniform vec2 uHalfOpening;
  uniform vec2 uSlope;
  uniform float uLength;
  uniform float uTime;
  uniform float uEnabled;
  varying vec3 vWorldPosition;

  // Undo the beam's shear to recover where a point's ray crossed the window.
  vec3 beamSpace(vec3 p) {
    p -= uOrigin;
    return vec3(p.x, p.y - uSlope.x * p.x, p.z - uSlope.y * p.x);
  }

  void main() {
    if (uEnabled < 0.5) discard;
    vec3 ray = normalize(vWorldPosition - cameraPosition);
    vec3 origin = beamSpace(cameraPosition);
    vec3 direction = vec3(ray.x, ray.y - uSlope.x * ray.x, ray.z - uSlope.y * ray.x);
    vec3 directionSign = step(vec3(0.0), direction) * 2.0 - 1.0;
    vec3 inverseDirection = directionSign / max(abs(direction), vec3(0.0001));
    vec3 nearHit = (vec3(0.0, -uHalfOpening.x, -uHalfOpening.y) - origin) * inverseDirection;
    vec3 farHit = (vec3(uLength, uHalfOpening.x, uHalfOpening.y) - origin) * inverseDirection;
    vec3 entry = min(nearHit, farHit);
    vec3 exit = max(nearHit, farHit);
    float start = max(0.0, max(entry.x, max(entry.y, entry.z)));
    float end = min(exit.x, min(exit.y, exit.z));
    if (end <= start) discard;

    // Fixed sample count: three modest volumes, no extra render targets.
    float stepLength = (end - start) / 12.0;
    float density = 0.0;
    for (int i = 0; i < 12; i++) {
      vec3 world = cameraPosition + ray * (start + (float(i) + 0.5) * stepLength);
      vec3 p = beamSpace(world);
      vec2 edge = uHalfOpening - abs(p.yz);
      float opening = smoothstep(0.0, 0.12, edge.x) * smoothstep(0.0, 0.12, edge.y);
      // Leave the same cross-shaped gap as the window's centre mullions.
      float panes = smoothstep(0.04, 0.09, abs(p.y)) * smoothstep(0.04, 0.09, abs(p.z));
      float dust = 0.9 + 0.1 * sin(p.z * 7.0 + uTime * 0.16) * sin(p.y * 11.0 - uTime * 0.12);
      float floorFade = smoothstep(0.12, 0.4, world.y);
      density += opening * panes * dust * floorFade * exp(-p.x * 0.12) * stepLength;
    }
    vec3 sunlightDirection = normalize(vec3(1.0, uSlope.x, uSlope.y));
    float scattering = 0.65 + 0.35 * pow(max(dot(ray, -sunlightDirection), 0.0), 4.0);
    float alpha = min(0.16, (1.0 - exp(-density * 0.045)) * scattering);
    gl_FragColor = vec4(vec3(1.0, 0.88, 0.65), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;
