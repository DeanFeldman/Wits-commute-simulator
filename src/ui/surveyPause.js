// Keep the open survey visible but non-interactive while the pause menu has focus.
export function syncSurveyPause(pauseMenu, quizRoot, paused) {
  const overSurvey = Boolean(paused && quizRoot && !quizRoot.hidden);
  pauseMenu.classList.toggle("over-survey", overSurvey);
  if (quizRoot) quizRoot.inert = overSurvey;
}
