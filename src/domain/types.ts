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
