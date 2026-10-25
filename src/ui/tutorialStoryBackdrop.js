import { preloadStoryArm } from "./storyArmOverlay.js";
import { storyWatchFace } from "./storyWatchFace.js";

const requests = new WeakMap();

// Reuse the decoded story layers behind the static tutorial poster.
export async function applyTutorialStoryBackdrop(section, level, variant, backgroundReady) {
  const request = {};
  requests.set(section, request);
  section.style.backgroundImage = "none";
  const [background, arm] = await Promise.all([
    backgroundReady,
    preloadStoryArm(variant, level)
  ]);
  if (requests.get(section) !== request || !background) return;
  const layers = [];
  if (arm && level === 1) layers.push(storyWatchFace(variant));
  if (arm) layers.push(arm.currentSrc || arm.src);
  layers.push(background.currentSrc || background.src);
  section.style.backgroundImage = layers.map(src => `url("${src}")`).join(", ");
}
