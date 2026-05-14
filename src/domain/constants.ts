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

// Eligibility constants (BUSINESS_LOGIC.md §3.3). MIN_REST_ROUNDS is referenced
// by programGenerator's previous-round exclusion; MAX_RACES_PER_HORSE feeds the
// derived fit-gate threshold below.
export const MIN_REST_ROUNDS = 1
export const MAX_RACES_PER_HORSE = 4

// Fit-gate (BUSINESS_LOGIC.md §3.8 / decision #26). A horse is fit when
// condition ≥ MIN_RACEABLE_CONDITION. Rest bumps every unfit horse to exactly
// this value. MIN_FIT_HORSES_FOR_PROGRAM is *derived*, not hand-tuned — it
// stays correct if LANE_COUNT, ROUND_COUNT, or MAX_RACES_PER_HORSE change
// (CLAUDE.md §1: no parallel literal).
export const MIN_RACEABLE_CONDITION = 40
export const MIN_FIT_HORSES_FOR_PROGRAM = (LANE_COUNT * ROUND_COUNT) / MAX_RACES_PER_HORSE

// Rest mechanism timings (BUSINESS_LOGIC.md §3.8 / §4.7).
export const REST_DURATION_MS = 10_000
export const REST_POLL_INTERVAL_MS = 1_000

// Pause between rounds (BUSINESS_LOGIC.md §4.4).
export const INTER_ROUND_DELAY_MS = 1500
