const ACTIVATION_DURATION = 0.5;
const EXIT_DURATION = 0.6;

function smoothstep(value, start, end) {
  const t = Math.max(0, Math.min(1, (value - start) / (end - start)));
  return t * t * (3 - 2 * t);
}

// Double Shot Screen Effect: radial speed lines for the player's coffee boost.
// Gameplay's remaining time is authoritative; these ages only animate the
// pickup pulse and exit fade. Unscaled level dt keeps them out of slow motion.
export class DoubleShotScreenEffect {
  constructor(root) {
    this.root = root;
    this.linesA = root?.querySelector(".double-shot-lines--a");
    this.linesB = root?.querySelector(".double-shot-lines--b");
    this.phase = 0;
    this.activationAge = ACTIVATION_DURATION;
    this.exitAge = EXIT_DURATION;
    this.reveal = 0;
    this.active = false;
    this.fadingOut = false;
  }

  activate() {
    if (!this.root) return;
    // A refreshed pickup replays the pulse without dropping existing lines.
    this.activationAge = 0;
    this.exitAge = 0;
    this.active = true;
    this.fadingOut = false;
    this.root.hidden = false;
  }

  update(dt, remaining) {
    if (!this.root) return;
    if (remaining > 0 && !this.active) this.activate();
    if (remaining <= 0 && this.active) {
      this.active = false;
      this.fadingOut = true;
      this.exitAge = 0;
    }
    if (!this.active && !this.fadingOut) return;

    this.phase += dt;
    this.activationAge += dt;
    this.reveal = Math.min(1, this.reveal + dt / 0.08);
    if (this.fadingOut) this.exitAge += dt;
    const fade = this.fadingOut ? 1 - smoothstep(this.exitAge, 0.1, EXIT_DURATION) : 1;
    const pulse = Math.sin(Math.PI * smoothstep(this.activationAge, 0, ACTIVATION_DURATION));
    const intensity = this.reveal * (0.36 + pulse * 0.39 + Math.sin(this.phase * 2.1) * 0.025) * fade;
    // Two overlapping layers expand and drift at different rates; only the
    // outer border contains streaks, even during the activation peak.
    const exitScale = this.fadingOut ? this.exitAge * 0.18 : 0;
    const scaleA = 1.025 + Math.sin(this.phase * 4) * 0.025 + exitScale;
    const scaleB = 1.025 + Math.sin(this.phase * 3.1 + 2) * 0.035 + exitScale;
    this.linesA.style.opacity = String(intensity);
    this.linesB.style.opacity = String(intensity * 0.52);
    this.linesA.style.transform = "scale(" + scaleA + ") rotate(" + Math.sin(this.phase * 1.8) * 0.45 + "deg)";
    this.linesB.style.transform = "scale(" + scaleB + ") rotate(" + (-0.35 - Math.sin(this.phase * 1.4) * 0.4) + "deg)";
    if (this.fadingOut && this.exitAge >= EXIT_DURATION) this.reset();
  }

  reset() {
    this.active = false;
    this.fadingOut = false;
    this.reveal = 0;
    this.phase = 0;
    if (this.root) this.root.hidden = true;
    if (this.linesA) this.linesA.style.opacity = "0";
    if (this.linesB) this.linesB.style.opacity = "0";
  }

  dispose() {
    this.reset();
  }
}
