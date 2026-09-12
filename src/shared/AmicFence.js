import * as THREE from "three";

export const AMIC_FENCE_TEXTURE_PATH = "./assets/textures/road/amic-fence.png";
export const AMIC_FENCE_REFERENCE_PATH = "./assets/textures/road/amic-fence-reference.png";

const SLAT_SPACING = 0.28;
const SLAT_WIDTH = 0.075;
const FENCE_HEIGHT = 1.62;
const slatGeometry = new THREE.BoxGeometry(SLAT_WIDTH, FENCE_HEIGHT, 0.075);
const railGeometry = new THREE.BoxGeometry(0.1, 0.1, 1);
let material = null;

function createReferenceTexture() {
  const texture = typeof document === "undefined"
    ? new THREE.DataTexture(new Uint8Array([
      58, 62, 64, 255, 42, 46, 48, 255,
      48, 52, 54, 255, 65, 69, 71, 255
    ]), 2, 2, THREE.RGBAFormat)
    : new THREE.TextureLoader().load(AMIC_FENCE_TEXTURE_PATH);
  texture.name = "amic-fence-reference-texture";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.12, 0.35);
  texture.needsUpdate = true;
  texture.userData.sharedAsset = true;
  return texture;
}

export function getAmicFenceMaterial() {
  if (material) return material;
  material = new THREE.MeshStandardMaterial({
    map: createReferenceTexture(),
    color: 0x555b5e,
    roughness: 0.72,
    metalness: 0.42
  });
  material.name = "amic-charcoal-fence-material";
  material.userData.sharedAsset = true;
  slatGeometry.userData.sharedAsset = true;
  railGeometry.userData.sharedAsset = true;
  return material;
}

// A section uses one InstancedMesh for all vertical slats and two shared rails.
// Collision stays separate: callers create one broad boundary volume per run.
export function createAmicFenceSection({ length, name = "amic-fence-section" }) {
  const root = new THREE.Group();
  root.name = name;
  root.userData.referenceAssets = [AMIC_FENCE_TEXTURE_PATH, AMIC_FENCE_REFERENCE_PATH];

  const fenceMaterial = getAmicFenceMaterial();
  const count = Math.max(2, Math.ceil(length / SLAT_SPACING) + 1);
  const spacing = length / (count - 1);
  const slats = new THREE.InstancedMesh(slatGeometry, fenceMaterial, count);
  slats.name = `${name}-vertical-slats`;
  slats.castShadow = true;
  slats.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < count; index++) {
    matrix.makeTranslation(0, FENCE_HEIGHT / 2, -length / 2 + index * spacing);
    slats.setMatrixAt(index, matrix);
  }
  slats.instanceMatrix.needsUpdate = true;
  slats.computeBoundingSphere();
  root.add(slats);

  for (const y of [0.12, FENCE_HEIGHT * 0.54]) {
    const rail = new THREE.Mesh(railGeometry, fenceMaterial);
    rail.name = `${name}-horizontal-rail`;
    rail.scale.z = length;
    rail.position.y = y;
    rail.castShadow = true;
    rail.receiveShadow = true;
    root.add(rail);
  }

  return root;
}
