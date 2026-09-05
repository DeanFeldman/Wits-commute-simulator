import {
  CUSTOM_HAZARD_STRIPS,
  CUSTOM_SAFE_STRIPS,
  LEVEL_2_STRIPS
} from "./Level2StripLibrary.js";

// Re-export these names so existing imports keep working.
export { CUSTOM_HAZARD_STRIPS, CUSTOM_SAFE_STRIPS, LEVEL_2_STRIPS };

export const STRIP_WIDTH = 22;
export const STRIP_DEPTH = 1.6;
// 25 rows create at least 24 forward grid steps: twice the original crossing.
export const LEVEL_2_ROW_COUNT = 25;

const VEHICLE_LENGTH = 2.6;
const MINIMUM_OPEN_GAP = 3.2;

export function createSeededRandom(seed) {
  // Mulberry32 gives fast, repeatable gameplay randomness from one integer seed.
  let state = normalizeSeed(seed);
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function normalizeSeed(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  if (typeof seed === "string" && /^\d+$/.test(seed)) return Number(seed) >>> 0;

  const text = String(seed ?? "level-2");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function generateLevel2Layout(seed) {
  const normalizedSeed = normalizeSeed(seed);
  const random = createSeededRandom(normalizedSeed);
  const hazardPositions = [];
  for (let index = 2; index < LEVEL_2_ROW_COUNT - 1; index += 2) {
    hazardPositions.push(index);
  }

  const taxiPosition = hazardPositions[Math.floor(hazardPositions.length / 2)];
  // A second protected checkpoint sits earlier in the crossing, well clear of
  // the taxi's median so the two checkpoints don't collide.
  const earlyCheckpointHazardPosition = hazardPositions[Math.max(1, Math.floor(hazardPositions.length / 3) - 1)];
  const taxiCheckpointRow = taxiPosition - 1;
  const earlyCheckpointRow = earlyCheckpointHazardPosition - 1;
  // Exactly one of the two median checkpoints is the Amic Deck bridge; the
  // other stays a plain traffic island. Which slot gets the bridge is randomised.
  const bridgeRow = random() < 0.5 ? earlyCheckpointRow : taxiCheckpointRow;

  const { hazards } = LEVEL_2_STRIPS;
  const hazardChoices = [...hazards.left, ...hazards.right, ...hazards.fast, ...hazards.custom];

  // Guarantee the core traffic types once, then fill remaining hazard slots
  // from the complete authored library.
  const ordinaryHazards = [
    pick(hazards.left, random),
    pick(hazards.right, random),
    pick(hazards.fast, random)
  ];
  while (ordinaryHazards.length < hazardPositions.length - 1) {
    ordinaryHazards.push(pick(hazardChoices, random));
  }
  const hazardsForLayout = shuffled(ordinaryHazards, random);

  // Layout recipe: fixed two-row start, then hazard/safe alternation.
  // Two protected checkpoints (one dressed as the bridge) and the taxi
  // hazard sit at fixed points through the crossing.
  const strips = [cloneStrip(LEVEL_2_STRIPS.start)];
  for (let index = 2; index < LEVEL_2_ROW_COUNT - 1; index++) {
    if (index === taxiPosition) {
      strips.push(cloneStrip(pick(hazards.taxi, random)));
    } else if (index === earlyCheckpointRow || index === taxiCheckpointRow) {
      strips.push(cloneStrip(index === bridgeRow ? LEVEL_2_STRIPS.bridgeCheckpoint : LEVEL_2_STRIPS.checkpoint));
    } else if (index % 2 === 0) {
      strips.push(cloneStrip(hazardsForLayout.shift()));
    } else {
      strips.push(cloneStrip(pick(LEVEL_2_STRIPS.safe, random)));
    }
  }
  strips.push(cloneStrip(LEVEL_2_STRIPS.finish));

  let rowStart = 0;
  const positionedStrips = strips.map((strip, index) => {
    const rowSpan = strip.rowSpan ?? 1;
    const positioned = {
      ...strip,
      index,
      rowStart,
      rowSpan,
      width: STRIP_WIDTH,
      depth: STRIP_DEPTH * rowSpan
    };
    rowStart += rowSpan;
    return positioned;
  });

  const layout = {
    seed: normalizedSeed,
    width: STRIP_WIDTH,
    depth: STRIP_DEPTH,
    rowCount: rowStart,
    strips: positionedStrips
  };

  const errors = validateLevel2Layout(layout);
  if (errors.length > 0) {
    throw new Error(`Invalid Level 2 layout for seed ${normalizedSeed}: ${errors.join(" ")}`);
  }
  return layout;
}

export function validateLevel2Layout(layout) {
  // Structural validation is independent of Three.js so it can run in tests.
  const errors = [];
  const strips = layout?.strips ?? [];
  if (strips[0]?.type !== "start") errors.push("The first strip must be the fixed start pavement.");
  if (strips.at(-1)?.type !== "finish") errors.push("The final strip must be the fixed finish pavement.");
  if (strips[0]?.traffic || strips[0]?.rowSpan < 2) errors.push("The opening strip must provide two safe rows.");

  for (let index = 1; index < strips.length - 1; index++) {
    const shouldBeHazard = index % 2 === 1;
    if (isHazardStrip(strips[index]) !== shouldBeHazard) {
      errors.push(`Strip ${index} breaks the hazard/safe alternation.`);
    }
  }

  let trafficRun = 0;
  let hardRun = 0;
  let expectedRowStart = 0;
  for (let index = 0; index < strips.length; index++) {
    const strip = strips[index];
    if (!Number.isInteger(strip.rowSpan) || strip.rowSpan < 1) {
      errors.push(`Strip ${index} has an invalid row span.`);
    }
    if (strip.rowStart !== expectedRowStart) {
      errors.push(`Strip ${index} does not stack after the previous strip.`);
    }
    if (strip.width !== STRIP_WIDTH || strip.depth !== STRIP_DEPTH * strip.rowSpan) {
      errors.push(`Strip ${index} does not use grid-aligned dimensions.`);
    }
    expectedRowStart += strip.rowSpan;

    for (const model of strip.models ?? []) {
      if (typeof model.path !== "string" || !model.path.startsWith("./assets/")) {
        errors.push(`Strip ${index} model paths must start with ./assets/.`);
      }
    }
    if (strip.trees) validateTrees(strip, index, errors);
    // Validated regardless of hazard classification: the bridge checkpoint
    // carries decorative highway traffic but is not itself a hazard.
    if (strip.traffic) validateTraffic(strip, index, errors);
    if (strip.crowd) validateCrowd(strip, index, errors);

    if (!isHazardStrip(strip)) {
      trafficRun = 0;
      hardRun = 0;
      continue;
    }

    trafficRun += 1;
    hardRun = strip.difficulty >= 2 ? hardRun + 1 : 0;
    if (trafficRun > 1) errors.push(`Traffic strips are adjacent at index ${index}.`);
    if (hardRun > 1) errors.push(`Difficult traffic strips are adjacent at index ${index}.`);

    if (strip.type === "taxi-hazard") {
      if (index < 3 || index > strips.length - 4) {
        errors.push(`Taxi strip ${index} is too close to the start or finish.`);
      }
      if (!strips[index - 1]?.checkpoint) {
        errors.push(`Taxi strip ${index} must follow a protected checkpoint.`);
      }
    }
  }

  if (layout.rowCount !== expectedRowStart) errors.push("Layout row count does not match its strip spans.");
  if (layout.rowCount < LEVEL_2_ROW_COUNT) errors.push(`Layout must cover at least ${LEVEL_2_ROW_COUNT} rows.`);

  const checkpoints = strips.filter((strip) => strip.checkpoint);
  const medianCheckpointTypes = checkpoints.slice(1).map((strip) => strip.type).sort();
  if (checkpoints.length !== 3 || checkpoints[0]?.type !== "start"
    || medianCheckpointTypes.join(",") !== "bridge,median") {
    errors.push("Layouts must contain exactly three checkpoints: the start, one bridge, and one median.");
  }

  const requiredTypes = ["road-left", "road-right", "road-fast", "median", "bridge", "taxi-hazard"];
  for (const type of requiredTypes) {
    if (!strips.some((strip) => strip.type === type)) errors.push(`Layout is missing ${type}.`);
  }
  return errors;
}

export function validateGeneratedLayouts(count = 100, firstSeed = 1) {
  const failures = [];
  for (let offset = 0; offset < count; offset++) {
    const seed = normalizeSeed(firstSeed + offset);
    try {
      generateLevel2Layout(seed);
    } catch (error) {
      failures.push({ seed, message: error.message });
    }
  }
  return failures;
}

function validateTraffic(strip, index, errors) {
  const lanes = strip.traffic.lanes ?? [strip.traffic];
  if (lanes.length === 0) errors.push(`Strip ${index} must contain at least one traffic lane.`);

  const occupiedRows = new Set();
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
    const lane = lanes[laneIndex];
    const label = `Strip ${index} lane ${laneIndex}`;
    const { direction, speed, gapRange, allowedVehicleTypes, vehicleCount, rowOffset } = lane;
    if (direction !== -1 && direction !== 1) errors.push(`${label} has an invalid direction.`);
    if (!(speed > 0)) errors.push(`${label} has an invalid speed.`);
    if (!Array.isArray(gapRange) || gapRange.length !== 2 || gapRange[0] > gapRange[1]) {
      errors.push(`${label} has an invalid gap range.`);
    } else if (gapRange[0] - VEHICLE_LENGTH < MINIMUM_OPEN_GAP) {
      errors.push(`${label} does not leave a patient-player gap.`);
    }
    if (!Array.isArray(allowedVehicleTypes) || allowedVehicleTypes.length === 0) {
      errors.push(`${label} has no allowed vehicle types.`);
    }
    if (!Number.isInteger(vehicleCount) || vehicleCount < 1) {
      errors.push(`${label} has an invalid vehicle count.`);
    }
    if (rowOffset !== undefined && (!Number.isInteger(rowOffset) || rowOffset < 0 || rowOffset >= strip.rowSpan)) {
      errors.push(`${label} has an invalid traffic row offset.`);
    }
    const resolvedRowOffset = rowOffset ?? Math.floor(strip.rowSpan / 2);
    if (occupiedRows.has(resolvedRowOffset)) errors.push(`${label} overlaps another traffic lane.`);
    occupiedRows.add(resolvedRowOffset);
  }
}

function validateCrowd(strip, index, errors) {
  const { count, speedRange, rowOffsets = [0] } = strip.crowd;
  if (!Number.isInteger(count) || count < 1) {
    errors.push(`Strip ${index} has an invalid crowd count.`);
  }
  if (!Array.isArray(speedRange) || speedRange.length !== 2
    || !(speedRange[0] > 0) || speedRange[0] > speedRange[1]) {
    errors.push(`Strip ${index} has an invalid crowd speed range.`);
  }
  if (!Array.isArray(rowOffsets) || rowOffsets.length === 0
    || rowOffsets.some((row) => !Number.isInteger(row) || row < 0 || row >= strip.rowSpan)) {
    errors.push(`Strip ${index} has invalid crowd row offsets.`);
  }
}

function validateTrees(strip, index, errors) {
  const { countRange, columns, rowOffsets, scale = 1 } = strip.trees;
  const validCountRange = Array.isArray(countRange) && countRange.length === 2
    && Number.isInteger(countRange[0]) && Number.isInteger(countRange[1])
    && countRange[0] >= 0 && countRange[0] <= countRange[1];
  if (!validCountRange) errors.push(`Strip ${index} has an invalid tree count range.`);
  if (!Array.isArray(columns) || columns.length === 0 || columns.some((column) => !Number.isInteger(column))) {
    errors.push(`Strip ${index} has invalid tree columns.`);
  } else if (Array.from({ length: 13 }, (_, column) => column - 6).every((column) => columns.includes(column))) {
    errors.push(`Strip ${index} must leave at least one crossing column free of trees.`);
  }
  if (!Array.isArray(rowOffsets) || rowOffsets.length === 0
    || rowOffsets.some((row) => !Number.isInteger(row) || row < 0 || row >= strip.rowSpan)) {
    errors.push(`Strip ${index} has invalid tree row offsets.`);
  }
  if (!(scale > 0)) errors.push(`Strip ${index} has an invalid tree scale.`);
  if (validCountRange && Array.isArray(columns) && Array.isArray(rowOffsets)
    && countRange[1] > columns.length * rowOffsets.length) {
    errors.push(`Strip ${index} requests more trees than available grid blocks.`);
  }
}

function isHazardStrip(strip) {
  if (strip?.crowd) return true;
  const lanes = strip?.traffic?.lanes ?? (strip?.traffic ? [strip.traffic] : []);
  // Highway lanes dress the bridge checkpoint but are excluded from player
  // collision, so they never count as a real hazard.
  return lanes.some((lane) => !lane.isHighway);
}

function pick(values, random) {
  return values[Math.floor(random() * values.length)];
}

function shuffled(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function cloneStrip(strip) {
  return {
    ...strip,
    markings: strip.markings ? { ...strip.markings } : undefined,
    models: strip.models?.map((model) => ({
      ...model,
      position: model.position ? [...model.position] : undefined,
      rotation: model.rotation ? [...model.rotation] : undefined,
      scale: Array.isArray(model.scale) ? [...model.scale] : model.scale
    })),
    crowd: strip.crowd ? {
      ...strip.crowd,
      speedRange: [...strip.crowd.speedRange],
      rowOffsets: strip.crowd.rowOffsets ? [...strip.crowd.rowOffsets] : undefined
    } : undefined,
    trees: strip.trees ? {
      ...strip.trees,
      countRange: [...strip.trees.countRange],
      columns: [...strip.trees.columns],
      rowOffsets: [...strip.trees.rowOffsets],
      canopyColors: strip.trees.canopyColors ? [...strip.trees.canopyColors] : undefined
    } : undefined,
    traffic: cloneTraffic(strip.traffic)
  };
}

function cloneTraffic(traffic) {
  if (!traffic) return null;
  if (traffic.lanes) {
    return {
      ...traffic,
      lanes: traffic.lanes.map(cloneLane)
    };
  }
  return cloneLane(traffic);
}

function cloneLane(lane) {
  return {
    ...lane,
    gapRange: [...lane.gapRange],
    allowedVehicleTypes: [...lane.allowedVehicleTypes]
  };
}
