import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowLoadingIndicator, syncLoadingIndicator } from "../src/ui/loadingIndicator.js";

const base = { isLoading: false, levelLoadFailed: false, isLevelIntroActive: false, isTutorialActive: false,
  currentLevelNumber: 1, levelOneGraphicsReady: true, staticParkingImagesReady: true, staticParkingImageError: false,
  staticCrossingImageReady: true, staticCrossingImageError: false, staticExamImageReady: true, staticExamImageError: false };
const pending = (changes) => shouldShowLoadingIndicator({ ...base, ...changes });

test("spinner only displays during an active loading flow", () => {
  assert.equal(pending({}), false);
  assert.equal(pending({ isLoading: true }), true);
  assert.equal(pending({ currentLevelNumber: 2, isTutorialActive: true, staticCrossingImageReady: false }), true);
  assert.equal(pending({ currentLevelNumber: 3, isLevelIntroActive: true, staticExamImageReady: false }), true);
  assert.equal(pending({ isLevelIntroActive: true, levelOneGraphicsReady: false }), true);
  assert.equal(pending({ isLevelIntroActive: true }), false);
  assert.equal(pending({ isTutorialActive: true, staticParkingImagesReady: false, staticParkingImageError: true }), false);
  assert.equal(pending({ isLoading: false, levelLoadFailed: true, isTutorialActive: true, staticParkingImagesReady: false }), false);
});

test("visibility and aria-busy follow loading state", () => {
  const indicator = { hidden: true };
  const attrs = new Map();
  const container = { setAttribute: (key, value) => attrs.set(key, value) };
  syncLoadingIndicator(indicator, container, true);
  assert.equal(indicator.hidden, false);
  assert.equal(attrs.get("aria-busy"), "true");
  syncLoadingIndicator(indicator, container, false);
  assert.equal(indicator.hidden, true);
  assert.equal(attrs.get("aria-busy"), "false");
});
