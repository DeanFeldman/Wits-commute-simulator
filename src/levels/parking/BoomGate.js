import * as THREE from "three";

// Animated gate prop; ParkingLevel handles its moving gate-line collision.
export class BoomGate {
  constructor({ x, z, inbound = false }) {
    this.x = x; this.z = z; this.inbound = inbound;
    this.state = inbound ? "closed" : "open"; this.angle = inbound ? 0 : Math.PI / 2; this.openTimer = 0;
    this.root = new THREE.Group();
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.25, 0.8), new THREE.MeshStandardMaterial({ color: 0xe6e1d4, roughness: 0.72 })); housing.position.set(-2.15, 0.625, 0);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.18, 0.88), new THREE.MeshStandardMaterial({ color: 0x174a78, roughness: 0.52 })); cap.position.set(-2.15, 1.3, 0);
    this.pivot = new THREE.Group(); this.pivot.position.set(-1.85, 1.25, 0);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(4.3, 0.14, 0.16), new THREE.MeshStandardMaterial({ color: 0xf4f1e7, roughness: 0.5 })); arm.position.x = 2.15;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.18), new THREE.MeshBasicMaterial({ color: 0xc93836 })); stripe.position.x = 2.8;
    this.pivot.add(arm, stripe); this.root.add(housing, cap, this.pivot); this.root.position.set(x, 0, z);
  }
  update(dt, car) {
    if (!this.inbound) return;
    const closeEnough = Math.abs(car.position.x - this.x) < 3.2 && car.position.z > this.z && car.position.z < this.z + 11;
    if (this.state === "closed" && closeEnough) this.state = "opening";
    if (this.state === "opening") { this.angle = Math.min(Math.PI / 2, this.angle + dt * 1.25); if (this.angle >= Math.PI / 2) { this.state = "open"; this.openTimer = 4; } }
    else if (this.state === "open") { this.openTimer -= dt; if (this.openTimer <= 0 && car.position.z < this.z - 3) this.state = "closing"; }
    else if (this.state === "closing") { this.angle = Math.max(0, this.angle - dt * 1.25); if (this.angle <= 0) this.state = "closed"; }
    this.pivot.rotation.z = this.angle;
  }
  blocksCrossing(previousPosition, car) {
    return this.inbound && this.angle < THREE.MathUtils.degToRad(68) && previousPosition.z > this.z && car.position.z <= this.z && Math.abs(car.position.x - this.x) < 2.35;
  }
}