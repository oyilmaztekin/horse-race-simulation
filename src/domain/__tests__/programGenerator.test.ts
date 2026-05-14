import { describe, expect, it } from 'vitest'
import { ROUND_COUNT, ROUND_DISTANCES } from '../constants'
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
})
