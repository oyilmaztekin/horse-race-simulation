export type Rng = () => number

export type HorseId = number

// Race phase names — BUSINESS_LOGIC.md §4.2. Single source of truth for the
// store's discriminated union and InvalidTransitionError's `kind` field.
export type RacePhase = 'INITIAL' | 'RESTING' | 'READY' | 'RACING' | 'FINISHED'

export interface Horse {
  number: HorseId
  name: string
  condition: number
}

export interface Round {
  distance: number
  lanes: HorseId[]
}

export type Program = Round[]

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
