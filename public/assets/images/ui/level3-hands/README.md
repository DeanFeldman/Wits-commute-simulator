# Individual Level 3 hand overlays

Each character has a separately generated, transparent 1774 × 887 PNG. Skin tone, shading, nail treatment and hand proportions are painted into each image. The game selects the PNG by the journey's selected character through `src/levels/level3/zoomHandSkin.js`, with Luca as fallback. No CSS colour filters are applied.

Generated with the built-in image generation tool, using the previously approved male/female hand artwork only as pose and style references. Exact prompts for each character are in `prompts.json`.

The viewing opening remains transparent. Existing per-character overlay opacity, slide, sway, HUD stacking and reduced-motion behaviour are retained. Browser validation checked all six unique file selections, no filters, initial hidden state and Luca fallback. Comparison: `output/arm-overlays/level3-skin-tones.png`.
