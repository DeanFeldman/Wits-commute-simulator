// Level 2 first-person turning is continuous; preserve an exact camera-relative heading.
export const FIRST_PERSON_TURN_STEP = Math.PI / 15; // 12° per tap
export const FIRST_PERSON_TURN_SPEED = Math.PI * 2 / 3; // 120° per second while held
export const normalizeFacingYaw = (yaw) => Math.atan2(Math.sin(yaw), Math.cos(yaw));
export const turnFacingYaw = (yaw, steering, radians = FIRST_PERSON_TURN_STEP) => normalizeFacingYaw(yaw + Math.sign(steering) * radians);
export function directionFromFacing(yaw, backwards = false) {
  const sign = backwards ? -1 : 1, x = Math.sin(yaw), z = Math.cos(yaw);
  return { x: Math.abs(x) < 1e-12 ? 0 : x * sign, z: Math.abs(z) < 1e-12 ? 0 : z * sign };
}
