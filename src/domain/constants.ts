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

// Colorblind-safe lane palette (ARCHITECTURE.md §16.3). First 8 are Okabe-Ito
// (Wong 2011, Nature Methods) minus pure black; last 2 are wine + teal from
// Paul Tol's "muted" palette to extend to LANE_COUNT without sacrificing
// distinguishability. Hex codes are sourced from those references — do not
// hand-pick replacements without checking deuteranopia/protanopia contrast.
export const LANE_COLORS = [
  '#E69F00',
  '#56B4E9',
  '#009E73',
  '#F0E442',
  '#0072B2',
  '#D55E00',
  '#CC79A7',
  '#999999',
  '#882255',
  '#44AA99',
] as const

// Runtime invariant: lane palette length must match LANE_COUNT. A typo here
// would silently desync lane → color mapping; throwing at import time keeps
// the failure mode obvious instead of "lane 10 has undefined color".
if (LANE_COLORS.length !== LANE_COUNT) {
  throw new Error(
    `LANE_COLORS has ${LANE_COLORS.length} entries; expected ${LANE_COUNT}`,
  )
}

// Speed-formula tuning (BUSINESS_LOGIC.md §3.4 / decision #12; ARCHITECTURE.md §16.2).
// Tuned for "believable, not realistic" — a thoroughbred gallops ~16–18 m/s.
export const BASE_SPEED_MPS_MIN = 14
export const BASE_SPEED_MPS_MAX = 18
// Per-tick jitter, now purely visual (Phase 12 — per-race form owns outcome
// variance). Reduced from 1.5 → 0.5 so lanes still jiggle but don't churn the
// per-tick speed enough to mask the form-driven outcome.
export const JITTER_MPS = 0.5

// Per-race "form" magnitude (BUSINESS_LOGIC.md §3.4 / Phase 9 revision). One
// draw per lane at snapshot creation, held constant across the race. Lets
// close-condition pairs flip without making big-gap upsets common.
export const FORM_MPS = 1.0

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

// Sim-speed multiplier control (Phase 12.2 — reviewer feedback 2026-05-15).
// Default 2× so the meeting feels brisk on first impression; reviewer can
// slow down to 0.5× to inspect or bump up to 4× to skim. Step 0.5 keeps the
// readout's discrete grid auditable. Only scales in-race motion (the
// accumulator's `dt`), never inter-round pauses or the server-driven rest.
export const SIM_SPEED_DEFAULT = 2
export const SIM_SPEED_MIN = 0.5
export const SIM_SPEED_MAX = 4
export const SIM_SPEED_STEP = 0.5

// Phase name constants — BUSINESS_LOGIC.md §4.2. The string-literal union
// `RacePhase` (in types.ts) is the type-level view; these are the value-level
// view. Every reference in stores/composables/components must import these
// rather than inlining the string literal (CLAUDE.md §1: no duplicate literals).
export const PHASE_INITIAL = 'INITIAL'
export const PHASE_RESTING = 'RESTING'
export const PHASE_READY = 'READY'
export const PHASE_RACING = 'RACING'
export const PHASE_FINISHED = 'FINISHED'
