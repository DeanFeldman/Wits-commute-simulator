import * as THREE from "three";

// Lightweight exterior foundation shared by the playable outdoor levels.
export function createWitsTerrain({ baseY = -0.04, palette = {}, nearScenery = false } = {}) {
  const root = new THREE.Group();
  root.name = String.fromCharCode(119, 105, 116, 115, 45, 116, 101, 114, 114, 97, 105, 110);

  const groundMaterial = new THREE.MeshStandardMaterial({
    color: palette.ground ?? 0x526b45,
    roughness: 0.96,
    flatShading: true
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = baseY;
  ground.receiveShadow = true;
  root.add(ground);

  if (nearScenery) {
    const vergeMaterials = [0x6f9257, 0x789a5f, 0x63854e].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
    for (const [x, z, width, depth, materialIndex] of [[0, 28, 52, 18, 0], [-28, 8, 18, 50, 1], [28, 0, 18, 64, 2]]) {
      const verge = new THREE.Mesh(new THREE.BoxGeometry(width, 0.035, depth), vergeMaterials[materialIndex]);
      verge.position.set(x, baseY + 0.02, z);
      verge.receiveShadow = true;
      root.add(verge);
    }

    const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x8f8068, roughness: 0.9, flatShading: true });
    for (const [x, z, width, depth] of [[0, 22, 46, 2.2], [-17, 8, 2.2, 50], [17, 0, 2.2, 60]]) {
      const path = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth), pathMaterial);
      path.position.set(x, baseY + 0.05, z);
      path.receiveShadow = true;
      root.add(path);
    }


    const nearTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 2.2, 6), new THREE.MeshStandardMaterial({ color: 0x65462f, roughness: 0.95 }), 20);
    const nearCanopy = new THREE.InstancedMesh(new THREE.ConeGeometry(1.45, 3.5, 7), new THREE.MeshStandardMaterial({ color: palette.trees ?? 0x315c3a, roughness: 0.95, flatShading: true }), 20);
    const nearMatrix = new THREE.Matrix4();
    for (let index = 0; index < 20; index++) {
      const side = index % 2 === 0 ? -1 : 1;
      const x = side * (13.5 + (index % 3) * 2.7);
      const z = -22 + Math.floor(index / 2) * 5.4;
      nearMatrix.makeTranslation(x, baseY + 1.1, z);
      nearTrunk.setMatrixAt(index, nearMatrix);
      nearMatrix.makeTranslation(x, baseY + 3.8, z);
      nearCanopy.setMatrixAt(index, nearMatrix);
    }
    nearTrunk.instanceMatrix.needsUpdate = true;
    nearCanopy.instanceMatrix.needsUpdate = true;
    root.add(nearTrunk, nearCanopy);
  }

  const hillMaterial = new THREE.MeshStandardMaterial({
    color: palette.hills ?? 0x405b3d,
    roughness: 1,
    flatShading: true
  });
  for (const [x, z, radius, height] of [[-70, -70, 30, 16], [58, -76, 36, 20], [-78, 62, 42, 22], [76, 60, 32, 14]]) {
    const hill = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 8), hillMaterial);
    hill.position.set(x, baseY + height / 2 - 3, z);
    root.add(hill);
  }

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: palette.buildings ?? 0x8d765f,
    roughness: 0.9,
    flatShading: true
  });
  const windowMaterial = new THREE.MeshBasicMaterial({ color: palette.windows ?? 0xbfd7d3 });
  

  
  return root;
}
