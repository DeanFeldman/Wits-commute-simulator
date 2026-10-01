import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const TUTOR_RIG_PATH = "./assets/models/level3-tutor/fla-guy-rig.fbx";
const TUTOR_TEXTURED_MODEL_PATH = "./assets/models/level3-tutor/fla-guy-textured.glb";
const NPC_ASSET_ROOT = "./assets/models/level2-npcs";
const TARGET_HEIGHT = 1.72;
// Existing Level 3 patrol points were authored for the procedural tutor,
// whose shoe soles sit 0.93 m below its root.
const PATROL_ROOT_TO_SOLE = 1.68;

function findFirstMaterial(root) {
  let material = null;
  root.traverse((object) => {
    if (!material && object.isMesh) material = Array.isArray(object.material) ? object.material[0] : object.material;
  });
  return material;
}

function findHeadBone(root) {
  let head = null;
  root.traverse((object) => {
    if (!head && object.isBone && /head/i.test(object.name)) head = object;
  });
  return head;
}

function removeRootMotion(clip) {
  for (const track of clip.tracks) {
    if (!track.name.startsWith("mixamorigHips.") || !track.name.endsWith(".position") || track.getValueSize() !== 3) continue;
    const x = track.values[0];
    const z = track.values[2];
    for (let value = 0; value < track.values.length; value += 3) {
      track.values[value] = x;
      track.values[value + 2] = z;
    }
  }
}

function alignHipHeight(clip, referenceClip) {
  const hipTrack = clip.tracks.find((track) => track.name === "mixamorigHips.position");
  const referenceTrack = referenceClip.tracks.find((track) => track.name === "mixamorigHips.position");
  if (!hipTrack || !referenceTrack || hipTrack.getValueSize() !== 3 || referenceTrack.getValueSize() !== 3) return;
  const offset = referenceTrack.values[1] - hipTrack.values[1];
  for (let value = 1; value < hipTrack.values.length; value += 3) {
    hipTrack.values[value] += offset;
  }
}

function transferRigSkinning(rig, texturedScene) {
  let rigMesh = null;
  let texturedMesh = null;
  rig.traverse((object) => { if (!rigMesh && object.isSkinnedMesh) rigMesh = object; });
  texturedScene.traverse((object) => { if (!texturedMesh && object.isMesh) texturedMesh = object; });
  if (!rigMesh || !texturedMesh) throw new Error("The tutor needs a skinned FBX mesh and a textured GLB mesh.");

  const source = rigMesh.geometry;
  const target = texturedMesh.geometry.clone();
  const sourcePosition = source.getAttribute("position");
  const sourceIndices = source.getAttribute("skinIndex");
  const sourceWeights = source.getAttribute("skinWeight");
  const targetPosition = target.getAttribute("position");
  source.computeBoundingBox();
  target.computeBoundingBox();
  const sourceSize = source.boundingBox.getSize(new THREE.Vector3());
  const targetSize = target.boundingBox.getSize(new THREE.Vector3());
  const sourceByPosition = new Map();
  const keyFor = (position, vertex, bounds, size) => ["x", "y", "z"].map((axis, component) => (
    ((position[`get${axis.toUpperCase()}`](vertex) - bounds.min[axis]) / size[axis]).toFixed(4)
  )).join(":");

  for (let vertex = 0; vertex < sourcePosition.count; vertex += 1) {
    const key = keyFor(sourcePosition, vertex, source.boundingBox, sourceSize);
    if (!sourceByPosition.has(key)) sourceByPosition.set(key, vertex);
  }

  const skinIndices = new Uint16Array(targetPosition.count * 4);
  const skinWeights = new Float32Array(targetPosition.count * 4);
  const getters = ["getX", "getY", "getZ", "getW"];
  for (let vertex = 0; vertex < targetPosition.count; vertex += 1) {
    const sourceVertex = sourceByPosition.get(keyFor(targetPosition, vertex, target.boundingBox, targetSize));
    if (sourceVertex === undefined) throw new Error("The tutor GLB geometry does not match its FBX rig.");
    for (let component = 0; component < 4; component += 1) {
      const getter = getters[component];
      skinIndices[vertex * 4 + component] = sourceIndices[getter](sourceVertex);
      skinWeights[vertex * 4 + component] = sourceWeights[getter](sourceVertex);
    }
  }
  target.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skinIndices, 4));
  target.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skinWeights, 4));
  rigMesh.geometry = target;
}

export async function createAnimatedTutor() {
  const fbx = new FBXLoader();
  const gltf = new GLTFLoader();
  const [rig, textured, idleSource, walkSource] = await Promise.all([
    fbx.loadAsync(TUTOR_RIG_PATH),
    gltf.loadAsync(TUTOR_TEXTURED_MODEL_PATH),
    fbx.loadAsync(`${NPC_ASSET_ROOT}/standing-idle.fbx`),
    fbx.loadAsync(`${NPC_ASSET_ROOT}/walk.fbx`)
  ]);

  const sourceMaterial = findFirstMaterial(textured.scene);
  if (!sourceMaterial?.map) throw new Error("The Level 3 tutor GLB has no base-colour texture.");
  transferRigSkinning(rig, textured.scene);
  rig.traverse((object) => {
    if (!object.isMesh) return;
    const material = sourceMaterial.clone();
    material.map = sourceMaterial.map;
    material.map.flipY = false;
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.color?.set(0xffffff);
    material.needsUpdate = true;
    object.material = material;
    object.castShadow = true;
    object.receiveShadow = true;
  });

  rig.updateMatrixWorld(true);
  const rawBounds = new THREE.Box3().setFromObject(rig, true);
  const height = rawBounds.max.y - rawBounds.min.y;
  if (!Number.isFinite(height) || height < 0.001) throw new Error("The Level 3 tutor rig has no measurable height.");
  rig.scale.setScalar(TARGET_HEIGHT / height);
  rig.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(rig, true);
  rig.position.set(
    -(bounds.min.x + bounds.max.x) / 2,
    -bounds.min.y - PATROL_ROOT_TO_SOLE,
    -(bounds.min.z + bounds.max.z) / 2
  );

  const idleClip = idleSource.animations[0]?.clone();
  const walkClip = walkSource.animations[0]?.clone();
  if (!idleClip || !walkClip) throw new Error("Level 2 NPC animation files contain no clips.");
  removeRootMotion(idleClip);
  removeRootMotion(walkClip);
  alignHipHeight(walkClip, idleClip);
  const mixer = new THREE.AnimationMixer(rig);
  const idle = mixer.clipAction(idleClip);
  const walk = mixer.clipAction(walkClip);
  idle.play();

  const root = new THREE.Group();
  root.add(rig);
  root.userData.animation = { mixer, idle, walk, active: idle };
  root.userData.head = findHeadBone(rig) ?? rig;
  return root;
}
