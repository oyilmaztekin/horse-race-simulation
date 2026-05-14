// Per BUSINESS_LOGIC.md §3.1 and CLAUDE.md §1 — single source of truth
// for every numeric/structural constant the domain refers to.

export const HORSE_COUNT = 20
export const CONDITION_MIN = 1
export const CONDITION_MAX = 100

// Distances per round (m), ordered round-1..round-6 (BUSINESS_LOGIC.md §3.2).
// ROUND_COUNT is derived from this tuple so the two can never drift apart.
export const ROUND_DISTANCES = [1200, 1400, 1600, 1800, 2000, 2200] as const
export const ROUND_COUNT = ROUND_DISTANCES.length

export const LANE_COUNT = 10

// Speed-formula tuning (BUSINESS_LOGIC.md §3.4 / decision #12; ARCHITECTURE.md §16.2).
// Tuned for "believable, not realistic" — a thoroughbred gallops ~16–18 m/s.
export const BASE_SPEED_MPS_MIN = 14
export const BASE_SPEED_MPS_MAX = 18
export const JITTER_MPS = 1.5

// Per BUSINESS_LOGIC.md §3.7 / decision #10: each raced horse loses
// FATIGUE_PER_RACE; each rested horse gains RECOVERY_PER_REST. Clamped to
// [CONDITION_MIN, CONDITION_MAX] by `applyRoundEffects`.
export const FATIGUE_PER_RACE = 8
export const RECOVERY_PER_REST = 3

// Fixed 60 Hz simulation tick (BUSINESS_LOGIC.md decision #16). The rAF
// accumulator in useRaceSimulation calls simulation.step with this dt, so
// the seeded RNG consumption pattern is reproducible across re-runs.
export const SIM_TICK_MS = 1000 / 60
