import { describe, expect, it } from 'vitest'
import {
  CONDITION_MAX,
  CONDITION_MIN,
  FATIGUE_PER_RACE,
  MIN_RACEABLE_CONDITION,
  RECOVERY_PER_REST,
} from '../constants'
import { applyRoundEffects, isFit } from '../conditionMutation'
import type { Horse } from '../types'

const horse = (number: number, condition: number, name = `H${number}`): Horse => ({
  number,
  name,
  condition,
})

describe('applyRoundEffects', () => {
  it('raced horses lose FATIGUE_PER_RACE; rested horses gain RECOVERY_PER_REST (happy)', () => {
    const horses: Horse[] = [horse(1, 50), horse(2, 50), horse(3, 50)]
    const raced = [1, 3]
    const next = applyRoundEffects(horses, raced)
    expect(next[0]?.condition).toBe(50 - FATIGUE_PER_RACE)
    expect(next[1]?.condition).toBe(50 + RECOVERY_PER_REST)
    expect(next[2]?.condition).toBe(50 - FATIGUE_PER_RACE)
  })

  it('clamps to [CONDITION_MIN, CONDITION_MAX] at both bounds (edge — boundary)', () => {
    // 1 rests at MAX → MAX+RECOVERY clamps down to MAX (upper bound).
    // 2 races at MIN → MIN-FATIGUE clamps up to MIN (lower bound).
    // 3 races at MIN+1 → underflow, clamps to MIN.
    // 4 rests at MAX-1 → overflow, clamps to MAX.
    const horses: Horse[] = [
      horse(1, CONDITION_MAX),
      horse(2, CONDITION_MIN),
      horse(3, CONDITION_MIN + 1),
      horse(4, CONDITION_MAX - 1),
    ]
    const raced = [2, 3]
    const next = applyRoundEffects(horses, raced)
    expect(next[0]?.condition).toBe(CONDITION_MAX)
    expect(next[1]?.condition).toBe(CONDITION_MIN)
    expect(next[2]?.condition).toBe(CONDITION_MIN)
    expect(next[3]?.condition).toBe(CONDITION_MAX)
  })

  it('preserves roster identity — same length, number and name unchanged, only condition mutates (sad — a stub that rebuilt horses would fail)', () => {
    const horses: Horse[] = [horse(1, 40, 'Alfa'), horse(2, 60, 'Bravo'), horse(3, 80, 'Charlie')]
    const raced = [2]
    const next = applyRoundEffects(horses, raced)
    expect(next).toHaveLength(horses.length)
    next.forEach((mutated, index) => {
      const original = horses[index] as Horse
      expect(mutated.number).toBe(original.number)
      expect(mutated.name).toBe(original.name)
    })
    expect(next[0]?.condition).not.toBe(horses[0]?.condition)
    expect(next[1]?.condition).not.toBe(horses[1]?.condition)
    expect(next[2]?.condition).not.toBe(horses[2]?.condition)
  })
})

describe('isFit', () => {
  it('returns true for a horse at or above MIN_RACEABLE_CONDITION (happy)', () => {
    expect(isFit(horse(1, MIN_RACEABLE_CONDITION + 10))).toBe(true)
    expect(isFit(horse(2, CONDITION_MAX))).toBe(true)
  })

  it('treats exactly MIN_RACEABLE_CONDITION as fit (edge — boundary)', () => {
    expect(isFit(horse(1, MIN_RACEABLE_CONDITION))).toBe(true)
    expect(isFit(horse(2, MIN_RACEABLE_CONDITION - 1))).toBe(false)
  })

  it('returns false at CONDITION_MIN (sad — a stub `() => true` would fail)', () => {
    expect(isFit(horse(1, CONDITION_MIN))).toBe(false)
  })
})
