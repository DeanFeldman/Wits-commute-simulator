import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";

export class CheatingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 3 — Don't Get Caught";

    this.root = new THREE.Group();

    this.camera = null;
    this.controls = null;

    this.playerPosition = new THREE.Vector3(0, 1.6, 4);

    this.tutor = null;
    this.spotlight = null;

    this.tutorTime = 0;

    this.answerProgress = 0;
    this.suspicion = 0;

    this.yaw = 0;
    this.pitch = -0.05;

    this.completed = false;
  }

  load() {
    const scene = this.game.scene;

    scene.background = new THREE.Color(0x17191e);

    scene.add(this.root);

    const ambient = new THREE.HemisphereLight(0xdde4ee, 0x1a1714, 1.2);
    this.root.add(ambient);

    const ceiling = new THREE.DirectionalLight(0xfff1d0, 1.8);
    ceiling.position.set(0, 10, 4);
    this.root.add(ceiling);

    this.createRoom();
    this.createTutor();

    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 100);
    this.camera.position.copy(this.playerPosition);

    this.game.setCamera(this.camera);

    this.controls = this.game.input.registerBindings({
      copy: "Space"
    });
    this.game.setMessage(
      "Click the game for mouse-look. Hold SPACE to copy. Release when the tutor watches you."
    );
  }

  createRoom() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(22, 20),
      new THREE.MeshStandardMaterial({
        color: 0x373941,
        roughness: 0.9
      })
    );

    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.root.add(floor);

    const deskMaterial = new THREE.MeshStandardMaterial({
      color: 0x785f48
    });

    for (let row = 0; row < 4; row++) {
      for (let column = -3; column <= 3; column++) {
        if (row === 0 && column === 0) {
          continue;
        }

        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.75, 0.9),
          deskMaterial
        );

        desk.position.set(
          column * 2.3,
          0.55,
          1 - row * 2.5
        );

        desk.castShadow = true;
        desk.receiveShadow = true;
        this.root.add(desk);
      }
    }

    const neighbour = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.6, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x35e0d1 })
    );

    neighbour.position.set(2.1, 0.8, 3.3);
    this.root.add(neighbour);
  }

  createTutor() {
    this.tutor = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 1.9, 0.85),
      new THREE.MeshStandardMaterial({
        color: 0xe35b66
      })
    );

    this.tutor.position.set(-6, 0.95, -5);
    this.tutor.castShadow = true;
    this.root.add(this.tutor);

    this.spotlight = new THREE.SpotLight(
      0xff5c6c,
      4,
      12,
      THREE.MathUtils.degToRad(28),
      0.35,
      1.2
    );

    this.spotlight.castShadow = true;
    this.spotlight.position.set(0, 0.8, 0);

    this.tutor.add(this.spotlight);
    this.root.add(this.spotlight.target);
  }

  update(dt) {
    if (this.completed) {
      return;
    }

    this.updateTutor(dt);
    this.updateMouseLook();
    this.updateCheating(dt);

    this.game.setHUD(`
      <strong>Don't Get Caught</strong><br>
      Answers copied: ${Math.round(this.answerProgress)}%<br>
      Suspicion: ${Math.round(this.suspicion)}%<br>
      ${this.controls.isDown("copy") ? "COPYING…" : "Facing forward"}
    `);

    if (this.answerProgress >= 100) {
      this.completed = true;
      this.game.completeLevel("Test completed. Calculating results…");
    }

    if (this.suspicion >= 100) {
      this.completed = true;
      this.game.failLevel("Caught! Restarting from the checkpoint.");
    }
  }

  updateTutor(dt) {
    this.tutorTime += dt;

    const x = Math.sin(this.tutorTime * 0.55) * 7;
    const z = -4.5 + Math.cos(this.tutorTime * 0.32) * 1.5;

    this.tutor.position.set(x, 0.95, z);

    const toPlayer = this.playerPosition
      .clone()
      .sub(this.tutor.position)
      .setY(0)
      .normalize();

    this.tutor.rotation.y = Math.atan2(toPlayer.x, toPlayer.z);

    this.spotlight.target.position.copy(this.playerPosition);
  }

  updateMouseLook() {
    const mouse = this.game.input.consumeMouseDelta();

    this.yaw -= mouse.x * 0.002;
    this.pitch -= mouse.y * 0.002;

    this.yaw = clamp(this.yaw, -1.0, 1.0);
    this.pitch = clamp(this.pitch, -0.65, 0.45);

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  updateCheating(dt) {
    const copying = this.controls.isDown("copy");

    const toPlayer = this.playerPosition
      .clone()
      .sub(this.tutor.position);

    const distance = toPlayer.length();

    const tutorForward = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(this.tutor.quaternion)
      .normalize();

    const directionToPlayer = toPlayer.normalize();

    const dot = tutorForward.dot(directionToPlayer);

    const seen =
      distance < 11 &&
      dot > Math.cos(THREE.MathUtils.degToRad(32));

    if (copying) {
      this.answerProgress += 16 * dt;

      if (seen) {
        this.suspicion += 34 * dt;
      } else {
        this.suspicion -= 7 * dt;
      }
    } else {
      this.suspicion -= 18 * dt;
    }

    this.answerProgress = clamp(this.answerProgress, 0, 100);
    this.suspicion = clamp(this.suspicion, 0, 100);
  }

  dispose() {
    this.controls?.dispose();

    if (document.pointerLockElement === this.game.renderer.domElement) {
      document.exitPointerLock?.();
    }

    disposeObject3D(this.root);
  }
}
