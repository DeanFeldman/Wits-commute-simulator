import { Game } from "./core/Game.js";

// Fetch and decode the home screen art together. The same background is
// reused on character select and will already be present in the image cache.
const menuImages = [
  "main-menu-v3-background.png",
  "at-wits-end-logo-v2.png",
  "begin-journey-unselected.png",
  "begin-journey-selected.png",
  "settings-unselected.png",
  "settings-selected.png",
  "credits-unselected.png",
  "credits-selected.png"
];

function decodeMenuImage(filename) {
  const image = new Image();
  image.src = `./assets/images/ui/${filename}`;
  if (typeof image.decode === "function") {
    return image.decode();
  }
  return new Promise((resolve, reject) => {
    if (image.complete) {
      image.naturalWidth ? resolve() : reject(new Error(filename));
      return;
    }
    image.onload = resolve;
    image.onerror = reject;
  });
}

const artReady = Promise.allSettled(menuImages.map(decodeMenuImage));
const container = document.querySelector("#game-container");
const game = new Game(container);
game.start();

// Even when one optional artwork file fails, don't trap the player.
// Wait for the next painted frame so menu imagery appears as one screen.
void artReady.then(() => {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelector("#menu-initial-loading")?.remove();
    });
  });
});
