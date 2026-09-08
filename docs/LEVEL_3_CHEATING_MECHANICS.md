# Level 3 Cheating Mechanics Contract

Read this document before changing Level 3 cameras, desk placement, tablet targets, holograms, answer entry, tutor detection, or the zoom overlay. It records the current approved interaction and the assumptions that keep the mechanic understandable and playable.

The source of truth remains the code:

- `src/levels/CheatingLevel.js` owns the classroom, camera, tutor, targeting, zoom, answers, suspicion, timer, and Level 3 lifecycle.
- `src/core/Game.js` owns the Level 3 briefing and shared UI shell.
- `index.html` and `src/style.css` own the hand-zoom overlay markup and presentation.
- `test/cheating-level-balance.test.js` protects the important answer, suspicion, zoom, and patrol rules.

## Player Experience

The player is a seated student. There is no locomotion. The level is an observation-and-recall challenge rather than the old continuous hold-to-copy mechanic.

The current loop is:

```text
look around
    ↓
hold left click to zoom at an answer tablet
    ↓
read the revealed hologram word
    ↓
release zoom and look down at the player's paper
    ↓
type the word and press Enter
    ↓
repeat while managing tutor suspicion
```

The level briefing and HUD must tell the player that typing only works while looking down at their own desk. Do not restore Space as a copying action.

## Controls

| Input | Action |
| --- | --- |
| Mouse movement | Seated first-person look |
| Hold left mouse | Zoom at any time |
| Letter keys | Type while aiming at the player's paper |
| Backspace | Remove the last typed letter |
| Escape | Clear the current typed answer |
| Enter | Submit the typed answer |
| P | Pause and expose look-sensitivity settings |

Pointer lock is required for mouse-look and zoom. Losing pointer lock clears the held mouse state so the overlay and zoom cannot remain stuck on.

## Camera and Player Seat

- Normal field of view: `62` degrees.
- Zoomed field of view: `30` degrees.
- The field of view interpolates at `dt * 10` rather than snapping.
- Eye height: `1.09`, aligned approximately with the surrounding students' heads.
- Nominal player seat Z: `4`.
- Camera and player chair are moved `0.25` units toward the desk.
- Vertical look is clamped from `-0.65` to `0.45` radians.
- Look sensitivity comes from `Game.levelThreeLookSensitivity` and is adjustable in the pause menu.

Keep the camera seated and near-first-person. Level 3 must not gain walking controls or become a free-roaming classroom level.

## Desk and Tablet Layout

The classroom contains six rows of nine desks: 54 desks total. The player occupies one desk and uses a generated `YOUR ANSWER` paper. Every other desk receives the paper-tablet model.

Current counts:

- 1 player answer paper;
- 7 functional answer tablets;
- 46 decorative tablets with no answer interaction.

The functional neighbourhood is:

```text
X O X
X P X
X X X
```

- `P` is the player.
- `X` is a functional answer tablet.
- `O` is a decorative tablet.
- The bottom row is behind the player, including the functional tablet directly behind the player.

This gives the player three usable students on the left, three on the right, and one directly behind. Do not make all classroom tablets functional; the constrained neighbourhood is part of the seated observation challenge.

The tablet asset is:

```text
./assets/models/props/paper_tablet.glb
```

Runtime paths must remain relative. Tablets lie flat like paper on the desktop. If the model's source orientation changes, correct the transform in `createDeskTablet` rather than rotating individual desks.

## Targeting and Holograms

Targeting uses a ray cast from the centre of the active camera with a maximum interaction distance of `5.25` units.

- Zoom is allowed even when no tablet is targeted.
- A hologram is shown only when the player is both zooming and aiming at a functional tablet.
- Only the currently targeted tablet's hologram may be visible.
- A decorative tablet never produces a hologram.
- Looking at the player desk takes precedence as the typing surface.

Holograms are canvas-textured sprites. Their current placement and display size are deliberately compact so they remain below the top of the screen:

| Property | Value |
| --- | ---: |
| World Y | `0.94` |
| Width | `0.58` |
| Display height | `0.22` |

## Answer Lifecycle

Level 3 draws from 15 programming-themed words. The initial seven words are shuffled and unique across functional tablets.

When the player successfully aims and zooms at a functional tablet, that tablet's word becomes the current copied word. The player must then release zoom, look down at their own paper, type the word, and press Enter.

Submission rules:

- comparison ignores letter case and surrounding whitespace;
- typing is limited to 24 characters;
- an incorrect answer clears the input and awards no progress;
- a correct answer awards 20 percentage points;
- five correct answers complete the level;
- after a correct answer, that same tablet immediately receives a new word;
- the replacement word cannot equal the tablet's previous word or duplicate a word currently assigned to another functional tablet;
- copied state and typed input are cleared after success.

The player's paper texture updates while typing so the answer appears on the desk as well as in the HUD.

## Suspicion and Tutor Behaviour

Suspicion is tied to exposed peeking, not typing:

| State | Suspicion behaviour |
| --- | --- |
| Zooming at a functional tablet while seen | Increases by 30 per second |
| Zooming while unseen | Holds its current value |
| Not peeking | Decreases by 6 per second |

Reaching 100 suspicion fails the level. The timer starts at 75 seconds, and reaching zero also fails. Answer progress reaching 100 completes the level.

The tutor uses `WaypointMover` to patrol the front, centre aisle, side aisles, and rear of the room. At pauses, the tutor turns toward the player's side and sweeps their head. Detection combines distance, view angle, player peeking state, and raycast visibility. Substantial classroom geometry can block sight; chairs and nearby students are intentionally excluded so they do not make the player permanently safe.

## Hand-Zoom Overlay

Holding zoom displays a first-person pixel-art pair of hands forming a heart-shaped viewing frame:

```text
./assets/images/ui/level3-zoom-hands.png
```

Presentation contract:

- hand image opacity is `0.5`;
- the overlay fades in while rising from below the viewport;
- it fades out while returning downward off-screen;
- the red-dot reference point from the approved artwork is at 50% X and approximately 51.5% Y and must align with the viewport centre;
- the hands have a restrained 3.4-second sway using small translation, rotation, and scale changes;
- the sway pauses while the overlay is hidden;
- reduced-motion users receive a static centred image;
- the overlay sits below the HUD and top bar so instructions remain readable;
- the overlay is marked `hidden` in `index.html` before JavaScript starts, preventing a full-image flash during page refresh;
- `CheatingLevel.load()` removes the HTML hidden state only after Level 3 is ready;
- `CheatingLevel.dispose()` restores it so other levels and the menu cannot show the hands.

Keep the slide motion on the overlay container and the sway on the child image. Combining both transforms on one element causes the animations to overwrite one another.

## HUD and Feedback

The HUD shows:

- answer progress;
- suspicion;
- remaining time;
- a context-sensitive instruction;
- the typed answer line while the player is looking at their paper.

Context instructions should guide the next action: find a tablet, hold zoom, avoid the tutor, look down, type, and submit. Preserve this guidance when changing the mechanic; the desk-gated typing rule is not obvious without it.

## Performance and Lifecycle

- Student body parts are instanced rather than created as separate full characters.
- Tablet GLB visuals are cloned from one loaded template.
- Hologram canvases and textures are created during room setup, not in the update loop.
- The hidden overlay pauses its CSS animation.
- `dispose()` must remove mouse, keyboard, and pointer-lock listeners, hide the overlay, release pointer lock, dispose audio/background resources, and dispose the Level 3 scene graph.

## Known Issue

The suspicion-failure path currently calls `game.playAlertTone`, but `Game` does not define that method. This is separate from the mechanics rework and should be fixed before relying on the caught-state browser flow.

## Safe Editing Checklist

Before completing a Level 3 gameplay change:

1. Keep the player seated and preserve mouse-look.
2. Confirm there are exactly seven functional and 46 decorative tablets.
3. Confirm the tablet directly behind the player remains functional.
4. Check that zoom works without a target but holograms require a targeted functional tablet.
5. Check that only one hologram is visible at a time.
6. Peek at a word, release zoom, look down, type it, and submit it.
7. Confirm a correct answer rerolls only the answered tablet.
8. Confirm typing is ignored away from the player's paper.
9. Confirm suspicion increases only during detected peeking and decays after peeking stops.
10. Refresh the page and confirm the hand overlay does not flash.
11. Check hand-overlay centring, opacity, slide, sway, and HUD stacking.
12. Run `npm test` and `npm run build`.
13. Load all three levels and inspect the browser console.
