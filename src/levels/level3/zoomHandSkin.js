// Selector order: Luca, Yusuf, Thabo, Emma, Priya, Naledi.
// Every character has separately authored hands with their skin tone baked in.
const HAND_SKINS = [
  { name: "luca", opacity: 0.5 },
  { name: "yusuf", opacity: 0.5 },
  { name: "thabo", opacity: 0.5 },
  { name: "emma", opacity: 0.5 },
  { name: "priya", opacity: 0.5 },
  { name: "naledi", opacity: 0.5 }
];

export function applyZoomHandSkin(overlay, variant) {
  const image = overlay?.querySelector("img");
  if (!image) return;
  const skin = HAND_SKINS[Number.isInteger(variant) ? variant : 0] ?? HAND_SKINS[0];
  image.src = skin.name === "luca"
    ? "./assets/images/ui/level3-zoom-hands.png"
    : `./assets/images/ui/level3-hands/${skin.name}.png`;
  image.style.filter = "none";
  // All characters use the original semi-transparent zoom presentation.
  image.style.setProperty("--zoom-hand-opacity", String(skin.opacity ?? 0.5));
  overlay.dataset.character = skin.name;
}
