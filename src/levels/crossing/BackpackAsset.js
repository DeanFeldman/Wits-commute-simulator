import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const BACKPACK_PATH = "./assets/models/level2-accessories/student-backpack.glb";
const TARGET_HEIGHT = 0.58;
let templatePromise = null;

// Player and NPC factories share this module-level promise, so the GLB is
// fetched and prepared once even though each animated character gets a clone.
export function loadBackpackTemplate() {
  if (!templatePromise) {
    templatePromise = new GLTFLoader().loadAsync(BACKPACK_PATH).then(({ scene }) => {
      const bounds = new THREE.Box3().setFromObject(scene, true);
      const height = bounds.max.y - bounds.min.y;
      if (!Number.isFinite(height) || height < 0.001) throw new Error("The Level 2 backpack has no measurable height.");

      scene.scale.setScalar(TARGET_HEIGHT / height);
      scene.updateMatrixWorld(true);
      const scaledBounds = new THREE.Box3().setFromObject(scene, true);
      scene.position.set(
        -(scaledBounds.min.x + scaledBounds.max.x) / 2,
        -(scaledBounds.min.y + scaledBounds.max.y) / 2,
        -(scaledBounds.min.z + scaledBounds.max.z) / 2
      );
      scene.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      scene.updateMatrixWorld(true);
      return scene;
    });
  }
  return templatePromise;
}

export function attachBackpack(model, template) {
  const chest = model.getObjectByName("mixamorigSpine2")
    ?? model.getObjectByName("mixamorigSpine1")
    ?? model.getObjectByName("mixamorigSpine");
  if (!chest) return null;

  const backpack = template.clone(true);
  backpack.name = "student-backpack";
  // The source GLB faces opposite the Mixamo rigs. Turn it around in the
  // chest bone's local space, reduce its authored bulk, and keep it snug to
  // the back for both the player and NPC variants.
backpack.scale.multiply(new THREE.Vector3(
  0.72, // X — width
  0.72, // Y — height
  0.5  // Z — depth
));
  backpack.position.set(0, -0.1, -0.1);
  backpack.rotation.set(0, Math.PI, 0);
  chest.add(backpack);
  return backpack;
}
