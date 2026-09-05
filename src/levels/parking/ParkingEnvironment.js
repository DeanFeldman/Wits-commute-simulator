import * as THREE from "three";
import {
  attachCarModel,
  createSeededRandom,
  pickRandomCar
} from "../../shared/VehicleModelLibrary.js";


export const PARKING_LAYOUT = Object.freeze({
  groundY: 0,
  mainLot: { x: 0, z: 0, width: 44, depth: 64 },

  // Wider road so it runs across the whole visible scene and fades into fog.
  campusRoad: { x: 0, z: 39, width: 165, depth: 10 },

  m1: { x: 0, z: -44, width: 150, depth: 15, y: -2.7 },
  bridgeRoad: { x: 30, z: -5, width: 9, depth: 145, y: 0.08 },

  // Move main entrance a bit to the right and make it actually meet the road.
  mainEntrance: { x: 10, z: 33.5, width: 9 },

  // Duplicate the entrance position for the opposite parking.
  otherEntrance: { x: 0, z: 44.5, width: 9 },

  otherParking: { x: 0, z: 59, width: 28, depth: 22 },

  armBuilding: { x: -30, z: 0, width: 13, depth: 48, height: 9 },

  // Bigger Flower Hall so it fills the left/background scene more strongly.
  flowerHall: { x: -28, z: 61, width: 42, depth: 24, height: 10 },

campusGate: { x: 20, z: 39 }
});

const COLORS = {
  grass: 0x4f6844,
  asphalt: 0x2f343a,
  m1: 0x242a30,
  concrete: 0xa7aaa5,
  kerb: 0xbfc0b8,
  metal: 0x59636c,
  brick: 0x86513d,
  darkBrick: 0x704233,
  window: 0xf0b56b,
  paint: 0xe2ddae,
  white: 0xe9e7dc,
  witsBlue: 0x245987
};

function material(color, roughness = 0.9, extras = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness, ...extras });
}

function box(root, size, position, mat, { castShadow = false, receiveShadow = true, name = "" } = {}) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), mat);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.name = name;
  root.add(mesh);
  return mesh;
}

function plane(root, width, depth, x, y, z, mat) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.receiveShadow = true;
  root.add(mesh);
  return mesh;
}

function addCollider(collisionWorld, root, position, size, tag, rotationY = 0) {
  const object = new THREE.Object3D();
  object.position.set(...position);
  object.rotation.y = rotationY;
  root.add(object);
  collisionWorld.add({ object, size, tag, color: 0xff6b6b });
  return object;
}

function createDashedLine(root, {
  axis = "x", centerX = 0, centerZ = 0, span = 80, step = 6,
  dash = 2.8, thickness = 0.11, y = 0.075, color = COLORS.paint
}) {
  const mat = new THREE.MeshBasicMaterial({ color });
  for (let offset = -span / 2 + step / 2; offset <= span / 2 - step / 2; offset += step) {
    const geometry = axis === "x"
      ? new THREE.BoxGeometry(dash, 0.025, thickness)
      : new THREE.BoxGeometry(thickness, 0.025, dash);
    const stripe = new THREE.Mesh(geometry, mat);
    stripe.position.set(
      axis === "x" ? centerX + offset : centerX,
      y,
      axis === "z" ? centerZ + offset : centerZ
    );
    root.add(stripe);
  }
}

function createFenceRun(root, collisionWorld, {
  x, z, length, axis = "x", tag = "fence", collider = true
}) {
  const metal = material(COLORS.metal, 0.68, { metalness: 0.22 });
  const postSpacing = 3.2;
  const posts = Math.max(2, Math.floor(length / postSpacing) + 1);
  const start = -length / 2;
  for (let i = 0; i < posts; i++) {
    const offset = start + (i / (posts - 1)) * length;
    const px = axis === "x" ? x + offset : x;
    const pz = axis === "z" ? z + offset : z;
    box(root, [0.11, 1.35, 0.11], [px, 0.675, pz], metal, { castShadow: true });
  }
  for (const y of [0.48, 1.05]) {
    box(
      root,
      axis === "x" ? [length, 0.08, 0.08] : [0.08, 0.08, length],
      [x, y, z],
      metal,
      { castShadow: true }
    );
  }
  if (collider) {
    addCollider(
      collisionWorld,
      root,
      [x, 0.7, z],
      axis === "x" ? [length, 1.4, 0.28] : [0.28, 1.4, length],
      tag
    );
  }
}

function createSeparatedGround(root) {
  const grass = material(COLORS.grass, 0.98, { flatShading: true });
  // Front/campus side. Stops before the M1 trench so it cannot cover the highway.
  box(root, [170, 0.14, 138], [0, -0.11, 34], grass);
  // Far/north side beyond the M1.
  box(root, [170, 0.14, 58], [0, -0.11, -81], grass);
}
function createBackdropWall(root) {
  const wallMat = material(0x6f766f, 0.92);
  const baseMat = material(0x555b56, 0.9);

  // Low base
  box(root, [90, 1.2, 1.4], [18, 0.6, 53], baseMat, {
    castShadow: true
  });

  // Main wall
  box(root, [90, 8, 1], [18, 4.6, 54], wallMat, {
    castShadow: true
  });
}

function createCampusRoad(root) {
  const { campusRoad, bridgeRoad } = PARKING_LAYOUT;
  const asphalt = material(COLORS.asphalt, 0.93);

  // Main road between the two parking areas.
  box(
    root,
    [campusRoad.width, 0.12, campusRoad.depth],
    [campusRoad.x, 0.0, campusRoad.z],
    asphalt
  );

  // Centre dashed line.
  createDashedLine(root, {
    axis: "x",
    centerX: campusRoad.x,
    centerZ: campusRoad.z,
    span: campusRoad.width - 4,
    y: 0.075
  });

  // Kerbs + pavements along the main road.
  for (const side of [-1, 1]) {
    box(
      root,
      [campusRoad.width, 0.16, 0.42],
      [
        campusRoad.x,
        0.08,
        campusRoad.z +
          side * (campusRoad.depth / 2 + 0.24)
      ],
      material(COLORS.kerb, 0.82)
    );

    box(
      root,
      [campusRoad.width, 0.08, 1.7],
      [
        campusRoad.x,
        0.06,
        campusRoad.z +
          side * (campusRoad.depth / 2 + 1.28)
      ],
      material(COLORS.concrete, 0.9)
    );
  }

  // Right-side road running toward / over the M1.
  box(
    root,
    [
      bridgeRoad.width,
      0.18,
      bridgeRoad.depth
    ],
    [
      bridgeRoad.x,
      bridgeRoad.y,
      bridgeRoad.z
    ],
    asphalt
  );

  createDashedLine(root, {
    axis: "z",
    centerX: bridgeRoad.x,
    centerZ: bridgeRoad.z,
    span: bridgeRoad.depth - 8,
    y: bridgeRoad.y + 0.1
  });

  // Zebra crossing aligned with the main parking entrance.
  const zebra = new THREE.MeshBasicMaterial({
    color: COLORS.white
  });

  const zebraStart =
    PARKING_LAYOUT.mainEntrance.x - 4;

  const zebraEnd =
    PARKING_LAYOUT.mainEntrance.x + 4;

  for (
    let x = zebraStart;
    x <= zebraEnd;
    x += 1.25
  ) {
    box(
      root,
      [0.62, 0.025, 8.1],
      [x, 0.085, campusRoad.z],
      zebra,
      { receiveShadow: false }
    );
  }
}

function createM1(root) {
  const { m1, bridgeRoad } = PARKING_LAYOUT;
  const highwayMat = material(COLORS.m1, 0.88);
  box(root, [m1.width, 0.14, m1.depth], [m1.x, m1.y, m1.z], highwayMat);

  const laneZ = [-5.2, -1.75, 1.75, 5.2].map((offset) => m1.z + offset);
  const paint = new THREE.MeshBasicMaterial({ color: 0xd7d5c2 });
  for (const boundary of [-3.5, 0, 3.5]) {
    for (let x = -72; x <= 72; x += 7) {
      box(root, [3.4, 0.025, 0.11], [x, m1.y + 0.09, m1.z + boundary], paint, { receiveShadow: false });
    }
  }

  // Retaining walls stop at the bridge opening so the bridge reads as crossing the trench.
  const wallMat = material(0x666c70, 0.84);
  const bridgeHalf = bridgeRoad.width / 2 + 0.8;
  for (const wallZ of [m1.z - m1.depth / 2 - 0.3, m1.z + m1.depth / 2 + 0.3]) {
    const leftWidth = (bridgeRoad.x - bridgeHalf) - (-m1.width / 2);
    const rightWidth = (m1.width / 2) - (bridgeRoad.x + bridgeHalf);
    box(root, [leftWidth, 2.6, 0.45], [-m1.width / 2 + leftWidth / 2, m1.y + 1.3, wallZ], wallMat);
    box(root, [rightWidth, 2.6, 0.45], [bridgeRoad.x + bridgeHalf + rightWidth / 2, m1.y + 1.3, wallZ], wallMat);
  }

  // Bridge side rails only over the trench; the deck itself is the ground-level right road.
  const bridgeSpan = m1.depth + 4;
  for (const x of [bridgeRoad.x - bridgeRoad.width / 2 + 0.28, bridgeRoad.x + bridgeRoad.width / 2 - 0.28]) {
    box(root, [0.14, 0.86, bridgeSpan], [x, 0.54, m1.z], material(COLORS.metal, 0.66, { metalness: 0.28 }), { castShadow: true });
  }

  return { laneZ };
}

function createM1Traffic(root, laneZ) {
  const random = createSeededRandom(30061);
  const count = 16;
  const traffic = [];

  for (let index = 0; index < count; index++) {
    const lane = index % 4;
    const direction = lane < 2 ? 1 : -1;

    const holder = new THREE.Group();

    holder.position.set(
      -68 + ((index * 14.5) % 136),
      PARKING_LAYOUT.m1.y + 0.08,
      laneZ[lane]
    );

    // Optimized models are +Z forward/length.
    // M1 traffic moves left/right along world X.
    holder.rotation.y =
      direction > 0
        ? Math.PI / 2
        : -Math.PI / 2;

    root.add(holder);

    const spec = pickRandomCar(
      random,
      { allowThomas: true }
    );

    // Lite variant is intended for M1/background traffic.
    attachCarModel(
      holder,
      spec,
      "lite"
    ).catch((error) => {
      console.warn(
        `Unable to load M1 car ${spec.id}`,
        error
      );
    });

    traffic.push({
      holder,
      direction,
      speed:
        10.5 +
        lane * 1.25 +
        (index % 3) * 0.65
    });
  }

  const update = (dt) => {
    for (const car of traffic) {
      car.holder.position.x +=
        car.direction *
        car.speed *
        dt;

      if (car.holder.position.x > 74) {
        car.holder.position.x = -74;
      }

      if (car.holder.position.x < -74) {
        car.holder.position.x = 74;
      }
    }
  };

  return update;
}

function createArmBuilding(root, collisionWorld) {
  const a = PARKING_LAYOUT.armBuilding;
  const brick = material(COLORS.brick, 0.88);
  const concrete = material(0xb1aaa0, 0.9);
  box(root, [a.width, a.height, a.depth], [a.x, a.height / 2, a.z], brick, { castShadow: true, name: "wits-arm-main" });
  box(root, [a.width - 1.5, a.height + 3, 10], [a.x - 0.5, (a.height + 3) / 2, -12], material(COLORS.darkBrick, 0.88), { castShadow: true });
  box(root, [1.2, 2.1, a.depth - 4], [a.x + a.width / 2 + 0.55, 1.05, a.z], concrete);
  const windows = new THREE.MeshBasicMaterial({ color: COLORS.window });
  for (let z = -19; z <= 19; z += 5.5) {
    for (const y of [2.4, 5.1, 7.5]) {
      box(root, [0.08, 1.15, 2.4], [a.x + a.width / 2 + 0.045, y, z], windows, { receiveShadow: false });
    }
  }
  // Parking-facing walkway.
  box(root, [2.1, 0.08, a.depth + 4], [a.x + a.width / 2 + 1.5, 0.05, a.z], material(COLORS.concrete, 0.9));
  addCollider(collisionWorld, root, [a.x, a.height / 2, a.z], [a.width, a.height, a.depth], "wits-arm");
}

function createFlowerHall(root) {
  const f = PARKING_LAYOUT.flowerHall;

  const hall = new THREE.Group();
  hall.position.set(f.x, 0, f.z);
  root.add(hall);

  const brick = material(0x955b42, 0.86);
  const darkBrick = material(0x7d4a39, 0.88);
  const concrete = material(0xb0aaa0, 0.9);
  const glass = new THREE.MeshBasicMaterial({ color: 0xdcae6d });

  // Main mass
  box(hall, [f.width, f.height, f.depth], [0, f.height / 2, 0], brick, {
    castShadow: true
  });

  // Taller section so it has a stronger silhouette
  box(hall, [18, f.height + 5, 10], [-8, (f.height + 5) / 2, 0], darkBrick, {
    castShadow: true
  });

  // Long front glazing facing the road
  box(hall, [f.width - 4, 2.2, 0.12], [0, 5.2, -f.depth / 2 - 0.07], glass, {
    receiveShadow: false
  });

  // Front platform / overhang
  box(hall, [14, 0.45, 4], [8, 2.9, -f.depth / 2 - 1.4], concrete, {
    castShadow: true
  });

  // Bigger pavement in front
  box(
    root,
    [f.width + 10, 0.08, 5.0],
    [f.x, 0.05, f.z - f.depth / 2 - 2.2],
    material(COLORS.concrete, 0.9)
  );
}

function createOtherParking(root) {
  const p = PARKING_LAYOUT.otherParking;
  const asphalt = material(0x343a3f, 0.94);

  box(
    root,
    [p.width, 0.08, p.depth],
    [p.x, 0.01, p.z],
    asphalt
  );

  const line = new THREE.MeshBasicMaterial({
    color: 0xded9be
  });

  const spaces = [];
  const xs = [-2, 2, 6, 10, 14, 18, 22];

  for (const z of [53.3, 64.4]) {
    for (const x of xs) {
      spaces.push([
        x,
        z,
        z < p.z ? Math.PI : 0
      ]);
    }
  }

  // Parking bay markings.
  for (const [x, z] of spaces) {
    for (const dx of [-1.45, 1.45]) {
      box(
        root,
        [0.09, 0.025, 4.5],
        [x + dx, 0.07, z],
        line,
        { receiveShadow: false }
      );
    }

    box(
      root,
      [2.9, 0.025, 0.09],
      [
        x,
        0.07,
        z + (z < p.z ? 2.25 : -2.25)
      ],
      line,
      { receiveShadow: false }
    );
  }

  const occupied = spaces.filter(
    (_, index) =>
      ![2, 8, 12].includes(index)
  );

  const random =
    createSeededRandom(20260905);

  occupied.forEach(
    ([x, z, rotationY]) => {
      const holder =
        new THREE.Group();

      holder.position.set(
        x,
        0.03,
        z
      );

      holder.rotation.y =
        rotationY;

      root.add(holder);

      const spec = pickRandomCar(
        random,
        { allowThomas: true }
      );

      // This parking lot is scenery, so use the lite meshes.
      attachCarModel(
        holder,
        spec,
        "lite"
      ).catch((error) => {
        console.warn(
          `Unable to load parked car ${spec.id}`,
          error
        );
      });
    }
  );
}

function createMainParkingBoundary(root, collisionWorld) {
  const lot = PARKING_LAYOUT.mainLot;
  const entrance = PARKING_LAYOUT.mainEntrance;
  const left = lot.x - lot.width / 2;
  const right = lot.x + lot.width / 2;
  const front = lot.z + lot.depth / 2;
  const back = lot.z - lot.depth / 2;

  createFenceRun(root, collisionWorld, { x: left - 0.1, z: 0, length: lot.depth, axis: "z" });
  createFenceRun(root, collisionWorld, { x: right + 0.1, z: 0, length: lot.depth, axis: "z" });

  const openingLeft = entrance.x - entrance.width / 2;
  const openingRight = entrance.x + entrance.width / 2;
  const frontLeftLength = openingLeft - left;
  const frontRightLength = right - openingRight;
  if (frontLeftLength > 0.5) {
    createFenceRun(root, collisionWorld, {
      x: left + frontLeftLength / 2, z: front + 0.15, length: frontLeftLength, axis: "x"
    });
  }
  if (frontRightLength > 0.5) {
    createFenceRun(root, collisionWorld, {
      x: openingRight + frontRightLength / 2, z: front + 0.15, length: frontRightLength, axis: "x"
    });
  }

  // M1-facing barrier: low base plus visible rails, never an opaque wall.
  const barrierMat = material(COLORS.metal, 0.65, { metalness: 0.3 });
  box(root, [lot.width + 1.2, 0.38, 0.5], [lot.x, 0.19, back - 0.35], material(0x747a7c, 0.82));
  for (const y of [0.68, 1.08]) {
    box(root, [lot.width + 1.2, 0.09, 0.09], [lot.x, y, back - 0.35], barrierMat, { castShadow: true });
  }
  for (let x = left; x <= right + 0.01; x += 3.4) {
    box(root, [0.11, 1.25, 0.11], [x, 0.63, back - 0.35], barrierMat, { castShadow: true });
  }
  addCollider(collisionWorld, root, [lot.x, 0.65, back - 0.35], [lot.width + 1.2, 1.3, 0.7], "m1-barrier");
}

function createParkingEntrance(root, collisionWorld, playerCar) {
  const e = PARKING_LAYOUT.mainEntrance;
  const asphalt = material(COLORS.asphalt, 0.93);
  box(root, [e.width, 0.09, 6], [e.x, 0.03, e.z + 2.5], asphalt);

  const islandMat = material(COLORS.kerb, 0.84);
  const island = box(root, [1.15, 0.28, 5.1], [e.x, 0.14, e.z + 2.25], islandMat, { castShadow: true });
  addCollider(collisionWorld, root, [island.position.x, 0.35, island.position.z], [1.15, 0.7, 5.1], "entrance-island");

  const hut = new THREE.Group();
  hut.position.set(e.x, 0, e.z + 1.3);
  root.add(hut);
  box(hut, [1.65, 2.2, 1.8], [0, 1.1, 0], material(0x8f826f, 0.8), { castShadow: true });
  box(hut, [1.72, 0.68, 0.07], [0, 1.48, -0.94], new THREE.MeshBasicMaterial({ color: 0xbcd3d1 }), { receiveShadow: false });
  addCollider(collisionWorld, root, [e.x, 1.1, e.z + 1.3], [1.65, 2.2, 1.8], "guard-hut");

  // Kerbed channel keeps the gap intentional rather than one giant bypass.
  for (const x of [e.x - e.width / 2, e.x + e.width / 2]) {
    box(root, [0.32, 0.25, 6], [x, 0.125, e.z + 2.5], islandMat);
    addCollider(collisionWorld, root, [x, 0.35, e.z + 2.5], [0.38, 0.7, 6], "entrance-kerb");
  }

  const boomRed = material(0xc34842, 0.62);
  const boomWhite = material(0xe7e1d2, 0.62);
  const pivot = new THREE.Group();
  pivot.position.set(e.x - e.width / 2 + 0.45, 0.95, e.z + 0.15);
  root.add(pivot);
  const boomLength = 4.2;
  const bar = box(pivot, [boomLength, 0.16, 0.18], [boomLength / 2, 0, 0], boomWhite, { castShadow: true });
  for (let x = 0.55; x < boomLength; x += 1.05) box(pivot, [0.5, 0.17, 0.19], [x, 0.01, 0], boomRed, { castShadow: true });
  box(root, [0.48, 1.15, 0.48], [pivot.position.x, 0.575, pivot.position.z], material(0x545b61, 0.7), { castShadow: true });

  const boomCollider = addCollider(
    collisionWorld,
    root,
    [pivot.position.x + boomLength / 2, 0.9, pivot.position.z],
    [boomLength, 1.0, 0.36],
    "parking-boom"
  );

  // Outbound boom is shown raised; inbound boom is the automatic functional one.
  const outbound = new THREE.Group();
  outbound.position.set(e.x + e.width / 2 - 0.45, 0.95, e.z + 0.15);
  outbound.rotation.z = -Math.PI * 0.42;
  root.add(outbound);
  box(outbound, [4.0, 0.16, 0.18], [-2.0, 0, 0], boomWhite, { castShadow: true });
  box(root, [0.48, 1.15, 0.48], [outbound.position.x, 0.575, outbound.position.z], material(0x545b61, 0.7), { castShadow: true });

  let angle = 0;
  const update = (dt) => {
    const dx = playerCar.position.x - (e.x - 2.5);
    const dz = playerCar.position.z - (e.z - 1.5);
    const near = dx * dx + dz * dz < 52;
    const target = near ? Math.PI * 0.46 : 0;
    angle = THREE.MathUtils.lerp(angle, target, 1 - Math.exp(-4.5 * dt));
    pivot.rotation.z = angle;
    // CollisionWorld ignores Z rotation, so move the blocking volume above the car when open.
    boomCollider.position.y = angle > 0.62 ? 3.0 : 0.9;
  };

  return update;
}


function createSecondaryParkingEntrance(root, collisionWorld) {
  const e = PARKING_LAYOUT.otherEntrance;
  const asphalt = material(COLORS.asphalt, 0.93);
  const islandMat = material(COLORS.kerb, 0.84);
  const boomRed = material(0xc34842, 0.62);
  const boomWhite = material(0xe7e1d2, 0.62);

  // Road link from the campus road into the opposite parking
  box(root, [e.width, 0.09, 6], [e.x, 0.03, e.z - 2.5], asphalt);

  // Centre island
  const island = box(root, [1.15, 0.28, 5.1], [e.x, 0.14, e.z - 2.25], islandMat, {
    castShadow: true
  });

  addCollider(
    collisionWorld,
    root,
    [island.position.x, 0.35, island.position.z],
    [1.15, 0.7, 5.1],
    "other-entrance-island"
  );

  // Hut
  const hut = new THREE.Group();
  hut.position.set(e.x, 0, e.z - 1.3);
  root.add(hut);

  box(hut, [1.65, 2.2, 1.8], [0, 1.1, 0], material(0x8f826f, 0.8), {
    castShadow: true
  });

  box(
    hut,
    [1.72, 0.68, 0.07],
    [0, 1.48, 0.94],
    new THREE.MeshBasicMaterial({ color: 0xbcd3d1 }),
    { receiveShadow: false }
  );

  addCollider(
    collisionWorld,
    root,
    [e.x, 1.1, e.z - 1.3],
    [1.65, 2.2, 1.8],
    "other-guard-hut"
  );

  // Kerbs
  for (const x of [e.x - e.width / 2, e.x + e.width / 2]) {
    box(root, [0.32, 0.25, 6], [x, 0.125, e.z - 2.5], islandMat);

    addCollider(
      collisionWorld,
      root,
      [x, 0.35, e.z - 2.5],
      [0.38, 0.7, 6],
      "other-entrance-kerb"
    );
  }

  // Decorative duplicated booms (raised)
  const leftBaseX = e.x - e.width / 2 + 0.45;
  const rightBaseX = e.x + e.width / 2 - 0.45;

  box(root, [0.48, 1.15, 0.48], [leftBaseX, 0.575, e.z - 0.15], material(0x545b61, 0.7), {
    castShadow: true
  });

  const leftBoom = new THREE.Group();
  leftBoom.position.set(leftBaseX, 0.95, e.z - 0.15);
  leftBoom.rotation.z = Math.PI * 0.42;
  root.add(leftBoom);

  box(leftBoom, [4.0, 0.16, 0.18], [2.0, 0, 0], boomWhite, { castShadow: true });
  for (let x = 0.55; x < 4.0; x += 1.05) {
    box(leftBoom, [0.5, 0.17, 0.19], [x, 0.01, 0], boomRed, { castShadow: true });
  }

  box(root, [0.48, 1.15, 0.48], [rightBaseX, 0.575, e.z - 0.15], material(0x545b61, 0.7), {
    castShadow: true
  });

  const rightBoom = new THREE.Group();
  rightBoom.position.set(rightBaseX, 0.95, e.z - 0.15);
  rightBoom.rotation.z = -Math.PI * 0.42;
  root.add(rightBoom);

  box(rightBoom, [4.0, 0.16, 0.18], [-2.0, 0, 0], boomWhite, { castShadow: true });
  for (let x = -0.55; x > -4.0; x -= 1.05) {
    box(rightBoom, [0.5, 0.17, 0.19], [x, 0.01, 0], boomRed, { castShadow: true });
  }
}

function createWitsMainGate(root) {
  const g = PARKING_LAYOUT.campusGate;

  const pillarMat = material(0xb6aca0, 0.82);
  const signMat = material(COLORS.witsBlue, 0.64);
  const metalMat = material(
    0x5a6269,
    0.68,
    { metalness: 0.2 }
  );
  const pavementMat = material(COLORS.concrete, 0.9);

  /*
   * Campus road runs LEFT <-> RIGHT along X.
   *
   * So the gate sits at a fixed X position and spans
   * across the road in Z.
   *
   *               pillar
   *                  |
   * =================|=================
   *       CAMPUS ROAD / parking-road
   * =================|=================
   *                  |
   *               pillar
   */

  const roadHalfWidth =
    PARKING_LAYOUT.campusRoad.depth / 2;

  const pillarOffset =
    roadHalfWidth - 0.8;

  // Two gate monuments on opposite sides of the SAME campus road.
  for (const z of [
    g.z - pillarOffset,
    g.z + pillarOffset
  ]) {
    box(
      root,
      [1.35, 4.4, 1.35],
      [g.x, 2.2, z],
      pillarMat,
      { castShadow: true }
    );

    // Wits blue sign panel facing along the approaching road.
    box(
      root,
      [0.12, 1.35, 1.05],
      [g.x - 0.74, 2.55, z],
      signMat,
      { receiveShadow: false }
    );
  }

  // Beam spans across the campus road.
  box(
    root,
    [0.28, 0.22, pillarOffset * 2],
    [g.x, 3.85, g.z],
    metalMat,
    { castShadow: true }
  );

  // Pavement around both gate monuments.
  for (const z of [
    g.z - roadHalfWidth - 1.0,
    g.z + roadHalfWidth + 1.0
  ]) {
    box(
      root,
      [6.5, 0.1, 1.5],
      [g.x, 0.05, z],
      pavementMat
    );
  }
}


function createTrees(root) {
  const positions = [
    [-42, 22], [-42, 12], [-42, -2], [-42, -17],
    [-8, 51], [-2, 69], [32, 67], [40, 63],
    [-48, 56], [-42, 67], [45, 34], [48, 20],
    [43, -18], [45, -28], [-50, -62], [-36, -66],
    [48, -65], [58, -58], [-60, 78], [54, 78]
  ];
  const trunk = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.24, 2.6, 6),
    material(0x62462f, 0.95),
    positions.length
  );
  const canopy = new THREE.InstancedMesh(
    new THREE.ConeGeometry(1.8, 4.2, 7),
    material(0x31583b, 0.96, { flatShading: true }),
    positions.length
  );
  const matrix = new THREE.Matrix4();
  positions.forEach(([x, z], index) => {
    matrix.makeTranslation(x, 1.3, z);
    trunk.setMatrixAt(index, matrix);
    matrix.makeTranslation(x, 4.2, z);
    canopy.setMatrixAt(index, matrix);
  });
  trunk.instanceMatrix.needsUpdate = true;
  canopy.instanceMatrix.needsUpdate = true;
  root.add(trunk, canopy);
}

export function createParkingEnvironment({ collisionWorld, playerCar }) {
  const root = new THREE.Group();
  root.name = "parking-environment";

  createSeparatedGround(root);
  createCampusRoad(root);
  const { laneZ } = createM1(root);
  const updateM1Traffic = createM1Traffic(root, laneZ);
  createArmBuilding(root, collisionWorld);
  createFlowerHall(root);
  createOtherParking(root);
  createSecondaryParkingEntrance(root, collisionWorld);
  createMainParkingBoundary(root, collisionWorld);
  const updateBoom = createParkingEntrance(root, collisionWorld, playerCar);
  createWitsMainGate(root);
  createBackdropWall(root);
  createTrees(root);


  const update = (dt) => {
    updateM1Traffic(dt);
    updateBoom(dt);
  };

  return { root, update };
}
