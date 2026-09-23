// Shared vocabulary for "you failed, and here is why".
//
// Every level fails differently (condition meter, traffic hit, suspicion,
// timer), but the player always needs the same three things: what happened,
// why it happened, and what to do next. Levels supply that copy in their own
// words; this module owns the shape of it and the transient banner, so a
// respawn never happens without an explanation.
//
// Two destinations:
//   Game.showFailure()   - the run is over. The Game Over card reads the
//                          same three fields instead of one terse line.
//   Game.reportSetback() - the player respawns at a checkpoint and play
//                          continues, so a banner says so and clears itself.

const DEFAULT_TITLE = "Run ended";

// Levels may pass { title, reason, next } or a plain sentence. Anything
// missing renders as nothing at all, so a bare string still reads sensibly.
export function describeFailure(failure) {
  const details = typeof failure === "string" ? { reason: failure } : failure ?? {};
  return {
    title: String(details.title ?? DEFAULT_TITLE).trim() || DEFAULT_TITLE,
    reason: String(details.reason ?? "").trim(),
    next: String(details.next ?? "").trim()
  };
}

// The banner for a checkpoint respawn, e.g. Level 2 traffic hits. The level
// keeps running underneath it, so it never takes input and clears itself.
export class SetbackBanner {
  constructor(root = document) {
    this.element = root.querySelector("#setback-banner");
    this.titleElement = root.querySelector("#setback-title");
    this.reasonElement = root.querySelector("#setback-reason");
    this.nextElement = root.querySelector("#setback-next");
    this.hideTimer = null;
  }

  show(failure, holdMs) {
    if (!this.element) return;
    this.clearTimer();

    const { title, reason, next } = describeFailure(failure);
    this.titleElement.textContent = title;
    this.reasonElement.textContent = reason;
    this.nextElement.textContent = next;

    // Re-run the entry animation even when the banner is already up, so two
    // hits in a row do not look like one frozen card.
    this.element.hidden = true;
    void this.element.offsetWidth;
    this.element.hidden = false;

    this.hideTimer = window.setTimeout(() => this.hide(), holdMs);
  }

  hide() {
    this.clearTimer();
    if (this.element) this.element.hidden = true;
  }

  clearTimer() {
    if (this.hideTimer === null) return;
    window.clearTimeout(this.hideTimer);
    this.hideTimer = null;
  }
}
