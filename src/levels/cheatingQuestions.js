// Level 3's questions are deliberately kept as plain data: a round uses the
// correct answer plus its six supplied distractors, then shuffles them.
const DISTRACTORS = Object.freeze({
  a: ["Africa", "Jupiter", "Bronze", "Dolphin", "Everest", "Mozart"],
  b: ["Sahara", "Saturn", "Granite", "Falcon", "Canada", "Copper"],
  c: ["Africa", "Mercury", "Bronze", "Everest", "Mozart", "Dolphin"],
  d: ["Brazil", "Jupiter", "Granite", "Falcon", "Sahara", "Oxygen"],
  e: ["Africa", "Saturn", "Copper", "Dolphin", "Everest", "Mozart"],
  f: ["Canada", "Mercury", "Granite", "Falcon", "Sahara", "Bronze"],
  g: ["Africa", "Jupiter", "Dolphin", "Mozart", "Copper", "Everest"],
  h: ["Sahara", "Saturn", "Falcon", "Bronze", "Canada", "Oxygen"]
});

const question = (prompt, correctAnswer, distractors) => ({
  prompt,
  correctAnswer,
  distractors: [...DISTRACTORS[distractors]]
});

export const QUESTION_BANK = Object.freeze([
  question("What structure uses LIFO ordering?", "Stack", "a"),
  question("What structure uses FIFO ordering?", "Queue", "b"),
  question("What language is known for indentation-based syntax?", "Python", "c"),
  question("What language commonly runs in web browsers?", "JavaScript", "d"),
  question("What language is commonly used to style webpages?", "CSS", "e"),
  question("What language structures webpage content?", "HTML", "f"),
  question("What stores a value in a program?", "Variable", "g"),
  question("What reusable block of code performs a task?", "Function", "h"),
  question("What repeats code multiple times?", "Loop", "c"),
  question("What represents a whole number?", "Integer", "d"),
  question("What represents text in programming?", "String", "e"),
  question("What represents true-or-false values?", "Boolean", "f"),
  question("What collection stores indexed values?", "Array", "g"),
  question("What is an error in software called?", "Bug", "b"),
  question("What is the process of fixing software errors?", "Debugging", "c"),
  question("What is a step-by-step solution called?", "Algorithm", "h"),
  question("What translates source code into machine code?", "Compiler", "a"),
  question("What executes code line-by-line?", "Interpreter", "b"),
  question("What stores organized information?", "Database", "e"),
  question("What language is commonly used to query databases?", "SQL", "h"),
  question("What system manages computer hardware and software?", "OS", "c"),
  question("What component executes computer instructions?", "CPU", "h"),
  question("What component primarily processes graphics?", "GPU", "a"),
  question("What temporary memory is used while programs run?", "RAM", "f"),
  question("What is a binary digit called?", "Bit", "e"),
  question("What contains eight bits?", "Byte", "b"),
  question("What numbering system uses only zero and one?", "Binary", "a"),
  question("What connects multiple computers together?", "Network", "h"),
  question("What device directs network traffic?", "Router", "c"),
  question("What device connects devices within a local network?", "Switch", "h"),
  question("What identifies a device on a network?", "IP", "e"),
  question("What translates domain names into IP addresses?", "DNS", "b"),
  question("What computer provides services to other computers?", "Server", "a"),
  question("What computer requests services from a server?", "Client", "b"),
  question("What tool tracks changes to source code?", "Git", "c"),
  question("What is a collection of project files called?", "Repository", "h"),
  question("What Git operation records a set of changes?", "Commit", "e"),
  question("What Git operation creates a separate development path?", "Branch", "b"),
  question("What Git operation combines development branches?", "Merge", "a"),
  question("What Git operation copies a remote repository?", "Clone", "b"),
  question("What stores the address of another value?", "Pointer", "c"),
  question("What occurs when a function calls itself?", "Recursion", "h"),
  question("What memory structure manages function calls?", "Stack", "a"),
  question("What protects data by making it unreadable?", "Encryption", "b"),
  question("What process confirms a user's identity?", "Authentication", "a"),
  question("What controls what an authenticated user can access?", "Authorization", "b"),
  question("What interface allows software systems to communicate?", "API", "c"),
  question("What small unit of execution exists inside a process?", "Thread", "h"),
  question("What search examines data one item at a time?", "Linear", "e"),
  question("What search repeatedly halves the search area?", "Binary", "b")
]);

export function normaliseAnswer(answer) {
  return String(answer ?? "").trim().toLowerCase();
}

export function validateQuestion(questionData) {
  const prompt = String(questionData?.prompt ?? "").trim();
  const correct = normaliseAnswer(questionData?.correctAnswer);
  const uniqueDistractors = new Set();

  for (const distractor of questionData?.distractors ?? []) {
    const normalised = normaliseAnswer(distractor);
    if (!normalised || normalised === correct || uniqueDistractors.has(normalised)) {
      return false;
    }
    uniqueDistractors.add(normalised);
  }

  return Boolean(prompt && correct && uniqueDistractors.size >= 6);
}

export function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function buildRoundAnswers(questionData) {
  const correct = questionData.correctAnswer.trim();
  const selectedDistractors = [];
  const used = new Set([normaliseAnswer(correct)]);

  for (const distractor of questionData.distractors) {
    const normalised = normaliseAnswer(distractor);
    if (normalised && !used.has(normalised)) {
      used.add(normalised);
      selectedDistractors.push(distractor.trim());
    }
    if (selectedDistractors.length === 6) break;
  }

  return shuffle([correct, ...selectedDistractors]);
}
