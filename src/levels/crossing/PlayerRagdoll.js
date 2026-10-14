import * as THREE from "three";

export const RAGDOLL_DURATION = 1.85;

// Short procedural ragdoll: ballistic flight, body spin and loose limbs.
// It uses the existing rig without an extra physics engine or colliders.
export class PlayerRagdoll {
  constructor(player, mixer = null) {
    this.player = player;
    this.mixer = mixer;
    this.elapsed = 0;
    this.velocity = new THREE.Vector3();
    this.vehiclePosition = new THREE.Vector3();
    this.offsetRotation = new THREE.Euler();
    this.offsetQuaternion = new THREE.Quaternion();
    this.originalRotation = player.quaternion.clone();
    this.originalTimeScale = mixer?.timeScale ?? 1;
    this.limbs = [];
    player.traverse((object) => {
      if (object.isBone && /(?:Left|Right)(?:Arm|ForeArm|UpLeg|Leg)$|Head$/.test(object.name)) {
        this.limbs.push({ object, rotation: object.quaternion.clone() });
      }
    });
    if (this.limbs.length === 0) {
      const rig = player.userData.rig;
      for (const object of [...(rig?.arms ?? []), ...(rig?.legs ?? [])]) {
        this.limbs.push({ object, rotation: object.quaternion.clone() });
      }
    }
  }

  launch(vehicle) {
    this.direction = vehicle.lane.direction < 0 ? -1 : 1;
    const speed = Math.abs(vehicle.controller?.speed ?? vehicle.cruiseSpeed ?? 5);
    vehicle.root.getWorldPosition(this.vehiclePosition);
    const sideways = this.player.position.z >= this.vehiclePosition.z ? 1 : -1;
    this.velocity.set(this.direction * THREE.MathUtils.clamp(speed * 1.1, 6, 11), 9, sideways * 1.8);
    this.floorY = this.player.position.y - 0.45;
    if (this.mixer) this.mixer.timeScale = 0;
    this.player.visible = true;
  }

  update(dt) {
    this.elapsed += dt;
    this.velocity.y -= 18 * dt;
    this.player.position.addScaledVector(this.velocity, dt);
    if (this.player.position.y <= this.floorY) {
      this.player.position.y = this.floorY;
      this.velocity.y = this.bounced ? 0 : Math.abs(this.velocity.y) * 0.2;
      this.bounced = true;
      const drag = Math.exp(-9 * dt);
      this.velocity.x *= drag;
      this.velocity.z *= drag;
    }
    if (!this.bounced) {
      this.player.rotation.x += dt * 2.8;
      this.player.rotation.z -= dt * this.direction * 7;
    } else {
      this.player.rotation.x = THREE.MathUtils.damp(this.player.rotation.x, 0, 12, dt);
      const target = -this.direction * Math.PI / 2;
      const angle = Math.atan2(Math.sin(target - this.player.rotation.z), Math.cos(target - this.player.rotation.z));
      this.player.rotation.z += angle * (1 - Math.exp(-12 * dt));
    }
    const flail = this.bounced ? Math.exp(-(this.elapsed - 1) * 6) : 1;
    for (let index = 0; index < this.limbs.length; index += 1) {
      const limb = this.limbs[index];
      const phase = this.elapsed * 11 + index * 1.9;
      this.offsetRotation.set(Math.sin(phase) * 0.85 * flail, 0, Math.cos(phase * 0.8) * 0.65 * flail);
      this.offsetQuaternion.setFromEuler(this.offsetRotation);
      limb.object.quaternion.copy(limb.rotation).multiply(this.offsetQuaternion);
    }
    return this.elapsed >= RAGDOLL_DURATION;
  }

  restore() {
    this.player.quaternion.copy(this.originalRotation);
    for (const limb of this.limbs) limb.object.quaternion.copy(limb.rotation);
    if (this.mixer) this.mixer.timeScale = this.originalTimeScale;
    this.player.visible = true;
  }
}
