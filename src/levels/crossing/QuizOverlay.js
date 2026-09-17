// A lightweight modal for Level 2's "someone stops you for a quiz" beats.
// Answers are read only to confirm they're valid (an option picked, or
// non-blank text) and are discarded as soon as the overlay closes — nothing
// is persisted anywhere.
import { isValidAnswer } from "./quizBank.js";
import {
  createPsychologyQuestionnaireSession,
  isQuestionnaireComplete
} from "./psychologyQuestionnaire.js";

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
    this.questionnaireSession = null;
    this.mode = null;

    this.boundTrySubmit = () => this.trySubmit();
    this.submitBtn.addEventListener("click", this.boundTrySubmit);
  }

  get isOpen() {
    return this.root && !this.root.hidden;
  }

  open(quiz, onComplete) {
    this.mode = "quiz";
    this.onComplete = onComplete;
    this.selected = null;
    this.errorEl.textContent = "";
    this.titleEl.textContent = quiz.title;
    this.introEl.textContent = quiz.intro;
    this.promptEl.textContent = quiz.prompt;
    this.bodyEl.innerHTML = "";
    this.bodyEl.className = "quiz-body";

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
    this.root.classList.remove("psychology-questionnaire-open");
    this.root.hidden = false;
  }

  openPsychologyQuestionnaire(random, onComplete) {
    this.mode = "psychology-questionnaire";
    this.onComplete = onComplete;
    this.currentQuiz = null;
    this.selected = null;
    this.questionnaireSession = createPsychologyQuestionnaireSession(random);
    // A survey is mouse-driven. Releasing pointer lock makes the system
    // cursor visible even if this overlay is opened from a locked camera.
    document.exitPointerLock?.();
    document.body.style.cursor = "default";
    this.root.classList.add("psychology-questionnaire-open");
    this.titleEl.hidden = true;
    this.introEl.hidden = true;
    this.promptEl.hidden = true;
    this.errorEl.textContent = "";
    this.submitBtn.textContent = "RETURN COMPLETED FORM";
    this.renderPsychologyQuestionnaire();
    this.root.hidden = false;
  }

  renderPsychologyQuestionnaire() {
    const session = this.questionnaireSession;
    this.bodyEl.innerHTML = "";
    this.bodyEl.className = "quiz-body psychology-questionnaire-body";
    const form = document.createElement("article");
    form.className = "psychology-form";
    form.innerHTML = `<header class="psychology-form-header"><p>UNIVERSITY DEPARTMENT OF BEHAVIOURAL STUDIES</p><h1>GENERAL PSYCHOLOGICAL RESPONSE INVENTORY</h1><p class="psychology-form-code">FORM PSY-04</p></header><p class="psychology-admin-copy">Participant responses will be processed according to departmental procedural guidelines.</p><div class="psychology-rule"></div><p class="psychology-instruction">Please indicate one response for each item. All fields are required.</p>`;
    form.appendChild(this.createQuestionSection("SECTION A — GENERAL RESPONSES", session.yesNoQuestions, (question) => {
      const choices = document.createElement("div");
      choices.className = "psychology-choices psychology-yes-no-choices";
      question.possibleAnswers.forEach((answer) => choices.appendChild(this.createAnswerButton(question, answer)));
      return choices;
    }));
    form.appendChild(this.createQuestionSection("SECTION B — RESPONSE SCALE", session.scaleQuestions, (question) => {
      const scale = document.createElement("div");
      scale.className = "psychology-scale";
      const labels = document.createElement("div");
      labels.className = "psychology-scale-labels";
      labels.innerHTML = "<span>STRONGLY DISAGREE</span><span>STRONGLY AGREE</span>";
      scale.appendChild(labels);
      const choices = document.createElement("div");
      choices.className = "psychology-choices psychology-scale-choices";
      question.possibleAnswers.forEach((answer) => choices.appendChild(this.createAnswerButton(question, answer)));
      scale.appendChild(choices);
      return scale;
    }));
    const footer = document.createElement("footer");
    footer.className = "psychology-form-footer";
    footer.textContent = "Form PSY-04 — Page 1 of 1";
    form.appendChild(footer);
    this.bodyEl.appendChild(form);
    this.updateQuestionnaireSubmitState();
  }

  createQuestionSection(title, questions, createChoices) {
    const section = document.createElement("section");
    section.className = "psychology-section";
    const heading = document.createElement("h2");
    heading.textContent = title;
    section.appendChild(heading);
    questions.forEach((question, index) => {
      const item = document.createElement("div");
      item.className = "psychology-question";
      const prompt = document.createElement("p");
      prompt.innerHTML = `<span class="psychology-question-number">${index + 1}.</span> ${question.text}`;
      item.appendChild(prompt);
      item.appendChild(createChoices(question));
      section.appendChild(item);
    });
    return section;
  }

  createAnswerButton(question, answer) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "psychology-answer";
    button.textContent = answer;
    button.addEventListener("click", () => {
      this.questionnaireSession.responses.set(question.id, answer);
      button.parentElement.querySelectorAll(".psychology-answer").forEach((choice) => choice.classList.remove("pencil-circled"));
      button.classList.add("pencil-circled");
      this.errorEl.textContent = "";
      this.updateQuestionnaireSubmitState();
    });
    return button;
  }

  updateQuestionnaireSubmitState() {
    const complete = isQuestionnaireComplete(this.questionnaireSession);
    this.submitBtn.disabled = !complete;
    this.submitBtn.title = complete ? "" : "PLEASE COMPLETE ALL REQUIRED FIELDS.";
  }

  trySubmit() {
    if (this.mode === "psychology-questionnaire") {
      if (!isQuestionnaireComplete(this.questionnaireSession)) {
        this.errorEl.textContent = "PLEASE COMPLETE ALL REQUIRED FIELDS.";
        return;
      }
      this.close();
      this.onComplete?.();
      return;
    }
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
    this.root.classList.remove("psychology-questionnaire-open");
    this.titleEl.hidden = false;
    this.introEl.hidden = false;
    this.promptEl.hidden = false;
    this.submitBtn.textContent = "Submit";
    this.submitBtn.disabled = false;
    this.submitBtn.title = "";
    document.body.style.cursor = "";
    this.currentQuiz = null;
    this.selected = null;
    this.questionnaireSession = null;
    this.mode = null;
  }

  dispose() {
    this.submitBtn.removeEventListener("click", this.boundTrySubmit);
  }
}
