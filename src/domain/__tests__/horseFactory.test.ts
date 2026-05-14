import { describe, expect, it } from 'vitest'
import { CONDITION_MAX, CONDITION_MIN, HORSE_COUNT } from '../constants'
import { generateRoster, pickConditionUniform } from '../horseFactory'
import { createRng } from '../rng'
import type { Rng } from '../types'

const ANY_SEED = 42
const stubName = (n: number): string => `stub-${n}`

describe('generateRoster', () => {
  it('returns HORSE_COUNT horses with non-empty names and bounded conditions (happy)', () => {
    const roster = generateRoster(createRng(ANY_SEED), stubName)

    expect(roster).toHaveLength(HORSE_COUNT)
    for (const horse of roster) {
      expect(horse.name.length).toBeGreaterThan(0)
      expect(horse.condition).toBeGreaterThanOrEqual(CONDITION_MIN)
      expect(horse.condition).toBeLessThanOrEqual(CONDITION_MAX)
    }
  })

  it('assigns horse numbers exactly 1..HORSE_COUNT, unique (edge)', () => {
    const roster = generateRoster(createRng(ANY_SEED), stubName)
    const numbers = roster.map((h) => h.number).sort((a, b) => a - b)
    const expected = Array.from({ length: HORSE_COUNT }, (_, i) => i + 1)

    expect(numbers).toEqual(expected)
  })

  it('produces non-uniform conditions across the roster (negative)', () => {
    const roster = generateRoster(createRng(ANY_SEED), stubName)
    const distinctConditions = new Set(roster.map((h) => h.condition))

    // a stub like "all conditions = 50" would leave size = 1
    expect(distinctConditions.size).toBeGreaterThan(1)
  })
})

const fixedRng = (value: number): Rng => () => value
const HIGHEST_RNG_BELOW_ONE = 0.9999

describe('pickConditionUniform', () => {
  it('returns an integer in [CONDITION_MIN, CONDITION_MAX] for a seeded RNG (happy)', () => {
    const rng = createRng(ANY_SEED)

    for (let i = 0; i < HORSE_COUNT; i += 1) {
      const value = pickConditionUniform(rng)
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(CONDITION_MIN)
      expect(value).toBeLessThanOrEqual(CONDITION_MAX)
    }
  })

  it('snaps to CONDITION_MIN at rng=0 and CONDITION_MAX at rng→1 (edge)', () => {
    expect(pickConditionUniform(fixedRng(0))).toBe(CONDITION_MIN)
    expect(pickConditionUniform(fixedRng(HIGHEST_RNG_BELOW_ONE))).toBe(CONDITION_MAX)
  })

  it('different rng outputs map to different conditions (negative)', () => {
    // a stub like "return CONDITION_MIN always" would fail this
    const low = pickConditionUniform(fixedRng(0))
    const high = pickConditionUniform(fixedRng(HIGHEST_RNG_BELOW_ONE))

    expect(low).not.toBe(high)
  })
})
