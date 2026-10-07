# Shader Demo Guide

Closes #243. This guide explains every custom shader in the game: what it does, how it works, and how gameplay drives it. Anyone on the team should be able to explain any of them during the demo. Each section points to the file and the JavaScript that feeds it.

> **Quick map:** there are two kinds of custom shader in this game.
>
> 1. **Material shaders** run on an object's own geometry: `asphaltShader.js`, `potholeWaterShader.js`, `potholeSplashShader.js`.
> 2. **Post-processing shaders** run once per *screen pixel* on the already-rendered image: `roadFogShader.js`, `suspicionShader.js`, `toonStyleShader.js`. They are chained with `EffectComposer` in `src/core/Game.js`.

---

## 0. The pipeline in one picture

```
JavaScript (CPU)                          GPU
─────────────────                         ─────────────────────────────────────────────
geometry.setAttribute(...)  ──attributes──▶ VERTEX SHADER (once per vertex)
material.uniforms.x.value = ──uniforms────▶   - transforms position: model → world → view → clip
                                           │   - writes gl_Position (+ gl_PointSize for points)
                                           │   - writes varyings
                                           ▼
                                        rasteriser: interpolates varyings across each triangle
                                           ▼
                            uniforms ───▶ FRAGMENT SHADER (once per pixel/fragment)
                                           - reads varyings + uniforms + textures
                                           - writes gl_FragColor (or discard)
```

Post-processing passes run the same pipeline on a **full-screen quad**. Their "texture" is the image the previous pass rendered, `tDiffuse`.

**Frame order (Game.js → `render()`)**

| Level | Composer chain |
|---|---|
| Level 1 (not in sky view) | RenderPass → **RoadFog** (radial mode) → **ToonStyle** → FXAA → Output |
| Level 2 | RenderPass → **RoadFog** (side + rear mode) → **ToonStyle** → FXAA → Output |
| Level 3 | RenderPass → **Suspicion** → **ToonStyle** → FXAA → Output |
| Effects off in settings | plain `renderer.render()`. Post passes are skipped, but material shaders still run |

---

## 1. `asphaltShader.js`: damaged asphalt and physical potholes (Level 1)

**Where it's used:** `ParkingLevel.createParkingSurface()` builds `createAsphaltMaterial(this.roadTextures)` for the parking-lot floor. The surrounding roads deliberately use a normal `MeshStandardMaterial` (`createRoadMaterial`).

### What it produces
Lit asphalt from texture maps, with potholes that look like real craters. Each crater has a chipped light/dark **lip**, a dark band **under the lip**, a **wall** lit by the dusk sun and the car's headlights, and a dark **floor**. The headlights also warm the road near the car.

### Why a custom shader
- The potholes are carved into the mesh on the CPU (`ParkingLevel.js` ~line 835 sets `position.z = -depth`, then calls `computeVertexNormals()`). A built-in material would shade them as a smooth dip. The shader **reads how deep each point is** and colours lip, wall and floor differently.
- It uses **procedural noise** so crater edges look fractured rather than like a painted circle. That isn't possible with a stock material.
- Lighting is driven by the **car's headlight position**, which is a gameplay value.

### Vertex shader
1. `vUv = uv` passes the texture coordinates on.
2. `vPotholeDepth = clamp(-position.z / 0.18, 0, 1)`. The road mesh is built flat and rotated, so **local −Z is "down"**. The CPU-carved depth is turned into 0 (flat road) to 1 (deepest point).
3. `vRoadNormal = normalize(mat3(modelMatrix) * normal)` rotates the real (CPU-computed) normal into **world space**.
4. `vDamage` combines two value-noise octaves of `position.xy` (one drifts very slowly with `uTime`).
5. A tiny displacement pushes the vertex down using `vDamage` and the displacement texture. It is scaled down inside potholes (`generalDisplacementScale`) so it doesn't push the crater through the ground.
6. `worldPosition = modelMatrix * vec4(damagedPosition, 1)` → `vWorldPosition`. Then `gl_Position = projectionMatrix * viewMatrix * worldPosition`.

### Fragment shader
1. Samples colour, roughness and normal textures at `vUv * vec2(12, 10)` (tiling). The normal map is unpacked with `* 2.0 - 1.0` (from [0,1] colour to a [−1,1] vector).
2. Builds `dryAsphalt`: a gamma-lifted texture colour plus "micro relief" from the normal map.
3. `headlight` = 1 near `uHeadlightPosition`, fading to 0 at `uHeadlightDistance` (13 m).
4. **Pothole layers**, all driven by `vPotholeDepth` with `smoothstep` bands:
   - `brokenLip` (depth ≈ 0.03–0.3), with its edges jittered by noise (`edgeOffset`) so they look chipped
   - `innerLip`, a dark band that makes the top surface look like it overhangs
   - `wallBand` (≈ 0.12–0.84)
   - `potholeCore`, the floor (≈ 0.54+)
5. **Custom lighting.** It takes the world normal, exaggerates its sideways part ×11 (`visualNormal`) so shallow walls still read, and does two Lambert-style `dot(N, L)` terms: a fixed **dusk sun direction** `(-0.79, 0.48, 0.35)` and the **headlight direction** `normalize(uHeadlightPosition - vWorldPosition)`. Walls facing away from both get darkened (`wallOcclusion`, which works like fake ambient occlusion).
6. Blends road → crater with `potholeMask`, adds a warm headlight tint, writes `gl_FragColor`.

### Important uniforms
| Uniform | Set by | Purpose |
|---|---|---|
| `uRoadTexture`, `uNormalTexture`, `uRoughnessTexture`, `uDisplacementTexture` | `createRoadTextures()` once | Real asphalt texture maps |
| `uTime` | `ParkingLevel` every frame (`+= dt`) | Slow drift of fine damage noise |
| `uHeadlightPosition` | `ParkingLevel` every frame: `car.localToWorld((0, 0.9, -2))` | Where the car's headlights are in world space |
| `uHeadlightDistance` | constant 13 | Headlight reach |
| `uRippleSlope`, `uPoolEdgeStart/End` | constants | Only used by the disabled puddle code (see warning) |

### Coordinate spaces
- `position`: **model/local space** (flat mesh, −Z = down)
- `modelMatrix`: local → **world** (used for `vWorldPosition` and normals)
- `viewMatrix`: world → **camera/view**
- `projectionMatrix`: view → **clip**
- Lighting is done in **world space**, which is why both the normal and the positions are converted to world.

> ⚠️ **Don't demo puddles on the asphalt.** The "EXISTING WATER" block (ripples, Fresnel, sky reflection) is computed but then forced off with `water = 0.0`. It only runs when the `POOL_COVERAGE_PROBE` define is set, which is a test tool (`parking/poolCoverage.js`) that measures puddle coverage. The water you see in game is **`potholeWaterShader.js`**. Also, `ShaderMaterial` does **not** receive Three.js scene lights or shadows. All the lighting on the lot is the shader's own dusk + headlight maths. Expect to be asked about this.

**Point at live:** drive at dusk towards a pothole. The crater wall facing the car brightens and the far wall stays dark. That's `headlightFacing` and `wallOcclusion` working.

---

## 2. `potholeWaterShader.js`: standing water in potholes (Level 1)

**Where:** `ParkingLevel.createPotholes()`. About 35% of potholes (`WATER_FILLED_FRACTION`) get a water disc mesh. All the discs share one material.

### What it produces
Murky, slightly animated water that reflects a blurred sky, is more reflective at shallow viewing angles, shows a sharp **glint from the car's headlights**, and fades softly at its edge.

### Why custom
A real reflection (rendering the scene again into a mirror) would be expensive. This **fakes** it cheaply: a procedural wave normal, Fresnel, a sky gradient picked by the reflected direction, and a Blinn-Phong highlight from the headlights.

### Vertex shader
- Custom **attribute** `edgeFactor`: built in JS (`ParkingLevel.js` ~line 269). The disc is a triangle fan with **centre vertex = 0** and **rim vertices = 1**. The rasteriser interpolates it, so in the fragment shader it means "how close to the edge am I".
- Computes `vWorldPosition` with `modelMatrix`, then `gl_Position = projectionMatrix * viewMatrix * worldPosition`.

### Fragment shader
1. **Moving normal:** three `sin` waves over world x/z plus `uTime`. Their derivatives (`cos`) give `slopeX`/`slopeZ`, so `waterNormal = normalize(-slopeX, 1, -slopeZ)`.
2. **Fresnel:** `viewDirection = normalize(cameraPosition - vWorldPosition)`, `facing = dot(N, V)`, `fresnel = (1 - facing)^2.2`.
3. **Sky reflection:** `reflect(-V, N)`, whose `.y` picks between horizon blue and upper-sky blue. That is then mixed 88% towards an average sky, which looks like a rough, blurred reflection.
4. Mixes deep dark water with sky by `0.30 + 0.16 * fresnel`.
5. **Murk:** sine-based dirt pattern plus more mud near the edge (`edgeMurk` from `vEdgeFactor`).
6. **Headlight glint (Blinn-Phong):** `H = normalize(L + V)`, `glint = max(dot(N, H), 0)^54`, fading with distance (2–18 m).
7. **Alpha:** about 0.78–0.86, fading only at the outer 6% of the disc (`vEdgeFactor` 0.94 → 1).

### Uniforms / attributes / varyings
| Name | Kind | Changes with |
|---|---|---|
| `uTime` | uniform | time (`ParkingLevel`, `+= dt` each frame) |
| `uHeadlightPosition` | uniform | car position every frame |
| `cameraPosition` | built-in uniform (Three.js) | camera movement |
| `edgeFactor` → `vEdgeFactor` | attribute → varying | fixed per vertex |
| `vWorldPosition` | varying | per pixel |

Material flags: `transparent: true`, `depthWrite: false` (so it doesn't hide things behind it in the depth buffer), `side: DoubleSide`.

**Point at live:** park the camera near a wet pothole and swing it around. The water gets lighter and bluer as you look across it at a low angle (Fresnel). Drive past it and a warm glint slides across the surface (Blinn-Phong half-vector from the headlights).

---

## 3. `potholeSplashShader.js`: splash particles (Level 1)

**Where:** `ParkingLevel.createPotholeSplashSystem()` makes **one `THREE.Points` object** with up to 192 particles (`POTHOLE_SPLASH_CAPACITY`). `triggerPotholeSplash()` fills free slots when the car hits a wet pothole. `updatePotholeSplashes(dt)` moves them every frame.

### What it produces
Short-lived water spray. High droplets are thin vertical streaks and low spray is flat and sideways. Each particle is shaped in the fragment shader rather than drawn as a square or a round "bubble".

### Why custom
`PointsMaterial` can only draw same-sized squares or a sprite texture. Here **every particle has its own size, alpha and stretch** (per-vertex attributes), and the shape is computed per pixel.

### Vertex shader
- **Attributes:** `aSize`, `aAlpha`, `aStretch` (custom, one float per particle), plus `position`.
- `viewPosition = modelViewMatrix * vec4(position, 1)` gives **view space**, so `-viewPosition.z` is the distance from the camera.
- `gl_PointSize = clamp(aSize * uPixelRatio * 6 / distance, 2, 22 * pixelRatio)` makes particles smaller further away, which is perspective size attenuation done by hand.
- `gl_Position = projectionMatrix * viewPosition`.
- Passes `vAlpha` and `vStretch` to the fragment shader.

### Fragment shader
- `gl_PointCoord` (0..1 inside the point square) is remapped to −1..1.
- Squashes or stretches that coordinate by `vStretch`. Below 1 gives a narrow tapered droplet, above 1 gives flat spray.
- `if (dot(p, p) > 1.0) discard;` cuts the square down to an ellipse.
- Soft edge with `smoothstep`, a thin pale highlight down one side, and colour between water-blue and a pale glint.
- Alpha = `vAlpha * softEdge`.

### CPU → GPU data flow
JS keeps `Float32Array`s (positions, velocities, ages, lifetimes, sizes, alphas, stretches). Each frame it applies drag, **gravity** (`POTHOLE_SPLASH_GRAVITY`) and position integration. It sets `alpha = fadeIn * (1 - progress)²` and marks the attributes `needsUpdate = true`. The buffers use `DynamicDrawUsage`.

**Point at live:** drive fast through a wet pothole.

---

## 4. `roadFogShader.js`: depth-based world-space fog (Levels 1 & 2)

**Where:** a `ShaderPass` in `Game.js`. Its composer's render target has a **`DepthTexture`** attached, so the depth of every pixel is available.

### What it produces
Sky-blue fog that is defined in **world space**, not just by distance from the camera:
- **Level 1 (radial mode):** fog grows with horizontal distance from a point near the lot `(0, -8)`. Start and end come from `roadFogConfig` and are scaled by the view-distance setting.
- **Level 2 (side + rear mode):** fog grows with distance sideways from the road centre (`|x|`) and behind the player (`-z`), whichever is stronger.
- A slowly drifting noise pattern breaks up the fog.

### Why custom
Three.js `scene.fog` only knows *distance from the camera*. We want fog that hides the edge of the world **in the shape of the playable area**, so we need each pixel's real world position.

### How it reconstructs world position (the key question)
```glsl
vec4 clip = vec4(vUv*2.0-1.0, depth*2.0-1.0, 1.0);  // screen uv + depth → NDC (-1..1)
vec4 view = uProjectionMatrixInverse * clip;          // undo projection
view /= view.w;                                       // undo perspective divide
vec3 world = (uCameraMatrixWorld * view).xyz;         // camera space → world (matrixWorld = inverse viewMatrix)
```
Pixels with `depth >= 0.99999` are the background or sky and are left untouched.

### Vertex / fragment split
- **Vertex:** just a full-screen quad, `vUv = uv`.
- **Fragment:** everything else. It samples the scene colour (`tDiffuse`) and depth (`tDepth`), reconstructs the world position, computes `fog` with `smoothstep(start, end, distance)`, multiplies by noise and `uDensity`, clamps to 0.98, then `mix(sceneColour, uFogColor, fog)`.

### Uniforms (all set every frame in `Game.render()`)
| Uniform | Value |
|---|---|
| `tDiffuse` | scene image (set automatically by `ShaderPass`) |
| `tDepth` | `roadFogComposer.readBuffer.depthTexture` |
| `uProjectionMatrixInverse` | `camera.projectionMatrixInverse` |
| `uCameraMatrixWorld` | `camera.matrixWorld` |
| `uRadialMode` | 1 for Level 1, 0 for Level 2 |
| `uFogCenterX/Z`, `uFogStart/End`, `uRearFogStart/End`, `uDensity` | per-level constants or config |
| `uTime` | `clock.elapsedTime` (drifts the noise) |

Fog is skipped in Level 1 sky view.

---

## 5. `suspicionShader.js`: suspicion post-process (Level 3)

**Where:** a `ShaderPass` in the Level 3 composer chain (`Game.js`).

### What it produces
As suspicion rises, the screen **loses colour** (up to 70% greyscale) and a **dark vignette** closes in from the edges (up to 55% darker). The player feels the pressure without looking at the meter.

### How gameplay drives it
`CheatingLevel` updates `this.suspicion` (0–100) with `updateSuspicionMeter(...)` based on the tutor's angle, distance, line of sight and whether you're peeking. Every frame `Game.render()` does:
```js
this.suspicionPass.uniforms.uSuspicion.value = clamp(currentLevel.suspicion / 100, 0, 1);
```
That one float uniform is the whole link between gameplay and the GPU.

### Fragment shader
1. `source = texture2D(tDiffuse, vUv)`
2. Luminance (Rec. 601 weights): `dot(rgb, vec3(0.299, 0.587, 0.114))`
3. `colour = mix(rgb, vec3(luminance), 0.7 * suspicion)` for desaturation
4. `vignette = smoothstep(0.26, 0.70, distance(vUv, 0.5))`
5. `colour *= 1 - vignette * 0.55 * suspicion`

The vertex shader is the standard full-screen quad. This is the simplest shader in the game and the best one to explain line by line.

**Point at live:** in Level 3, peek while the tutor is facing you. The screen greys and darkens at the edges as the meter climbs, then recovers as suspicion falls.

---

## 6. Bonus: `toonStyleShader.js` (all levels when effects are on)

Not listed in #243, but it runs on **every** level, so expect a question about it.
- Samples the pixel and its 4 neighbours (one texel apart, `1.0 / uResolution`). The sum of luminance differences gives an **edge** value, thresholded high so only big silhouettes count.
- Slightly lifts shadows, compresses highlights (`c / (1 + 0.1c)`, a mini tone-map), and adds a tiny warm-highlight / cool-shadow split.
- Darkens edges by only 3.5%. It's a subtle outline, not a heavy cartoon line.
- `uResolution` is set every frame from `renderer.getDrawingBufferSize()`.

**Demo trick:** the **Effects on/off** setting skips all the post-processing passes. Toggle it to show before and after.

---

## 7. Data flow summary

| Shader | Attributes (per vertex) | Uniforms that change at runtime | Driven by |
|---|---|---|---|
| Asphalt | `position`, `normal`, `uv` | `uTime`, `uHeadlightPosition` | car movement, time |
| Pothole water | `position`, `edgeFactor` | `uTime`, `uHeadlightPosition`, `cameraPosition` | car, camera, time |
| Splash | `position`, `aSize`, `aAlpha`, `aStretch` (rewritten each frame) | `uPixelRatio` (fixed) | car hitting wet potholes |
| Road fog | full-screen quad | depth texture, inverse projection, camera matrix, mode/config, `uTime` | camera, level, settings |
| Suspicion | full-screen quad | `uSuspicion` | tutor detection |
| Toon | full-screen quad | `uResolution` | window size |

---

## 8. Team questions: short answers

**What is a uniform?**
A value that is the **same for every vertex/pixel in one draw call**, set from JavaScript (`material.uniforms.uTime.value = ...`). Examples: `uTime`, `uHeadlightPosition`, `uSuspicion`, textures.

**What is an attribute?**
Per-vertex data stored in the geometry's buffers, read only by the **vertex shader**. Examples: `position`, `normal`, `uv`, and our custom `edgeFactor`, `aSize`, `aAlpha`, `aStretch`.

**What is a varying?**
An output of the vertex shader that the rasteriser **interpolates across the triangle** and passes to the fragment shader. Examples: `vUv`, `vWorldPosition`, `vPotholeDepth`, `vEdgeFactor`. (`edgeFactor` 0 at the centre and 1 at the rim becomes a smooth 0→1 gradient per pixel.)

**Vertex vs fragment shader?**
The vertex shader runs once per **vertex**: it positions geometry (writes `gl_Position`) and prepares varyings. The fragment shader runs once per **pixel covered**: it decides colour and alpha (writes `gl_FragColor`) and can `discard`. Our potholes are carved by the CPU, nudged in the vertex shader, and coloured in the fragment shader.

**What do `modelMatrix`, `viewMatrix`, `projectionMatrix` do?**
- `modelMatrix`: object/local space → **world** space (the object's position, rotation, scale)
- `viewMatrix`: world → **camera/view** space (the inverse of the camera's world transform)
- `projectionMatrix`: view → **clip** space (perspective or orthographic). The GPU then divides by `w` to get normalised device coordinates.
- `modelViewMatrix = viewMatrix * modelMatrix` (used in the splash and full-screen-quad shaders).

**Why does the water change with camera/view direction?**
Fresnel. `facing = dot(waterNormal, viewDirection)`. Looking straight down, `facing ≈ 1` and you see mostly the dark water. At a grazing angle `facing → 0`, so `(1 - facing)^2.2` grows and more sky is reflected. The reflected direction `reflect(-V, N)` also decides *which* part of the sky colour is used, and the headlight glint uses the half-vector `normalize(L + V)`, so it moves as the camera moves.

**How does the suspicion post-process receive the suspicion value?**
`CheatingLevel.suspicion` (0–100), then `Game.render()` divides by 100, clamps to 0–1, and writes `suspicionPass.uniforms.uSuspicion.value` every frame. The fragment shader uses it to scale desaturation and vignette strength.

**How does the fog shader use the depth texture to reconstruct world position?**
The scene is rendered into a target with a `DepthTexture`. For each pixel, screen uv and depth are mapped to NDC (−1..1), multiplied by the **inverse projection matrix**, divided by `w` (giving view space), then multiplied by the **camera's world matrix** (giving world space). The world x/z position then decides how foggy the pixel is.

---

## 9. Performance trade-offs (if asked)

- **Faked reflection** (Fresnel plus a sky gradient) instead of a real mirror or second render pass. Much cheaper.
- **Procedural hash noise** instead of extra noise textures. Costs some ALU work but no texture memory.
- **Splash:** one `Points` draw call for all 192 particles. Arrays are preallocated and reused (no per-frame allocation), and dead particles are moved to y = −1000 with alpha 0.
- **Water:** one shared material for all wet potholes. `depthWrite: false` avoids sorting artifacts with transparency.
- **Post-processing** runs per screen pixel, so its cost scales with resolution. The Effects and antialiasing settings let slow lab PCs turn it off.
- The fog needs an extra depth texture on the render target. The toon pass does 5 texture reads per pixel.
- The asphalt uses one `ShaderMaterial` instead of standard lighting, so it doesn't pay for scene lights or shadows (but also doesn't *receive* them).

---

## 10. Demo-day checklist

- [ ] Level 1: headlights lighting a pothole wall; the far wall dark (asphalt)
- [ ] Level 1: wet pothole Fresnel and glint while orbiting the camera (water)
- [ ] Level 1: drive through a wet pothole (splash)
- [ ] Level 1/2: fog hiding the world edge; mention world-space reconstruction (fog)
- [ ] Level 3: get spotted → screen greys and vignettes (suspicion)
- [ ] Toggle Effects off/on to show the post-processing passes
- [ ] Have `suspicionShader.js` open: it's the easiest to walk through line by line
