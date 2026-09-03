import * as THREE from "three";

export class WaypointMover {
  constructor(object, options) {
    this.object = object;
    this.points = options.points.map((point) => point.clone?.() ?? new THREE.Vector3(...point));
    this.speed = options.speed ?? 1;
    this.mode = options.mode ?? "loop";
    this.pauseAtNodes = options.pauseAtNodes ?? 0;
    this.teleportOnLoop = options.teleportOnLoop ?? false;
    this.index = options.startIndex ?? 1;
    this.pauseTimer = 0;
    this.finished = false;
    this.debugLine = this.createDebugLine(options.debugRoot, options.debugColor ?? 0x35e0d1);
  }

  update(dt, advance) {
    if (this.finished || this.points.length < 2) return { moved: false, arrived: false };
    if (this.pauseTimer > 0) {
      this.pauseTimer = Math.max(0, this.pauseTimer - dt);
      return { moved: false, arrived: false, paused: true };
    }
    const target = this.points[this.index];
    const offset = target.clone().sub(this.object.position);
    const distance = offset.length();
    if (distance > 0.001) {
      const direction = offset.normalize();
      const requested = Math.min(this.speed * dt, distance);
      const travelled = advance ? advance(direction, requested, dt) : requested;
      if (!advance) this.object.position.addScaledVector(direction, travelled);
      if (distance - travelled > 0.02) return { moved: travelled > 0, arrived: false };
    }
    this.object.position.copy(target);
    const reached = this.index;
    this.advance();
    this.pauseTimer = this.points[reached].pause ?? this.pauseAtNodes;
    return { moved: true, arrived: true, reached, looped: this.index === 0 };
  }

  pause(seconds) {
    this.pauseTimer = Math.max(this.pauseTimer, seconds);
  }

  reset(position = this.points[0], startIndex = 1) {
    this.object.position.copy(position);
    this.index = startIndex;
    this.pauseTimer = 0;
    this.finished = false;
  }

  setDebugVisible(visible) {
    if (this.debugLine) this.debugLine.visible = visible;
  }

  advance() {
    if (this.index < this.points.length - 1) {
      this.index += 1;
      return;
    }
    if (this.mode === "one-shot") {
      this.finished = true;
      return;
    }
    this.index = 0;
    if (this.teleportOnLoop) {
      this.object.position.copy(this.points[0]);
      this.index = 1;
    }
  }

  createDebugLine(root, color) {
    if (!root) return null;
    const points = this.mode === "loop" ? [...this.points, this.points[0]] : this.points;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color }));
    line.visible = false;
    root.add(line);
    return line;
  }
}
