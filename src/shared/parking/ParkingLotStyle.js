import * as THREE from "three";

export const PARKING_BAY_WIDTH = 2.5;
export const PARKING_BAY_LENGTH = 5;
export const PARKING_AISLE_WIDTH = 6;
export const PARKING_LINE_WIDTH = 0.08;
export const PARKING_SLOT_PITCH = 2.6;
export const PARKING_PAINT_COLOR = 0xe5ddbd;
export const PARKING_KERB_COLOR = 0xbfc0b8;

// Shared by Level 1 and its visually adjacent Level 2 parking section.
// spaces: [{ x, z, angle }]
export function createParkingBayMarkings(spaces, { y = 0.035 } = {}) {
  const lineMaterial = new THREE.MeshBasicMaterial({ color: PARKING_PAINT_COLOR });
  const sideLines = new THREE.InstancedMesh(
    new THREE.BoxGeometry(PARKING_LINE_WIDTH, 0.025, PARKING_BAY_LENGTH),
    lineMaterial,
    spaces.length * 2
  );
  const endLines = new THREE.InstancedMesh(
    new THREE.BoxGeometry(PARKING_BAY_WIDTH, 0.025, PARKING_LINE_WIDTH),
    lineMaterial,
    spaces.length * 2
  );
  const rowMatrix = new THREE.Matrix4();
  const localMatrix = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();

  spaces.forEach((space, index) => {
    rowMatrix.makeRotationY(space.angle);
    rowMatrix.setPosition(space.x, y, space.z);
    for (let side = 0; side < 2; side++) {
      localMatrix.makeTranslation((side ? 1 : -1) * PARKING_BAY_WIDTH / 2, 0, 0);
      sideLines.setMatrixAt(index * 2 + side, instanceMatrix.multiplyMatrices(rowMatrix, localMatrix));
      localMatrix.makeTranslation(0, 0, (side ? 1 : -1) * PARKING_BAY_LENGTH / 2);
      endLines.setMatrixAt(index * 2 + side, instanceMatrix.multiplyMatrices(rowMatrix, localMatrix));
    }
  });

  sideLines.name = "parking-bay-side-lines";
  endLines.name = "parking-bay-end-lines";
  sideLines.instanceMatrix.needsUpdate = true;
  endLines.instanceMatrix.needsUpdate = true;
  return [sideLines, endLines];
}

export function createParkingKerb(length, { along = "z" } = {}) {
  const geometry = along === "z"
    ? new THREE.BoxGeometry(0.32, 0.24, length)
    : new THREE.BoxGeometry(length, 0.24, 0.32);
  const kerb = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: PARKING_KERB_COLOR, roughness: 0.84 })
  );
  kerb.castShadow = true;
  kerb.receiveShadow = true;
  return kerb;
}
