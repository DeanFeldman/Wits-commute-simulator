export function shouldShowLoadingIndicator(state) {
  if (state.isLoading) return true;
  if (state.levelLoadFailed || (!state.isLevelIntroActive && !state.isTutorialActive)) return false;
  if (state.currentLevelNumber === 1) return !state.levelOneGraphicsReady || (!state.staticParkingImagesReady && !state.staticParkingImageError);
  if (state.currentLevelNumber === 2) return !state.staticCrossingImageReady && !state.staticCrossingImageError;
  if (state.currentLevelNumber === 3) return !state.staticExamImageReady && !state.staticExamImageError;
  return false;
}

export function syncLoadingIndicator(indicator, container, loading) {
  indicator.hidden = !loading;
  container.setAttribute("aria-busy", String(loading));
}
