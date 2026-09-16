import * as THREE from "three";

// HTML speech bubbles and floating pop-up text that follow 3D objects.
// Text stays crisp at any resolution, and nothing here touches the scene graph.
export class SpeechBubbles {
  constructor(parent = document.body) {
    this.layer = document.createElement("div");
    this.layer.className = "speech-layer";
    this.layer.setAttribute("aria-live", "polite");
    parent.appendChild(this.layer);
    this.bubbles = new Map();
    this.popups = [];
    this.projected = new THREE.Vector3();
  }

  // One bubble per speaker: a new line replaces whatever they were saying.
  say(target, text, { speaker = "", tone = "neutral", duration = 2.8, height = 1.35 } = {}) {
    let bubble = this.bubbles.get(target);
    if (!bubble) {
      const element = document.createElement("div");
      element.className = "speech-bubble";
      // The outer element is positioned every frame; the inner one animates.
      element.innerHTML = `<div class="speech-inner"><span class="speech-speaker"></span><span class="speech-text"></span></div>`;
      this.layer.appendChild(element);
      bubble = { element, target, height, life: 0 };
      this.bubbles.set(target, bubble);
    }
    bubble.element.dataset.tone = tone;
    bubble.element.querySelector(".speech-speaker").textContent = speaker;
    bubble.element.querySelector(".speech-speaker").hidden = speaker.length === 0;
    bubble.element.querySelector(".speech-text").textContent = text;
    bubble.height = height;
    bubble.life = duration;
    // Restart the pop-in animation.
    const inner = bubble.element.firstElementChild;
    inner.classList.remove("speech-bubble-in");
    void inner.offsetWidth;
    inner.classList.add("speech-bubble-in");
  }

  isSpeaking(target) {
    return (this.bubbles.get(target)?.life ?? 0) > 0;
  }

  // Short rising text at a world position, e.g. "+ DOUBLE SHOT".
  popup(position, text, color = "#ffffff") {
    const element = document.createElement("div");
    element.className = "world-popup";
    element.textContent = text;
    element.style.color = color;
    this.layer.appendChild(element);
    this.popups.push({ element, position: position.clone(), life: 1.3, age: 0 });
  }

  update(dt, camera, width, height) {
    for (const [target, bubble] of this.bubbles) {
      bubble.life -= dt;
      if (bubble.life <= 0) {
        bubble.element.remove();
        this.bubbles.delete(target);
        continue;
      }
      target.getWorldPosition(this.projected);
      this.projected.y += bubble.height;
      this.place(bubble.element, camera, width, height, Math.min(1, bubble.life / 0.25));
    }

    for (let index = this.popups.length - 1; index >= 0; index--) {
      const popup = this.popups[index];
      popup.age += dt;
      if (popup.age >= popup.life) {
        popup.element.remove();
        this.popups.splice(index, 1);
        continue;
      }
      this.projected.copy(popup.position);
      this.projected.y += 1.6 + popup.age * 1.2;
      this.place(popup.element, camera, width, height, 1 - Math.pow(popup.age / popup.life, 3));
    }
  }

  place(element, camera, width, height, opacity) {
    this.projected.project(camera);
    const visible = this.projected.z > -1 && this.projected.z < 1;
    element.style.display = visible ? "" : "none";
    if (!visible) return;
    const x = (this.projected.x * 0.5 + 0.5) * width;
    const y = (-this.projected.y * 0.5 + 0.5) * height;
    element.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    element.style.opacity = opacity.toFixed(2);
  }

  dispose() {
    this.layer.remove();
    this.bubbles.clear();
    this.popups.length = 0;
  }
}
