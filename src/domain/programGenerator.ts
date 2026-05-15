import { LANE_COUNT, ROUND_DISTANCES } from './constants'
import type { Horse, HorseId, Program, Rng, Round } from './types'

// Builds the 6-round program. Each round draws LANE_COUNT horses from the
// eligible pool (excluding any horse that raced in the immediately previous
// round) using sequential weighted-without-replacement, weight = condition
// (BUSINESS_LOGIC.md §3.2, decision #11). Selection order = lane order.
export function generateProgram(horses: Horse[], rng: Rng): Program {
  const program: Round[] = []
  for (const distance of ROUND_DISTANCES) {
    const previousLanes = new Set(program[program.length - 1]?.lanes ?? [])
    const pool = horses.filter((horse: Horse) => !previousLanes.has(horse.number))
    const lanes: HorseId[] = []
    while (lanes.length < LANE_COUNT) {
      const totalWeight = pool.reduce((sum: number, horse: Horse) => sum + horse.condition, 0)
      const target = rng() * totalWeight
      let running = 0
      // findIndex callback accumulates running weight; with totalWeight > 0
      // and target < totalWeight, some index always crosses, so pickIdx >= 0
      const pickIdx = pool.findIndex((horse: Horse) => (running += horse.condition) > target)
      lanes.push(pool[pickIdx]!.number)
      pool.splice(pickIdx, 1)
    }
    program.push({ distance, lanes })
  }
  return program
}
