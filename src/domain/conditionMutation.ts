import {
  CONDITION_MAX,
  CONDITION_MIN,
  FATIGUE_PER_RACE,
  MIN_FIT_HORSES_FOR_PROGRAM,
  MIN_RACEABLE_CONDITION,
  RECOVERY_PER_REST,
} from './constants'
import { NotEnoughFitHorsesError } from './errors'
import type { Horse, HorseId } from './types'

// Per BUSINESS_LOGIC.md §3.8: a horse is fit when condition ≥ MIN_RACEABLE_CONDITION.
export function isFit(horse: Horse): boolean {
  return horse.condition >= MIN_RACEABLE_CONDITION
}

// Per BUSINESS_LOGIC.md §3.8 fit-gate: aggregate predicate over a roster.
// Used by `race.canRest`, `race.fitCount`, and the `assertEnoughFitHorses` guard.
export function countFitHorses(horses: Horse[]): number {
  return horses.filter((horse: Horse) => isFit(horse)).length
}

// Per BUSINESS_LOGIC.md §3.8 / decision #26: meeting-start guard. Throws
// NotEnoughFitHorsesError if fewer than MIN_FIT_HORSES_FOR_PROGRAM horses
// clear the fit threshold. Called by `race.generateProgram` before building.
export function assertEnoughFitHorses(horses: Horse[]): void {
  const fitCount = countFitHorses(horses)
  if (fitCount < MIN_FIT_HORSES_FOR_PROGRAM) {
    throw new NotEnoughFitHorsesError(fitCount, MIN_FIT_HORSES_FOR_PROGRAM)
  }
}

// Per BUSINESS_LOGIC.md §3.8 / decision #27: bump every unfit horse to exactly
// MIN_RACEABLE_CONDITION; horses already at/above the threshold are unchanged.
// Bump-to-floor (not bump-by-delta) guarantees one rest re-fits the whole roster.
export function applyRestEffects(horses: Horse[]): Horse[] {
  return horses.map((horse) =>
    isFit(horse) ? horse : { ...horse, condition: MIN_RACEABLE_CONDITION },
  )
}

// Per BUSINESS_LOGIC.md §3.7 / decision #10: end-of-round fatigue + recovery.
// Raced horses lose FATIGUE_PER_RACE; rested horses gain RECOVERY_PER_REST;
// condition is clamped to [CONDITION_MIN, CONDITION_MAX]. Identity fields
// (number, name) are preserved; only condition changes.
export function applyRoundEffects(horses: Horse[], raced: HorseId[]): Horse[] {
  const racedSet = new Set(raced)
  return horses.map((horse) => {
    const delta = racedSet.has(horse.number) ? -FATIGUE_PER_RACE : RECOVERY_PER_REST
    const next = horse.condition + delta
    const clamped = Math.max(CONDITION_MIN, Math.min(CONDITION_MAX, next))
    return { ...horse, condition: clamped }
  })
}
