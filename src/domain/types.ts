export type Rng = () => number

export type HorseId = number

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
