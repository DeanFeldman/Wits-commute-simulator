import * as THREE from "three";
import { clamp, moveTowards } from "./math.js";

// Small arcade controller used by the player now and intended for traffic AI later.
export class VehicleController {
  constructor(object, options = {}) {
    this.object = object;
    this.speed = 0;
    this.steering = 0;
    this.maxForwardSpeed = options.maxForwardSpeed ?? 9;
    this.maxReverseSpeed = options.maxReverseSpeed ?? 4;
    this.acceleration = options.acceleration ?? 12;
    this.braking = options.braking ?? 18;
    this.coastDeceleration = options.coastDeceleration ?? 5;
    this.maxSteering = options.maxSteering ?? THREE.MathUtils.degToRad(32);
    this.steeringResponse = options.steeringResponse ?? 3.5;
    this.wheelBase = options.wheelBase ?? 2.7;
  }

  update(dt, input) {
    const throttle = clamp(input.throttle ?? 0, -1, 1);
    const steeringInput = clamp(input.steering ?? 0, -1, 1);
    const targetSpeed = throttle >= 0
      ? throttle * this.maxForwardSpeed
      : throttle * this.maxReverseSpeed;
    const slowingDown = Math.sign(targetSpeed) !== Math.sign(this.speed) || throttle === 0;
    this.speed = moveTowards(this.speed, targetSpeed, (slowingDown ? this.braking : this.acceleration) * dt);
    if (throttle === 0) this.speed = moveTowards(this.speed, 0, this.coastDeceleration * dt);

    const speedRatio = clamp(Math.abs(this.speed) / this.maxForwardSpeed, 0, 1);
    const steeringLimit = THREE.MathUtils.lerp(this.maxSteering, this.maxSteering * 0.42, speedRatio);
    this.steering = moveTowards(this.steering, steeringInput * steeringLimit, this.steeringResponse * dt);
    this.object.rotation.y += Math.tan(this.steering) * this.speed / this.wheelBase * dt;

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.object.quaternion);
    this.object.position.addScaledVector(forward, this.speed * dt);
  }

  followDirection(dt, direction, throttle = 1) {
    this.object.rotation.y = Math.atan2(-direction.x, -direction.z);
    const start = this.object.position.clone();
    this.update(dt, { throttle, steering: 0 });
    return this.object.position.distanceTo(start);
  }

  stop() {
    this.speed = 0;
    this.steering = 0;
  }
}