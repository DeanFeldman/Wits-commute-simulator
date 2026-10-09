// Pure selectors and animation easing for the one-time Wits Sharks encounter.
export const SHARK_TRIGGER_DISTANCE = 8;
export const SHARK_RISE_SECONDS = 0.65;
export const SHARK_HOLD_SECONDS = 2.8;
export const SHARK_SINK_SECONDS = 0.7;
export const SHARK_TOTAL_SECONDS = SHARK_RISE_SECONDS + SHARK_HOLD_SECONDS + SHARK_SINK_SECONDS;

export function chooseSharkPothole(potholes, x, z, isVisible, maximumDistance = SHARK_TRIGGER_DISTANCE) {
  let best = null;
  let bestDistanceSquared = maximumDistance * maximumDistance;
  for (const pothole of potholes) {
    if (!pothole.userData.isWet || !pothole.userData.waterMesh) continue;
    const dx = pothole.position.x - x;
    const dz = pothole.position.z - z;
    const distanceSquared = dx * dx + dz * dz;
    if (distanceSquared < bestDistanceSquared && isVisible(pothole)) {
      best = pothole;
      bestDistanceSquared = distanceSquared;
    }
  }
  return best;
}

const smoothstep = (t) => {
  const value = Math.max(0, Math.min(1, t));
  return value * value * (3 - 2 * value);
};

export function sharkEmergence(time) {
  if (time <= 0) return 0;
  if (time < SHARK_RISE_SECONDS) return smoothstep(time / SHARK_RISE_SECONDS);
  if (time < SHARK_RISE_SECONDS + SHARK_HOLD_SECONDS) return 1;
  if (time < SHARK_TOTAL_SECONDS) return 1 - smoothstep((time - SHARK_RISE_SECONDS - SHARK_HOLD_SECONDS) / SHARK_SINK_SECONDS);
  return 0;
}
