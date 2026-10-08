import * as THREE from "three";
import { loadVehiclePrototype } from "./VehicleModelLibrary.js";

// Bodywork colours are deliberately mixed rather than lightly multiplied over
// the pack's original yellow/cyan/red paints (which cannot create new hues).
const BODY_PALETTE = [
  0x3e7e94, // steel blue
  0x668479, // sage
  0xbd753e, // copper
  0x64718a, // slate blue
  0xb7afa1, // warm silver
  0x872f3f, // burgundy
  0x317d88, // teal
  0xcaa84c, // mustard
  0x545c62, // graphite
  0x806a9c, // muted violet
  0xa6bbc3, // pale blue
  0x487447  // forest green
].map((hex) => new THREE.Color(hex));

// Not every part of an imported car is bodywork. Preserve glass, tyres,
// headlamps, trim and textured detail rather than recolouring entire cars.
function isPaintMaterial(material, meshName = "") {
  if (!material?.color || material.map || material.transparent || material.opacity < 1) return false;
  const name = `${material.name ?? ""} ${meshName}`.toLowerCase();
  if (/(glass|window|windscreen|windshield|wheel|tire|tyre|rim|rubber|lamp|light|head|tail|brake|interior|seat|grille|grill|chrome|badge|license|number.?plate|black|trim)/.test(name)) return false;
  if (/(paint|body|carpaint|exterior|shell)/.test(name)) return true;
  // A brightly coloured non-metallic surface is likely baked body paint.
  // Dark rubber, silver trim, and near-white glass stay exactly as imported.
  const { h, s, l } = material.color.getHSL({ h: 0, s: 0, l: 0 });
  return s > 0.38 && l > 0.17 && l < 0.88 && (material.metalness ?? 0) < 0.75;
}

// Spatial hash means nearby bays don't repeat the same paint just because
// their vehicle type or row is the same. All colours remain deterministic.
function paintFor(placement) {
  const x = Math.round(placement.x * 10);
  const z = Math.round(placement.z * 10);
  const hash = Math.imul(x, 73856093) ^ Math.imul(z, 19349663);
  return BODY_PALETTE[(hash >>> 0) % BODY_PALETTE.length];
}

// The instanced field preserves a single draw call per original mesh part.
export async function createInstancedCarField(placements, { variant = "lite" } = {}) {
  const root = new THREE.Group();
  const bySpec = new Map();
  const bindings = new Map();
  root.name = "instanced-car-field";

  for (const placement of placements) {
    const group = bySpec.get(placement.spec) ?? [];
    group.push(placement);
    bySpec.set(placement.spec, group);
  }

  await Promise.all([...bySpec].map(async ([spec, group]) => {
    const prototype = await loadVehiclePrototype(spec, variant);
    prototype.updateMatrixWorld(true);
    const parts = [];
    prototype.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      parts.push({
        geometry: child.geometry,
        material: child.material,
        local: child.matrixWorld.clone(),
        name: child.name
      });
    });

    const holder = new THREE.Matrix4();
    const combined = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const axis = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);

    for (const part of parts) {
      // The original vehicle pack may carry multiple mesh parts/materials.
      // Only paintable parts get neutral bases and per-instance colours.
      const paintable = !Array.isArray(part.material)
        && isPaintMaterial(part.material, part.name);
      const material = paintable ? part.material.clone() : part.material;
      if (paintable) {
        material.color.set(0xffffff);
        material.userData = { ...material.userData, localPaintInstance: true };
      }
      const mesh = new THREE.InstancedMesh(part.geometry, material, group.length);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.name = `${spec.id}-instances`;

      group.forEach((placement, index) => {
        position.set(placement.x, placement.y ?? 0, placement.z);
        quaternion.setFromAxisAngle(axis, placement.angle);
        holder.compose(position, quaternion, scale);
        combined.multiplyMatrices(holder, part.local);
        mesh.setMatrixAt(index, combined);
        if (paintable) mesh.setColorAt(index, paintFor(placement));
        const list = bindings.get(placement) ?? [];
        list.push({ mesh, index, local: part.local });
        bindings.set(placement, list);
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingBox();
      mesh.computeBoundingSphere();
      mesh.frustumCulled = false;
      root.add(mesh);
    }
  }));

  root.userData.updatePlacement = (placement) => {
    const list = bindings.get(placement);
    if (!list) return;
    const holder = new THREE.Matrix4();
    const combined = new THREE.Matrix4();
    const position = new THREE.Vector3(placement.x, placement.y ?? 0, placement.z);
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), placement.angle);
    const scale = new THREE.Vector3(1, 1, 1);
    holder.compose(position, quaternion, scale);
    for (const { mesh, index, local } of list) {
      combined.multiplyMatrices(holder, local);
      mesh.setMatrixAt(index, combined);
      mesh.instanceMatrix.needsUpdate = true;
    }
  };
  return root;
}
