export function shouldShowLoadingIndicator(state) {
  if (state.isLoading) return true;
  if (state.levelLoadFailed || (!state.isLevelIntroActive && !state.isTutorialActive)) return false;
  if (state.currentLevelNumber === 1) return !state.levelOneGraphicsReady || (!state.staticParkingImagesReady && !state.staticParkingImageError);
  if (state.currentLevelNumber === 2) return !state.staticCrossingImageReady && !state.staticCrossingImageError;
  if (state.currentLevelNumber === 3) return !state.staticExamImageReady && !state.staticExamImageError;
  return false;
}

export function loadingProgress(state) {
  if (!shouldShowLoadingIndicator(state)) return 100;
  if (state.isLoading) return state.currentLevel ? 40 : 10;
  return state.currentLevelNumber === 1 && !state.levelOneGraphicsReady ? 80 : 90;
}

export function syncLoadingIndicator(indicator, container, state) {
  const loading = shouldShowLoadingIndicator(state);
  indicator.hidden = !loading;
  container.setAttribute("aria-busy", String(loading));
  if (!loading) return;
  const progress = loadingProgress(state);
  indicator.querySelector("#loading-label").textContent = `Loading Level ${state.currentLevelNumber}…`;
  indicator.querySelector("#loading-progress-fill").style.width = `${progress}%`;
  indicator.querySelector("#loading-progress").setAttribute("aria-valuenow", String(progress));
}
