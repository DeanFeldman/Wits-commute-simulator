// Same ordering as the character selector: Luca is also the fallback.
const CHARACTER_ARMS = ["luca", "yusuf", "thabo", "emma", "priya", "naledi"];
const preloads = new Map();

export function preloadStoryArm(variant, levelNumber = 1) {
  const name = Number.isInteger(variant) ? CHARACTER_ARMS[variant] ?? "luca" : "luca";
  const key = `${levelNumber}:${name}`;
  const folder = levelNumber === 2 ? "story-arms/level2" : "story-arms";
  if (preloads.has(key)) return preloads.get(key);

  const preload = new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try { await image.decode(); } catch { /* Loaded images remain usable. */ }
      resolve(image);
    };
    image.onerror = () => reject(new Error(`Unable to load ${name}'s story arm.`));
    image.src = `./assets/images/ui/${folder}/${name}.png?v=755-r2`;
  }).catch((error) => {
    preloads.delete(key);
    console.warn(error);
    return name === "luca" ? null : preloadStoryArm(0, levelNumber);
  });
  preloads.set(key, preload);
  return preload;
}
