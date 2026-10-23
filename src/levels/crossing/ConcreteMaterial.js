import * as THREE from "three";

// Plain concrete shared by the building's concrete faces.
export function createConcreteMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xb1aaa0,
    roughness: 0.9
  });
}
