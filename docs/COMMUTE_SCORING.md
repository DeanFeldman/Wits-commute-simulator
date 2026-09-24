# Commute Scoring Contract

Issue #41 replaces the old flat completion score with a performance-based commute rating.

## Score structure

Every successful level is worth at most 100 points:

| Component | Maximum |
| --- | ---: |
| Time | 40 |
| Mistakes | 30 |
| Level-specific quality | 30 |
| **Level total** | **100** |

A complete three-level journey is therefore scored out of 300.

Levels 1 and 3 use bounded time scoring: full credit at or below the level's par time, zero at or above its slow time, and linear interpolation between those values.

Level 2 is intentionally different because it has no time limit. It uses open-ended fastest-completion scoring instead: full time credit at or below its par time, then a continuously decreasing score for slower successful finishes.

## Level 1 — Park at Wits

Time:

- par: 45 seconds
- slow: 120 seconds

Mistake score:

- starts from the car's remaining condition as a fraction of 30 points;
- each previously failed or manually restarted attempt removes 10 points.

Quality score:

- 15 points for parking containment, normalised from the 80% pass threshold to 100%;
- 15 points for alignment, normalised from the 12 degree pass threshold to perfect alignment.

The level reports its successful attempt's elapsed time, remaining condition, containment and alignment error to the central scoring system.

## Level 2 — Cross the Road

Time:

- there is no countdown time limit and no time-based failure state;
- the level records the player's actual elapsed completion time;
- par: 40 seconds;
- 40 seconds or faster earns the full 40-point time component;
- after 40 seconds, the time component is `round(40 × 40 / elapsedSeconds)`;
- there is no slow-time cutoff, so slower successful runs continue to earn some time credit;
- Flat White cups no longer subtract seconds from the recorded time;
- backwards movement no longer changes the timer and is scored only through the quality component.

Mistake score:

- starts at 30;
- each traffic impact removes 6 points;
- shield-absorbed traffic impacts still count as impacts;
- each previously failed or manually restarted attempt removes 10 points.

Quality score:

- starts at 30;
- each backwards movement step removes 3 points.

Vida cups are required for success, so collection count is not used as a quality discriminator.

## Level 3 — Don't Get Caught

Time:

- par: 45 seconds
- slow: the 100-second level time limit.

Mistake score:

- starts at 30;
- each incorrect submitted answer removes 6 points;
- each previously failed or manually restarted attempt removes 10 points.

Quality score:

- based on final suspicion;
- 0% suspicion earns 30 points and 100% earns 0, with linear scaling between them.

## Commute ratings

| Total | Rating |
| ---: | --- |
| 270–300 | S — Wits Commute Legend |
| 240–269 | A — Smooth Commute |
| 210–239 | B — Solid Commute |
| 180–209 | C — Cutting It Fine |
| 0–179 | D — Barely Made It |

## Retry accounting

A full failure that reaches the shared Game Over screen counts as one failed attempt. A manual Ctrl+R restart during a scored journey also counts as a failed attempt. Pressing Retry on the Game Over screen does not count twice.

Checkpoint respawns inside Level 2 are impacts, not failed level attempts.

## Results and records

The results screen shows:

- commute rating and score out of 300;
- total active gameplay time;
- each level score and its time / mistakes / quality breakdown;
- raw level-specific performance details;
- saved personal bests.

Successful scored journeys persist the following in `localStorage` under `wits-commute-personal-bests-v1`:

- best successful time for each level;
- best complete-journey time;
- best complete-journey score.

Developer level shortcuts still calculate scores for debugging, but do not update personal-best records.

## Code ownership

`src/core/commuteScoring.js` is the single scoring authority. Level modules only report raw performance data. `Game` owns journey-level attempt accounting, result aggregation, persistence and results presentation.

Keep scoring constants named and centralised so playtesting can rebalance them without spreading magic numbers through the level code.
