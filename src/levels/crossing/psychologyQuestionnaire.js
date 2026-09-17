// Deliberately vacuous questions for the Level 2 psychology-survey NPC.
// This module contains only form data and session selection; no response is
// scored, persisted, or interpreted anywhere in the game.
export const YES_NO_UNDECIDED_QUESTIONS = Object.freeze([
  "Have you experienced an emotion at any point in your life?",
  "When something bad happens to you, does it negatively affect your mood?",
  "Do you generally prefer feeling good over feeling bad?",
  "Have you ever felt tired after not sleeping enough?",
  "When you are angry, would you describe yourself as more angry than when you are not angry?",
  "Do stressful situations sometimes cause you to feel stressed?",
  "Have you ever changed your opinion after changing your mind?",
  "When somebody insults you, are you more likely to feel insulted?",
  "Do you sometimes think about things you are currently thinking about?",
  "Do you consider yourself to be a person?",
  "Have you ever wanted something that you did not currently have?",
  "Do you find difficult things harder than easy things?",
  "Have you ever remembered something that happened in the past?",
  "When you are confused, do you sometimes feel unsure?",
  "Do you notice when you become aware of something?",
  "Have you ever been surprised by something you were not expecting?",
  "When you are hungry, does eating usually make you less hungry?",
  "Do you behave differently in different situations?",
  "Have you ever made a decision after deciding what to do?",
  "Would you describe things you dislike as less preferable than things you like?"
].map((text, index) => Object.freeze({ id: `ynu-${index + 1}`, text, questionType: "yes-no-undecided", possibleAnswers: ["YES", "NO", "UNDECIDED"] })));

export const AGREE_DISAGREE_QUESTIONS = Object.freeze([
  "My experiences have, to some extent, affected my experience of things.",
  "Things that affect me emotionally tend to affect me emotionally.",
  "I tend to feel tired when I am extremely tired.",
  "I feel my strongest feelings more strongly than my weaker feelings.",
  "My personality generally resembles my personality.",
  "I sometimes think before, during, or after thinking.",
  "Situations I consider stressful tend to cause some degree of stress.",
  "I am sometimes aware of my own level of awareness.",
  "My mood changes when my mood changes.",
  "The answers I provide on questionnaires generally resemble the answers I selected."
].map((text, index) => Object.freeze({ id: `scale-${index + 1}`, text, questionType: "agree-disagree", possibleAnswers: Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) })));

function chooseUnique(pool, count, random = Math.random) {
  const remaining = [...pool];
  const chosen = [];
  while (chosen.length < count && remaining.length > 0) {
    const index = Math.floor(random() * remaining.length) % remaining.length;
    chosen.push(remaining.splice(index, 1)[0]);
  }
  return chosen;
}

// A fresh session is made every time the NPC starts the form. Responses stay
// in this short-lived object only and are discarded when the overlay closes.
export function createPsychologyQuestionnaireSession(random = Math.random) {
  const yesNoQuestions = chooseUnique(YES_NO_UNDECIDED_QUESTIONS, 3, random);
  const scaleQuestions = chooseUnique(AGREE_DISAGREE_QUESTIONS, 3, random);
  return {
    yesNoQuestions,
    scaleQuestions,
    questions: [...yesNoQuestions, ...scaleQuestions],
    responses: new Map()
  };
}

export function isQuestionnaireComplete(session) {
  return session.questions.every((question) => session.responses.has(question.id));
}
