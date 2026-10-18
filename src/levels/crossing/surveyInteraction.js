// Surveys are one-shot per NPC; completed types are tracked for the whole run.
export function canStartSurvey(person, completedSurveys) {
  return (person?.kind === "psychQuizzer" || person?.kind === "ccduAdvisor")
    && !person.surveyAsked && !completedSurveys.has(person.kind) && person.surveyCooldown === 0;
}
