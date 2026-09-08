import * as THREE from "three";
import { loadVehiclePrototype } from "./VehicleModelLibrary.js";

// Level 1 parks a few hundred cars. Cloning a GLB per car would cost one draw
// call per mesh per car, which is the most expensive thing the level could do.
// Instead every mesh of a vehicle prototype is baked into an InstancedMesh, so
// the whole lot costs one draw call per prototype mesh no matter how many cars
// are parked in it. This is the batching the layout contract asks for.
//
// placements: [{ spec, x, z, angle, y? }]
export async function createInstancedCarField(placements, { variant = "lite" } = {}) {
  const root = new THREE.Group();
  root.name = "instanced-car-field";

  const bySpec = new Map();
  for (const placement of placements) {
    const group = bySpec.get(placement.spec) ?? [];
    group.push(placement);
    bySpec.set(placement.spec, group);
  }

  await Promise.all(
    [...bySpec].map(async ([spec, group]) => {
      const prototype = await loadVehiclePrototype(spec, variant);

      // The cached prototype has no parent, so each mesh's world matrix is
      // already the transform an attached clone would receive from its holder.
      prototype.updateMatrixWorld(true);

      const parts = [];
      prototype.traverse((child) => {
        if (child.isMesh && child.geometry) {
          parts.push({
            geometry: child.geometry,
            material: child.material,
            local: child.matrixWorld.clone()
          });
        }
      });

      const holder = new THREE.Matrix4();
      const combined = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const axis = new THREE.Vector3(0, 1, 0);
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3(1, 1, 1);

      for (const part of parts) {
        const mesh = new THREE.InstancedMesh(part.geometry, part.material, group.length);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.name = `${spec.id}-instances`;

        group.forEach((placement, index) => {
          position.set(placement.x, placement.y ?? 0, placement.z);
          quaternion.setFromAxisAngle(axis, placement.angle);
          holder.compose(position, quaternion, scale);
          combined.multiplyMatrices(holder, part.local);
          mesh.setMatrixAt(index, combined);
        });

        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
        root.add(mesh);
      }
    })
  );

  return root;
}
