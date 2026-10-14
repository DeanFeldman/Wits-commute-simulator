import assert from "node:assert/strict";
import test from "node:test";
import { DoubleShotScreenEffect } from "../src/ui/DoubleShotScreenEffect.js";
import { PowerUpState } from "../src/levels/crossing/VidaCups.js";

function setup() {
  const layers = [{ style: {} }, { style: {} }];
  const root = { hidden: true, querySelector: selector => layers[selector.endsWith("--a") ? 0 : 1] };
  return { root, layers, effect: new DoubleShotScreenEffect(root), gameplay: new PowerUpState() };
}

test("Double Shot alone starts animated lines without changing gameplay duration or speed", () => {
  const { root, layers, effect, gameplay } = setup();
  gameplay.apply("icedLatte");
  effect.update(0.1, gameplay.timers.doubleShot);
  assert.equal(root.hidden, true, "Iced Latte does not start speed lines");
  gameplay.apply("doubleShot");
  effect.activate();
  gameplay.update(0.1);
  effect.update(0.1, gameplay.timers.doubleShot);
  assert.equal(root.hidden, false);
  assert.ok(Number(layers[0].style.opacity) > 0);
  const before = layers[0].style.transform;
  effect.update(0.1, gameplay.timers.doubleShot);
  assert.notEqual(layers[0].style.transform, before, "lines move even with unchanged gameplay time");
  assert.notEqual(layers[0].style.transform, layers[1].style.transform);
  assert.equal(gameplay.speedMultiplier, 1.65);
  assert.equal(gameplay.timers.doubleShot, 5.9);
});

test("a second Double Shot refreshes gameplay and replays a pulse without hiding the overlay", () => {
  const { root, layers, effect, gameplay } = setup();
  gameplay.apply("doubleShot");
  effect.update(1, gameplay.timers.doubleShot);
  const activeOpacity = Number(layers[0].style.opacity);
  gameplay.update(3);
  gameplay.apply("doubleShot");
  effect.activate();
  effect.update(0.2, gameplay.timers.doubleShot);
  assert.equal(root.hidden, false);
  assert.ok(Number(layers[0].style.opacity) > activeOpacity);
  assert.equal(gameplay.timers.doubleShot, 6);
});

test("speed resets immediately at expiry while the visual tail fades and then hides", () => {
  const { root, layers, effect, gameplay } = setup();
  gameplay.apply("doubleShot");
  effect.update(1, gameplay.timers.doubleShot);
  gameplay.update(6);
  effect.update(0.1, gameplay.timers.doubleShot);
  const startOpacity = Number(layers[0].style.opacity);
  assert.equal(gameplay.speedMultiplier, 1);
  assert.equal(root.hidden, false);
  effect.update(0.25, gameplay.timers.doubleShot);
  assert.ok(Number(layers[0].style.opacity) < startOpacity);
  effect.update(0.3, gameplay.timers.doubleShot);
  assert.equal(root.hidden, true);
  assert.equal(layers[0].style.opacity, "0");
});

test("disposing the level clears both layers even during a refreshed boost", () => {
  const { root, layers, effect } = setup();
  effect.activate();
  effect.update(0.2, 6);
  effect.dispose();
  assert.equal(root.hidden, true);
  assert.equal(layers[0].style.opacity, "0");
  assert.equal(layers[1].style.opacity, "0");
});
