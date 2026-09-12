import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

// Files in public/ are served from Vite's configured relative base. Keep this
// relative so the deployed game also works from a subdirectory.
const BASE_PATH = "./assets/cars/";
const TARGET_LENGTH = 4.2;
const PARKING_PACK_FILE = "generic-passenger-car-pack.glb";
export const PLAYER_CAR_MODEL_PATH = "./assets/models/vehicles/car-scene.glb";
const PLAYER_CAR_PROP_NAMES = new Set([
  "chest_base",
  "wheel_004",
  "wheel_005",
  "shadowplane",
  "vintage_lantern_7_base"
]);

// The source pack stores each vehicle as five consecutive RootNode children:
// four wheel assemblies and one body assembly (or the body followed by wheels).
// Keeping these definitions here lets Level 1 reuse one downloaded GLB while
// still cloning only the selected vehicle, rather than the entire nine-car pack.
export const PARKING_CAR_SPECS = Object.freeze([
  { id: "pack-compact", name: "Compact", packBodyChild: 4, packRootChildren: [0, 1, 2, 3, 4], collider: [2.0, 1.55, 4.5] },
  {
    id: "pack-coupe",
    name: "Coupe",
    packBodyChild: 5,
    packForwardAxis: "x",
    // Its mesh geometry is baked 17.657 degrees off the node's local X axis.
    packHeadingOffset: -THREE.MathUtils.degToRad(17.657),
    packRootChildren: [5, 6, 7, 8, 9],
    collider: [2.05, 1.45, 4.5]
  },
  { id: "pack-hatchback", name: "Hatchback", packBodyChild: 10, packRootChildren: [10, 11, 12, 13, 14], collider: [2.0, 1.65, 4.5] },
  { id: "pack-minivan", name: "Minivan", packBodyChild: 16, packRootChildren: [15, 16, 17, 18, 19], collider: [2.1, 1.9, 4.5] },
  { id: "pack-offroad", name: "Off-road", packBodyChild: 21, packRootChildren: [20, 21, 22, 23, 24], collider: [2.15, 1.85, 4.5] },
  { id: "pack-pickup", name: "Pickup", packBodyChild: 26, packRootChildren: [25, 26, 27, 28, 29], collider: [2.15, 1.85, 4.5] },
  { id: "pack-sedan", name: "Sedan", packBodyChild: 30, packRootChildren: [30, 31, 32, 33, 34], collider: [2.05, 1.55, 4.5] },
  { id: "pack-sport", name: "Sport", packBodyChild: 39, packRootChildren: [35, 36, 37, 38, 39], collider: [2.05, 1.35, 4.5] },
  { id: "pack-suv", name: "SUV", packBodyChild: 41, packRootChildren: [40, 41, 42, 43, 44], collider: [2.15, 1.9, 4.5] },
  { id: "pack-wagon", name: "Wagon", packBodyChild: 45, packRootChildren: [45, 46, 47, 48, 49], collider: [2.05, 1.65, 4.5] }
].map((spec) => Object.freeze({ ...spec, packRootChildren: Object.freeze(spec.packRootChildren) })));

export const CAR_SPECS = Object.freeze([
  {
    id: "aston",
    name: "2008 Aston Martin V8 Vantage GT2",
    game: "aston-game.glb",
    lite: "aston-lite.glb",
    collider: [2.0, 1.35, 4.5],
    randomWeight: 1
  },
  {
    id: "byd",
    name: "2024 BYD Atto 2",
    game: "byd-game.glb",
    lite: "byd-lite.glb",
    collider: [2.15, 1.75, 4.5],
    randomWeight: 1
  },
  {
    id: "honda",
    name: "Honda Accord 11th Gen",
    game: "honda-game.glb",
    lite: "honda-lite.glb",
    collider: [1.95, 1.4, 4.5],
    randomWeight: 1
  },
  {
    id: "nissan",
    name: "2020 Nissan GT-R50",
    game: "nissan-game.glb",
    lite: "nissan-lite.glb",
    collider: [1.95, 1.35, 4.5],
    randomWeight: 1
  },
  {
    id: "vw",
    name: "2022 Volkswagen Saveiro 1.6 Robust",
    game: "vw-game.glb",
    lite: "vw-lite.glb",
    collider: [2.1, 1.95, 4.5],
    randomWeight: 1
  },
  {
    id: "diesel-thomas-proxy",
    name: "Diesel Powered Thomas (proxy)",
    game: "diesel-thomas-proxy-game.glb",
    lite: "diesel-thomas-proxy-lite.glb",
    collider: [2.0, 2.1, 3.9],
    randomWeight: 0.01
  }
]);

const loader = new GLTFLoader();
const prototypeCache = new Map();
let parkingPackPromise = null;
let playerCarPrototypePromise = null;

function preserveSharedVehicleResources(scene) {
  scene.traverse((child) => {
    if (!child.isMesh) return;
    if (child.geometry) child.geometry.userData.sharedAsset = true;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) {
      if (material) material.userData.sharedAsset = true;
    }
  });
}

// SkeletonUtils is safe for rigid models too, and prevents a future animated or
// skinned vehicle from sharing bone bindings with another instance.
export function cloneVehicleHierarchy(prototype) {
  return SkeletonUtils.clone(prototype);
}

function normalizeVehicleModel(scene) {
  scene.updateMatrixWorld(true);

  const originalBounds = new THREE.Box3().setFromObject(scene);
  const originalSize = originalBounds.getSize(new THREE.Vector3());
  const longestHorizontal = Math.max(originalSize.x, originalSize.z);

  if (longestHorizontal > 0.001) {
    scene.scale.setScalar(TARGET_LENGTH / longestHorizontal);
  }

  scene.updateMatrixWorld(true);
  const scaledBounds = new THREE.Box3().setFromObject(scene);
  const center = scaledBounds.getCenter(new THREE.Vector3());

  // The holder owns world position and rotation. The prototype is centred and
  // grounded locally so every clone can be placed by its holder unchanged.
  scene.position.x -= center.x;
  scene.position.z -= center.z;

  scene.updateMatrixWorld(true);
  const groundedBounds = new THREE.Box3().setFromObject(scene);
  scene.position.y -= groundedBounds.min.y;
  scene.updateMatrixWorld(true);
}

export function createSeededRandom(seed = 3006) {
  let state = seed >>> 0;

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function pickRandomCar(
  random = Math.random,
  { allowThomas = true } = {}
) {
  const candidates = allowThomas
    ? CAR_SPECS
    : CAR_SPECS.filter((spec) => spec.id !== "diesel-thomas-proxy");

  const totalWeight = candidates.reduce(
    (sum, spec) => sum + spec.randomWeight,
    0
  );

  let value = random() * totalWeight;

  for (const spec of candidates) {
    value -= spec.randomWeight;
    if (value <= 0) return spec;
  }

  return candidates[candidates.length - 1];
}

export function pickRandomParkingCar(random = Math.random) {
  return PARKING_CAR_SPECS[
    Math.min(
      PARKING_CAR_SPECS.length - 1,
      Math.floor(random() * PARKING_CAR_SPECS.length)
    )
  ];
}

export function getCarSpec(id) {
  return CAR_SPECS.find((spec) => spec.id === id) ?? null;
}

async function getPrototype(spec, variant) {
  if (spec.packRootChildren) {
    const key = `${spec.id}:parking-pack`;

    if (!prototypeCache.has(key)) {
      parkingPackPromise ??= loader.loadAsync(`${BASE_PATH}${PARKING_PACK_FILE}`);
      prototypeCache.set(
        key,
        parkingPackPromise.then((gltf) => {
          const scene = cloneVehicleHierarchy(gltf.scene);
          const rootNode = scene.getObjectByName("RootNode");

          if (!rootNode) {
            throw new Error("Generic passenger car pack is missing RootNode.");
          }

          const body = rootNode.children[spec.packBodyChild];
          const selected = new Set(spec.packRootChildren);
          for (let index = rootNode.children.length - 1; index >= 0; index--) {
            if (!selected.has(index)) rootNode.remove(rootNode.children[index]);
          }

          normalizeVehicleModel(scene);

          // The source scene displays its cars in a circle, so every vehicle
          // has a different baked heading. Convert the body's local length
          // axis to a shared +Z heading before holders rotate it into a bay.
          if (!body) {
            throw new Error(`Generic passenger car pack is missing body child ${spec.packBodyChild}.`);
          }
          scene.updateMatrixWorld(true);
          const bodyRotation = body.getWorldQuaternion(new THREE.Quaternion());
          const forward = new THREE.Vector3(
            spec.packForwardAxis === "x" ? 1 : 0,
            spec.packForwardAxis === "x" ? 0 : 1,
            0
          ).applyQuaternion(bodyRotation);
          forward.y = 0;
          if (forward.lengthSq() > 0.001) {
            forward.normalize();
            scene.rotateY(-Math.atan2(forward.x, forward.z));
            scene.rotateY(spec.packHeadingOffset ?? 0);
            // Rotating the imported scene also rotates its baked source offset;
            // centre it again so every clone sits on its holder's origin.
            normalizeVehicleModel(scene);
          }

          scene.traverse((child) => {
            if (!child.isMesh) return;
            child.visible = true;
            child.castShadow = false;
            child.receiveShadow = true;
          });

          preserveSharedVehicleResources(scene);

          return scene;
        })
      );
    }

    return prototypeCache.get(key);
  }

  const file = spec[variant];

  if (!file) {
    throw new Error(`Unknown vehicle variant "${variant}" for ${spec.id}.`);
  }

  const key = `${spec.id}:${variant}`;

  if (!prototypeCache.has(key)) {
    prototypeCache.set(
      key,
      loader.loadAsync(`${BASE_PATH}${file}`).then((gltf) => {
        const scene = gltf.scene;

        normalizeVehicleModel(scene);

        scene.traverse((child) => {
          if (!child.isMesh) return;

          child.visible = true;
          child.castShadow = variant === "game";
          child.receiveShadow = true;
        });

        preserveSharedVehicleResources(scene);

        return scene;
      })
    );
  }

  return prototypeCache.get(key);
}

// Exposed so InstancedCarField can bake a prototype into instanced meshes.
// The prototype is already scaled to a 4.2 m length, grounded at Y = 0 and
// turned to +Z forward, so callers can place it with a plain holder transform.
export function loadVehiclePrototype(spec, variant = "game") {
  return getPrototype(spec, variant);
}

export async function attachVehicleModel(
  holder,
  spec,
  variant = "game"
) {
  const prototype = await getPrototype(spec, variant);

  // Preserve every imported node transform. Only the outside holder is ever
  // positioned or rotated by parking/gameplay/traffic code.
  const model = cloneVehicleHierarchy(prototype);

  holder.add(model);
  return model;
}

export async function attachPlayerCarModel(holder) {
  playerCarPrototypePromise ??= loader.loadAsync(PLAYER_CAR_MODEL_PATH).then((gltf) => {
    const scene = gltf.scene;
    const rootNode = scene.getObjectByName("RootNode");

    if (!rootNode) {
      throw new Error("Player car scene is missing RootNode.");
    }

    // car-scene.glb is an authored showcase scene. Remove its surrounding
    // props so the player gets only the vehicle itself.
    for (const child of [...rootNode.children]) {
      if (PLAYER_CAR_PROP_NAMES.has(child.name)) rootNode.remove(child);
    }

    scene.updateMatrixWorld(true);
    const size = new THREE.Box3()
      .setFromObject(scene)
      .getSize(new THREE.Vector3());

    // The source vehicle is modelled lengthwise on X; gameplay uses -Z as
    // forward. Keep this conditional so a re-export with Z-forward still works.
    if (size.x > size.z) scene.rotateY(-Math.PI / 2);

    normalizeVehicleModel(scene);
    scene.traverse((child) => {
      if (!child.isMesh) return;
      child.visible = true;
      child.castShadow = true;
      child.receiveShadow = true;
    });

    preserveSharedVehicleResources(scene);

    return scene;
  });

  const prototype = await playerCarPrototypePromise;
  const model = cloneVehicleHierarchy(prototype);
  model.name = "player-car-model";
  holder.add(model);
  return model;
}

export async function createCarModel(
  spec,
  {
    variant = "game",
    position = [0, 0, 0],
    rotationY = 0
  } = {}
) {
  const holder = new THREE.Group();
  holder.position.set(...position);
  holder.rotation.y = rotationY;

  await attachVehicleModel(holder, spec, variant);

  return holder;
}
