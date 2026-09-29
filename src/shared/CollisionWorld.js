import * as THREE from "three";

function beveledFootprintVertices(size, bevel = 0) {
  const halfWidth = size.x / 2;
  const halfLength = size.z / 2;
  const corner = Math.min(bevel, halfWidth, halfLength);

  if (corner <= 0) {
    return [
      [-halfWidth, -halfLength],
      [halfWidth, -halfLength],
      [halfWidth, halfLength],
      [-halfWidth, halfLength]
    ];
  }

  return [
    [-halfWidth + corner, -halfLength],
    [halfWidth - corner, -halfLength],
    [halfWidth, -halfLength + corner],
    [halfWidth, halfLength - corner],
    [halfWidth - corner, halfLength],
    [-halfWidth + corner, halfLength],
    [-halfWidth, halfLength - corner],
    [-halfWidth, -halfLength + corner]
  ];
}

export function createColliderDebugGeometry(size, bevel = 0) {
  if (bevel <= 0) {
    return new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z));
  }

  const footprint = beveledFootprintVertices(size, bevel);
  const positions = [];
  const addEdge = (from, to) => {
    positions.push(...from, ...to);
  };
  const bottom = footprint.map(([x, z]) => [x, -size.y / 2, z]);
  const top = footprint.map(([x, z]) => [x, size.y / 2, z]);

  for (let index = 0; index < footprint.length; index++) {
    const next = (index + 1) % footprint.length;
    addEdge(bottom[index], bottom[next]);
    addEdge(top[index], top[next]);
    addEdge(bottom[index], top[index]);
  }

  return new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
}

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

  add({ object, size, type = "aabb", color = 0xff4d6d, tag = "world", bevel = 0 }) {
    const collider = { object, size: new THREE.Vector3(...size), type, color, tag, bevel };
    this.colliders.push(collider);
    return collider;
  }

  rebuild() {
  this.cells.clear();

  for (const collider of this.colliders) {
    const [minX, maxX] = this.project(
      collider,
      new THREE.Vector2(1, 0)
    );
    const [minZ, maxZ] = this.project(
      collider,
      new THREE.Vector2(0, 1)
    );

    const minCellX = Math.floor(minX / this.cellSize);
    const maxCellX = Math.floor(maxX / this.cellSize);
    const minCellZ = Math.floor(minZ / this.cellSize);
    const maxCellZ = Math.floor(maxZ / this.cellSize);

    for (let x = minCellX; x <= maxCellX; x++) {
      for (let z = minCellZ; z <= maxCellZ; z++) {
        const key = `${x}:${z}`;
        const cell = this.cells.get(key) ?? [];
        cell.push(collider);
        this.cells.set(key, cell);
      }
    }
  }
}

  firstHit(object, size, filter = () => true, bevel = 0) {
    const subject = { object, size: new THREE.Vector3(...size), type: "obb", bevel };
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
    if (collider.bevel > 0) {
      const points = beveledFootprintVertices(collider.size, collider.bevel);
      return points.map(([x, z], index) => {
        const [nextX, nextZ] = points[(index + 1) % points.length];
        const edgeX = nextX - x;
        const edgeZ = nextZ - z;
        return new THREE.Vector2(
          Math.cos(angle) * -edgeZ + Math.sin(angle) * edgeX,
          -Math.sin(angle) * -edgeZ + Math.cos(angle) * edgeX
        ).normalize();
      });
    }
    return [new THREE.Vector2(Math.cos(angle), -Math.sin(angle)), new THREE.Vector2(Math.sin(angle), Math.cos(angle))];
  }

  project(collider, axis) {
    if (collider.bevel > 0) {
      const angle = collider.object.rotation.y;
      let minimum = Infinity;
      let maximum = -Infinity;
      for (const [x, z] of beveledFootprintVertices(collider.size, collider.bevel)) {
        const worldX = collider.object.position.x + Math.cos(angle) * x + Math.sin(angle) * z;
        const worldZ = collider.object.position.z - Math.sin(angle) * x + Math.cos(angle) * z;
        const projection = worldX * axis.x + worldZ * axis.y;
        minimum = Math.min(minimum, projection);
        maximum = Math.max(maximum, projection);
      }
      return [minimum, maximum];
    }
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
      const helper = new THREE.LineSegments(
        createColliderDebugGeometry(collider.size, collider.bevel),
        new THREE.LineBasicMaterial({ color: collider.color, transparent: true, opacity: 0.5, depthTest: false })
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
