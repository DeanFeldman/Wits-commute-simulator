class ActionBindings {
  constructor(input, bindings) {
    this.input = input;
    this.bindings = new Map(
      Object.entries(bindings).map(([action, codes]) => [
        action,
        new Set(Array.isArray(codes) ? codes : [codes])
      ])
    );
    this.isDisposed = false;
  }

  isDown(action) {
    return this.matches(action, this.input.keysDown);
  }

  wasPressed(action) {
    return this.matches(action, this.input.keysPressed);
  }

  wasReleased(action) {
    return this.matches(action, this.input.keysReleased);
  }

  consumeBuffered(action, maxAge = 150) {
    const codes = this.bindings.get(action);

    if (!codes || this.isDisposed) {
      return false;
    }

    for (const code of codes) {
      if (this.input.consumeBuffered(code, maxAge)) {
        return true;
      }
    }

    return false;
  }

  matches(action, keys) {
    const codes = this.bindings.get(action);

    if (!codes || this.isDisposed) {
      return false;
    }

    for (const code of codes) {
      if (keys.has(code)) {
        return true;
      }
    }

    return false;
  }

  dispose() {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.input.unregisterBindings(this);
    this.bindings.clear();
  }
}

export class InputManager {
  constructor(domElement) {
    this.domElement = domElement;

    this.keysDown = new Set();
    this.keysPressed = new Set();
    this.keysReleased = new Set();
    this.bufferedKeys = new Map();
    this.bindingScopes = new Set();

    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDelta = { x: 0, y: 0 };

    this.preventDefaultKeys = new Set([
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Space"
    ]);

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.onCanvasClick = this.onCanvasClick.bind(this);

    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.domElement.addEventListener("click", this.onCanvasClick);
  }

  registerBindings(bindings) {
    const scope = new ActionBindings(this, bindings);
    this.bindingScopes.add(scope);
    return scope;
  }

  unregisterBindings(scope) {
    this.bindingScopes.delete(scope);
  }

  isDown(code) {
    return this.keysDown.has(code);
  }

  wasPressed(code) {
    return this.keysPressed.has(code);
  }

  wasReleased(code) {
    return this.keysReleased.has(code);
  }

  consumeBuffered(code, maxAge = 150) {
    const pressedAt = this.bufferedKeys.get(code);

    if (pressedAt === undefined) {
      return false;
    }

    this.bufferedKeys.delete(code);
    return performance.now() - pressedAt <= maxAge;
  }

  consumeMouseDelta() {
    const delta = this.mouseDelta;
    delta.x = this.mouseDX;
    delta.y = this.mouseDY;

    this.mouseDX = 0;
    this.mouseDY = 0;

    return delta;
  }

  isPointerLocked() {
    return document.pointerLockElement === this.domElement;
  }

  requestPointerLock() {
    if (!this.isPointerLocked()) {
      this.domElement.requestPointerLock?.();
    }
  }

  endFrame() {
    this.keysPressed.clear();
    this.keysReleased.clear();
  }

  dispose() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.domElement.removeEventListener("click", this.onCanvasClick);

    for (const scope of this.bindingScopes) {
      scope.isDisposed = true;
      scope.bindings.clear();
    }

    this.bindingScopes.clear();
    this.keysDown.clear();
    this.keysPressed.clear();
    this.keysReleased.clear();
    this.bufferedKeys.clear();
  }

  onKeyDown(event) {
    if (!this.keysDown.has(event.code)) {
      this.keysPressed.add(event.code);
      this.bufferedKeys.set(event.code, performance.now());
    }

    this.keysDown.add(event.code);

    if (this.preventDefaultKeys.has(event.code)) {
      event.preventDefault();
    }
  }

  onKeyUp(event) {
    if (this.keysDown.delete(event.code)) {
      this.keysReleased.add(event.code);
    }
  }

  onMouseMove(event) {
    if (this.isPointerLocked()) {
      this.mouseDX += event.movementX;
      this.mouseDY += event.movementY;
    }
  }

  onCanvasClick() {
    this.requestPointerLock();
  }
}
