import { LANE_COUNT, ROUND_DISTANCES } from './constants'
import type { Horse, HorseId, Program, Rng, Round } from './types'

// Builds the 6-round program. Each round draws LANE_COUNT distinct horses
// uniformly at random, excluding any horse that raced in the immediately
// previous round (rest rule, MIN_REST_ROUNDS = 1). Cap rule and condition-
// weighting follow in subsequent TDD cycles.
export function generateProgram(horses: Horse[], rng: Rng): Program {
  const program: Round[] = []
  for (const distance of ROUND_DISTANCES) {
    const previousLanes = new Set(program[program.length - 1]?.lanes ?? [])
    const pool = horses.map((h) => h.number).filter((n) => !previousLanes.has(n))
    const lanes: HorseId[] = []
    while (lanes.length < LANE_COUNT) {
      // idx is in [0, pool.length) by construction; non-null assertion is safe
      const idx = Math.floor(rng() * pool.length)
      lanes.push(pool[idx]!)
      pool.splice(idx, 1)
    }
    program.push({ distance, lanes })
  }
  return program
}
