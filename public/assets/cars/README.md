# Wits Commute Simulator — optimized vehicle pack

These files are prepared for efficient Three.js use in repeated parking/traffic scenes.

## What was changed

- Converted/exported to binary `.glb`.
- Removed source textures and most interior/detail geometry to reduce download size and draw cost.
- Replaced materials with lightweight vertex colours, so no texture files are required at runtime.
- Standardised the normal cars to roughly 4.4 world units long.
- Standardised orientation to `+Y = up`, `+Z = vehicle length`, with the vehicle grounded at `Y = 0`.
- Added two variants:
  - `*-game.glb`: roughly 17k–19k triangles for close/reachable parked cars.
  - `*-lite.glb`: roughly 5k triangles for distant parking and M1/background traffic.

The GLBs use ordinary glTF geometry and vertex colours; no Draco or Meshopt decoder is required.

## Recommended use

Use `game` versions only where the chase camera can get close to a vehicle. Use `lite` versions for the other parking lot, M1 traffic, and other background vehicles.

Load each unique GLB once with `GLTFLoader`, cache the loaded scene, and clone it for repeated placements. Do not reload a model for every parking bay and do not create models in `update()`.

`car-library-manifest.json` contains suggested collider sizes and random weights.

## Thomas note

The uploaded Diesel Powered Thomas asset was a Blender `.blend` file. The conversion environment does not contain Blender, so the included `diesel-thomas-proxy-*` files are lightweight procedural stand-ins, not a conversion of the original mesh. They are suitable for a rare Easter egg. Keep the original `.blend` if you later want to export the exact model from Blender.

## Licensing / credits

The uploaded archives did not include enough source/licence metadata for me to determine their licences. Keep the original asset download pages/licences and credit each third-party model in the game's credits screen.
