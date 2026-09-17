// A lightweight modal for Level 2's "someone stops you for a quiz" beats.
// Answers are read only to confirm they're valid (an option picked, or
// non-blank text) and are discarded as soon as the overlay closes — nothing
// is persisted anywhere.
import { isValidAnswer } from "./quizBank.js";

export class QuizOverlay {
  constructor() {
    this.root = document.querySelector("#quiz-overlay");
    this.titleEl = document.querySelector("#quiz-title");
    this.introEl = document.querySelector("#quiz-intro");
    this.promptEl = document.querySelector("#quiz-prompt");
    this.bodyEl = document.querySelector("#quiz-body");
    this.submitBtn = document.querySelector("#quiz-submit");
    this.errorEl = document.querySelector("#quiz-error");

    if (!this.root) {
      // Fails loudly rather than silently no-opping, so a missing
      // index.html section is obvious instead of "the quiz never opens".
      throw new Error("QuizOverlay: #quiz-overlay markup not found in index.html");
    }

    this.onComplete = null;
    this.selected = null;
    this.currentQuiz = null;

    this.boundTrySubmit = () => this.trySubmit();
    this.submitBtn.addEventListener("click", this.boundTrySubmit);
  }

  get isOpen() {
    return this.root && !this.root.hidden;
  }

  open(quiz, onComplete) {
    this.onComplete = onComplete;
    this.selected = null;
    this.errorEl.textContent = "";
    this.titleEl.textContent = quiz.title;
    this.introEl.textContent = quiz.intro;
    this.promptEl.textContent = quiz.prompt;
    this.bodyEl.innerHTML = "";

    if (quiz.type === "choice") {
      quiz.options.forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "quiz-option";
        button.textContent = option;
        button.addEventListener("click", () => {
          this.selected = option;
          this.bodyEl.querySelectorAll(".quiz-option").forEach((el) => el.classList.remove("selected"));
          button.classList.add("selected");
          this.errorEl.textContent = "";
        });
        this.bodyEl.appendChild(button);
      });
    } else {
      const textarea = document.createElement("textarea");
      textarea.id = "quiz-text-answer";
      textarea.placeholder = quiz.placeholder ?? "";
      textarea.rows = 3;
      this.bodyEl.appendChild(textarea);
    }

    this.currentQuiz = quiz;
    this.root.hidden = false;
  }

  trySubmit() {
    const quiz = this.currentQuiz;
    if (!quiz) return;
    const answer = quiz.type === "choice" ? this.selected : document.querySelector("#quiz-text-answer")?.value;
    const valid = isValidAnswer(quiz, answer);
    if (!valid) {
      this.errorEl.textContent = quiz.type === "choice" ? "Pick an option to continue." : "Just a sentence or two is fine!";
      return;
    }
    this.close();
    this.onComplete?.();
  }

  close() {
    this.root.hidden = true;
    this.currentQuiz = null;
    this.selected = null;
  }

  dispose() {
    this.submitBtn.removeEventListener("click", this.boundTrySubmit);
  }
}