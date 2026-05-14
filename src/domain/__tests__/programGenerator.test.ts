import { describe, expect, it } from 'vitest'
import { HORSE_COUNT, LANE_COUNT, ROUND_COUNT, ROUND_DISTANCES } from '../constants'
import { generateRoster } from '../horseFactory'
import { generateProgram } from '../programGenerator'
import { createRng } from '../rng'

const ANY_SEED = 42
const stubName = (n: number): string => `stub-${n}`

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
})
