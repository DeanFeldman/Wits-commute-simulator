import * as THREE from "three";

export class GridHopController {
  constructor(object, options = {}) {
    this.object = object;
    this.cellSize = options.cellSize ?? 1;
    this.hopDuration = options.hopDuration ?? 0.16;
    this.hopHeight = options.hopHeight ?? 0.35;
    this.minX = options.minX ?? -Infinity;
    this.maxX = options.maxX ?? Infinity;
    this.minZ = options.minZ ?? -Infinity;
    this.maxZ = options.maxZ ?? Infinity;
    this.gridPosition = new THREE.Vector2(object.position.x, object.position.z);
    this.queue = [];
    this.hop = null;
    this.delayTimer = 0;
  }

  enqueue(direction) {
    if (this.queue.length < 4) this.queue.push(direction);
  }

  update(dt) {
    if (this.delayTimer > 0) {
      this.delayTimer = Math.max(0, this.delayTimer - dt);
      return null;
    }
    if (!this.hop && this.queue.length > 0) this.startHop(this.queue.shift());
    if (!this.hop) return null;

    this.hop.elapsed += dt;
    const progress = Math.min(this.hop.elapsed / this.hopDuration, 1);
    this.object.position.lerpVectors(this.hop.start, this.hop.end, progress);
    this.object.position.y = this.hop.baseY + Math.sin(progress * Math.PI) * this.hopHeight;
    if (progress < 1) return null;

    this.object.position.copy(this.hop.end);
    this.object.position.y = this.hop.baseY;
    const completedDirection = this.hop.direction;
    this.hop = null;
    return completedDirection;
  }

  startHop(direction) {
    const targetX = THREE.MathUtils.clamp(this.gridPosition.x + direction.x * this.cellSize, this.minX, this.maxX);
    const targetZ = THREE.MathUtils.clamp(this.gridPosition.y + direction.z * this.cellSize, this.minZ, this.maxZ);
    const moved = targetX !== this.gridPosition.x || targetZ !== this.gridPosition.y;
    if (!moved) return;

    const start = this.object.position.clone();
    const end = new THREE.Vector3(targetX, start.y, targetZ);
    this.gridPosition.set(targetX, targetZ);
    this.hop = { start, end, baseY: start.y, elapsed: 0, direction };
    this.object.rotation.y = Math.atan2(direction.x, direction.z);
  }

  delay(seconds) {
    this.delayTimer = Math.max(this.delayTimer, seconds);
  }

  reset(position) {
    this.queue.length = 0;
    this.hop = null;
    this.delayTimer = 0;
    this.gridPosition.set(position.x, position.z);
    this.object.position.set(position.x, position.y, position.z);
  }

  get hopProgress() {
    return this.hop ? Math.min(this.hop.elapsed / this.hopDuration, 1) : 0;
  }

  get isHopping() {
    return this.hop !== null;
  }
}