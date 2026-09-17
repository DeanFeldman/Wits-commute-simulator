// Fake pop-psychology quizzes and a CCDU-style time-management check-in.
// Nothing here is scored or saved — a quiz only requires a valid response
// (an option chosen, or non-blank text) to be considered "answered", and the
// answer itself is never written back into this file or kept anywhere.

export const QUIZ_BANK = [
  {
    id: "psych-procrastinator",
    giver: "psychQuizzer",
    title: "Quick Campus Psychology Check",
    intro: "Got a second? I'm doing an unofficial vibe check for my psych elective.",
    type: "choice",
    prompt: "A deadline is in 3 days. You are most likely to:",
    options: [
      "Start immediately and finish early",
      "Make a plan today, start tomorrow",
      "Start the night before, fuelled by Vida coffee",
      "What deadline?"
    ]
  },
  {
    id: "psych-stress-animal",
    giver: "psychQuizzer",
    title: "Quick Campus Psychology Check",
    intro: "One more — if stress was an animal, which one are you today?",
    type: "choice",
    prompt: "Pick your stress animal:",
    options: ["Startled meerkat", "Sleepy tortoise", "Caffeinated squirrel", "Unbothered cat"]
  },
  {
    id: "psych-decision-style",
    giver: "psychQuizzer",
    title: "Quick Campus Psychology Check",
    intro: "Last one, I promise — this is for the results section, I swear.",
    type: "choice",
    prompt: "When picking a lunch spot on campus, you:",
    options: [
      "Go to the same place every time",
      "Ask three group chats for opinions first",
      "Pick whatever queue is shortest",
      "Skip lunch, eat snacks in a lecture"
    ]
  },
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

// Picks a random quiz belonging to the given crowd `kind` (e.g. "psychQuizzer",
// "ccduAdvisor"). Returns null if that kind has no quizzes in the bank.
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