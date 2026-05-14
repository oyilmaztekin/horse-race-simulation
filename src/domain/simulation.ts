import { BASE_SPEED_MPS_MAX, BASE_SPEED_MPS_MIN, CONDITION_MAX, JITTER_MPS } from './constants'
import type { Rng } from './types'

// Per BUSINESS_LOGIC.md §3.4 / decision #12: additive linear interpolation
// from MIN..MAX over condition, with a caller-supplied jitter perturbation.
// Drawing jitter is a separate concern (kept out so this stays pure).
export function computeSpeed(condition: number, jitter: number): number {
  const conditionRatio = condition / CONDITION_MAX
  const speedRange = BASE_SPEED_MPS_MAX - BASE_SPEED_MPS_MIN
  return BASE_SPEED_MPS_MIN + conditionRatio * speedRange + jitter
}

// One rng draw → uniform sample in [-JITTER_MPS, +JITTER_MPS).
// rng() === 0.5 returns 0 exactly — the symmetry anchor that makes the
// closed-form finish-time test (cond=MAX, jitter=0) feasible.
export function drawJitter(rng: Rng): number {
  return (rng() - 0.5) * 2 * JITTER_MPS
}
