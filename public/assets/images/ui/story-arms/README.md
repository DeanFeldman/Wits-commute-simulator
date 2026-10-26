# Character arm overlays

Generated using the built-in image generation tool, with the attached car scene as the pose/style reference and rendered project character models as the outfit/skin reference.

`level1-background.png` is the clean shared car scene. The six character-named PNGs contain only the arm and watch, with real alpha transparency. The Level 1 story screen layers the selected character arm over this background. Missing or invalid selections default to Luca; Levels 2 and 3 use their existing artwork.

Place both images in the same positioned container, with identical width and height. Do not crop the transparent PNG to its visible arm bounds. Switch the foreground filename to select a character.

```html
<div class="story-art">
  <img src="./assets/images/ui/story-arms/level1-background.png" alt="Car beside a forest road">
  <img src="./assets/images/ui/story-arms/luca.png" alt="Luca checking the time">
</div>
```

```css
.story-art { position: relative; aspect-ratio: 1672 / 941; }
.story-art img { position: absolute; inset: 0; width: 100%; height: 100%; }
```

The base is 1672 × 941. Five overlays are 1672 × 941; Emma is 1670 × 941 and fills the identical display rectangle using the CSS above. Transparency and all six character switches were checked in the browser. A visual contact sheet and interactive selector are in `output/arm-overlays/`.

The initial full prompt set is recorded in `manifest.json`. Emma received a follow-up edit to expose the forearm beneath the rolled cuff and clean edge colors, preserving pose, scale, watch and transparency.



All six watch faces were edited with the built-in image generation tool to show 7:55: minute hand at 11, hour hand just before 8. Arm placement and transparent backgrounds were retained. Browser character-selection checks passed after replacement.

Precision revision: the game and interactive preview now add a vector watch-face layer above each PNG. The long hand is fixed at 330 degrees clockwise from 12 (exactly 11); the short hand is fixed at 237.5 degrees (just before 8, toward 7). The matching *-watch.svg files provide the same layer for standalone use. The PNG hand artwork is covered by this face, so use the face layer along with the arm.
