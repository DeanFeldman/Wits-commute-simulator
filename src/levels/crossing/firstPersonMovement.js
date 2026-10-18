// First-person facing is smooth; Level 2 still walks between cardinal grid cells.
const QUARTER_TURN = Math.PI / 2;
export const FIRST_PERSON_TURN_STEP = Math.PI / 15; // 12° per key tap.
export const FIRST_PERSON_TURN_SPEED = Math.PI * 2 / 3; // 120°/s while held.
const CARDINAL = Object.freeze([{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }]);
export const normalizeFacingYaw = (yaw) => Math.atan2(Math.sin(yaw), Math.cos(yaw));
export const turnFacingYaw = (yaw, steering, radians = FIRST_PERSON_TURN_STEP) => normalizeFacingYaw(yaw + Math.sign(steering) * radians);
export function directionFromFacing(yaw, backwards = false) {
  const step = Math.round(yaw / QUARTER_TURN) + (backwards ? 2 : 0);
  return CARDINAL[((step % 4) + 4) % 4];
}
