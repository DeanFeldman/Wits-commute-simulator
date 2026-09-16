import { poseWalk } from "./PedestrianFactory.js";

// The people on the Level 2 walkways. They are obstacles you can walk into,
// not hazards: bumping someone stops you for a moment and they tell you about it.
//
// Nobody walks onto Yale Road, so the only thing that can end a run is traffic.

// What people say. `bump` lines are picked by personality; after a few bumps
// everyone runs out of patience and uses `annoyed`.
export const CROWD_LINES = Object.freeze({
  student: [
    "Eish, watch where you're going, bru!",
    "Haibo! Eyes up, chief.",
    "Are you also late for the COMS exam?",
    "Yoh, you're sweating. Exam today?",
    "Sorry! ...wait, why am I apologising?",
    "Did you study? Because I did not.",
    "Bro, the bridge is wide enough for two people.",
    "You look like you parked at the far end of West Campus."
  ],
  commuter: [
    "Sharp sharp, but go around, hey.",
    "My Gautrain was late and now this.",
    "Careful! Yale Road taxis don't brake for anyone.",
    "Ai, not today my friend.",
    "Load-shedding in my res and now I'm getting tackled."
  ],
  phone: [
    "Hold on, someone just walked into me... no, I'm fine.",
    "Can't you see I'm on a voice note?",
    "Sorry, I'm reading the exam venue list. Again.",
    "Bro, my data is on 3%. Don't."
  ],
  jogger: [
    "On your left! ...too late.",
    "Can't stop, I'm on a streak!",
    "That's gonna show up on my Strava."
  ],
  guard: [
    "Student card? ...Fine, you look stressed enough. Go.",
    "Slow down! No running on the bridge.",
    "Campus Protection. Walk, don't barge."
  ],
  queue: [
    "Hey, there's a queue for Vida!",
    "No skipping, I've been here since 7.",
    "Get in line, the barista knows my name."
  ],
  tutor: [
    "Exam venue is inside. Phones off!",
    "Late, are we? Brendan's already handing out papers.",
    "Walk in quietly. Very quietly."
  ],
  annoyed: [
    "Again?!",
    "Okay, now you're doing it on purpose.",
    "I'm calling Campus Protection.",
    "Do you need glasses or a map?",
    "Bru. Seriously."
  ],
  cupDrop: [
    "Ag no man, my Vida!",
    "That was a R40 flat white!",
    "You owe me a coffee. Actually, just take it."
  ],
  excuseMe: [
    "Excuse me, sorry!",
    "Sorry, sharp!",
    "Scuse, scuse."
  ],
  // Said once when the player first walks near a standing person.
  greeting: {
    guard: "Morning! Watch the traffic on Yale Road.",
    queue: "Tip: a Red Cappuccino gets you through one taxi. Just one.",
    tutor: "Nearly there. Engineering is right behind me.",
    phone: "Bru, the taxis on Yale Road stop randomly. Don't trust them.",
    student: "Iced latte from Vida? Everything feels slower after one."
  }
});

const NAMES = ["Thabo", "Lerato", "Sipho", "Ayesha", "Kyle", "Naledi", "Pieter", "Zanele", "Tariq", "Megan", "Karabo", "Priya", "Lwazi", "Bongi"];
const SHIRTS = [0xa8464f, 0x405f8e, 0x63864f, 0x9a693f, 0x645687, 0x327a76, 0xd08a2c, 0x2e3440, 0xe0d6c3];
const TROUSERS = [0x31363d, 0x454b55, 0x2b3a57, 0x6b5a45, 0x1f2328];
const SKINS = [0x5a3825, 0x7b4a2d, 0x9a6440, 0xb97857, 0xd29c78, 0xe7bf9d];
const HAIR = ["short", "puff", "bun", "cap", "none", "short"];
const HAIR_COLORS = [0x1d1714, 0x2f2118, 0x5a3b22, 0x8c6a3a, 0x3a3f58, 0xa4312a];
const BACKPACKS = [0x2c3e50, 0x8e2b2b, 0x355e3b, 0x505050, null];

export function pickLine(lines, random) {
  return lines[Math.floor(random() * lines.length) % lines.length];
}

// How close a person must be to a cell to occupy it.
const OCCUPY_X = 0.6;
const OCCUPY_Z = 0.95;

export class CampusCrowd {
  constructor({ root, factory, random, onSay = null }) {
    this.root = root;
    this.factory = factory;
    this.random = random;
    this.onSay = onSay;
    this.people = [];
    this.time = 0;
    this.greetCooldown = 0;
  }

  // `plan` entries: { kind, x, z, yaw } for people standing still, or
  // { kind, x, fromZ, toZ, speed } for walkers pacing up and down one column.
  spawn(plan) {
    plan.forEach((entry, index) => this.add(entry, index));
  }

  add(entry, index = this.people.length) {
    const pick = (list, salt) => list[(index * salt + Math.floor(this.random() * list.length)) % list.length];
    const kind = entry.kind;
    const mesh = this.factory.create({
      shirt: kind === "tutor" ? 0x2a2f3a : pick(SHIRTS, 3),
      trousers: pick(TROUSERS, 5),
      skin: pick(SKINS, 7),
      hair: kind === "guard" ? "cap" : pick(HAIR, 11),
      hairColor: kind === "guard" ? 0x1c2a44 : pick(HAIR_COLORS, 13),
      backpack: kind === "student" || kind === "commuter" ? pick(BACKPACKS, 17) : null,
      vest: kind === "guard",
      holding: entry.holding ?? (kind === "phone" ? "phone" : null),
      scale: 0.92 + ((index * 7) % 5) * 0.03
    });
    mesh.name = `campus-person-${index}-${kind}`;
    const walking = entry.fromZ !== undefined;
    const z = walking ? entry.fromZ : entry.z;
    mesh.position.set(entry.x, entry.y ?? 0.95, z);
    const yaw = walking ? (entry.toZ < entry.fromZ ? Math.PI : 0) : (entry.yaw ?? 0);
    mesh.rotation.y = yaw;
    this.root.add(mesh);

    const person = {
      kind,
      name: entry.name ?? NAMES[index % NAMES.length],
      mesh,
      rig: mesh.userData.rig,
      walking,
      x: entry.x,
      fromZ: entry.fromZ,
      toZ: entry.toZ,
      targetZ: entry.toZ,
      speed: entry.speed ?? 1.1,
      restYaw: yaw,
      yaw,
      phase: index * 1.37,
      stride: 0,
      waitTimer: walking ? this.random() * 1.2 : 0,
      reactTimer: 0,
      recoil: 0,
      talkCooldown: 0,
      bumps: 0,
      greeted: false,
      facePlayer: null
    };
    this.people.push(person);
    return person;
  }

  // The person standing in (or walking through) a grid cell, if any.
  personAt(x, z) {
    return this.people.find((person) =>
      Math.abs(person.mesh.position.x - x) < OCCUPY_X && Math.abs(person.mesh.position.z - z) < OCCUPY_Z
    ) ?? null;
  }

  // The player walked into `person`. Returns { line, droppedCup } where
  // droppedCup is the cup type the person let go of, if they were carrying one.
  bump(person, playerPosition) {
    person.bumps += 1;
    person.reactTimer = 1.8;
    person.recoil = 1;
    person.facePlayer = { x: playerPosition.x, z: playerPosition.z };

    let droppedCup = null;
    let line;
    const heldCup = person.rig.holding && person.rig.holding !== "phone" ? person.rig.holding : null;
    if (heldCup && person.rig.heldItem.visible) {
      person.rig.heldItem.visible = false;
      person.rig.arms[1].rotation.x = 0;
      person.rig.holding = null;
      droppedCup = heldCup;
      line = pickLine(CROWD_LINES.cupDrop, this.random);
    } else if (person.bumps >= 3) {
      line = pickLine(CROWD_LINES.annoyed, this.random);
    } else {
      line = pickLine(CROWD_LINES[person.kind] ?? CROWD_LINES.student, this.random);
    }
    this.say(person, line, person.bumps >= 3 ? "angry" : "surprised");
    return { line, droppedCup };
  }

  say(person, text, tone = "neutral") {
    person.talkCooldown = 3.5;
    this.onSay?.(person, text, tone);
  }

  update(dt, player) {
    this.time += dt;
    this.greetCooldown = Math.max(0, this.greetCooldown - dt);
    for (const person of this.people) {
      person.talkCooldown = Math.max(0, person.talkCooldown - dt);
      person.recoil = Math.max(0, person.recoil - dt * 3);

      if (person.reactTimer > 0) {
        person.reactTimer = Math.max(0, person.reactTimer - dt);
        this.faceTowards(person, person.facePlayer, dt);
        if (person.reactTimer === 0) person.facePlayer = null;
      } else if (person.walking) {
        this.updateWalker(person, dt, player);
      } else {
        this.updateGreeting(person, player);
        this.turnTo(person, person.restYaw, dt);
      }
      this.animate(person, dt);
    }
  }

  updateWalker(person, dt, player) {
    const position = person.mesh.position;
    if (person.waitTimer > 0) {
      person.waitTimer = Math.max(0, person.waitTimer - dt);
      person.moving = false;
      return;
    }
    const direction = Math.sign(person.targetZ - position.z);
    // Wait for the player rather than walking through them.
    const ahead = (player.z - position.z) * direction;
    if (Math.abs(player.x - position.x) < 0.7 && ahead > 0 && ahead < 1.05) {
      person.moving = false;
      if (person.talkCooldown === 0 && this.random() < 0.02) {
        this.say(person, pickLine(CROWD_LINES.excuseMe, this.random));
      }
      return;
    }
    const step = Math.min(person.speed * dt, Math.abs(person.targetZ - position.z));
    position.z += direction * step;
    person.stride += step;
    person.moving = step > 0;
    this.turnTo(person, direction < 0 ? Math.PI : 0, dt);
    if (Math.abs(person.targetZ - position.z) < 0.01) {
      // Turn around at the end of the path after a short pause.
      person.targetZ = person.targetZ === person.toZ ? person.fromZ : person.toZ;
      person.waitTimer = 0.8 + this.random() * 1.4;
    }
  }

  updateGreeting(person, player) {
    if (person.greeted || this.greetCooldown > 0 || person.talkCooldown > 0) return;
    const line = CROWD_LINES.greeting[person.kind];
    if (!line) return;
    if (Math.hypot(player.x - person.mesh.position.x, player.z - person.mesh.position.z) > 2.6) return;
    person.greeted = true;
    this.greetCooldown = 5;
    this.say(person, line, "friendly");
  }

  faceTowards(person, point, dt) {
    if (!point) return;
    const yaw = Math.atan2(point.x - person.mesh.position.x, point.z - person.mesh.position.z);
    this.turnTo(person, yaw, dt);
  }

  turnTo(person, yaw, dt) {
    const current = person.mesh.rotation.y;
    const delta = Math.atan2(Math.sin(yaw - current), Math.cos(yaw - current));
    person.mesh.rotation.y = current + delta * (1 - Math.exp(-8 * dt));
  }

  animate(person, dt) {
    const rig = person.rig;
    if (person.walking && person.moving && person.reactTimer === 0) {
      poseWalk(rig, (person.stride / 1.5) * Math.PI * 2, 0.85);
    } else {
      // Settle the legs and idle: breathing, chatting gestures, or staring at a phone.
      for (const limb of [rig.legs[0], rig.legs[1], rig.arms[0]]) limb.rotation.x *= Math.exp(-10 * dt);
      if (!rig.holding) rig.arms[1].rotation.x *= Math.exp(-10 * dt);
      rig.upper.position.y = Math.sin(this.time * 1.8 + person.phase) * 0.012;
      if (person.kind === "student" && !person.walking) {
        rig.arms[0].rotation.x = Math.sin(this.time * 2.3 + person.phase) * 0.35 - 0.2;
        rig.arms[0].rotation.z = -0.15;
      }
    }
    rig.head.rotation.x = rig.holding === "phone" ? 0.45 : 0;
    // Recoil leans the body back after a bump; reacting shakes the head.
    rig.upper.rotation.x = -0.28 * person.recoil;
    rig.head.rotation.y = person.reactTimer > 0.6 ? Math.sin(this.time * 18) * 0.25 : 0;
  }
}

// Where everybody stands and walks, relative to the strips of the route.
// `zones` maps strip type -> { z, depth }. `step` is the player grid step, and
// every position is snapped to the player's grid so people occupy real cells.
export function createCrowdPlan({ zones, startZ, step }) {
  const snap = (z) => startZ - Math.round((startZ - z) / step) * step;
  // The first cell fully inside a strip, counted in from its far or near edge.
  const top = (zone, rows = 0) => snap(zone.z + zone.depth / 2 - step - rows * step);
  const bottom = (zone, rows = 0) => snap(zone.z - zone.depth / 2 + step + rows * step);
  const { start, "bridge-entry": entry, bridge, "bridge-exit": exit, finish } = zones;

  return [
    // Walkers each own one column, so they never have to pass each other.
    { kind: "commuter", x: -step, fromZ: top(start, 1), toZ: snap(exit.z), speed: 1.35 },
    { kind: "student", x: step, fromZ: bottom(exit), toZ: snap(start.z), speed: 1.1, holding: "flatWhite" },
    { kind: "jogger", x: step * 2, fromZ: top(bridge, 1), toZ: bottom(bridge, 1), speed: 2.3 },
    { kind: "student", x: -step * 2, fromZ: bottom(start), toZ: top(start, 1), speed: 0.95, holding: "doubleShot" },
    { kind: "commuter", x: 0, fromZ: top(finish), toZ: bottom(finish, 2), speed: 1.0 },

    // A pair chatting outside the ARM, facing each other.
    { kind: "student", x: step * 2, z: snap(start.z), yaw: Math.PI },
    { kind: "student", x: step * 2, z: snap(start.z) - step, yaw: 0, holding: "icedLatte" },
    // Campus Protection at the bridge entrance.
    { kind: "guard", x: -step * 2, z: snap(entry.z), yaw: Math.PI / 2 },
    // Someone stopped dead on the bridge, reading their phone.
    { kind: "phone", x: 0, z: snap(bridge.z + step * 2), yaw: -Math.PI / 2 },
    // The Vida queue on the far landing faces the container.
    { kind: "queue", x: -step * 2, z: snap(exit.z), yaw: -Math.PI / 2, holding: "flatWhite" },
    { kind: "queue", x: -step * 2, z: snap(exit.z) + step, yaw: -Math.PI / 2 },
    // A tutor waiting outside Engineering.
    { kind: "tutor", x: step * 2, z: snap(finish.z), yaw: 0 },
    { kind: "phone", x: -step * 2, z: snap(finish.z) + step, yaw: Math.PI }
  ];
}

// Cells that standing people occupy, so cups are never placed underneath them.
export function standingCells(plan) {
  return plan.filter((entry) => entry.z !== undefined).map((entry) => ({ x: entry.x, z: entry.z }));
}
