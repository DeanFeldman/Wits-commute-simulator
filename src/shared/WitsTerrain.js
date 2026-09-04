import * as THREE from "three";

// Lightweight exterior foundation shared by the playable outdoor levels.
export function createWitsTerrain({ baseY = -0.04, palette = {} } = {}) {
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
  for (const [x, z, width, height, depth] of [[-52, -48, 14, 13, 10], [-30, -62, 10, 18, 8], [38, -58, 16, 15, 10], [64, -42, 12, 21, 9]]) {
    const building = new THREE.Group();
    const block = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), buildingMaterial);
    block.position.y = baseY + height / 2;
    building.add(block);
    const windows = new THREE.Mesh(new THREE.BoxGeometry(width * 0.72, height * 0.38, 0.06), windowMaterial);
    windows.position.set(0, baseY + height * 0.62, -depth / 2 - 0.04);
    building.add(windows);
    building.position.set(x, 0, z);
    root.add(building);
  }

  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.18, 0.25, 2.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x65462f, roughness: 0.95 }),
    24
  );
  const canopy = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.8, 4.2, 7),
    new THREE.MeshStandardMaterial({ color: palette.trees ?? 0x315c3a, roughness: 0.95, flatShading: true }),
    24
  );
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < 24; index++) {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * (36 + (index % 4) * 7);
    const z = -52 + Math.floor(index / 2) * 9;
    matrix.makeTranslation(x, baseY + 1.25, z);
    trunk.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, baseY + 4.2, z);
    canopy.setMatrixAt(index, matrix);
  }
  trunk.instanceMatrix.needsUpdate = true;
  canopy.instanceMatrix.needsUpdate = true;
  root.add(trunk, canopy);

  return root;
}
