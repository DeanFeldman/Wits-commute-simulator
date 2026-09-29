import * as THREE from "three";

export const PARKING_BAY_WIDTH = 2.5;
export const PARKING_BAY_LENGTH = 5;
export const PARKING_AISLE_WIDTH = 6;
export const PARKING_LINE_WIDTH = 0.08;
export const PARKING_SLOT_PITCH = 2.6;
export const PARKING_PAINT_COLOR = 0xe5ddbd;
export const PARKING_KERB_COLOR = 0xbfc0b8;

function createWeatheredParkingPaintMaterial() {
  const material = new THREE.MeshBasicMaterial({ color: PARKING_PAINT_COLOR });

  // Continuous paint strips keep the bay silhouette clear. The shader adds only
  // subtle mottling and tiny chips, revealing asphalt beneath without turning a
  // solid marking into visibly separate rectangular segments.
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vParkingPaintWorldPosition;"
      )
      .replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\nvParkingPaintWorldPosition = worldPosition.xyz;"
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vParkingPaintWorldPosition;
float parkingPaintHash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
}`
      )
      .replace(
        "#include <dithering_fragment>",
        `float chip = parkingPaintHash(floor(vParkingPaintWorldPosition.xz * 34.0));
float fleck = parkingPaintHash(floor(vParkingPaintWorldPosition.xz * 79.0));
if (chip > 0.994 && fleck > 0.72) discard;
gl_FragColor.rgb *= mix(0.86, 1.0, parkingPaintHash(floor(vParkingPaintWorldPosition.xz * 2.0)));
#include <dithering_fragment>`
      );
  };
  material.customProgramCacheKey = () => "weathered-parking-paint-v1";
  return material;
}

// Shared by Level 1 and its visually adjacent Level 2 parking section.
// spaces: [{ x, z, angle }]. Cars face local -Z, so the local +Z edge is the
// approach side and deliberately remains unpainted.
export function createParkingBayMarkings(spaces, { y = 0.035 } = {}) {
  const lineMaterial = createWeatheredParkingPaintMaterial();
  const sideLines = new THREE.InstancedMesh(
    new THREE.BoxGeometry(PARKING_LINE_WIDTH, 0.025, PARKING_BAY_LENGTH),
    lineMaterial,
    spaces.length * 2
  );
  const endLines = new THREE.InstancedMesh(
    new THREE.BoxGeometry(PARKING_BAY_WIDTH, 0.025, PARKING_LINE_WIDTH),
    lineMaterial,
    spaces.length
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
    }
    // The solid end marks the front/kerb edge. Leaving the approach end open
    // makes adjacent bays read as real parking spaces instead of closed boxes.
    localMatrix.makeTranslation(0, 0, -PARKING_BAY_LENGTH / 2);
    endLines.setMatrixAt(index, instanceMatrix.multiplyMatrices(rowMatrix, localMatrix));
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
