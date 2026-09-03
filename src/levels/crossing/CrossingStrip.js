import * as THREE from "three";
import { VehicleController } from "../../shared/VehicleController.js";
import { WaypointMover } from "../../shared/WaypointMover.js";

// Visual tuning values shared by every generated Level 2 strip.
const ROAD_COLOR = 0x3d4148;
const VEHICLE_COLORS = [0xd65a5a, 0x496a9b, 0x6f7f51, 0xa45f98, 0xe8e1d0];
const TRAFFIC_EDGE = 14;

// Low-poly vehicle dimensions. Length follows the vehicle's local forward axis.
const VEHICLE_SHAPES = {
  car: { width: 1.3, height: 1.05, length: 2.6 },
  hatchback: { width: 1.25, height: 1.15, length: 2.3 },
  van: { width: 1.4, height: 1.4, length: 3 },
  taxi: { width: 1.45, height: 1.45, length: 3.1 }
};

// One CrossingStrip owns one horizontal area: its surface, decorations and traffic lanes.
export class CrossingStrip {
  constructor({ definition, z, parent, random, audio }) {
    this.definition = definition;
    this.z = z;
    this.random = random;
    this.audio = audio;
    this.root = new THREE.Group();
    this.root.name = `crossing-strip-${definition.index}-${definition.type}`;
    this.root.position.z = z;
    parent.add(this.root);

    // Old presets may declare one traffic object directly. Larger custom hazards
    // can declare traffic.lanes, with one lane configuration per occupied row.
    const laneDefinitions = definition.traffic?.lanes
      ?? (definition.traffic ? [definition.traffic] : []);
    this.lanes = laneDefinitions.map((laneDefinition, laneIndex) => {
      const rowOffset = laneDefinition.rowOffset ?? Math.floor(definition.rowSpan / 2);
      const localZ = this.localZForRow(rowOffset);
      return {
        ...laneDefinition,
        laneIndex,
        localZ,
        z: z + localZ,
        strip: this
      };
    });
    // Retain `lane` as a convenience for any existing one-lane callers.
    this.lane = this.lanes[0] ?? null;
    this.traffic = [];
    this.blockedCells = [];
    this.createGeometry();
    if (this.lanes.length > 0) this.createTraffic();
  }

  get isCheckpoint() {
    return this.definition.checkpoint === true;
  }

  get checkpointLabel() {
    if (this.definition.type === "median") return "traffic island";
    if (this.definition.type === "start") return "start";
    return "safe pavement";
  }

  containsZ(worldZ) {
    return Math.abs(worldZ - this.z) <= this.definition.depth / 2 + 0.01;
  }

  localZForRow(rowOffset) {
    const rowDepth = this.definition.depth / this.definition.rowSpan;
    return ((this.definition.rowSpan - 1) / 2 - rowOffset) * rowDepth;
  }

  async loadModels(loader, modelCache) {
    // Load optional GLB scenery declared by this strip's preset.
    await Promise.all((this.definition.models ?? []).map(async (modelDefinition) => {
      let modelPromise = modelCache.get(modelDefinition.path);
      if (!modelPromise) {
        modelPromise = loader.loadAsync(modelDefinition.path).then((gltf) => gltf.scene);
        modelCache.set(modelDefinition.path, modelPromise);
      }

      const model = (await modelPromise).clone(true);
      model.name = modelDefinition.name ?? `strip-model-${this.definition.id}`;
      model.position.fromArray(modelDefinition.position ?? [0, 0, 0]);
      model.rotation.fromArray(modelDefinition.rotation ?? [0, 0, 0]);
      if (Array.isArray(modelDefinition.scale)) model.scale.fromArray(modelDefinition.scale);
      else model.scale.setScalar(modelDefinition.scale ?? 1);
      model.traverse((child) => {
        if (!child.isMesh) return;
        child.castShadow = modelDefinition.castShadow ?? true;
        child.receiveShadow = modelDefinition.receiveShadow ?? true;
      });
      this.root.add(model);
    }));
  }

  createGeometry() {
    // Draw the base road, pavement, start/finish area, or traffic-island surface.
    const isRoad = this.definition.surface === "road";
    const isMedian = this.definition.surface === "median";
    const colors = {
      start: 0x2f8f68,
      finish: 0x4caf50,
      pavement: 0x3a9d78,
      median: 0xdcccae
    };
    const color = this.definition.surfaceColor
      ?? (isRoad ? ROAD_COLOR : colors[this.definition.type] ?? colors[this.definition.surface]);
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(this.definition.width, isRoad ? 0.12 : 0.22, this.definition.depth),
      new THREE.MeshStandardMaterial({ color, roughness: isRoad ? 0.95 : 0.84, flatShading: true })
    );
    surface.position.y = isRoad ? -0.06 : 0;
    surface.receiveShadow = true;
    this.root.add(surface);

    if (isRoad) this.createRoadMarkings();
    if (isMedian) this.createMedianDetails();
    if (this.isCheckpoint) this.createCheckpointMarker();
    if (this.definition.trees) this.createTrees();
  }

  createTrees() {
    // Pick unique grid blocks using the strip's seeded RNG. Tree presets normally
    // reserve the centre columns so the player's forward route stays open.
    const config = this.definition.trees;
    const blocks = [];
    for (const rowOffset of config.rowOffsets) {
      for (const column of config.columns) blocks.push({ column, rowOffset });
    }
    for (let index = blocks.length - 1; index > 0; index--) {
      const other = Math.floor(this.random() * (index + 1));
      [blocks[index], blocks[other]] = [blocks[other], blocks[index]];
    }

    const [minimumCount, maximumCount] = config.countRange;
    const count = minimumCount + Math.floor(this.random() * (maximumCount - minimumCount + 1));
    const [minimumScale, maximumScale] = config.scaleRange ?? [0.9, 1.1];
    const gridSize = this.definition.depth / this.definition.rowSpan;
    const trunkGeometry = new THREE.CylinderGeometry(0.16, 0.22, 1.15, 7);
    const canopyGeometry = new THREE.ConeGeometry(0.72, 1.45, 7);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: config.trunkColor ?? 0x76513a,
      roughness: 0.92,
      flatShading: true
    });
    const canopyColors = config.canopyColors ?? [0x3f7f4c, 0x57934f, 0x6aa557];
    const canopyMaterials = canopyColors.map((color) => new THREE.MeshStandardMaterial({
      color,
      roughness: 0.86,
      flatShading: true
    }));

    for (let index = 0; index < count; index++) {
      const block = blocks[index];
      const tree = new THREE.Group();
      tree.name = `strip-tree-${this.definition.index}-${index}`;
      tree.userData.gridColumn = block.column;
      tree.userData.rowOffset = block.rowOffset;

      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = 0.68;
      trunk.castShadow = true;
      tree.add(trunk);

      const canopy = new THREE.Mesh(
        canopyGeometry,
        canopyMaterials[Math.floor(this.random() * canopyMaterials.length)]
      );
      canopy.position.y = 1.75;
      canopy.castShadow = true;
      tree.add(canopy);

      const scale = minimumScale + this.random() * (maximumScale - minimumScale);
      tree.scale.setScalar(scale);
      tree.position.set(block.column * gridSize, 0.11, this.localZForRow(block.rowOffset));
      this.root.add(tree);
      this.blockedCells.push({
        x: tree.position.x,
        z: this.z + tree.position.z,
        type: "tree"
      });
    }
  }

  createRoadMarkings() {
    // Draw the repeated dashed street line across the centre of a traffic row.
    // A strip preset can override any of these values through `markings`.
    const markings = {
      color: 0xe2dd9a,
      length: 1.4,
      thickness: 0.08,
      spacing: 3,
      offsetZ: 0,
      ...this.definition.markings
    };
    const lineMaterial = new THREE.MeshBasicMaterial({ color: markings.color });
    for (let x = -9; x <= 9; x += markings.spacing) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(markings.length, 0.025, markings.thickness),
        lineMaterial
      );
      stripe.position.set(x, 0.015, markings.offsetZ);
      this.root.add(stripe);
    }
  }

  createMedianDetails() {
    // Draw the raised green median top and the pale kerbs on both edges.
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(this.definition.width - 0.5, 0.08, this.definition.depth - 0.42),
      new THREE.MeshStandardMaterial({ color: 0x85b96b, roughness: 0.88, flatShading: true })
    );
    top.position.y = 0.15;
    top.receiveShadow = true;
    this.root.add(top);

    const kerbMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e9d3, roughness: 0.78, flatShading: true });
    const kerbOffset = this.definition.depth / 2 - 0.17;
    for (const localZ of [-kerbOffset, kerbOffset]) {
      const kerb = new THREE.Mesh(
        new THREE.BoxGeometry(this.definition.width, 0.24, 0.18),
        kerbMaterial
      );
      kerb.position.set(0, 0.12, localZ);
      kerb.castShadow = true;
      kerb.receiveShadow = true;
      this.root.add(kerb);
    }
  }

createCheckpointMarker() {
  // Small checkpoint flag placed near the edge of the safe strip.
  const flag = new THREE.Group();

  // Pole
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.035, 1.2, 8),
    new THREE.MeshStandardMaterial({ color: 0xdddddd })
  );
  pole.position.y = 0.6;
  flag.add(pole);

  // Flag cloth
  const cloth = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.32, 0.04),
    new THREE.MeshStandardMaterial({ color: 0xffffff })
  );
  cloth.position.set(0.275, 1.02, 0);
  flag.add(cloth);

  // Put it near the right-hand end of the strip
  flag.position.set(
    this.definition.width / 2 - 0.8,
    this.definition.surface === "median" ? 0.21 : 0.13,
    0
  );

  this.root.add(flag);
}

  createTraffic() {
    // Each lane gets an independent fixed pool, spacing, direction and recycle tail.
    for (const lane of this.lanes) this.createTrafficLane(lane);
  }

  createTrafficLane(lane) {
    let previousX = lane.direction > 0
      ? -10 + this.random() * 20
      : 10 - this.random() * 20;
    for (let index = 0; index < lane.vehicleCount; index++) {
      const type = this.vehicleTypeFor(lane, index);
      const vehicle = this.createVehicle(lane, type, index);
      if (index > 0) previousX -= lane.direction * this.randomGap(lane);
      vehicle.root.position.x = previousX;
      vehicle.mover.reset(vehicle.root.position, 1);
      if (vehicle.isTaxi) this.scheduleTaxiStop(vehicle);
      this.traffic.push(vehicle);
    }
  }

  createVehicle(lane, type, index) {
    // Build a simple vehicle model. Replace this section when GLB models are introduced.
    const shape = VEHICLE_SHAPES[type] ?? VEHICLE_SHAPES.car;
    const vehicleRoot = new THREE.Group();
    vehicleRoot.name = `${type}-${this.definition.index}-${lane.laneIndex}-${index}`;
    vehicleRoot.rotation.y = lane.direction > 0 ? -Math.PI / 2 : Math.PI / 2;
    this.root.add(vehicleRoot);

    const body = new THREE.Mesh(
      new THREE.BoxGeometry(shape.width, shape.height, shape.length),
      new THREE.MeshStandardMaterial({
        color: type === "taxi" ? 0xf2b233 : VEHICLE_COLORS[Math.floor(this.random() * VEHICLE_COLORS.length)],
        roughness: 0.55,
        metalness: 0.2
      })
    );
    body.position.y = shape.height / 2;
    body.castShadow = true;
    vehicleRoot.add(body);

    // The windscreen marks the front, making travel direction visually readable.
    const windscreen = new THREE.Mesh(
      new THREE.BoxGeometry(shape.width * 0.72, shape.height * 0.34, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xbfe4ef })
    );
    windscreen.position.set(0, shape.height * 0.7, -shape.length / 2 - 0.015);
    vehicleRoot.add(windscreen);

    if (type === "taxi") this.decorateTaxi(vehicleRoot, shape);
    const passenger = type === "taxi" ? this.createTaxiPassenger(lane) : null;
    vehicleRoot.position.z = lane.localZ;
    const start = new THREE.Vector3(lane.direction > 0 ? -TRAFFIC_EDGE : TRAFFIC_EDGE, 0, lane.localZ);
    const end = new THREE.Vector3(lane.direction > 0 ? TRAFFIC_EDGE : -TRAFFIC_EDGE, 0, lane.localZ);
    return {
      root: vehicleRoot,
      controller: new VehicleController(vehicleRoot, {
        maxForwardSpeed: lane.speed,
        acceleration: 18,
        braking: 24
      }),
      lane,
      mover: new WaypointMover(vehicleRoot, {
        points: [start, end],
        speed: lane.speed,
        mode: "one-shot",
        debugRoot: this.root,
        debugColor: type === "taxi" ? 0xf2b233 : 0x8fd6c8
      }),
      type,
      length: shape.length,
      isTaxi: type === "taxi",
      passenger,
      stopTimer: 0,
      nextStopX: null
    };
  }

  decorateTaxi(vehicleRoot, shape) {
    // Draw the taxi's roof sign so the hazard is recognizable at a glance.
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.38),
      new THREE.MeshBasicMaterial({ color: 0xfff4a3 })
    );
    sign.position.set(0, shape.height + 0.12, 0);
    vehicleRoot.add(sign);
  }

  createTaxiPassenger(lane) {
    // Hidden passenger shown beside a taxi only while it performs a random stop.
    const passenger = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 1.15, 0.45),
      new THREE.MeshStandardMaterial({ color: 0x35e0d1, roughness: 0.8 })
    );
    passenger.visible = false;
    passenger.position.set(0, 0.58, lane.localZ + 0.95);
    this.root.add(passenger);
    return passenger;
  }

  update(dt) {
    // Advance this strip's traffic and handle taxi stops and end-of-row recycling.
    for (const vehicle of this.traffic) {
      if (vehicle.stopTimer > 0) {
        vehicle.stopTimer = Math.max(0, vehicle.stopTimer - dt);
        vehicle.controller.stop();
        if (vehicle.stopTimer === 0) {
          vehicle.passenger.visible = false;
          this.scheduleTaxiStop(vehicle);
        }
        continue;
      }

      const result = vehicle.mover.update(dt, (direction, requested, stepDt) =>
        this.advanceVehicle(vehicle, direction, requested, stepDt)
      );
      if (result.arrived || vehicle.mover.finished) {
        this.recycleVehicle(vehicle);
        continue;
      }

      if (vehicle.isTaxi && this.hasReachedTaxiStop(vehicle)) this.stopTaxi(vehicle);
    }
  }

  advanceVehicle(vehicle, direction, requested, dt) {
    // Preserve a safe following distance, including behind a stopped taxi.
    const available = this.distanceToVehicleAhead(vehicle);
    if (available <= 0) {
      vehicle.controller.stop();
      return 0;
    }

    const startX = vehicle.root.position.x;
    const travelled = vehicle.controller.followDirection(dt, direction);
    const allowed = Math.min(requested, travelled, available);
    vehicle.root.position.x = startX + vehicle.lane.direction * allowed;
    if (allowed < travelled) vehicle.controller.stop();
    return allowed;
  }

  distanceToVehicleAhead(vehicle) {
    let available = Infinity;
    for (const other of this.traffic) {
      if (other === vehicle || other.lane !== vehicle.lane) continue;
      const centerDistance = (other.root.position.x - vehicle.root.position.x) * vehicle.lane.direction;
      if (centerDistance <= 0) continue;
      const followingDistance = (vehicle.length + other.length) / 2 + 0.8;
      available = Math.min(available, centerDistance - followingDistance);
    }
    return Math.max(0, available);
  }

  recycleVehicle(vehicle) {
    // Reuse the same object behind the current tail instead of creating a new vehicle.
    const lane = vehicle.lane;
    const otherVehicles = this.traffic.filter((candidate) => candidate !== vehicle && candidate.lane === lane);
    const tailX = lane.direction > 0
      ? Math.min(...otherVehicles.map((candidate) => candidate.root.position.x), -TRAFFIC_EDGE)
      : Math.max(...otherVehicles.map((candidate) => candidate.root.position.x), TRAFFIC_EDGE);
    const nextX = tailX - lane.direction * this.randomGap(lane);
    vehicle.controller.stop();
    vehicle.mover.reset(new THREE.Vector3(nextX, 0, lane.localZ), 1);
    if (vehicle.isTaxi) {
      vehicle.passenger.visible = false;
      this.scheduleTaxiStop(vehicle);
    }
  }

  stopTaxi(vehicle) {
    vehicle.stopTimer = 1.1 + this.random() * 0.7;
    vehicle.controller.stop();
    vehicle.passenger.position.x = vehicle.root.position.x;
    vehicle.passenger.visible = true;
    this.audio?.cue(520, 0.13, 0.1, vehicle.root.position.x / 12);
  }

  scheduleTaxiStop(vehicle) {
    const distance = 4.5 + this.random() * 4.5;
    const desired = vehicle.root.position.x + vehicle.lane.direction * distance;
    vehicle.nextStopX = THREE.MathUtils.clamp(desired, -TRAFFIC_EDGE + 3, TRAFFIC_EDGE - 3);
  }

  hasReachedTaxiStop(vehicle) {
    return vehicle.lane.direction > 0
      ? vehicle.root.position.x >= vehicle.nextStopX
      : vehicle.root.position.x <= vehicle.nextStopX;
  }

  vehicleTypeFor(lane, index) {
    if (lane.taxiStops && index === 0) return "taxi";
    const choices = lane.allowedVehicleTypes.filter((type) => type !== "taxi");
    return choices[Math.floor(this.random() * choices.length)] ?? lane.allowedVehicleTypes[0];
  }

  randomGap(lane) {
    const [minimum, maximum] = lane.gapRange;
    return minimum + this.random() * (maximum - minimum);
  }

  setDebugVisible(visible) {
    for (const vehicle of this.traffic) vehicle.mover.setDebugVisible(visible);
  }
}
