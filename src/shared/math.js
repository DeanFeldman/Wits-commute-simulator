export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function moveTowards(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) {
    return target;
  }

  return current + Math.sign(target - current) * maxDelta;
}
