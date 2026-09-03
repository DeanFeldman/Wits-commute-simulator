# Asset Naming and Export Conventions

Follow these rules for every runtime model and texture. They keep assets predictable across Blender, Three.js, and the Linux deployment server.

## Runtime Asset Rules

- Store runtime files under `public/assets/`.
- Use lowercase, hyphen-separated filenames with no spaces: `wits-parking-sign.glb`.
- Use `.glb` only for runtime 3D models. Do not commit `.blend`, `.fbx`, `.obj`, or `.gltf` files unless the team has explicitly agreed they are needed as source files.
- Use relative asset paths in code, for example `./assets/models/vehicles/wits-taxi.glb`.
- Keep model and texture names descriptive; do not use `final`, `new`, or version numbers in filenames.

## Coordinate and Scale Convention

Every exported model must use the same scene convention:

| Property | Convention |
| --- | --- |
| Unit | 1 Blender unit = 1 metre |
| Runtime up axis | +Y |
| Model forward axis | +Z |
| Origin | Meaningful attachment point; ground-based objects use their base centre |
| Export transform | Location `(0, 0, 0)`, rotation `(0, 0, 0)`, scale `(1, 1, 1)` |

Model the object at real-world scale, apply transforms in Blender (`Ctrl+A` -> Rotation & Scale), and place the origin before exporting. Never compensate for a bad export with a permanent `rotation` or `scale` adjustment in a level file.

## Blender Export Checklist

Before export:

1. Set scene units to **Metric** with unit scale **1.0**.
2. Confirm the model is upright on +Y after export and faces +Z.
3. Apply rotation and scale; remove hidden test geometry and unused cameras/lights.
4. Use sensible material names and pack only textures the model needs.
5. Export **File -> Export -> glTF 2.0** with:
   - Format: **glTF Binary (`.glb`)**
   - Include: **Selected Objects**
   - Transform: **+Y Up enabled**
   - Geometry: **Apply Modifiers enabled**
   - Materials: **Export enabled**
   - Animation: disabled unless the asset needs it
6. Compress the exported `.glb` before adding it to `public/assets/`. Use the team-approved Meshopt or Draco workflow; compressed `.glb` is the only runtime model format.

Do not export a second copy with different axes or scale for a specific level. Fix the source model and re-export it.

## Texture Convention

- Use power-of-two dimensions: `256`, `512`, `1024`, or `2048` pixels per side.
- Use the smallest resolution that remains visually correct in-game; 4096-pixel textures need explicit team approval.
- Use `.jpg` or `.webp` for opaque colour textures, and `.png` only where alpha is required.
- Keep normal, roughness, metallic, and ambient-occlusion maps separate and clearly suffixed: `asphalt-normal.webp`, `asphalt-roughness.webp`.

## Reproducible Export Check

Before a new Blender workflow is used for production assets, two contributors must independently export the same test model:

1. Create a 1 m x 2 m x 3 m box named `export-convention-test`, with its base centred on the origin and its long face pointing +Z.
2. Export it using the checklist above to `public/assets/models/tests/export-convention-test.glb`.
3. Load each export at position `(0, 0, 0)` with rotation `(0, 0, 0)` and scale `(1, 1, 1)`.
4. Confirm both are upright, face +Z, rest on the ground, and have matching 1 x 2 x 3 m bounds.

If either export differs, stop using that workflow and correct the Blender setup before adding gameplay assets.

## Review Checklist

Before committing an asset, verify:

- filename and folder are correct;
- `.glb` is compressed;
- transforms are applied;
- texture dimensions are power-of-two;
- paths use exact filename case;
- third-party assets are recorded in `docs/ASSETS_AND_CREDITS.md`.
