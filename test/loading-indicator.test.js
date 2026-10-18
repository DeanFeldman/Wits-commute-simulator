import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowLoadingIndicator, loadingProgress, syncLoadingIndicator } from "../src/ui/loadingIndicator.js";

const base = { isLoading: false, levelLoadFailed: false, isLevelIntroActive: false, isTutorialActive: false,
  currentLevelNumber: 1, levelOneGraphicsReady: true, staticParkingImagesReady: true, staticParkingImageError: false,
  staticCrossingImageReady: true, staticCrossingImageError: false, staticExamImageReady: true, staticExamImageError: false };
const pending = (changes) => shouldShowLoadingIndicator({ ...base, ...changes });

test("progress bar only displays during an active loading flow", () => {
  assert.equal(pending({}), false);
  assert.equal(pending({ isLoading: true }), true);
  assert.equal(pending({ currentLevelNumber: 2, isTutorialActive: true, staticCrossingImageReady: false }), true);
  assert.equal(pending({ currentLevelNumber: 3, isLevelIntroActive: true, staticExamImageReady: false }), true);
  assert.equal(pending({ isLevelIntroActive: true, levelOneGraphicsReady: false }), true);
  assert.equal(pending({ isLevelIntroActive: true }), false);
  assert.equal(pending({ isTutorialActive: true, staticParkingImagesReady: false, staticParkingImageError: true }), false);
  assert.equal(pending({ isLoading: false, levelLoadFailed: true, isTutorialActive: true, staticParkingImagesReady: false }), false);
});

test("bar advances through scene and tutorial milestones", () => {
  assert.equal(loadingProgress({ ...base, isLoading: true }), 10);
  assert.equal(loadingProgress({ ...base, isLoading: true, currentLevel: {} }), 40);
  assert.equal(loadingProgress({ ...base, isLevelIntroActive: true, levelOneGraphicsReady: false }), 80);
  assert.equal(loadingProgress({ ...base, isLevelIntroActive: true, staticParkingImagesReady: false }), 90);
  assert.equal(loadingProgress({ ...base, isTutorialActive: true, staticParkingImagesReady: true }), 100);
});

test("bar updates label, fill and accessibility while loading", () => {
  const label = { textContent: "" }, fill = { style: { width: "" } }, progressAttrs = new Map();
  const progress = { setAttribute: (key, value) => progressAttrs.set(key, value) };
  const nodes = { "#loading-label": label, "#loading-progress-fill": fill, "#loading-progress": progress };
  const indicator = { hidden: true, querySelector: (key) => nodes[key] };
  const attrs = new Map(), container = { setAttribute: (key, value) => attrs.set(key, value) };
  syncLoadingIndicator(indicator, container, { ...base, isLoading: true });
  assert.equal(indicator.hidden, false);
  assert.equal(attrs.get("aria-busy"), "true");
  assert.equal(label.textContent, "Loading Level 1…");
  assert.equal(fill.style.width, "10%");
  assert.equal(progressAttrs.get("aria-valuenow"), "10");
  syncLoadingIndicator(indicator, container, { ...base });
  assert.equal(indicator.hidden, true);
  assert.equal(attrs.get("aria-busy"), "false");
});
