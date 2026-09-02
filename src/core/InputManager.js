export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;

    this.keysDown = new Set();
    this.keysPressed = new Set();

    this.mouseDX = 0;
    this.mouseDY = 0;

    window.addEventListener("keydown", (event) => {
      if (!this.keysDown.has(event.code)) {
        this.keysPressed.add(event.code);
      }
      this.keysDown.add(event.code);

      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          event.code
        )
      ) {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keysDown.delete(event.code);
    });

    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement === this.domElement) {
        this.mouseDX += event.movementX;
        this.mouseDY += event.movementY;
      }
    });

    this.domElement.addEventListener("click", () => {
      if (document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock?.();
      }
    });
  }

  isDown(code) {
    return this.keysDown.has(code);
  }

  wasPressed(code) {
    return this.keysPressed.has(code);
  }

  consumeMouseDelta() {
    const delta = {
      x: this.mouseDX,
      y: this.mouseDY
    };

    this.mouseDX = 0;
    this.mouseDY = 0;

    return delta;
  }

  endFrame() {
    this.keysPressed.clear();
  }
}
