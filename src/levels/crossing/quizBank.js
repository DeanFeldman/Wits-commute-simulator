// CCDU-style time-management check-ins. The psychology-survey NPC uses the
// printed questionnaire data in psychologyQuestionnaire.js instead.
// Nothing here is scored or saved — a quiz only requires a valid response
// (an option chosen, or non-blank text) to be considered "answered", and the
// answer itself is never written back into this file or kept anywhere.

export const QUIZ_BANK = [
  {
    id: "ccdu-time-management",
    giver: "ccduAdvisor",
    title: "CCDU Wellness Check-In",
    intro: "Hi! Quick one from CCDU — we're asking students how they manage their time this week.",
    type: "text",
    prompt: "In your own words, how do you manage your time day-to-day?",
    placeholder: "e.g. I use a planner and block out study time in the mornings…",
    minLength: 5
  },
  {
    id: "ccdu-stress-coping",
    giver: "ccduAdvisor",
    title: "CCDU Wellness Check-In",
    intro: "Thanks for stopping — one more from us.",
    type: "text",
    prompt: "What's one thing that helps you cope when campus life gets stressful?",
    placeholder: "e.g. I take a walk around campus or call a friend…",
    minLength: 5
  }
];

// Picks a random quiz belonging to the given crowd kind. Returns null if that
// kind has no quick quiz in the bank.
export function pickQuiz(giverKind, random) {
  const pool = QUIZ_BANK.filter((quiz) => quiz.giver === giverKind);
  if (pool.length === 0) return null;
  return pool[Math.floor(random() * pool.length) % pool.length];
}

// Pure validity check, shared by QuizOverlay and the test suite. `answer` is
// the selected option string for a "choice" quiz, or the raw text for a
// "text" quiz. Never mutates `quiz` or reads/writes any outside state.
export function isValidAnswer(quiz, answer) {
  if (quiz.type === "choice") {
    return typeof answer === "string" && quiz.options.includes(answer);
  }
  if (quiz.type === "text") {
    return typeof answer === "string" && answer.trim().length >= (quiz.minLength ?? 1);
  }
  return false;
}
