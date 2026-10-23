import { ACHIEVEMENTS } from "../shared/Achievements.js";

export class AchievementsUI {
  constructor(achievements) {
    this.achievements = achievements;
    this.dialog = document.createElement("dialog");
    this.dialog.className = "achievements-dialog";
    this.dialog.setAttribute("aria-labelledby", "achievements-title");
    this.dialog.innerHTML = `
      <div class="achievements-sheet">
        <header class="achievements-heading">
          <div><p class="achievements-kicker">AT WITS END / STUDENT RECORD</p>
          <h1 id="achievements-title">Achievements</h1></div>
          <form method="dialog"><button class="achievements-close" aria-label="Close achievements">×</button></form>
        </header>
        <div class="achievements-summary"></div>
        <div class="achievements-grid"></div>
        <footer class="achievements-footer"><p data-achievements-storage></p>
          <form method="dialog"><button class="achievements-back">Back to menu</button></form>
        </footer>
      </div>`;
    this.dialog.addEventListener("click", (event) => {
      if (event.target === this.dialog) this.dialog.close();
    });
    this.dialog.addEventListener("close", () => this.returnFocus?.focus());
    this.toast = document.createElement("div");
    this.toast.className = "achievement-toast";
    this.toast.setAttribute("role", "status");
    this.toast.setAttribute("aria-live", "polite");
    this.toast.hidden = true;
    document.body.append(this.dialog, this.toast);
    this.queue = [];
    this.toastTimer = null;
  }

  render() {
    const count = ACHIEVEMENTS.filter(({ id }) => this.achievements.unlocked[id]).length;
    this.dialog.querySelector(".achievements-summary").innerHTML = `
      <div><strong>${count} / ${ACHIEVEMENTS.length}</strong><span> badges earned</span></div>
      <progress value="${count}" max="${ACHIEVEMENTS.length}" aria-label="Achievements earned"></progress>`;
    this.dialog.querySelector(".achievements-grid").innerHTML = ACHIEVEMENTS.map((entry) => {
      const earned = Boolean(this.achievements.unlocked[entry.id]);
      const secret = entry.hidden && !earned;
      return `<article class="achievement-card ${earned ? "is-earned" : "is-locked"}">
        <div class="achievement-badge" aria-hidden="true">${secret ? "?" : entry.number}</div>
        <div class="achievement-details"><p class="achievement-category">${secret ? "RESULT WITHHELD" : entry.label}</p>
          <h2>${secret ? "Hidden achievement" : entry.title}</h2>
          <p>${secret ? "There’s more than one way for this commute to end." : entry.description}</p>
          <span class="achievement-stamp">${earned ? "PASSED" : "LOCKED"}</span>
        </div></article>`;
    }).join("");
    this.dialog.querySelector("[data-achievements-storage]").textContent = this.achievements.storageAvailable
      ? "Earn badges in a full journey. Progress is saved in this browser."
      : "Earn badges in a full journey. Browser saving is unavailable; progress lasts for this session.";
  }

  show() {
    this.returnFocus = document.activeElement;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
  }

  notify(achievement) {
    this.queue.push(achievement);
    if (this.dialog.open) this.render();
    if (!this.toastTimer) this.showNextToast();
  }

  showNextToast() {
    const achievement = this.queue.shift();
    if (!achievement) {
      this.toast.hidden = true;
      this.toastTimer = null;
      return;
    }
    this.toast.replaceChildren();
    const label = document.createElement("span");
    label.textContent = "ACHIEVEMENT UNLOCKED";
    const title = document.createElement("strong");
    title.textContent = achievement.title;
    this.toast.append(label, title);
    this.toast.hidden = false;
    this.toastTimer = setTimeout(() => this.showNextToast(), 4500);
  }
}
