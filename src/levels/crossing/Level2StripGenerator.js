import {
  CUSTOM_HAZARD_STRIPS,
  CUSTOM_SAFE_STRIPS,
  LEVEL_2_STRIPS
} from "./Level2StripLibrary.js";

export { CUSTOM_HAZARD_STRIPS, CUSTOM_SAFE_STRIPS, LEVEL_2_STRIPS };

export const STRIP_WIDTH = 28;
export const STRIP_DEPTH = 2.4;
export const LEVEL_2_ROW_COUNT = 25;

const VEHICLE_LENGTH = 4.5;
const MINIMUM_OPEN_GAP = 3.2;
const ROUTE = [
  LEVEL_2_STRIPS.start,
  LEVEL_2_STRIPS.bridgeEntry,
  LEVEL_2_STRIPS.bridgeCheckpoint,
  LEVEL_2_STRIPS.engineeringCheckpoint,
  LEVEL_2_STRIPS.yaleRoad,
  LEVEL_2_STRIPS.finish
];

export function createSeededRandom(seed) {
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
  let rowStart = 0;
  const strips = ROUTE.map((preset, index) => {
    const strip = cloneStrip(preset);
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
    strips
  };

  const errors = validateLevel2Layout(layout);
  if (errors.length > 0) {
    throw new Error(`Invalid Level 2 layout for seed ${normalizedSeed}: ${errors.join(" ")}`);
  }
  return layout;
}

export function validateLevel2Layout(layout) {
  const errors = [];
  const strips = layout?.strips ?? [];
  const expectedTypes = [
    "start",
    "bridge-entry",
    "bridge",
    "bridge-exit",
    "yale-road",
    "finish"
  ];

  if (strips.map((strip) => strip.type).join(",") !== expectedTypes.join(",")) {
    errors.push("Level 2 must follow the ARM walkway, bridge entry, M1 bridge, opposite landing, Yale Road, then Engineering.");
  }

  let expectedRowStart = 0;
  for (let index = 0; index < strips.length; index++) {
    const strip = strips[index];
    if (!Number.isInteger(strip.rowSpan) || strip.rowSpan < 1) errors.push(`Strip ${index} has an invalid row span.`);
    if (strip.rowStart !== expectedRowStart) errors.push(`Strip ${index} does not stack after the previous strip.`);
    if (strip.width !== STRIP_WIDTH || strip.depth !== STRIP_DEPTH * strip.rowSpan) {
      errors.push(`Strip ${index} does not use grid-aligned dimensions.`);
    }
    expectedRowStart += strip.rowSpan;
    if (strip.traffic) validateTraffic(strip, index, errors);
  }

  if (layout.rowCount !== expectedRowStart || layout.rowCount !== LEVEL_2_ROW_COUNT) {
    errors.push(`Level 2 must cover exactly ${LEVEL_2_ROW_COUNT} rows.`);
  }

  const checkpoints = strips.filter((strip) => strip.checkpoint).map((strip) => strip.type);
  if (checkpoints.join(",") !== "start,bridge-entry,bridge-exit") {
    errors.push("Checkpoints must be at the spawn, bridge entry, and far-side bridge landing before Yale Road.");
  }

  const yale = strips.find((strip) => strip.type === "yale-road");
  const bridge = strips.find((strip) => strip.type === "bridge");
  if (!yale?.traffic?.lanes?.every((lane) => !lane.isHighway)) errors.push("Yale Road must contain lethal surface traffic.");
  if (!bridge?.traffic?.lanes?.every((lane) => lane.isHighway)) errors.push("M1 traffic must be environmental only.");

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
  const occupiedRows = new Set();
  for (let laneIndex = 0; laneIndex < lanes.length; laneIndex++) {
    const lane = lanes[laneIndex];
    const label = `Strip ${index} lane ${laneIndex}`;
    if (lane.direction !== -1 && lane.direction !== 1) errors.push(`${label} has an invalid direction.`);
    if (!(lane.speed > 0)) errors.push(`${label} has an invalid speed.`);
    if (!Array.isArray(lane.gapRange) || lane.gapRange.length !== 2 || lane.gapRange[0] > lane.gapRange[1]) {
      errors.push(`${label} has an invalid gap range.`);
    } else if (lane.gapRange[0] - VEHICLE_LENGTH < MINIMUM_OPEN_GAP) {
      errors.push(`${label} does not leave a patient-player gap.`);
    }
    if (!Array.isArray(lane.allowedVehicleTypes) || lane.allowedVehicleTypes.length === 0) errors.push(`${label} has no vehicle types.`);
    if (!Number.isInteger(lane.vehicleCount) || lane.vehicleCount < 1) errors.push(`${label} has an invalid vehicle count.`);
    const rowOffset = lane.rowOffset ?? Math.floor(strip.rowSpan / 2);
    if (!Number.isInteger(rowOffset) || rowOffset < 0 || rowOffset >= strip.rowSpan) errors.push(`${label} has an invalid row offset.`);
    if (occupiedRows.has(rowOffset)) errors.push(`${label} overlaps another traffic lane.`);
    occupiedRows.add(rowOffset);
  }
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
  if (traffic.lanes) return { ...traffic, lanes: traffic.lanes.map(cloneLane) };
  return cloneLane(traffic);
}

function cloneLane(lane) {
  return {
    ...lane,
    gapRange: [...lane.gapRange],
    allowedVehicleTypes: [...lane.allowedVehicleTypes]
  };
}
