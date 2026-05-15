import { PHASE_FINISHED, PHASE_INITIAL, PHASE_READY, PHASE_RESTING, PHASE_RACING } from './constants'

export type Rng = () => number

export type HorseId = number

// Race phase names — BUSINESS_LOGIC.md §4.2. Single source of truth for the
// store's discriminated union and InvalidTransitionError's `kind` field.
export type RacePhase =
  | typeof PHASE_INITIAL
  | typeof PHASE_RESTING
  | typeof PHASE_READY
  | typeof PHASE_RACING
  | typeof PHASE_FINISHED

export interface Horse {
  number: HorseId
  name: string
  condition: number
}

// GET /api/horses and POST /api/horses/rest both return this shape (ARCHITECTURE.md §6 / decision #29).
// restingUntil is the server-set deadline (epoch-millis); remainingRestMs is the
// server-computed countdown at the moment the response was generated. Both null
// when no rest is active. The client renders remainingRestMs directly — the
// server is the source of the displayed countdown (BUSINESS_LOGIC.md §4.7).
export interface HorsesEnvelope {
  horses: Horse[]
  restingUntil: number | null
  remainingRestMs: number | null
}

export interface Round {
  distance: number
  lanes: HorseId[]
}

export type Program = Round[]

// One horse's finish result within a round (ARCHITECTURE.md §6).
export interface Ranking {
  rank: number
  horseId: HorseId
  lane: number
  finishTimeMs: number
}

// The full result set for one completed round, stored in the race store.
export interface RoundResult {
  roundNumber: number
  rankings: Ranking[]
}

export interface LanePosition {
  horseId: HorseId
  lane: number
  meters: number
  finishedAtMs: number | null
  // Per-race form offset (m/s), drawn once at snapshot creation in lane-order
  // 1→10 via drawForm(rng). Constant across the race. BUSINESS_LOGIC.md §3.4.
  form: number
}

// One row of the end-of-meeting score table (ARCHITECTURE.md §6 / §14).
// Aggregates a horse's per-round Rankings into wins (rank=1), podiums
// (rank ≤ PODIUM_RANK_MAX), races run, and cumulative finish time.
export interface Standing {
  rank: number
  horseId: HorseId
  number: number
  name: string
  wins: number
  podiums: number
  roundsRun: number
  totalFinishTimeMs: number
}

export interface SimulationSnapshot {
  roundNumber: number
  distance: number
  elapsedMs: number
  lanes: LanePosition[]
}
