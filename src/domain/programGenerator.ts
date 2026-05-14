import { ROUND_DISTANCES } from './constants'
import type { Horse, Program, Rng } from './types'

// Builds the 6-round program. Distances are fixed by ROUND_DISTANCES;
// lane assignments are filled in by later TDD cycles (rest/cap rules, weighting).
export function generateProgram(_horses: Horse[], _rng: Rng): Program {
  return ROUND_DISTANCES.map((distance) => ({ distance, lanes: [] }))
}
