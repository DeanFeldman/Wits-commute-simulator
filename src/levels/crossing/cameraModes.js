export const LEVEL2_CAMERA_MODES = Object.freeze(["chase", "close", "first-person"]);
export function nextLevel2CameraMode(current) {
  return LEVEL2_CAMERA_MODES[(LEVEL2_CAMERA_MODES.indexOf(current) + 1) % LEVEL2_CAMERA_MODES.length];
}
