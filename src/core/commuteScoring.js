const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const SCORE_CONFIG = Object.freeze({
  maxPerLevel: 100,
  components: Object.freeze({
    time: 40,
    mistakes: 30,
    quality: 30
  }),
  levels: Object.freeze({
    1: Object.freeze({ parTime: 45, slowTime: 120 }),
    // Level 2 records real elapsed time and has no timeout. Forty seconds
    // or faster earns full time credit; slower runs decay continuously.
    2: Object.freeze({ parTime: 40 }),
    3: Object.freeze({ parTime: 45, slowTime: 100 })
  })
});

export const COMMUTE_RATINGS = Object.freeze([
  Object.freeze({ minimum: 270, grade: "S", label: "Wits Commute Legend" }),
  Object.freeze({ minimum: 240, grade: "A", label: "Smooth Commute" }),
  Object.freeze({ minimum: 210, grade: "B", label: "Solid Commute" }),
  Object.freeze({ minimum: 180, grade: "C", label: "Cutting It Fine" }),
  Object.freeze({ minimum: 0, grade: "D", label: "Barely Made It" })
]);

export const PERSONAL_BESTS_STORAGE_KEY = "wits-commute-personal-bests-v1";

export function scoreTime(time, parTime, slowTime) {
  if (!Number.isFinite(time)) return 0;
  if (time <= parTime) return SCORE_CONFIG.components.time;
  if (time >= slowTime) return 0;

  const fraction = 1 - (time - parTime) / (slowTime - parTime);
  return Math.round(SCORE_CONFIG.components.time * fraction);
}

// Level 2 has no deadline. After par, its time score decays continuously
// instead of dropping to zero at an arbitrary cutoff, so faster finishes
// remain worth more even on longer runs.
export function scoreFastestTime(time, parTime) {
  if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(parTime) || parTime <= 0) return 0;
  if (time <= parTime) return SCORE_CONFIG.components.time;

  return Math.round(SCORE_CONFIG.components.time * (parTime / time));
}

function finalise(levelNumber, performance, componentScores) {
  const components = {
    time: Math.round(clamp(componentScores.time, 0, SCORE_CONFIG.components.time)),
    mistakes: Math.round(clamp(componentScores.mistakes, 0, SCORE_CONFIG.components.mistakes)),
    quality: Math.round(clamp(componentScores.quality, 0, SCORE_CONFIG.components.quality))
  };

  return {
    levelNumber,
    time: Math.max(0, Number(performance.time) || 0),
    failedAttempts: Math.max(0, Number(performance.failedAttempts) || 0),
    components,
    total: components.time + components.mistakes + components.quality,
    performance: { ...performance }
  };
}

export function scoreLevel(levelNumber, performance = {}) {
  const failedAttempts = Math.max(0, Number(performance.failedAttempts) || 0);
  const config = SCORE_CONFIG.levels[levelNumber];

  if (!config) {
    throw new Error(`No scoring configuration for Level ${levelNumber}`);
  }

  const time = Number(performance.time);
  const timeScore = levelNumber === 2
    ? scoreFastestTime(time, config.parTime)
    : scoreTime(time, config.parTime, config.slowTime);

  if (levelNumber === 1) {
    const condition = clamp(Number(performance.condition) || 0, 0, 100);
    const containment = clamp(Number(performance.containmentPercent) || 0, 0, 100);
    const angleError = clamp(Number(performance.alignmentErrorDegrees) || 0, 0, 180);
    const containmentQuality = 15 * clamp((containment - 80) / 20, 0, 1);
    const alignmentQuality = 15 * clamp((12 - angleError) / 12, 0, 1);

    return finalise(levelNumber, performance, {
      time: timeScore,
      mistakes: 30 * (condition / 100) - failedAttempts * 10,
      quality: containmentQuality + alignmentQuality
    });
  }

  if (levelNumber === 2) {
    const impacts = Math.max(0, Number(performance.impacts) || 0);
    const backwardSteps = Math.max(0, Number(performance.backwardSteps) || 0);

    return finalise(levelNumber, performance, {
      time: timeScore,
      mistakes: 30 - impacts * 6 - failedAttempts * 10,
      quality: 30 - backwardSteps * 3
    });
  }

  const incorrectAnswers = Math.max(0, Number(performance.incorrectAnswers) || 0);
  const suspicion = clamp(Number(performance.suspicion) || 0, 0, 100);

  return finalise(levelNumber, performance, {
    time: timeScore,
    mistakes: 30 - incorrectAnswers * 6 - failedAttempts * 10,
    quality: 30 * (1 - suspicion / 100)
  });
}

export function getCommuteRating(totalScore) {
  const score = clamp(Math.round(Number(totalScore) || 0), 0, 300);
  return COMMUTE_RATINGS.find((rating) => score >= rating.minimum);
}

export function summariseJourney(levelResults, totalTime) {
  const orderedResults = [...levelResults].sort((a, b) => a.levelNumber - b.levelNumber);
  const totalScore = orderedResults.reduce((sum, result) => sum + result.total, 0);

  return {
    levels: orderedResults,
    totalScore,
    totalTime: Math.max(0, Number(totalTime) || 0),
    rating: getCommuteRating(totalScore),
    isFullJourney: orderedResults.length === 3 &&
      orderedResults.every((result, index) => result.levelNumber === index + 1)
  };
}

export function loadPersonalBests(storage = globalThis.localStorage) {
  if (!storage) return {};

  try {
    const parsed = JSON.parse(storage.getItem(PERSONAL_BESTS_STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function updatePersonalBests(records = {}, summary) {
  const next = {
    levelTimes: { ...(records.levelTimes ?? {}) },
    journeyTime: Number.isFinite(records.journeyTime) ? records.journeyTime : null,
    journeyScore: Number.isFinite(records.journeyScore) ? records.journeyScore : null
  };

  for (const result of summary.levels) {
    const key = String(result.levelNumber);
    const previous = next.levelTimes[key];
    if (result.time > 0 && (!Number.isFinite(previous) || result.time < previous)) {
      next.levelTimes[key] = result.time;
    }
  }

  if (summary.isFullJourney) {
    if (!Number.isFinite(next.journeyTime) || summary.totalTime < next.journeyTime) {
      next.journeyTime = summary.totalTime;
    }
    if (!Number.isFinite(next.journeyScore) || summary.totalScore > next.journeyScore) {
      next.journeyScore = summary.totalScore;
    }
  }

  return next;
}

export function savePersonalBests(records, storage = globalThis.localStorage) {
  if (!storage) return false;

  try {
    storage.setItem(PERSONAL_BESTS_STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch {
    return false;
  }
}
