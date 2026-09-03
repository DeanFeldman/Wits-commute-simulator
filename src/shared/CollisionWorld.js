import * as THREE from "three";

export class CollisionWorld {
  constructor(root, cellSize = 5) {
    this.root = root;
    this.cellSize = cellSize;
    this.colliders = [];
    this.cells = new Map();
    this.debugGroup = new THREE.Group();
    this.debugGroup.visible = false;
    root.add(this.debugGroup);
  }

  add({ object, size, type = "aabb", color = 0xff4d6d, tag = "world" }) {
    const collider = { object, size: new THREE.Vector3(...size), type, color, tag };
    this.colliders.push(collider);
    return collider;
  }

  rebuild() {
    this.cells.clear();
    for (const collider of this.colliders) {
      const key = this.cellKey(collider.object.position);
      const cell = this.cells.get(key) ?? [];
      cell.push(collider);
      this.cells.set(key, cell);
    }
  }

  firstHit(object, size, filter = () => true) {
    const subject = { object, size: new THREE.Vector3(...size), type: "obb" };
    for (const collider of this.nearby(object)) {
      if (filter(collider) && this.intersects(subject, collider)) return collider;
    }
    return null;
  }

  nearby(object) {
    const result = new Set();
    const x = Math.floor(object.position.x / this.cellSize);
    const z = Math.floor(object.position.z / this.cellSize);
    for (let ix = x - 1; ix <= x + 1; ix++) {
      for (let iz = z - 1; iz <= z + 1; iz++) {
        for (const collider of this.cells.get(`${ix}:${iz}`) ?? []) result.add(collider);
      }
    }
    return [...result];
  }

  intersects(a, b) {
    if (a.type === "aabb" && b.type === "aabb") return this.intersectsAABB(a, b);
    if (Math.abs(a.object.position.y - b.object.position.y) > (a.size.y + b.size.y) / 2) return false;
    for (const axis of [...this.axesFor(a), ...this.axesFor(b)]) {
      const [aMin, aMax] = this.project(a, axis);
      const [bMin, bMax] = this.project(b, axis);
      if (aMax < bMin || bMax < aMin) return false;
    }
    return true;
  }

  intersectsAABB(a, b) {
    return Math.abs(a.object.position.x - b.object.position.x) <= (a.size.x + b.size.x) / 2 &&
      Math.abs(a.object.position.y - b.object.position.y) <= (a.size.y + b.size.y) / 2 &&
      Math.abs(a.object.position.z - b.object.position.z) <= (a.size.z + b.size.z) / 2;
  }

  axesFor(collider) {
    const angle = collider.object.rotation.y;
    return [new THREE.Vector2(Math.cos(angle), -Math.sin(angle)), new THREE.Vector2(Math.sin(angle), Math.cos(angle))];
  }

  project(collider, axis) {
    const center = new THREE.Vector2(collider.object.position.x, collider.object.position.z).dot(axis);
    const [localX, localZ] = this.axesFor(collider);
    const radius = Math.abs(axis.dot(localX)) * collider.size.x / 2 + Math.abs(axis.dot(localZ)) * collider.size.z / 2;
    return [center - radius, center + radius];
  }

  setDebugVisible(visible) {
    this.debugGroup.visible = visible;
    if (!visible) return;
    this.debugGroup.clear();
    for (const collider of this.colliders) {
      const helper = new THREE.Mesh(
        new THREE.BoxGeometry(collider.size.x, collider.size.y, collider.size.z),
        new THREE.MeshBasicMaterial({ color: collider.color, transparent: true, opacity: 0.3, wireframe: true })
      );
      helper.position.copy(collider.object.position);
      helper.rotation.copy(collider.object.rotation);
      this.debugGroup.add(helper);
    }
  }

  cellKey(position) {
    return `${Math.floor(position.x / this.cellSize)}:${Math.floor(position.z / this.cellSize)}`;
  }
}