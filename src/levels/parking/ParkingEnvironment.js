import * as THREE from "three";
import {
  attachCarModel,
  createSeededRandom,
  pickRandomCar,
  pickRandomParkingCar
} from "../../shared/VehicleModelLibrary.js";


export const PARKING_LAYOUT = Object.freeze({
  groundY: 0,
  // Broad, slightly tapered footprint matching the aerial shape of the Wits
  // parking area between the ARM building, M1 and Yale Road.
  mainLot: {
    x: 0,
    z: -8,
    width: 122,
    depth: 84,
    outline: Object.freeze([
      Object.freeze([-55, -50]),
      Object.freeze([59, -38]),
      Object.freeze([54, 34]),
      Object.freeze([-61, 34]),
      Object.freeze([-61, -33]),
      Object.freeze([-56, -33]),
      Object.freeze([-56, -42]),
      Object.freeze([-61, -42]),
      Object.freeze([-61, -50])
    ])
  },

  // Wider road so it runs across the whole visible scene and fades into fog.
  campusRoad: { x: 0, z: 41, width: 185, depth: 10 },

  m1: { x: 0, z: -65, width: 190, depth: 15, y: 0.02 },
  bridgeRoad: { x: 72, z: -5, width: 11, depth: 150, y: 0.08 },

  // Lower-middle opening aligned with the central drive aisle.
  mainEntrance: { x: -2.5, z: 35.5, width: 9 },

  // Player entrance aligned with the second aisle from the west.
  parkingBoomEntrance: { x: -34.5, z: 35.5, width: 7, boundaryWidth: 17 },

  // Duplicate the entrance position for the opposite parking.
  otherEntrance: { x: 0, z: 46.5, width: 9 },

  otherParking: { x: 0, z: 61, width: 28, depth: 22 },

  armBuilding: { x: -80, z: -7, width: 36, depth: 62, height: 10 },

  // Bigger Flower Hall so it fills the left/background scene more strongly.
  flowerHall: { x: -48, z: 64, width: 48, depth: 26, height: 10 },

campusGate: { x: -2.5, z: 41 }
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

function createAngledFenceRun(root, collisionWorld, {
  startX, startZ, endX, endZ, tag = "fence"
}) {
  const dx = endX - startX;
  const dz = endZ - startZ;
  const length = Math.hypot(dx, dz);
  const centerX = (startX + endX) / 2;
  const centerZ = (startZ + endZ) / 2;
  const rotationY = -Math.atan2(dz, dx);
  const metal = material(COLORS.metal, 0.66, { metalness: 0.28 });

  box(root, [length, 0.34, 0.42], [centerX, 0.17, centerZ], material(0x747a7c, 0.82)).rotation.y = rotationY;
  for (const y of [0.68, 1.08]) {
    const rail = box(root, [length, 0.09, 0.09], [centerX, y, centerZ], metal, { castShadow: true });
    rail.rotation.y = rotationY;
  }

  const postCount = Math.max(2, Math.floor(length / 3.4) + 1);
  for (let index = 0; index < postCount; index++) {
    const progress = index / (postCount - 1);
    box(root, [0.11, 1.25, 0.11], [
      THREE.MathUtils.lerp(startX, endX, progress),
      0.63,
      THREE.MathUtils.lerp(startZ, endZ, progress)
    ], metal, { castShadow: true });
  }

  addCollider(
    collisionWorld,
    root,
    [centerX, 0.65, centerZ],
    [length, 1.3, 0.7],
    tag,
    rotationY
  );
}

function createSeparatedGround(root) {
  const grass = material(COLORS.grass, 0.98, { flatShading: true });
  // Satellite imagery is continuous terrain; a single ground slab avoids the
  // sky-coloured bands that previously separated the lot from its roads.
  box(root, [230, 0.14, 210], [0, -0.11, 0], grass);
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

  // Short yellow guide lines mark the Entrance 9 approach without the large
  // zebra crossing that was not present in the aerial reference.
  const entranceX = PARKING_LAYOUT.mainEntrance.x;
  for (const x of [entranceX - 2.7, entranceX + 2.7]) {
    box(root, [0.1, 0.025, campusRoad.depth - 1.4], [x, 0.085, campusRoad.z], new THREE.MeshBasicMaterial({ color: 0xd8b34f }), { receiveShadow: false });
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
  const roof = material(0x89979b, 0.76, { metalness: 0.12 });

  // Interlocking masses and the circular ARM roof are the dominant landmark
  // in the supplied aerial reference.
  box(root, [a.width, a.height, a.depth], [a.x, a.height / 2, a.z], brick, { castShadow: true, name: "wits-arm-main" });
  box(root, [a.width - 1, 0.45, a.depth - 1], [a.x, a.height + 0.2, a.z], roof, { castShadow: true });
  box(root, [a.width + 9, a.height - 2, 18], [a.x - 2, (a.height - 2) / 2, a.z - 23], concrete, { castShadow: true });
  box(root, [a.width + 5, 0.55, 20], [a.x - 1, a.height + 0.2, a.z + 20], roof, { castShadow: true });
  box(root, [18, a.height + 3, 24], [a.x + 8, (a.height + 3) / 2, a.z + 18], material(COLORS.darkBrick, 0.88), { castShadow: true });

  const domeBase = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 4, 32), concrete);
  domeBase.position.set(a.x + 3, a.height + 2, a.z + 2);
  domeBase.castShadow = true;
  root.add(domeBase);
  const domeRoof = new THREE.Mesh(new THREE.CylinderGeometry(10.8, 11.4, 1.1, 32), roof);
  domeRoof.position.set(a.x + 3, a.height + 4.45, a.z + 2);
  domeRoof.castShadow = true;
  root.add(domeRoof);

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
  addCollider(collisionWorld, root, [a.x + 3, 4, a.z + 2], [24, 8, 24], "wits-arm-dome");
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

      const spec = pickRandomParkingCar(random);

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
  const front = 34;
  const left = -61;
  const right = 54;

  const openings = [PARKING_LAYOUT.parkingBoomEntrance, PARKING_LAYOUT.mainEntrance]
    .map((entrance) => ({
      left: entrance.x - (entrance.boundaryWidth ?? entrance.width) / 2,
      right: entrance.x + (entrance.boundaryWidth ?? entrance.width) / 2
    }))
    .sort((a, b) => a.left - b.left);
  let runStart = left;
  for (const opening of openings) {
    const length = opening.left - runStart;
    if (length > 0.5) {
      createFenceRun(root, collisionWorld, {
        x: runStart + length / 2, z: front + 0.15, length, axis: "x"
      });
    }
    runStart = opening.right;
  }
  const finalLength = right - runStart;
  if (finalLength > 0.5) {
    createFenceRun(root, collisionWorld, {
      x: runStart + finalLength / 2, z: front + 0.15, length: finalLength, axis: "x"
    });
  }

  // Follow every non-southern segment of the irregular aerial footprint.
  const outline = lot.outline;
  for (let index = 0; index < outline.length; index++) {
    const [startX, startZ] = outline[index];
    const [endX, endZ] = outline[(index + 1) % outline.length];
    if (Math.abs(startZ - front) < 0.01 && Math.abs(endZ - front) < 0.01) continue;
    if (startX === endX && startZ === endZ) continue;
    createAngledFenceRun(root, collisionWorld, {
      startX,
      startZ,
      endX,
      endZ,
      tag: index === 0 ? "m1-barrier" : "fence"
    });
  }
}

function createOpenParkingEntrance(root, entrance) {
  const asphalt = material(COLORS.asphalt, 0.93);
  plane(root, entrance.width, 11, entrance.x, 0.068, entrance.z + 1, asphalt);
}

function createParkingEntranceCurbs(root, collisionWorld) {
  const entrance = PARKING_LAYOUT.parkingBoomEntrance;
  const shoulderWidth = (entrance.boundaryWidth - entrance.width) / 2;
  const curbMaterial = material(COLORS.kerb, 0.84);
  for (const side of [-1, 1]) {
    const x = entrance.x + side * (entrance.width / 2 + shoulderWidth / 2);
    box(
      root,
      [shoulderWidth, 0.28, 2.5],
      [x, 0.14, 34.7],
      curbMaterial,
      { castShadow: true, name: "parking-entrance-curb" }
    );
    addCollider(
      collisionWorld,
      root,
      [x, 0.2, 34.7],
      [shoulderWidth, 0.5, 2.5],
      "parking-entrance-curb"
    );
  }
}

function createParkingBoomEntrance(root, collisionWorld, playerCar) {
  const entrance = PARKING_LAYOUT.parkingBoomEntrance;
  const boomRed = material(0xc34842, 0.62);
  const boomWhite = material(0xe7e1d2, 0.62);
  const baseX = entrance.x - entrance.width / 2 + 0.35;
  const boomZ = 36.1;
  const boomLength = entrance.width - 0.7;
  const pivot = new THREE.Group();
  pivot.position.set(baseX, 1.05, boomZ);
  root.add(pivot);
  box(pivot, [boomLength, 0.18, 0.2], [boomLength / 2, 0, 0], boomWhite, { castShadow: true });
  for (let x = 0.55; x < boomLength; x += 1.05) {
    box(pivot, [0.5, 0.19, 0.21], [x, 0.01, 0], boomRed, { castShadow: true });
  }
  box(root, [0.52, 1.2, 0.52], [baseX, 0.6, boomZ], material(0x545b61, 0.7), { castShadow: true });

  const boomCollider = addCollider(
    collisionWorld,
    root,
    [baseX + boomLength / 2, 0.95, boomZ],
    [boomLength, 1, 0.36],
    "parking-entrance-boom"
  );
  let angle = 0;
  return (dt) => {
    const dx = playerCar.position.x - entrance.x;
    const dz = playerCar.position.z - boomZ;
    // Keep the barrier visible at spawn, then raise it as the player rolls up.
    const target = dx * dx + dz * dz < 14 ? Math.PI * 0.46 : 0;
    angle = THREE.MathUtils.lerp(angle, target, 1 - Math.exp(-4.5 * dt));
    pivot.rotation.z = angle;
    boomCollider.position.y = angle > 0.62 ? 3 : 0.9;
  };
}

function createCampusBoomGate(root, collisionWorld, playerCar) {
  const checkpoint = PARKING_LAYOUT.campusGate;
  const road = PARKING_LAYOUT.campusRoad;
  const gateZ = road.z + 3.2;
  const roofMat = material(0xd5d9da, 0.54, { metalness: 0.25 });
  const supportMat = material(0x747b7c, 0.6, { metalness: 0.35 });
  const islandMat = material(0xb89f83, 0.82);
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x90b5bf,
    roughness: 0.28,
    metalness: 0.08,
    transparent: true,
    opacity: 0.72
  });

  // Entrance 9-style checkpoint: a broad metal canopy with two clear lanes.
  box(root, [13.5, 0.55, 10.8], [checkpoint.x, 4.75, gateZ], roofMat, { castShadow: true });
  box(root, [14.0, 0.16, 11.3], [checkpoint.x, 5.1, gateZ], material(0xe8ebea, 0.48, { metalness: 0.3 }), { castShadow: true });
  for (const x of [checkpoint.x - 5.5, checkpoint.x + 5.5]) {
    for (const z of [gateZ - 4.15, gateZ + 4.15]) {
      box(root, [0.32, 4.5, 0.32], [x, 2.25, z], supportMat, { castShadow: true });
    }
  }
  // Blue fascia makes the roof read as the Wits entrance from the sky camera.
  for (const z of [gateZ - 5.48, gateZ + 5.48]) {
    box(root, [13.7, 0.65, 0.18], [checkpoint.x, 4.65, z], material(COLORS.witsBlue, 0.58), { castShadow: true });
  }

  const boothX = checkpoint.x + 3.8;
  box(root, [2.15, 0.24, 5.2], [boothX, 0.12, gateZ], islandMat, { castShadow: true });
  box(root, [1.75, 2.55, 2.7], [boothX, 1.4, gateZ], material(0xb8b0a3, 0.76), { castShadow: true });
  for (const z of [gateZ - 1.38, gateZ + 1.38]) {
    box(root, [1.45, 0.92, 0.05], [boothX, 1.65, z], glassMat, { receiveShadow: false });
  }
  addCollider(collisionWorld, root, [boothX, 1.4, gateZ], [2.15, 2.8, 5.2], "entrance-nine-booth");

  for (const x of [checkpoint.x - 6.2, checkpoint.x + 6.2]) {
    box(root, [0.42, 0.24, 10.5], [x, 0.12, gateZ], islandMat, { castShadow: true });
  }

  const boomRed = material(0xc34842, 0.62);
  const boomWhite = material(0xe7e1d2, 0.62);
  const baseX = checkpoint.x - 5.1;
  const boomZ = gateZ - 2.25;
  const pivot = new THREE.Group();
  pivot.position.set(baseX, 1.05, boomZ);
  root.add(pivot);
  const boomLength = 6.9;
  box(pivot, [boomLength, 0.18, 0.2], [boomLength / 2, 0, 0], boomWhite, { castShadow: true });
  for (let x = 0.6; x < boomLength; x += 1.15) box(pivot, [0.55, 0.19, 0.21], [x, 0.01, 0], boomRed, { castShadow: true });
  box(root, [0.48, 1.15, 0.48], [pivot.position.x, 0.575, pivot.position.z], material(0x545b61, 0.7), { castShadow: true });

  const boomCollider = addCollider(
    collisionWorld,
    root,
    [baseX + boomLength / 2, 0.95, boomZ],
    [boomLength, 1.0, 0.36],
    "campus-boom"
  );

  let angle = 0;
  const update = (dt) => {
    const dx = playerCar.position.x - checkpoint.x;
    const dz = playerCar.position.z - boomZ;
    const near = dx * dx + dz * dz < 55;
    const target = near ? Math.PI * 0.46 : 0;
    angle = THREE.MathUtils.lerp(angle, target, 1 - Math.exp(-4.5 * dt));
    pivot.rotation.z = angle;
    // CollisionWorld ignores Z rotation, so move the blocking volume above the car when open.
    boomCollider.position.y = angle > 0.62 ? 3.0 : 0.9;
  };

  return update;
}


function createSecondaryParkingLink(root) {
  const e = PARKING_LAYOUT.otherEntrance;
  const asphalt = material(COLORS.asphalt, 0.93);

  // Keep this connection open; Entrance 9 is now the only checkpoint here.
  box(root, [e.width, 0.09, 6], [e.x, 0.03, e.z - 2.5], asphalt);
}


function createTrees(root) {
  const positions = [
    [-104, -35], [-104, -15], [-104, 8], [-101, 28],
    [-70, -55], [-48, -57], [-22, -57], [55, -56],
    [64, -44], [64, -19], [64, 5], [64, 26],
    [-91, 35], [-76, 38], [-61, 39], [51, 56],
    [65, 58], [84, 20], [85, -20], [85, -55]
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
  createSecondaryParkingLink(root);
  createMainParkingBoundary(root, collisionWorld);
  createOpenParkingEntrance(root, PARKING_LAYOUT.mainEntrance);
  createOpenParkingEntrance(root, PARKING_LAYOUT.parkingBoomEntrance);
  createParkingEntranceCurbs(root, collisionWorld);
  const updateCampusBoom = createCampusBoomGate(root, collisionWorld, playerCar);
  const updateParkingBoom = createParkingBoomEntrance(root, collisionWorld, playerCar);
  createTrees(root);


  const update = (dt) => {
    updateM1Traffic(dt);
    updateCampusBoom(dt);
    updateParkingBoom(dt);
  };

  return { root, update };
}
