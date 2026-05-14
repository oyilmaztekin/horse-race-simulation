import { LANE_COUNT, ROUND_DISTANCES } from './constants'
import type { Horse, HorseId, Program, Rng } from './types'

// Builds the 6-round program. Distances are fixed by ROUND_DISTANCES; each
// round draws LANE_COUNT distinct horses uniformly at random from the roster.
// Rest/cap rules and condition-weighting follow in subsequent TDD cycles.
export function generateProgram(horses: Horse[], rng: Rng): Program {
  return ROUND_DISTANCES.map((distance) => {
    const pool = horses.map((h) => h.number)
    const lanes: HorseId[] = []
    while (lanes.length < LANE_COUNT) {
      // idx is in [0, pool.length) by construction; non-null assertion is safe
      const idx = Math.floor(rng() * pool.length)
      lanes.push(pool[idx]!)
      pool.splice(idx, 1)
    }
    return { distance, lanes }
  })
}
