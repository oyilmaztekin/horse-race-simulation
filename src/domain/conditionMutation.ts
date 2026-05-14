import { CONDITION_MAX, CONDITION_MIN, FATIGUE_PER_RACE, RECOVERY_PER_REST } from './constants'
import type { Horse, HorseId } from './types'

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
