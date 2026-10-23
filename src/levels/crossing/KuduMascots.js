import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { disposeObject3D } from "../../shared/disposeObject3D.js";

// Crowd-only mascots; never added to the selectable student variants.
const MASCOTS = [
  { file: "female-kudu.glb", name: "Kudu Sis", offsetZ: 1.8, yaw: Math.PI / 3 },
  { file: "male-kudu.glb", name: "Kudu Bro", offsetZ: -1.8, yaw: Math.PI * 2 / 3 }
];

export async function loadKuduMascots(startZone) {
  const loader = new GLTFLoader();
  const results = await Promise.allSettled(MASCOTS.map(async (mascot) => {
    const { scene, animations } = await loader.loadAsync(`./assets/models/level2-kudus/${mascot.file}`);
    const bounds = new THREE.Box3().setFromObject(scene);
    const height = bounds.max.y - bounds.min.y;
    if (!Number.isFinite(height) || height <= 0) {
      disposeObject3D(scene);
      throw new Error(`Kudu model has no measurable height: ${mascot.file}`);
    }
    // Shoes rest on the pavement; keep the authored pose and textures.
    const scale = 2.05 / height; // Includes horns; students are 1.72 m tall.
    scene.scale.multiplyScalar(scale);
    scene.position.set(
      -(bounds.min.x + bounds.max.x) * scale / 2,
      -bounds.min.y * scale,
      -(bounds.min.z + bounds.max.z) * scale / 2
    );
    scene.traverse((object) => {
      if (!object.isMesh) return;
      // The male GLB contains positions and UVs but no authored normals.
      if (!object.geometry.getAttribute("normal")) object.geometry.computeVertexNormals();
      object.castShadow = true;
      object.receiveShadow = true;
    });
    const mesh = new THREE.Group();
    mesh.add(scene);
    mesh.userData.kuduVisual = scene;
    if (animations.length) {
      const mixer = new THREE.AnimationMixer(scene);
      mixer.clipAction(animations[0]).play();
      mesh.userData.animation = { mixer };
      mixer.update(0);
      // The clip's hip translation can lift the shoes above the bind-pose
      // bounds. Ground the posed mesh, preserving the dance's vertical motion.
      scene.updateMatrixWorld(true);
      const posedBounds = new THREE.Box3().setFromObject(scene, true);
      if (Number.isFinite(posedBounds.min.y)) {
        scene.position.y -= posedBounds.min.y;
        scene.updateMatrixWorld(true);
      }
    }
    mesh.userData.speechHeight = 2.25;
    mesh.userData.soleOffset = 0;
    return {
      kind: "kudu", name: mascot.name, mesh,
      x: -3.8, z: startZone.z + mascot.offsetZ,
      y: 0.215, yaw: mascot.yaw
    };
  }));
  return results.flatMap((result) => {
    if (result.status === "fulfilled") return [result.value];
    console.warn("A Level 2 kudu mascot could not load.", result.reason);
    return [];
  });
}

