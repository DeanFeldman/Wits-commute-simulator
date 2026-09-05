import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

// Files in public/ are served from Vite's configured relative base. Keep this
// relative so the deployed game also works from a subdirectory.
const BASE_PATH = "./assets/cars/";
const TARGET_LENGTH = 4.2;

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

export function getCarSpec(id) {
  return CAR_SPECS.find((spec) => spec.id === id) ?? null;
}

async function getPrototype(spec, variant) {
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

        return scene;
      })
    );
  }

  return prototypeCache.get(key);
}

export async function attachCarModel(
  holder,
  spec,
  variant = "game"
) {
  const prototype = await getPrototype(spec, variant);

  // clone(true) reuses geometry/material resources, which is what we want.
  const model = prototype.clone(true);

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

  await attachCarModel(holder, spec, variant);

  return holder;
}
