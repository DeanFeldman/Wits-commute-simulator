import { PEDESTRIAN_SOLE_OFFSET, poseWalk, poseChase } from "./PedestrianFactory.js";

// The people on the Level 2 walkways. Most are obstacles you can walk into,
// not hazards: bumping someone stops you for a moment and they tell you about it.
//
// Nobody walks onto Yale Road, so the only thing that can end a run is traffic.

// The two quiz-giving NPCs are the exception: once the player gets close,
// they leave their spot and jog after the player with their hands up until
// they either catch them (see updateChaser / CrossingLevel.handleChaseCatches)
// or the player moves back out of range. Once caught and the quiz finishes,
// CrossingLevel calls sendOff(), which has the NPC walk on past the player
// (see updateLeaving) rather than
// freezing mid-chase. Each NPC's state lives on the person object, so the
// two run independently of one another.
const CHASE_KINDS = new Set(["psychQuizzer", "ccduAdvisor"]);
const CHASE_TRIGGER_DISTANCE = 4;
const CHASE_CATCH_DISTANCE = 0.9;
const CHASE_SPEED = 3.3;
const CHASE_MAX_DURATION = 1.6;
const CHASE_MAX_TRAVEL = 4.5;
const LEAVE_SPEED = 1.6;
// How far (in grid steps) a survey NPC may walk after a survey.
const LEAVE_MAX_STEPS = 5;
const SURVEY_COOLDOWN = 5;

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
  psychQuizzer: [
    "Oh — perfect, you're just the person I needed!",
    "Got a second for my psych elective survey?"
  ],
  ccduAdvisor: [
    "Hi! Got 30 seconds for a CCDU wellness question?",
    "Quick check-in from CCDU, if you don't mind."
  ],
  robot: [
    "BEEP. PEDESTRIAN ROUTE OCCUPIED.",
    "WITS BOT REQUESTS RIGHT OF WAY.",
    "BEEP BEEP. DELIVERY IN PROGRESS."
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
    student: "Iced latte from Vida? Everything feels slower after one.",
    psychQuizzer: "Excuse me — walk into me and I'll ask you something fun.",
    ccduAdvisor: "Hey! CCDU is doing quick check-ins today.",
    robot: "BEEP. CAMPUS DELIVERY ROUTE ACTIVE."
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
  // `grid` ({ step, originZ, minX, maxX, minZ, maxZ }) and `canOccupy(x, z)`
  // describe the walkable route, so survey NPCs only ever walk cell to cell
  // on it: never across Yale Road, into buildings, or through the railings.
  // `playerVariant` is the student model the player chose; nobody in the
  // crowd uses it, so the player never meets their own double.
  constructor({ root, factory, animatedFactory = null, random, onSay = null, grid = null, canOccupy = null, playerVariant = null, variantCount = null }) {
    this.root = root;
    this.grid = grid ?? { step: 1.2, originZ: 0, minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
    this.canOccupy = canOccupy ?? (() => true);
    this.lastPlayer = null;
    this.factory = factory;
    this.animatedFactory = animatedFactory;
    this.playerVariant = Number.isInteger(playerVariant) ? playerVariant : null;
    this.variantCount = variantCount ?? animatedFactory?.templates?.length ?? 0;
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
    // Imported human variants are already normalized to the same height.
    // Keep them at a uniform scale so model selection changes appearance only.
    const scale = kind === "robot" ? 0.9 : 1;
    const robot = kind === "robot";
    const appearance = {
      shirt: robot ? 0xc7d0d6 : kind === "tutor" ? 0x2a2f3a : pick(SHIRTS, 3),
      trousers: robot ? 0x39454d : pick(TROUSERS, 5),
      skin: robot ? 0xaebbc4 : pick(SKINS, 7),
      hair: robot ? "none" : kind === "guard" ? "cap" : pick(HAIR, 11),
      hairColor: kind === "guard" ? 0x1c2a44 : pick(HAIR_COLORS, 13),
      backpack: !robot && (kind === "student" || kind === "commuter") ? pick(BACKPACKS, 17) : null,
      vest: kind === "guard",
      holding: robot ? null : entry.holding ?? (kind === "phone" ? "phone" : null),
      robot,
      scale
    };
    const animated = !robot && Boolean(this.animatedFactory);
    const variant = animated ? this.crowdVariant(index) : null;
    const mesh = animated
      ? this.animatedFactory.create({ variant, holding: appearance.holding, scale })
      : this.factory.create(appearance);
    mesh.name = `campus-person-${index}-${kind}`;
    const walking = entry.fromZ !== undefined;
    const z = walking ? entry.fromZ : entry.z;
    const soleOffset = mesh.userData.soleOffset ?? PEDESTRIAN_SOLE_OFFSET * scale;
    mesh.position.set(entry.x, entry.y ?? (0.19 + soleOffset + 0.025), z);
    const yaw = walking ? (entry.toZ < entry.fromZ ? Math.PI : 0) : (entry.yaw ?? 0);
    mesh.rotation.y = yaw;
    this.root.add(mesh);

    const person = {
      kind,
      variant,
      name: entry.name ?? (robot ? `Wits Bot ${index + 1}` : NAMES[index % NAMES.length]),
      mesh,
      rig: mesh.userData.rig,
      animation: mesh.userData.animation ?? null,
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
      facePlayer: null,
      // Chase-only state; harmless on every other kind of person.
      chasing: false,
      chaseArmed: true,
      chaseTime: 0,
      chaseDistance: 0,
      surveyCooldown: 0,
      caught: false,
      leaving: false,
      returning: false,
      route: []
    };
    this.people.push(person);
    return person;
  }

  // The model for the index-th crowd member, skipping the player's model.
  crowdVariant(index) {
    const count = this.variantCount;
    if (count <= 1 || this.playerVariant === null || this.playerVariant >= count) return count > 0 ? index % count : index;
    const slot = index % (count - 1);
    return slot >= this.playerVariant ? slot + 1 : slot;
  }

  // The player switched models mid-level (dev panel). Anyone wearing the new
  // player model swaps to the one the player just gave up.
  setPlayerVariant(variant) {
    if (!Number.isInteger(variant) || variant === this.playerVariant) return;
    const previous = this.playerVariant;
    this.playerVariant = variant;
    if (!this.animatedFactory) return;
    for (const person of this.people) {
      if (person.variant !== variant || !person.animation) continue;
      const replacement = previous ?? this.crowdVariant(this.people.indexOf(person));
      if (replacement === variant) continue;
      this.reskin(person, replacement);
    }
  }

  reskin(person, variant) {
    const old = person.mesh;
    const holding = person.rig?.holding && person.rig.heldItem?.visible !== false ? person.rig.holding : null;
    const mesh = this.animatedFactory.create({ variant, holding, scale: old.scale.x });
    mesh.name = old.name;
    mesh.position.copy(old.position);
    mesh.rotation.copy(old.rotation);
    old.parent?.add(mesh);
    old.removeFromParent();
    person.animation?.mixer.stopAllAction();
    person.animation?.mixer.uncacheRoot(old.children[0]);
    person.mesh = mesh;
    person.rig = mesh.userData.rig;
    person.animation = mesh.userData.animation ?? null;
    person.variant = variant;
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
    const heldCup = person.rig?.holding && person.rig.holding !== "phone" ? person.rig.holding : null;
    if (heldCup && person.rig.heldItem?.visible) {
      person.rig.heldItem.visible = false;
      if (person.rig.arms) person.rig.arms[1].rotation.x = 0;
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

  // After a survey, walk away from the player along the route, then become
  // chaseable again.
  sendOff(person) {
    person.chasing = false;
    person.chaseArmed = false;
    person.surveyCooldown = SURVEY_COOLDOWN;
    person.caught = false;
    person.returning = false;
    person.moving = false;
    // A previous bump can leave the idle/reaction animation locked on while
    // the NPC moves away. Clear that reaction when the survey is finished.
    person.reactTimer = 0;
    person.recoil = 0;
    person.facePlayer = null;
    person.route = this.planRoute(person, this.lastPlayer, { leave: true });
    person.leaving = true;
  }

  snapCell(x, z) {
    const { step, originZ, minX, maxX, minZ, maxZ } = this.grid;
    const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
    return {
      x: clamp(Math.round(x / step) * step, minX, maxX),
      z: clamp(originZ - Math.round((originZ - z) / step) * step, minZ, maxZ)
    };
  }

  inGrid(x, z) {
    const { minX, maxX, minZ, maxZ } = this.grid;
    return x >= minX - 0.01 && x <= maxX + 0.01 && z >= minZ - 0.01 && z <= maxZ + 0.01;
  }

  // Walkable for an NPC: on the route and not on top of anyone else.
  isOpenCell(x, z, self, player) {
    if (!this.inGrid(x, z) || !this.canOccupy(x, z)) return false;
    if (player && Math.abs(player.x - x) < OCCUPY_X && Math.abs(player.z - z) < OCCUPY_Z) return false;
    return !this.people.some((other) => other !== self && !other.walking &&
      Math.abs(other.mesh.position.x - x) < OCCUPY_X && Math.abs(other.mesh.position.z - z) < OCCUPY_Z);
  }

  // Walkers pace a column; nobody should come to rest on their path.
  onWalkerPath(x, z) {
    const step = this.grid.step;
    return this.people.some((other) => other.walking && Math.abs(other.x - x) < 0.1 &&
      z >= Math.min(other.fromZ, other.toZ) - step * 0.5 && z <= Math.max(other.fromZ, other.toZ) + step * 0.5);
  }

  // Breadth-first search over open grid cells. With `leave`, pick a cell a few
  // steps away from the player; otherwise just the nearest open cell (used to
  // settle back onto the grid after a chase).
  planRoute(person, player, { leave = false } = {}) {
    const step = this.grid.step;
    const position = person.mesh.position;
    const start = this.snapCell(position.x, position.z);
    const key = (cell) => `${Math.round(cell.x / step)},${Math.round(cell.z / step)}`;
    const startOpen = this.isOpenCell(start.x, start.z, person, player);
    const parents = new Map([[key(start), null]]);
    const queue = [{ ...start, depth: 0 }];
    const goodRest = (cell) => this.isOpenCell(cell.x, cell.z, person, player) && !this.onWalkerPath(cell.x, cell.z);
    let best = null;
    let bestScore = -Infinity;
    const maxDepth = leave ? LEAVE_MAX_STEPS : 6;

    for (let i = 0; i < queue.length; i++) {
      const cell = queue[i];
      if (!leave && goodRest(cell)) { best = cell; break; }
      if (leave && cell.depth > 0 && goodRest(cell)) {
        const away = player ? Math.min(Math.hypot(cell.x - player.x, cell.z - player.z), step * 4) : 0;
        const score = away + cell.depth * 0.25 + this.random() * 0.3;
        if (score > bestScore) { bestScore = score; best = cell; }
      }
      if (cell.depth >= maxDepth) continue;
      for (const [dx, dz] of [[0, -step], [0, step], [-step, 0], [step, 0]]) {
        const next = { x: cell.x + dx, z: cell.z + dz, depth: cell.depth + 1 };
        const nextKey = key(next);
        if (parents.has(nextKey)) continue;
        // An NPC that ended up off the route may step back onto it, but
        // never walks further through blocked cells.
        if (!this.isOpenCell(next.x, next.z, person, player) && !(cell.depth === 0 && !startOpen && this.inGrid(next.x, next.z) && this.canOccupy(next.x, next.z))) continue;
        parents.set(nextKey, cell);
        queue.push(next);
      }
    }

    if (!best) return startOpen ? [] : [start];
    const route = [];
    for (let cell = best; cell && key(cell) !== key(start); cell = parents.get(key(cell))) route.unshift({ x: cell.x, z: cell.z });
    if (Math.hypot(position.x - start.x, position.z - start.z) > 0.05 && startOpen) route.unshift(start);
    return route;
  }

  // Walks the person along `person.route`, one grid cell at a time, waiting
  // if the player steps onto the next cell. Returns true once finished.
  followRoute(person, dt, player) {
    const position = person.mesh.position;
    const target = person.route[0];
    if (!target) {
      person.moving = false;
      return true;
    }
    if (player && Math.abs(player.x - target.x) < OCCUPY_X && Math.abs(player.z - target.z) < OCCUPY_Z) {
      person.moving = false;
      return false;
    }
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    // When walking away after a face-to-face survey, the character was
    // looking at the player. Turn towards the next waypoint before moving,
    // otherwise the model visibly slides backwards or sideways.
    if (distance > 1e-4) {
      const facingError = Math.atan2(
        Math.sin(yaw - person.mesh.rotation.y),
        Math.cos(yaw - person.mesh.rotation.y)
      );
      if (Math.abs(facingError) > 0.3) {
        person.moving = false;
        this.turnTo(person, yaw, dt);
        return false;
      }
    }

    const step = Math.min(LEAVE_SPEED * dt, distance);
    if (distance > 1e-4) {
      position.x += (dx / distance) * step;
      position.z += (dz / distance) * step;
      person.restYaw = yaw;
      this.turnTo(person, yaw, dt);
    }
    person.stride += step;
    person.moving = step > 1e-4;
    if (distance - step < 0.01) {
      position.x = target.x;
      position.z = target.z;
      person.route.shift();
    }
    return person.route.length === 0;
  }

  update(dt, player) {
    this.time += dt;
    this.lastPlayer = player;
    this.greetCooldown = Math.max(0, this.greetCooldown - dt);
    for (const person of this.people) {
      person.talkCooldown = Math.max(0, person.talkCooldown - dt);
      person.surveyCooldown = Math.max(0, person.surveyCooldown - dt);
      person.recoil = Math.max(0, person.recoil - dt * 3);
      person.caught = false;

      if (CHASE_KINDS.has(person.kind)) {
        if (person.leaving || person.returning) {
          this.updateLeaving(person, dt, player);
          this.animate(person, dt);
          continue;
        }
        this.updateChaser(person, dt, player);
        this.animate(person, dt);
        continue;
      }

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

  // IDLE -> CHASING once the player is within CHASE_TRIGGER_DISTANCE.
  // CHASING -> IDLE if the player gets back out of that range.
  // CHASING -> CAUGHT (person.caught = true, one frame) once the NPC closes
  // to CHASE_CATCH_DISTANCE; CrossingLevel reads that flag to open the quiz.
  updateChaser(person, dt, player) {
    const position = person.mesh.position;

    if (person.reactTimer > 0) {
      person.reactTimer = Math.max(0, person.reactTimer - dt);
      this.faceTowards(person, person.facePlayer, dt);
      if (person.reactTimer === 0) person.facePlayer = null;
      person.chasing = false;
      person.moving = false;
      return;
    }

    const dx = player.x - position.x;
    const dz = player.z - position.z;
    const distance = Math.hypot(dx, dz);

    if (distance > CHASE_TRIGGER_DISTANCE && person.surveyCooldown === 0) person.chaseArmed = true;

    if (!person.chasing && person.chaseArmed && person.surveyCooldown === 0 && distance <= CHASE_TRIGGER_DISTANCE) {
      person.chasing = true;
      person.chaseArmed = false;
      person.chaseTime = 0;
      person.chaseDistance = 0;
    } else if (person.chasing) {
      person.chaseTime += dt;
      if (distance > CHASE_TRIGGER_DISTANCE || person.chaseTime >= CHASE_MAX_DURATION || person.chaseDistance >= CHASE_MAX_TRAVEL) person.chasing = false;
    }

    if (!person.chasing) {
      // A chase that ended short of the player can leave the NPC between
      // cells; settle back onto the nearest walkable cell.
      const cell = this.snapCell(position.x, position.z);
      if (Math.hypot(position.x - cell.x, position.z - cell.z) > 0.05 || !this.canOccupy(cell.x, cell.z)) {
        person.route = this.planRoute(person, player);
        if (person.route.length > 0) {
          person.returning = true;
          return;
        }
      }
      this.updateGreeting(person, player);
      this.turnTo(person, person.restYaw, dt);
      person.moving = false;
      return;
    }

    const yaw = Math.atan2(dx, dz);

    if (distance <= CHASE_CATCH_DISTANCE) {
      person.moving = false;
      person.caught = true;
      this.turnTo(person, yaw, dt);
      return;
    }

    const step = Math.min(CHASE_SPEED * dt, distance);
    const nextX = position.x + Math.sin(yaw) * step;
    const nextZ = position.z + Math.cos(yaw) * step;
    // Never chase off the route (onto Yale Road, into railings or buildings).
    const nextCell = this.snapCell(nextX, nextZ);
    if (!this.inGrid(nextX, nextZ) || !this.canOccupy(nextCell.x, nextCell.z)) {
      person.chasing = false;
      person.moving = false;
      this.turnTo(person, yaw, dt);
      return;
    }
    position.x = nextX;
    position.z = nextZ;
    person.chaseDistance += step;
    person.stride += step;
    person.moving = true;
    this.turnTo(person, yaw, dt);
  }

  // Post-quiz departure (or settling back after a chase): follow the planned
  // grid route, then stand on that cell (animate's idle branch takes over).
  updateLeaving(person, dt, player) {
    if (!this.followRoute(person, dt, player)) return;
    person.moving = false;
    if (person.leaving) person.chaseArmed = person.surveyCooldown === 0;
    person.leaving = false;
    person.returning = false;
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
    if (person.animation) {
      // Animate footsteps only when the NPC actually moves. Leaving and
      // returning also include stationary turning and blocked waypoints.
      const moving = person.reactTimer === 0 && Boolean(person.moving);
      const speed = person.chasing ? CHASE_SPEED : person.leaving || person.returning ? LEAVE_SPEED : person.speed;
      // On departure/return, the first translating frame must already be a
      // full walk pose. A normal 0.18s crossfade makes the feet visibly slide
      // while the character is moving away after a repeated survey dialogue.
      const startingRouteWalk = (person.leaving || person.returning) &&
        moving && person.animation.active !== person.animation.walk;
      this.animatedFactory.setMoving(person.animation, moving, speed, person.chasing, startingRouteWalk);
      person.animation.mixer.update(dt);
      return;
    }

    const rig = person.rig;

    if (CHASE_KINDS.has(person.kind) && person.chasing) {
      const runAmount = person.caught ? 0.3 : 1;
      poseChase(rig, (person.stride / 1.3) * Math.PI * 2, runAmount);
      rig.head.rotation.x = 0;
      rig.head.rotation.y = 0;
      return;
    }

    if (CHASE_KINDS.has(person.kind) && (person.leaving || person.returning)) {
      if (person.moving) {
        // Reuses the ordinary walk cycle, which also zeroes arm rotation.z
        // every frame — that's what clears the chase pose's raised arms.
        poseWalk(rig, (person.stride / 1.5) * Math.PI * 2, 0.85);
      } else {
        for (const limb of [rig.legs[0], rig.legs[1], rig.arms[0], rig.arms[1]]) {
          limb.rotation.x *= Math.exp(-10 * dt);
          limb.rotation.z *= Math.exp(-10 * dt);
        }
      }
      rig.head.rotation.x = 0;
      rig.head.rotation.y = 0;
      rig.upper.rotation.x *= Math.exp(-10 * dt);
      return;
    }

    if (person.walking && person.moving && person.reactTimer === 0) {
      poseWalk(rig, (person.stride / 1.5) * Math.PI * 2, 0.85);
    } else {
      // Settle the legs and idle: breathing, chatting gestures, or staring at a phone.
      for (const limb of [rig.legs[0], rig.legs[1], rig.arms[0]]) limb.rotation.x *= Math.exp(-10 * dt);
      if (!rig.holding) rig.arms[1].rotation.x *= Math.exp(-10 * dt);
      rig.arms[0].rotation.z *= Math.exp(-10 * dt);
      rig.arms[1].rotation.z *= Math.exp(-10 * dt);
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

  dispose() {
    for (const person of this.people) {
      if (!person.animation) continue;
      person.animation.mixer.stopAllAction();
      person.animation.mixer.uncacheRoot(person.mesh.children[0]);
    }
  }
}

// Where everybody stands and walks, relative to the strips of the route.
// `zones` maps strip type -> { z, depth }. `step` is the player grid step, and
// every position is snapped to the player's grid so people occupy real cells.
export function createCrowdPlan({ zones, startZ, step, random = () => 0.5 }) {
  const snap = (z) => startZ - Math.round((startZ - z) / step) * step;
  const top = (zone, rows = 0) => snap(zone.z + zone.depth / 2 - step - rows * step);
  const bottom = (zone, rows = 0) => snap(zone.z - zone.depth / 2 + step + rows * step);
  const { start, "bridge-entry": entry, bridge, "bridge-exit": exit, finish } = zones;

  const plan = [
    // Walkers each own one column, so they never have to pass each other.
    { kind: "commuter", x: -step, fromZ: top(start, 1), toZ: snap(exit.z), speed: 1.35 },
    { kind: "student", x: step, fromZ: bottom(exit), toZ: snap(start.z), speed: 1.1, holding: "flatWhite" },
    { kind: "jogger", x: step * 2, fromZ: top(bridge, 1), toZ: bottom(bridge, 1), speed: 2.3 },
    { kind: "student", x: -step * 2, fromZ: bottom(start), toZ: top(start, 1), speed: 0.95, holding: "doubleShot" },
    { kind: "commuter", x: 0, fromZ: top(finish), toZ: bottom(finish, 2), speed: 1.0 },
    { kind: "robot", x: -step, fromZ: top(entry), toZ: bottom(entry), speed: 0.78 },
    { kind: "robot", x: step, fromZ: top(finish, 1), toZ: bottom(finish, 1), speed: 0.72 },

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
    { kind: "phone", x: -step * 2, z: snap(finish.z) + step, yaw: Math.PI },

  ];

  const blocked = (x, z) => plan.some((p) => Math.abs(p.x - x) < 0.1 && (p.z !== undefined ? Math.abs(p.z - z) < 0.1 : z >= Math.min(p.fromZ, p.toZ) - step && z <= Math.max(p.fromZ, p.toZ) + step));
  const candidates = [entry, bridge, exit].flatMap((zone) => {
    const cells = [];
    for (let z = top(zone); z >= bottom(zone) - 0.01; z -= step) for (const x of [-2, 0, 2].map((n) => n * step)) if (!blocked(x, z)) cells.push({ x, z });
    return cells;
  });
  candidates.sort(() => random() - 0.5);
  const [psych, ccdu] = candidates;
  plan.push(
    { kind: "psychQuizzer", ...psych, yaw: -Math.PI / 2 },
    { kind: "ccduAdvisor", ...ccdu, yaw: -Math.PI / 2 }
  );
  return plan;
}

// Cells that standing people occupy, so cups are never placed underneath them.
export function standingCells(plan) {
  return plan.filter((entry) => entry.z !== undefined).map((entry) => ({ x: entry.x, z: entry.z }));
}
