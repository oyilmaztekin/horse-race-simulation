import { BASE_SPEED_MPS_MAX, BASE_SPEED_MPS_MIN, CONDITION_MAX } from './constants'

// Per BUSINESS_LOGIC.md §3.4 / decision #12: additive linear interpolation
// from MIN..MAX over condition, with a caller-supplied jitter perturbation.
// Drawing jitter is a separate concern (kept out so this stays pure).
export function computeSpeed(condition: number, jitter: number): number {
  const conditionRatio = condition / CONDITION_MAX
  const speedRange = BASE_SPEED_MPS_MAX - BASE_SPEED_MPS_MIN
  return BASE_SPEED_MPS_MIN + conditionRatio * speedRange + jitter
}
