import * as THREE from "three";

// Collectible Vida e Caffè cups for Level 2 and the power-ups they grant.
//
// Each cup type has its own sleeve and glow. Some cups also grant a temporary
// gameplay effect:
// - flatWhite:  route collectible only
// - doubleShot: walk faster for a few seconds
// - icedLatte:  traffic slows down for a few seconds
// - shield:     the next vehicle hit knocks you over instead of sending you back
export const CUP_TYPES = Object.freeze({
  flatWhite: Object.freeze({
    id: "flatWhite", label: "Flat White", sleeve: "#f1e6cf", ink: "#7a2320", glow: 0xffe7a8,
    duration: 0, blurb: "Route collectible"
  }),
  doubleShot: Object.freeze({
    id: "doubleShot", label: "Double Shot", sleeve: "#b8322d", ink: "#fff3e4", glow: 0xff7043,
    duration: 6, speedMultiplier: 1.65, blurb: "Caffeine rush: walk faster"
  }),
  icedLatte: Object.freeze({
    id: "icedLatte", label: "Iced Latte", sleeve: "#3a86c8", ink: "#eaf7ff", glow: 0x8fdcff,
    duration: 5, trafficScale: 0.4, blurb: "Chill: traffic slows down"
  }),
  shield: Object.freeze({
    id: "shield", label: "Red Cappuccino", sleeve: "#d9a526", ink: "#3b1d05", glow: 0xffd257,
    duration: 0, blurb: "Shield: survive one hit"
  })
});

export const CUP_SCORE = 25;
const PICKUP_RADIUS = 0.8;

// ---------------------------------------------------------------------------
// Placement

// Chooses where cups sit. `cells` is every reachable grid cell labelled with
// the strip type it lies in; `reserved` holds cells people stand on.
// The plan is authored (which kinds go where) and the seed picks the cells:
// - the VIDA plaza before Yale Road always offers a shield and an iced latte;
// - two flat whites sit out on Yale Road itself, as risk-for-reward;
// - double shots and flat whites are spread along the walk to the bridge.
export function planCupSpots({ cells, random, reserved = [], startZ }) {
  const isReserved = (cell) => reserved.some((spot) => Math.abs(spot.x - cell.x) < 0.1 && Math.abs(spot.z - cell.z) < 0.1);
  // Never on the spawn row or the row in front of it.
  const open = cells.filter((cell) => !isReserved(cell) && Math.abs(cell.z - startZ) > 1.3);
  const chosen = [];
  const requests = [
    { type: "shield", zones: ["bridge-exit"] },
    { type: "icedLatte", zones: ["bridge-exit"] },
    { type: "flatWhite", zones: ["yale-road"] },
    { type: "flatWhite", zones: ["yale-road"] },
    { type: "doubleShot", zones: ["start"] },
    { type: "doubleShot", zones: ["bridge"] },
    { type: "icedLatte", zones: ["bridge"] },
    { type: "flatWhite", zones: ["start", "bridge-entry"] },
    { type: "flatWhite", zones: ["bridge"] },
    { type: "flatWhite", zones: ["bridge"] },
    { type: "flatWhite", zones: ["finish"] }
  ];
  for (const request of requests) {
    const candidates = open.filter((cell) =>
      request.zones.includes(cell.zone)
      // Keep cups apart so each one is its own small decision.
      && chosen.every((spot) => Math.hypot(spot.x - cell.x, spot.z - cell.z) >= 2.3)
    );
    if (candidates.length === 0) continue;
    const cell = candidates[Math.floor(random() * candidates.length)];
    chosen.push({ x: cell.x, z: cell.z, type: request.type, zone: cell.zone });
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Power-up state (no Three.js here, so it is easy to test)

export class PowerUpState {
  constructor() {
    this.timers = { doubleShot: 0, icedLatte: 0 };
    this.shield = false;
    this.collected = 0;
  }

  apply(typeId) {
    const type = CUP_TYPES[typeId];
    if (!type) return null;
    this.collected += 1;
    if (type.duration > 0) this.timers[typeId] = type.duration;
    if (typeId === "shield") this.shield = true;
    return type;
  }

  update(dt) {
    for (const key of Object.keys(this.timers)) {
      this.timers[key] = Math.max(0, this.timers[key] - dt);
    }
  }

  consumeShield() {
    if (!this.shield) return false;
    this.shield = false;
    return true;
  }

  get speedMultiplier() {
    return this.timers.doubleShot > 0 ? CUP_TYPES.doubleShot.speedMultiplier : 1;
  }

  get trafficScale() {
    return this.timers.icedLatte > 0 ? CUP_TYPES.icedLatte.trafficScale : 1;
  }

  // Active effects for the HUD, as { type, fraction } (fraction of time left).
  get active() {
    const list = [];
    for (const [key, remaining] of Object.entries(this.timers)) {
      if (remaining > 0) list.push({ type: CUP_TYPES[key], remaining, fraction: remaining / CUP_TYPES[key].duration });
    }
    if (this.shield) list.push({ type: CUP_TYPES.shield, remaining: Infinity, fraction: 1 });
    return list;
  }
}

// ---------------------------------------------------------------------------
// Models

// Shared geometry and per-type materials for every cup in one level load.
export class CupModelKit {
  constructor() {
    this.geometry = {
      body: new THREE.CylinderGeometry(0.15, 0.11, 0.36, 18),
      sleeve: new THREE.CylinderGeometry(0.153, 0.126, 0.16, 18, 1, true),
      lid: new THREE.CylinderGeometry(0.168, 0.162, 0.045, 18),
      dome: new THREE.CylinderGeometry(0.08, 0.15, 0.045, 18),
      ring: new THREE.RingGeometry(0.42, 0.62, 36),
      beam: new THREE.CylinderGeometry(0.28, 0.5, 2.4, 20, 1, true)
    };
    this.cupMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f4ee, roughness: 0.55 });
    this.lidMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2522, roughness: 0.45 });
    this.sleeveMaterials = new Map();
    this.glowMaterials = new Map();
  }

  sleeveMaterial(typeId) {
    if (!this.sleeveMaterials.has(typeId)) {
      const type = CUP_TYPES[typeId];
      this.sleeveMaterials.set(typeId, new THREE.MeshStandardMaterial({
        map: createSleeveTexture(type),
        color: 0xffffff,
        roughness: 0.7
      }));
    }
    return this.sleeveMaterials.get(typeId);
  }

  glowMaterial(typeId, part = "ring") {
    const key = `${typeId}:${part}`;
    if (!this.glowMaterials.has(key)) {
      const material = new THREE.MeshBasicMaterial({
        color: CUP_TYPES[typeId].glow,
        transparent: true,
        opacity: part === "ring" ? 0.6 : 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });
      this.glowMaterials.set(key, material);
    }
    return this.glowMaterials.get(key);
  }

  // The cup itself: white body, printed sleeve and a dark lid.
  createCup(typeId) {
    const cup = new THREE.Group();
    cup.name = `vida-cup-${typeId}`;
    const body = new THREE.Mesh(this.geometry.body, this.cupMaterial);
    const sleeve = new THREE.Mesh(this.geometry.sleeve, this.sleeveMaterial(typeId));
    sleeve.position.y = -0.01;
    const lid = new THREE.Mesh(this.geometry.lid, this.lidMaterial);
    lid.position.y = 0.2;
    const dome = new THREE.Mesh(this.geometry.dome, this.lidMaterial);
    dome.position.y = 0.24;
    cup.add(body, sleeve, lid, dome);
    cup.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    return cup;
  }

  // A floating cup with a ground ring and a soft light beam above it.
  createPickup(typeId) {
    const pickup = new THREE.Group();
    pickup.name = `vida-pickup-${typeId}`;
    const cup = this.createCup(typeId);
    cup.scale.setScalar(1.8);
    const ring = new THREE.Mesh(this.geometry.ring, this.glowMaterial(typeId));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.24;
    const beam = new THREE.Mesh(this.geometry.beam, this.glowMaterial(typeId, "beam"));
    beam.position.y = 1.4;
    beam.renderOrder = 2;
    pickup.add(cup, ring, beam);
    pickup.userData = { cup, ring, beam };
    return pickup;
  }
}

function createSleeveTexture(type) {
  if (typeof document === "undefined") {
    const texture = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
    texture.needsUpdate = true;
    return texture;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.fillStyle = type.sleeve;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = type.ink;
  context.fillRect(0, 10, canvas.width, 6);
  context.fillRect(0, canvas.height - 16, canvas.width, 6);
  context.font = "bold 64px sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  // Printed twice so the logo is visible from any side of the cylinder.
  context.fillText("VIDA", canvas.width * 0.25, canvas.height / 2 + 3);
  context.fillText("VIDA", canvas.width * 0.75, canvas.height / 2 + 3);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.name = `vida-sleeve-${type.id}`;
  return texture;
}

// ---------------------------------------------------------------------------
// Runtime collection

export class VidaCups {
  constructor({ root, kit, groundY = 0 }) {
    this.root = root;
    this.kit = kit;
    this.groundY = groundY;
    this.cups = [];
    this.time = 0;
    this.bursts = createBurstPool(root, 4);
  }

  spawn(spots) {
    for (const spot of spots) this.add(spot.x, spot.z, spot.type);
  }

  add(x, z, typeId, { dropped = false } = {}) {
    const mesh = this.kit.createPickup(typeId);
    mesh.position.set(x, this.groundY, z);
    this.root.add(mesh);
    const cup = {
      x, z, type: CUP_TYPES[typeId], mesh, collected: false,
      phase: this.cups.length * 1.7,
      // A dropped cup pops up out of someone's hand before it settles.
      popTimer: dropped ? 0.5 : 0
    };
    this.cups.push(cup);
    return cup;
  }

  get remaining() {
    return this.cups.filter((cup) => !cup.collected).length;
  }

  get total() {
    return this.cups.length;
  }

  update(dt) {
    this.time += dt;
    for (const cup of this.cups) {
      if (cup.collected) continue;
      const { cup: model, ring, beam } = cup.mesh.userData;
      cup.popTimer = Math.max(0, cup.popTimer - dt);
      const pop = cup.popTimer > 0 ? Math.sin((1 - cup.popTimer / 0.5) * Math.PI) * 0.9 : 0;
      model.position.y = 0.72 + Math.sin(this.time * 2.6 + cup.phase) * 0.08 + pop;
      model.rotation.y += dt * 1.8;
      const pulse = 1 + Math.sin(this.time * 4 + cup.phase) * 0.08;
      ring.scale.set(pulse, pulse, pulse);
      beam.scale.set(1, 1 + Math.sin(this.time * 1.7 + cup.phase) * 0.06, 1);
    }
    updateBursts(this.bursts, dt);
  }

  // Returns the cup the player just walked through, if any.
  collectNear(position) {
    for (const cup of this.cups) {
      if (cup.collected || cup.popTimer > 0.2) continue;
      if (Math.hypot(cup.x - position.x, cup.z - position.z) > PICKUP_RADIUS) continue;
      cup.collected = true;
      cup.mesh.visible = false;
      emitBurst(this.bursts, cup.mesh.position, cup.type.glow);
      return cup;
    }
    return null;
  }
}

// Small reusable particle bursts; no geometry is created after load.
const BURST_SIZE = 28;

function createBurstPool(root, count) {
  const pool = [];
  for (let index = 0; index < count; index++) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(BURST_SIZE * 3), 3));
    const material = new THREE.PointsMaterial({
      size: 0.2,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const points = new THREE.Points(geometry, material);
    points.frustumCulled = false;
    points.visible = false;
    root.add(points);
    pool.push({ points, velocities: new Float32Array(BURST_SIZE * 3), life: 0 });
  }
  return pool;
}

function emitBurst(pool, origin, color) {
  const burst = pool.reduce((oldest, candidate) => (candidate.life < oldest.life ? candidate : oldest), pool[0]);
  const positions = burst.points.geometry.attributes.position.array;
  for (let index = 0; index < BURST_SIZE; index++) {
    const angle = (index / BURST_SIZE) * Math.PI * 2;
    const lift = 2.2 + ((index * 37) % 11) / 4;
    const spread = 1.6 + ((index * 17) % 7) / 5;
    positions[index * 3] = origin.x;
    positions[index * 3 + 1] = origin.y + 0.9;
    positions[index * 3 + 2] = origin.z;
    burst.velocities[index * 3] = Math.cos(angle) * spread;
    burst.velocities[index * 3 + 1] = lift;
    burst.velocities[index * 3 + 2] = Math.sin(angle) * spread;
  }
  burst.points.geometry.attributes.position.needsUpdate = true;
  burst.points.material.color.setHex(color);
  burst.points.visible = true;
  burst.life = 1;
}

function updateBursts(pool, dt) {
  for (const burst of pool) {
    if (burst.life <= 0) continue;
    burst.life = Math.max(0, burst.life - dt * 1.4);
    const positions = burst.points.geometry.attributes.position.array;
    for (let index = 0; index < BURST_SIZE; index++) {
      burst.velocities[index * 3 + 1] -= 7 * dt;
      positions[index * 3] += burst.velocities[index * 3] * dt;
      positions[index * 3 + 1] += burst.velocities[index * 3 + 1] * dt;
      positions[index * 3 + 2] += burst.velocities[index * 3 + 2] * dt;
    }
    burst.points.geometry.attributes.position.needsUpdate = true;
    burst.points.material.opacity = burst.life;
    burst.points.visible = burst.life > 0;
  }
}
