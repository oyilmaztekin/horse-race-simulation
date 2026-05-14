import { describe, expect, it } from 'vitest'
import { HORSE_COUNT, LANE_COUNT, ROUND_COUNT, ROUND_DISTANCES } from '../constants'
import { generateRoster } from '../horseFactory'
import { generateProgram } from '../programGenerator'
import { createRng } from '../rng'
import type { Horse } from '../types'

const ANY_SEED = 42
const stubName = (n: number): string => `stub-${n}`

const buildRoster = (conditionByNumber: (n: number) => number): Horse[] =>
  Array.from({ length: HORSE_COUNT }, (_, i) => {
    const number = i + 1
    return { number, name: `stub-${number}`, condition: conditionByNumber(number) }
  })

describe('generateProgram', () => {
  it('returns ROUND_COUNT rounds with the locked distances in order (happy)', () => {
    const rng = createRng(ANY_SEED)
    const horses = generateRoster(rng, stubName)

    const program = generateProgram(horses, rng)

    expect(program).toHaveLength(ROUND_COUNT)
    expect(program.map((round) => round.distance)).toEqual([...ROUND_DISTANCES])
  })

  it('round distances are strictly increasing and distinct (edge)', () => {
    const rng = createRng(ANY_SEED)
    const horses = generateRoster(rng, stubName)

    const program = generateProgram(horses, rng)

    for (let i = 1; i < program.length; i += 1) {
      expect(program[i]!.distance).toBeGreaterThan(program[i - 1]!.distance)
    }
  })

  it('every round has a lanes array, even before assignment logic exists (negative)', () => {
    const rng = createRng(ANY_SEED)
    const horses = generateRoster(rng, stubName)

    // a stub like `ROUND_DISTANCES.map(d => ({ distance: d }))` would leave `lanes` undefined
    const program = generateProgram(horses, rng)

    for (const round of program) {
      expect(Array.isArray(round.lanes)).toBe(true)
    }
  })

  it('each round assigns LANE_COUNT horse numbers from [1, HORSE_COUNT] (happy)', () => {
    const rng = createRng(ANY_SEED)
    const horses = generateRoster(rng, stubName)

    const program = generateProgram(horses, rng)

    for (const round of program) {
      expect(round.lanes).toHaveLength(LANE_COUNT)
      for (const horseNumber of round.lanes) {
        expect(horseNumber).toBeGreaterThanOrEqual(1)
        expect(horseNumber).toBeLessThanOrEqual(HORSE_COUNT)
      }
    }
  })

  it('lane horse numbers within a single round are distinct (edge)', () => {
    const rng = createRng(ANY_SEED)
    const horses = generateRoster(rng, stubName)

    const program = generateProgram(horses, rng)

    for (const round of program) {
      const distinct = new Set(round.lanes)
      expect(distinct.size).toBe(round.lanes.length)
    }
  })

  it('different rng seeds produce different lane assignments (negative)', () => {
    const horses = generateRoster(createRng(0), stubName)

    // a stub like `horses.slice(0, LANE_COUNT)` would produce identical lanes
    const programA = generateProgram(horses, createRng(1))
    const programB = generateProgram(horses, createRng(2))

    const someRoundDiffers = programA.some((roundA, i) => {
      const roundB = programB[i]!
      return JSON.stringify(roundA.lanes) !== JSON.stringify(roundB.lanes)
    })
    expect(someRoundDiffers).toBe(true)
  })

  it('no horse races in two consecutive rounds (happy — rest rule)', () => {
    const rng = createRng(ANY_SEED)
    const horses = generateRoster(rng, stubName)

    const program = generateProgram(horses, rng)

    for (let i = 1; i < program.length; i += 1) {
      const previous = new Set(program[i - 1]!.lanes)
      for (const horseNumber of program[i]!.lanes) {
        expect(previous.has(horseNumber)).toBe(false)
      }
    }
  })

  it('with HORSE_COUNT === 2 * LANE_COUNT, rounds 1 and 3 share the full horse set (edge — alternation theorem)', () => {
    const rng = createRng(ANY_SEED)
    const horses = generateRoster(rng, stubName)

    const program = generateProgram(horses, rng)

    const round1Set = new Set(program[0]!.lanes)
    const round3Set = new Set(program[2]!.lanes)
    expect(round3Set).toEqual(round1Set)
  })

  it('rest invariant holds across many seeds (negative)', () => {
    // a stub that picks at random without filtering the previous round would
    // occasionally produce an overlap; testing many seeds makes that detectable
    const seeds = [1, 7, 42, 99, 314, 2026]

    for (const seed of seeds) {
      const rng = createRng(seed)
      const horses = generateRoster(rng, stubName)
      const program = generateProgram(horses, rng)

      for (let i = 1; i < program.length; i += 1) {
        const previous = new Set(program[i - 1]!.lanes)
        for (const horseNumber of program[i]!.lanes) {
          expect(previous.has(horseNumber)).toBe(false)
        }
      }
    }
  })

  it('high-condition horse is selected for round 1 far more often than low-condition horse (happy — weighting)', () => {
    // Counting appearances across all rounds would be uninformative — the alternation
    // theorem from the rest rule forces every horse into exactly 3 rounds regardless
    // of condition. The weighting effect is observable only in *which* horses get
    // picked in round 1 (which then determines the alternation group).
    const horses = buildRoster((n) => (n === 1 ? 100 : n === 2 ? 1 : 50))

    let highInRound1 = 0
    let lowInRound1 = 0
    const seedCount = 100
    for (let seed = 1; seed <= seedCount; seed += 1) {
      const program = generateProgram(horses, createRng(seed))
      if (program[0]!.lanes.includes(1)) highInRound1 += 1
      if (program[0]!.lanes.includes(2)) lowInRound1 += 1
    }

    expect(highInRound1).toBeGreaterThan(lowInRound1 * 2)
  })

  it('with all conditions equal, lane-1 is filled by a wide variety of horses (edge — no degenerate bias)', () => {
    const horses = buildRoster(() => 50)

    const lane1Occupants = new Set<number>()
    for (let seed = 1; seed <= 200; seed += 1) {
      const program = generateProgram(horses, createRng(seed))
      lane1Occupants.add(program[0]!.lanes[0]!)
    }

    // a stub like "always pick the lowest-numbered eligible horse" would fail this
    expect(lane1Occupants.size).toBeGreaterThanOrEqual(15)
  })

  it('changing only the condition distribution changes the program for the same seed (negative — picker reads condition)', () => {
    // identical horse numbers and rng — only the conditions differ
    const baseline = buildRoster(() => 50)
    const skewed = baseline.map((h) =>
      h.number === 1 ? { ...h, condition: 100 } : h.number === 2 ? { ...h, condition: 1 } : h,
    )

    const programA = generateProgram(baseline, createRng(ANY_SEED))
    const programB = generateProgram(skewed, createRng(ANY_SEED))

    // a stub that ignores condition would produce identical lanes
    const someRoundDiffers = programA.some(
      (roundA, i) => JSON.stringify(roundA.lanes) !== JSON.stringify(programB[i]!.lanes),
    )
    expect(someRoundDiffers).toBe(true)
  })
})
