// First-person steering is quarter-turn based because Level 2 uses grid cells.
const QUARTER_TURN = Math.PI / 2;
const CARDINAL = Object.freeze([{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: 0, z: -1 }, { x: -1, z: 0 }]);
export const snapFacingYaw = (yaw) => Math.round(yaw / QUARTER_TURN) * QUARTER_TURN;
export const turnFacingYaw = (yaw, steering) => Math.atan2(Math.sin(yaw + Math.sign(steering) * QUARTER_TURN), Math.cos(yaw + Math.sign(steering) * QUARTER_TURN));
export function directionFromFacing(yaw, backwards = false) {
  const step = Math.round(yaw / QUARTER_TURN) + (backwards ? 2 : 0);
  return CARDINAL[((step % 4) + 4) % 4];
}
