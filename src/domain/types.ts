export type Rng = () => number

export type HorseId = number

export interface Horse {
  number: HorseId
  name: string
  condition: number
}
