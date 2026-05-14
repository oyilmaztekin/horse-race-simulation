import { CONDITION_MAX, CONDITION_MIN, HORSE_COUNT } from './constants'
import type { Horse, Rng } from './types'

// Builds the initial 20-horse roster. Numbers are deterministic (1..HORSE_COUNT);
// conditions are uniformly random from the seeded RNG (BUSINESS_LOGIC.md §3.1).
// Names are injected via `lookupName` per decision #18 — domain never imports
// editorial data; the seed script wires `prisma/horseNames.json` in at the boundary.

export type NameLookup = (horseNumber: number) => string

export function generateRoster(rng: Rng, lookupName: NameLookup): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_, index) => {
    const number = index + 1
    return {
      number,
      name: lookupName(number),
      condition: pickConditionUniform(rng),
    }
  })
}

export function pickConditionUniform(rng: Rng): number {
  // closed interval [CONDITION_MIN, CONDITION_MAX] → count of integers in it
  const inclusiveRangeSize = CONDITION_MAX - CONDITION_MIN + 1
  return CONDITION_MIN + Math.floor(rng() * inclusiveRangeSize)
}
