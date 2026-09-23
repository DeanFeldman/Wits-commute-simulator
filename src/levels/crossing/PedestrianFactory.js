import * as THREE from "three";

// Builds the low-poly Level 2 people: the player and every campus pedestrian.
//
// Geometry is shared by every person in every load (it is tiny and marked as a
// shared asset so disposeObject3D leaves it alone). Materials are cached per
// colour for one level load and are disposed with the level root.
const shared = (geometry) => {
  geometry.userData.sharedAsset = true;
  return geometry;
};

export const PEDESTRIAN_GEOMETRY = {
  body: shared(new THREE.CapsuleGeometry(0.29, 0.46, 5, 10)),
  head: shared(new THREE.SphereGeometry(0.23, 12, 10)),
  arm: shared(new THREE.CapsuleGeometry(0.07, 0.42, 4, 8)),
  leg: shared(new THREE.CapsuleGeometry(0.09, 0.45, 4, 8)),
  shoe: shared(new THREE.BoxGeometry(0.18, 0.11, 0.3)),
  hairShort: shared(new THREE.SphereGeometry(0.245, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52)),
  hairPuff: shared(new THREE.SphereGeometry(0.3, 12, 10)),
  bun: shared(new THREE.SphereGeometry(0.11, 8, 6)),
  capCrown: shared(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45)),
  capBrim: shared(new THREE.BoxGeometry(0.34, 0.03, 0.22)),
  backpack: shared(new THREE.BoxGeometry(0.44, 0.52, 0.2)),
  vest: shared(new THREE.CapsuleGeometry(0.305, 0.3, 4, 10)),
  phone: shared(new THREE.BoxGeometry(0.09, 0.16, 0.02))
};

export const SKIN_TONES = [0x5a3825, 0x7b4a2d, 0x9a6440, 0xb97857, 0xd29c78, 0xe7bf9d];
export const HAIR_STYLES = ["short", "puff", "bun", "cap", "none"];
// Distance from a pedestrian root to the bottom of the shoes before scaling.
export const PEDESTRIAN_SOLE_OFFSET = 0.935;

export class PedestrianFactory {
  // `createHeldCup(type)` returns a small cup model for people carrying coffee.
  constructor({ createHeldCup = null } = {}) {
    this.materials = new Map();
    this.createHeldCup = createHeldCup;
  }

  material(color, roughness = 0.82, extra = {}) {
    const key = `${color}:${roughness}:${JSON.stringify(extra)}`;
    if (!this.materials.has(key)) {
      this.materials.set(key, new THREE.MeshStandardMaterial({ color, roughness, ...extra }));
    }
    return this.materials.get(key);
  }

  create({
    shirt,
    trousers,
    skin = 0xb97857,
    hair = "short",
    hairColor = 0x1d1714,
    backpack = null,
    vest = false,
    holding = null,
    scale = 1
  }) {
    const pedestrian = new THREE.Group();
    const shirtMaterial = this.material(shirt, 0.78);
    const skinMaterial = this.material(skin, 0.86);
    const trouserMaterial = this.material(trousers, 0.9);
    const shoeMaterial = this.material(0x202328, 0.72);

    // Legs stay on the pedestrian; everything above the hips sits in `upper`
    // so the walk cycle can bob the torso without lifting the feet.
    const upper = new THREE.Group();
    pedestrian.add(upper);

    const body = new THREE.Mesh(PEDESTRIAN_GEOMETRY.body, shirtMaterial);
    body.position.y = 0.06;
    const head = new THREE.Mesh(PEDESTRIAN_GEOMETRY.head, skinMaterial);
    head.position.y = 0.72;
    upper.add(body, head);
    this.addHair(head, hair, hairColor);

    if (vest) {
      const hiVis = new THREE.Mesh(PEDESTRIAN_GEOMETRY.vest, this.material(0xd7ef2a, 0.6, { emissive: 0x2c3300 }));
      hiVis.position.y = 0.12;
      upper.add(hiVis);
    }
    if (backpack !== null) {
      const pack = new THREE.Mesh(PEDESTRIAN_GEOMETRY.backpack, this.material(backpack, 0.9));
      pack.position.set(0, 0.14, -0.3);
      upper.add(pack);
    }

    const arms = [];
    const legs = [];
    for (const side of [-1, 1]) {
      const armBone = new THREE.Group();
      armBone.position.set(side * 0.36, 0.3, 0);
      const arm = new THREE.Mesh(PEDESTRIAN_GEOMETRY.arm, shirtMaterial);
      arm.position.y = -0.23;
      armBone.add(arm);
      upper.add(armBone);
      arms.push(armBone);

      const legBone = new THREE.Group();
      legBone.position.set(side * 0.16, -0.33, 0);
      const leg = new THREE.Mesh(PEDESTRIAN_GEOMETRY.leg, trouserMaterial);
      leg.position.y = -0.27;
      // Shoes point along +Z, the direction the whole person faces.
      const shoe = new THREE.Mesh(PEDESTRIAN_GEOMETRY.shoe, shoeMaterial);
      shoe.position.set(0, -0.55, 0.06);
      legBone.add(leg, shoe);
      pedestrian.add(legBone);
      legs.push(legBone);
    }

    let heldItem = null;
    if (holding === "phone") {
      heldItem = new THREE.Mesh(PEDESTRIAN_GEOMETRY.phone, this.material(0x16181c, 0.35, { emissive: 0x1f3550 }));
      heldItem.position.set(0, -0.5, 0.1);
      heldItem.rotation.x = -0.9;
      arms[1].add(heldItem);
    } else if (holding && this.createHeldCup) {
      heldItem = this.createHeldCup(holding);
      heldItem.scale.setScalar(0.55);
      heldItem.position.set(0, -0.52, 0.08);
      arms[1].add(heldItem);
    }
    // A negative X rotation swings the hand forward, in front of the body.
    if (heldItem) arms[1].rotation.x = holding === "phone" ? -1.25 : -0.85;

    pedestrian.scale.setScalar(scale);
    pedestrian.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    pedestrian.userData.rig = { upper, body, head, arms, legs, heldItem, holding };
    return pedestrian;
  }

  addHair(head, style, color) {
    const material = this.material(color, 0.95);
    if (style === "short") {
      const hair = new THREE.Mesh(PEDESTRIAN_GEOMETRY.hairShort, material);
      hair.position.y = 0.02;
      head.add(hair);
    } else if (style === "puff") {
      const hair = new THREE.Mesh(PEDESTRIAN_GEOMETRY.hairPuff, material);
      hair.position.set(0, 0.1, -0.03);
      head.add(hair);
    } else if (style === "bun") {
      const hair = new THREE.Mesh(PEDESTRIAN_GEOMETRY.hairShort, material);
      hair.position.y = 0.02;
      const bun = new THREE.Mesh(PEDESTRIAN_GEOMETRY.bun, material);
      bun.position.set(0, 0.2, -0.16);
      head.add(hair, bun);
    } else if (style === "cap") {
      const capMaterial = this.material(color, 0.8);
      const crown = new THREE.Mesh(PEDESTRIAN_GEOMETRY.capCrown, capMaterial);
      crown.position.y = 0.03;
      const brim = new THREE.Mesh(PEDESTRIAN_GEOMETRY.capBrim, capMaterial);
      brim.position.set(0, 0.1, 0.2);
      head.add(crown, brim);
    }
  }
}

// Leg and arm swing for a walk cycle. `phase` is in radians; `amount` is 0..1.
//
// Explicitly zeroes arm rotation.z every frame (not just x). poseChase below
// is the only thing that ever sets rotation.z away from 0 (the "hands up"
// chase pose); zeroing it here — rather than only decaying it in the idle
// branch of CampusCrowd.animate — means a chase NPC's arms snap back onto
// the normal walk cycle the instant it starts walking away, instead of
// carrying a stuck sideways offset in on top of the walk swing.
export function poseWalk(rig, phase, amount) {
  const swing = Math.sin(phase) * 0.72 * amount;
  rig.legs[0].rotation.x = swing;
  rig.legs[1].rotation.x = -swing;
  rig.arms[0].rotation.x = -swing * 0.8;
  rig.arms[0].rotation.z = 0;
  if (!rig.holding) {
    rig.arms[1].rotation.x = swing * 0.8;
    rig.arms[1].rotation.z = 0;
  }
  // Two small torso bobs per stride, well under a centimetre of hop per step.
  rig.upper.position.y = Math.abs(Math.cos(phase)) * 0.035 * amount;
}

// Sprint pose used by a chase NPC (see CampusCrowd.updateChaser). Legs pump
// like a run; arms are thrown up into a fixed "hands up" shape rather than
// swinging at the sides, so the pose reads as "chasing you" at a glance
// instead of as a jogger. `amount` lets the pose ease down (e.g. once the
// NPC has caught the player and stops moving) without a hard cut.
export function poseChase(rig, phase, amount) {
  const swing = Math.sin(phase) * 0.95 * amount;
  rig.legs[0].rotation.x = swing;
  rig.legs[1].rotation.x = -swing;
  rig.arms[0].rotation.x = -2.6 + Math.sin(phase) * 0.2 * amount;
  rig.arms[1].rotation.x = -2.6 - Math.sin(phase) * 0.2 * amount;
  rig.arms[0].rotation.z = 0.32;
  rig.arms[1].rotation.z = -0.32;
  rig.upper.position.y = Math.abs(Math.cos(phase)) * 0.05 * amount;
  rig.upper.rotation.x = -0.18 * amount;
}