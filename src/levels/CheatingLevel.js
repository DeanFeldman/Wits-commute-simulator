import * as THREE from "three";
import { clamp } from "../shared/math.js";
import { disposeObject3D } from "../shared/disposeObject3D.js";
import { CollisionWorld } from "../shared/CollisionWorld.js";
import { WaypointMover } from "../shared/WaypointMover.js";
import { LevelAudio } from "../shared/LevelAudio.js";

export const LEVEL_THREE_BALANCE = Object.freeze({
  answerGainPerSecond: 5,
  suspicionGainPerSecond: 30,
  suspicionDecayPerSecond: 6,
  tutorPauseSeconds: 2.6,
  tutorTurnSpeed: 2.4
});

export function updateStealthMeters({
  answerProgress,
  suspicion,
  copying,
  seen,
  dt
}) {
  let nextAnswer = answerProgress;
  let nextSuspicion = suspicion;

  if (copying) {
    nextAnswer += LEVEL_THREE_BALANCE.answerGainPerSecond * dt;

    if (seen) {
      nextSuspicion +=
        LEVEL_THREE_BALANCE.suspicionGainPerSecond * dt;
    }
  } else {
    nextSuspicion -=
      LEVEL_THREE_BALANCE.suspicionDecayPerSecond * dt;
  }

  return {
    answerProgress: clamp(nextAnswer, 0, 100),
    suspicion: clamp(nextSuspicion, 0, 100)
  };
}

export class CheatingLevel {
  constructor(game) {
    this.game = game;
    this.name = "Level 3 — Don't Get Caught";

    this.root = new THREE.Group();

    this.camera = null;
    this.controls = null;

    this.playerPosition = new THREE.Vector3(0, 1.85, 4);

    this.tutor = null;
    this.spotlight = null;
    this.collisionWorld = null;

    this.tutorTime = 0;
    this.patrolPoints = [
      new THREE.Vector3(-6, 0.95, -5.1),
      new THREE.Vector3(6, 0.95, -5.1),
      new THREE.Vector3(6, 0.95, -3.9),
      new THREE.Vector3(-6, 0.95, -3.9)
    ];
    this.patrolIndex = 1;
    this.patrolState = "walk";
    this.stateTimer = 0;
    this.occluders = [];
    this.raycaster = new THREE.Raycaster();
    this.playerSeen = false;
    this.tutorMover = null;
    this.tutorLegs = [];
    this.tutorWalkPhase = 0;

    this.answerProgress = 0;
    this.suspicion = 0;
    this.timeRemaining = 75;
    this.copyLean = 0;
    this.audio = new LevelAudio();

    this.yaw = 0;
    this.pitch = -0.05;

    this.completed = false;
  }

  load() {
    const scene = this.game.scene;

    scene.background = new THREE.Color(0x17191e);

    scene.add(this.root);
    this.audio.startDrone(39, 0.004);
    this.collisionWorld = new CollisionWorld(this.root);

    const ambient = new THREE.HemisphereLight(0xaec8df, 0x17120f, 0.55);
    this.root.add(ambient);

    const ceiling = new THREE.DirectionalLight(0xfff1d0, 0.7);
    ceiling.position.set(0, 10, 4);
    this.root.add(ceiling);

    this.createRoom();
    this.createLightingIdentity();
    this.createTutor();
    this.tutorMover = new WaypointMover(this.tutor, {
      points: this.patrolPoints, speed: 2.1, pauseAtNodes: LEVEL_THREE_BALANCE.tutorPauseSeconds,
      debugRoot: this.root, debugColor: 0xff7f86
    });
    this.collisionWorld.rebuild();

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
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x373941,
      roughness: 0.9
    });
    const tierHeights = [0.9, 0.6, 0.3, 0];

    for (let row = 0; row < tierHeights.length; row++) {
      const tier = new THREE.Mesh(
        new THREE.BoxGeometry(18, tierHeights[row] + 0.2, 2.4),
        floorMaterial
      );
      tier.position.set(0, (tierHeights[row] + 0.2) / 2 - 0.1, 4 - row * 2.5);
      tier.receiveShadow = true;
      this.root.add(tier);
    }

    const deskMaterial = new THREE.MeshStandardMaterial({ color: 0x785f48 });
    for (let row = 0; row < 4; row++) {
      for (let column = -3; column <= 3; column++) {
        const desk = new THREE.Mesh(
          new THREE.BoxGeometry(1.5, 0.75, 0.9),
          deskMaterial
        );
        desk.position.set(
          column * 2.3,
          tierHeights[row] + 0.55,
          3.2 - row * 2.5
        );
        desk.castShadow = true;
        desk.receiveShadow = true;
        this.root.add(desk);
        this.occluders.push(desk);
        this.collisionWorld.add({ object: desk, size: [1.5, 0.75, 0.9], color: 0x785f48, tag: "desk" });
      }
    }

    const seatGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const seatMaterial = new THREE.MeshStandardMaterial({ color: 0x35516e });
    const seats = new THREE.InstancedMesh(seatGeometry, seatMaterial, 28);
    const seatTransform = new THREE.Matrix4();
    let seatIndex = 0;
    for (let row = 0; row < 4; row++) {
      for (let column = -3; column <= 3; column++) {
        seatTransform.setPosition(
          column * 2.3,
          tierHeights[row] + 0.4,
          4 - row * 2.5
        );
        seats.setMatrixAt(seatIndex, seatTransform);
        seatIndex += 1;
      }
    }
    seats.instanceMatrix.needsUpdate = true;
    seats.castShadow = true;
    seats.receiveShadow = true;
    this.root.add(seats);
    this.occluders.push(seats);

    const studentMaterial = new THREE.MeshStandardMaterial({ color: 0x56738f, roughness: 0.75 });
    for (const [x, z] of [[0, 1.5], [-2.3, -1], [2.3, -1], [-4.6, -3.5], [4.6, -3.5]]) {
      const student = new THREE.Mesh(new THREE.BoxGeometry(0.65, 1.8, 0.65), studentMaterial);
      student.position.set(x, 1.15, z);
      student.castShadow = true;
      this.root.add(student);
      this.occluders.push(student);
    }
    const aisle = new THREE.Mesh(
      new THREE.BoxGeometry(15, 0.03, 0.55),
      new THREE.MeshBasicMaterial({ color: 0xd6b24c })
    );
    aisle.position.set(0, 0.08, -5.1);
    this.root.add(aisle);
  }

  createLightingIdentity() {
    const enclosureMaterial = new THREE.MeshStandardMaterial({ color: 0x20242c, roughness: 0.92 });
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(18, 0.18, 14), enclosureMaterial);
    ceiling.position.set(0, 6.2, -1);
    ceiling.receiveShadow = true;
    this.root.add(ceiling);
    for (const x of [-9, 9]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 6.2, 14), enclosureMaterial);
      wall.position.set(x, 3.1, -1);
      wall.receiveShadow = true;
      this.root.add(wall);
    }
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(18, 6.2, 0.2), enclosureMaterial);
    frontWall.position.set(0, 3.1, -7.8);
    frontWall.receiveShadow = true;
    this.root.add(frontWall);

    const fixtureMaterial = new THREE.MeshStandardMaterial({ color: 0xffedc2, emissive: 0xffc870, emissiveIntensity: 1.4 });
    for (const [x, z] of [[-5, 2.5], [0, 0], [5, -2.5]]) {
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.55), fixtureMaterial);
      fixture.position.set(x, 6.02, z);
      this.root.add(fixture);
      const light = new THREE.PointLight(0xffd7a3, 1.25, 8, 2);
      light.position.set(x, 5.8, z);
      this.root.add(light);
    }

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(5.8, 3.2),
      new THREE.MeshBasicMaterial({ color: 0xd7e9ff, transparent: true, opacity: 0.5 })
    );
    screen.position.set(0, 3.3, -7.65);
    this.root.add(screen);
    const projector = new THREE.Mesh(
      new THREE.BoxGeometry(0.65, 0.35, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x30343c, emissive: 0x80b8ff, emissiveIntensity: 1.1 })
    );
    projector.position.set(0, 5.6, 5.2);
    this.root.add(projector);
    const projectorTarget = new THREE.Object3D();
    projectorTarget.position.copy(screen.position);
    this.root.add(projectorTarget);
    const projectorGlow = new THREE.SpotLight(0x8abaff, 1.1, 18, THREE.MathUtils.degToRad(20), 0.7, 1.5);
    projectorGlow.position.copy(projector.position);
    projectorGlow.target = projectorTarget;
    this.root.add(projectorGlow);
  }
  createTutor() {
    this.tutor = new THREE.Group();
    this.tutor.position.copy(this.patrolPoints[0]);
    this.root.add(this.tutor);
    this.collisionWorld.add({ object: this.tutor, size: [0.85, 1.9, 0.85], color: 0xe35b66, tag: "tutor" });

    const clothes = new THREE.MeshStandardMaterial({ color: 0xe35b66, roughness: 0.72 });
    const trousers = new THREE.MeshStandardMaterial({ color: 0x273442, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd7a47e, roughness: 0.78 });
    this.tutorBody = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.55), clothes);
    this.tutorBody.castShadow = true;
    this.tutor.add(this.tutorBody);
    for (const x of [-0.24, 0.24]) {
      const leg = new THREE.Group();
      leg.position.set(x, -0.5, 0);
      const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.9, 0.3), trousers);
      legMesh.position.y = -0.45;
      legMesh.castShadow = true;
      leg.add(legMesh);
      this.tutor.add(leg);
      this.tutorLegs.push(leg);
    }

    this.tutorHead = new THREE.Group();
    this.tutorHead.position.y = 0.75;
    const headMesh = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.58, 0.58), skin);
    headMesh.castShadow = true;
    this.tutorHead.add(headMesh);
    this.tutor.add(this.tutorHead);
    this.visionTarget = new THREE.Object3D();
    this.root.add(this.visionTarget);
    this.spotlight = new THREE.SpotLight(0xff7f86, 1.35, 10, THREE.MathUtils.degToRad(32), 0.55, 1.5);
    this.spotlight.castShadow = true;
    this.tutorHead.add(this.spotlight);
    this.spotlight.target = this.visionTarget;

    const coneLength = 5.5;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(Math.tan(THREE.MathUtils.degToRad(32)) * coneLength, coneLength, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xff8a8f, transparent: true, opacity: 0.075, depthWrite: false, side: THREE.DoubleSide })
    );
    cone.rotation.x = -Math.PI / 2;
    cone.position.z = coneLength / 2;
    this.tutorHead.add(cone);
  }

  update(dt) {
    if (this.completed) {
      return;
    }

    this.updateTutor(dt);
    this.audio.updateClock(dt);
    this.updateMouseLook();
    this.updateCheating(dt);
    this.timeRemaining = Math.max(0, this.timeRemaining - dt);

    this.game.setHUD(`
      <strong>Don't Get Caught</strong><br>
      <span class="hud-label">ANSWERS</span><div class="meter progress"><i style="width: ${this.answerProgress}%"></i></div>${Math.round(this.answerProgress)}%<br>
      <span class="hud-label">SUSPICION</span><div class="meter suspicion"><i style="width: ${this.suspicion}%"></i></div>${Math.round(this.suspicion)}%<br>
      Time remaining: ${Math.ceil(this.timeRemaining)}s<br>
      ${this.controls.isDown("copy") ? "COPYING — lean exposed" : "Facing forward — safe posture"}
    `);

    if (this.answerProgress >= 100) {
      this.completed = true;
      this.game.completeLevel("Test completed. Calculating results…");
    }

    if (this.timeRemaining <= 0) {
      this.completed = true;
      this.game.failLevel("Time is up. Restarting from the checkpoint.");
    }

    if (this.suspicion >= 100) {
      this.game.flashHUD();
      this.game.playAlertTone(120, 0.2);
      this.completed = true;
      this.game.failLevel("Caught! Restarting from the checkpoint.");
    }
  }

  updateTutor(dt) {
    const previousPosition = this.tutor.position.clone();
    this.tutorMover.update(dt);

    const movement = this.tutor.position
      .clone()
      .sub(previousPosition)
      .setY(0);

    const isWalking = movement.lengthSq() > 0.0001;
    const isScanning = this.tutorMover.pauseTimer > 0;

    if (isWalking) {
      const targetYaw = Math.atan2(movement.x, movement.z);
      const difference = Math.atan2(
        Math.sin(targetYaw - this.tutor.rotation.y),
        Math.cos(targetYaw - this.tutor.rotation.y)
      );

      this.tutor.rotation.y += THREE.MathUtils.clamp(
        difference,
        -5 * dt,
        5 * dt
      );
    } else if (isScanning) {
      // During each patrol pause, deliberately turn toward the player's
      // side of the room instead of scanning only along the walking path.
      const toPlayer = this.playerPosition
        .clone()
        .sub(this.tutor.position)
        .setY(0);

      if (toPlayer.lengthSq() > 0.0001) {
        const targetYaw = Math.atan2(toPlayer.x, toPlayer.z);
        const difference = Math.atan2(
          Math.sin(targetYaw - this.tutor.rotation.y),
          Math.cos(targetYaw - this.tutor.rotation.y)
        );

        const maxTurn =
          LEVEL_THREE_BALANCE.tutorTurnSpeed * dt;

        this.tutor.rotation.y += THREE.MathUtils.clamp(
          difference,
          -maxTurn,
          maxTurn
        );
      }
    }

    this.patrolState = isScanning ? "scan" : "walk";
    this.stateTimer = this.tutorMover.pauseTimer;
    this.tutorTime += dt;

    this.updateTutorAnimation(dt, isWalking);

    this.audio.updateTutorFootsteps(
      dt,
      isWalking,
      this.tutor.position.x,
      this.playerPosition.x
    );

    const headForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
      this.tutorHead.getWorldQuaternion(new THREE.Quaternion())
    );

    this.visionTarget.position
      .copy(this.tutorHead.getWorldPosition(new THREE.Vector3()))
      .addScaledVector(headForward, 10);
  }

  updateTutorAnimation(dt, isWalking) {
    if (isWalking) {
      this.tutorWalkPhase += dt * 11;
    }

    const stride = isWalking
      ? Math.sin(this.tutorWalkPhase) * 0.48
      : 0;

    this.tutorLegs[0].rotation.x = stride;
    this.tutorLegs[1].rotation.x = -stride;

    this.tutorBody.position.y = isWalking
      ? Math.abs(Math.sin(this.tutorWalkPhase)) * 0.045
      : 0;

    if (this.patrolState === "scan") {
      // Once the body has turned toward the room, sweep the vision cone
      // slightly so the pause reads as deliberate observation.
      this.tutorHead.rotation.y =
        Math.sin(this.tutorTime * 3.2) * 0.2;
    } else {
      this.tutorHead.rotation.y =
        Math.sin(this.tutorWalkPhase * 0.5) *
        (isWalking ? 0.07 : 0.025);
    }
  }

  updateMouseLook() {
    const mouse = this.game.input.consumeMouseDelta();

    const sensitivity = this.game.levelThreeLookSensitivity ?? 1;
    this.yaw -= mouse.x * 0.002 * sensitivity;
    this.pitch -= mouse.y * 0.002 * sensitivity;

    this.yaw = clamp(this.yaw, -1.0, 1.0);
    this.pitch = clamp(this.pitch, -0.65, 0.45);

    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }

  updateCheating(dt) {
    const copying = this.controls.isDown("copy");
    const targetLean = copying ? 1 : 0;

    this.copyLean +=
      (targetLean - this.copyLean) *
      Math.min(1, dt * 12);

    this.camera.rotation.z = -this.copyLean * 0.12;

    const seen = this.canTutorSeePlayer();
    this.playerSeen = seen;

    const previousAnswer = this.answerProgress;

    const meters = updateStealthMeters({
      answerProgress: this.answerProgress,
      suspicion: this.suspicion,
      copying,
      seen,
      dt
    });

    this.answerProgress = meters.answerProgress;
    this.suspicion = meters.suspicion;

    // Cue once when crossing each 12% answer milestone.
    if (
      copying &&
      Math.floor(previousAnswer / 12) <
        Math.floor(this.answerProgress / 12)
    ) {
      this.audio.cue(680, 0.04, 0.025);
    }
  }

  canTutorSeePlayer() {
    const eye = this.tutorHead.getWorldPosition(new THREE.Vector3());
    const toPlayer = this.playerPosition.clone().sub(eye);
    const distance = toPlayer.length();
    if (distance > 11) return false;

    const direction = toPlayer.normalize();
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.tutorHead.getWorldQuaternion(new THREE.Quaternion()));
    if (forward.dot(direction) < Math.cos(THREE.MathUtils.degToRad(32))) return false;

    this.root.updateMatrixWorld(true);
    this.raycaster.set(eye, direction);
    this.raycaster.far = distance - 0.08;
    return this.raycaster.intersectObjects(this.occluders, true).length === 0;
  }
  toggleCollisionDebug(visible) {
    this.collisionWorld.setDebugVisible(visible);
    this.tutorMover?.setDebugVisible(visible);
  }

  dispose() {
    this.audio.dispose();
    this.controls?.dispose();

    if (document.pointerLockElement === this.game.renderer.domElement) {
      document.exitPointerLock?.();
    }

    disposeObject3D(this.root);
  }
}
