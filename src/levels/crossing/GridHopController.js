import * as THREE from "three";
import { directionFromFacing } from "./firstPersonMovement.js";

// Moves the Level 2 pedestrian between discrete grid cells.
//
// The player still rests on grid cells (Level 2's identity is discrete steps),
// but a step is now a steady walk rather than an eased hop:
// - speed is constant, so holding a key chains cells into one smooth walk;
// - leftover distance at the end of a cell carries into the next one, so there
//   is no stop-start stutter between cells;
// - only the final cell of a walk slows down a little before stopping;
// - the body turns towards the walk direction instead of snapping.
export class GridHopController {
  constructor(object, options = {}) {
    this.object = object;
    this.cellSize = options.cellSize ?? 1;
    // `hopDuration` is kept for older callers: the time one cell takes.
    this.walkSpeed = options.walkSpeed ?? this.cellSize / (options.hopDuration ?? 0.16);
    this.minX = options.minX ?? -Infinity;
    this.maxX = options.maxX ?? Infinity;
    this.minZ = options.minZ ?? -Infinity;
    this.maxZ = options.maxZ ?? Infinity;
    this.canEnter = options.canEnter ?? (() => true);
    this.onBlocked = options.onBlocked ?? null;
    this.turnRate = options.turnRate ?? 16;
    this.gridPosition = new THREE.Vector2(object.position.x, object.position.z);
    this.gridOriginZ = options.gridOriginZ ?? object.position.z;
    this.queue = [];
    this.hop = null;
    this.bumpState = null;
    this.delayTimer = 0;
    this.heldDirection = null;
    this.speedMultiplier = 1;
    this.targetYaw = object.rotation.y;
    this.lockedFacingYaw = null; // First-person steering controls facing independently of grid movement.
    this.freeMovement = false;
    this.freeThrottle = 0;
    this.freeMoving = false;
    this.freeBlockCooldown = 0;
    // Total distance walked; the level drives the leg cycle from it so the
    // feet match the ground speed instead of sliding.
    this.distanceWalked = 0;
  }

  enqueue(direction) {
    if (this.queue.length < 2) this.queue.push(direction);
  }

  // The direction currently held down, or null. Used to keep walking.
  setHeldDirection(direction) {
    this.heldDirection = direction;
  }

  setFreeMovement(enabled) {
    if (this.freeMovement === enabled) return;
    this.freeMovement = enabled;
    this.freeThrottle = 0;
    this.freeMoving = false;
    this.freeBlockCooldown = 0;
    this.queue.length = 0;
    this.hop = null;
    this.bumpState = null;
    this.heldDirection = null;
    const { x, z } = this.object.position;
    this.gridPosition.set(enabled ? x : Math.round(x / this.cellSize) * this.cellSize,
      enabled ? z : this.gridOriginZ - Math.round((this.gridOriginZ - z) / this.cellSize) * this.cellSize);
  }

  update(dt) {
    if (this.freeMovement) {
      this.updateTurn(dt);
      return this.advanceFree(dt);
    }
    const landed = this.advance(dt);
    this.updateTurn(dt);
    return landed;
  }

  advanceFree(dt) {
    this.freeMoving = false;
    this.freeBlockCooldown = Math.max(0, this.freeBlockCooldown - dt);
    if (this.delayTimer > 0) {
      this.delayTimer = Math.max(0, this.delayTimer - dt);
      return null;
    }
    if (this.bumpState) {
      this.updateBump(dt);
      return null;
    }
    if (!this.freeThrottle) return null;
    const direction = directionFromFacing(this.object.rotation.y, this.freeThrottle < 0);
    const distance = this.walkSpeed * this.speedMultiplier * Math.max(0, dt);
    const count = Math.max(1, Math.ceil(distance / Math.min(0.2, this.cellSize / 5)));
    const step = distance / count;
    for (let i = 0; i < count; i++) {
      // Clamp the final partial step so the finish line and walkway edges are reachable.
      const x = THREE.MathUtils.clamp(this.object.position.x + direction.x * step, this.minX, this.maxX);
      const z = THREE.MathUtils.clamp(this.object.position.z + direction.z * step, this.minZ, this.maxZ);
      if ((x === this.object.position.x && z === this.object.position.z) || !this.canEnter(x, z)) {
        if (this.freeBlockCooldown === 0) {
          this.onBlocked?.(x, z, direction);
          this.freeBlockCooldown = 0.3;
        }
        break;
      }
      this.distanceWalked += Math.hypot(x - this.object.position.x, z - this.object.position.z);
      this.object.position.x = x;
      this.object.position.z = z;
      this.gridPosition.set(x, z);
      this.freeMoving = true;
    }
    return this.freeMoving ? direction : null;
  }

  advance(dt) {
    if (this.delayTimer > 0) {
      this.delayTimer = Math.max(0, this.delayTimer - dt);
      return null;
    }
    if (this.bumpState) {
      this.updateBump(dt);
      return null;
    }
    if (!this.hop) this.startNextHop();
    if (!this.hop) return null;

    let travel = this.walkSpeed * this.speedMultiplier * dt;
    let landed = null;
    while (this.hop && travel > 0) {
      const remaining = this.hop.length - this.hop.distance;
      // Ease out over the last part of a walk only when nothing follows it.
      const stopping = this.queue.length === 0 && !this.heldDirection;
      const step = stopping ? travel * THREE.MathUtils.clamp(remaining / 0.45 + 0.35, 0.35, 1) : travel;
      if (step < remaining) {
        this.hop.distance += step;
        this.distanceWalked += step;
        travel = 0;
        break;
      }
      this.hop.distance = this.hop.length;
      this.distanceWalked += remaining;
      travel = stopping ? 0 : travel - remaining;
      landed = this.hop.direction;
      this.object.position.copy(this.hop.end);
      this.hop = null;
      // A held key carries the leftover distance straight into the next cell.
      // The landing is still returned, so checkpoints see every cell.
      if (travel > 0) this.startNextHop();
    }
    if (this.hop) {
      const progress = this.hop.distance / this.hop.length;
      this.object.position.lerpVectors(this.hop.start, this.hop.end, progress);
    }
    return landed;
  }

  startNextHop() {
    const direction = this.queue.length > 0 ? this.queue.shift() : this.heldDirection;
    if (direction) this.startHop(direction);
  }

  startHop(direction) {
    const targetX = THREE.MathUtils.clamp(this.gridPosition.x + direction.x * this.cellSize, this.minX, this.maxX);
    const targetZ = THREE.MathUtils.clamp(this.gridPosition.y + direction.z * this.cellSize, this.minZ, this.maxZ);
    this.targetYaw = Math.atan2(direction.x, direction.z);
    const moved = targetX !== this.gridPosition.x || targetZ !== this.gridPosition.y;
    if (!moved) return;
    if (!this.canEnter(targetX, targetZ)) {
      // A blocked walk stops the queue so the player does not keep bumping.
      this.queue.length = 0;
      this.onBlocked?.(targetX, targetZ, direction);
      return;
    }

    const start = this.object.position.clone();
    const end = new THREE.Vector3(targetX, start.y, targetZ);
    this.gridPosition.set(targetX, targetZ);
    this.hop = { start, end, length: Math.max(start.distanceTo(end), 1e-6), distance: 0, direction };
  }

  // A short lean into the blocked cell and back, used when walking into a person.
  bump(direction, distance = 0.32, duration = 0.26) {
    if (this.hop || this.bumpState) return;
    this.bumpState = {
      origin: this.object.position.clone(),
      direction: new THREE.Vector3(direction.x, 0, direction.z).normalize(),
      distance,
      duration,
      elapsed: 0
    };
  }

  updateBump(dt) {
    const state = this.bumpState;
    state.elapsed += dt;
    const progress = Math.min(state.elapsed / state.duration, 1);
    // Fast push in, softer recoil back out.
    const offset = Math.sin(Math.pow(progress, 0.7) * Math.PI) * state.distance;
    this.object.position.copy(state.origin).addScaledVector(state.direction, offset);
    if (progress >= 1) {
      this.object.position.copy(state.origin);
      this.bumpState = null;
    }
  }

  updateTurn(dt) {
    const current = this.object.rotation.y;
    const yaw = this.lockedFacingYaw ?? this.targetYaw;
    const delta = Math.atan2(Math.sin(yaw - current), Math.cos(yaw - current));
    this.object.rotation.y = current + delta * (1 - Math.exp(-this.turnRate * dt));
  }

  delay(seconds) {
    this.delayTimer = Math.max(this.delayTimer, seconds);
  }

  reset(position) {
    this.queue.length = 0;
    this.hop = null;
    this.bumpState = null;
    this.delayTimer = 0;
    this.freeThrottle = 0;
    this.freeMoving = false;
    this.gridPosition.set(position.x, position.z);
    this.object.position.set(position.x, position.y, position.z);
  }

  get hopProgress() {
    return this.hop ? this.hop.distance / this.hop.length : 0;
  }

  get isHopping() {
    return this.hop !== null;
  }

  get isBumping() {
    return this.bumpState !== null;
  }
}
