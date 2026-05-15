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
// restingUntil is epoch-millis; null means no rest is active.
export interface HorsesEnvelope {
  horses: Horse[]
  restingUntil: number | null
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
}

export interface SimulationSnapshot {
  roundNumber: number
  distance: number
  elapsedMs: number
  lanes: LanePosition[]
}
