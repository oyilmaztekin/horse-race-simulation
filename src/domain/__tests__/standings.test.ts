import { describe, expect, it } from 'vitest'
import { computeStandings } from '../standings'
import type { Horse, HorseId, RoundResult } from '../types'

const horsesFixture: Horse[] = [
  { number: 1, name: 'Alfa', condition: 70 },
  { number: 2, name: 'Bravo', condition: 70 },
  { number: 3, name: 'Charlie', condition: 70 },
  { number: 4, name: 'Delta', condition: 70 },
]
const lookup = (horseId: HorseId): Horse | undefined =>
  horsesFixture.find((horse: Horse) => horse.number === horseId)

const round = (roundNumber: number, finishes: Array<[HorseId, number]>): RoundResult => ({
  roundNumber,
  rankings: finishes.map(([horseId, finishTimeMs]: [HorseId, number], index: number) => ({
    rank: index + 1,
    horseId,
    lane: index + 1,
    finishTimeMs,
  })),
})

describe('computeStandings', () => {
  it('sorts by wins desc, podiums desc, total time asc (happy)', () => {
    // Round 1: 1 wins, 2 second, 3 third
    // Round 2: 2 wins, 1 second, 3 third
    // Round 3: 1 wins, 3 second, 2 third
    const results: RoundResult[] = [
      round(1, [[1, 70_000], [2, 71_000], [3, 72_000]]),
      round(2, [[2, 70_000], [1, 71_000], [3, 72_000]]),
      round(3, [[1, 70_000], [3, 71_000], [2, 72_000]]),
    ]

    const standings = computeStandings(results, lookup)

    expect(standings.map((standing) => standing.horseId)).toEqual([1, 2, 3])
    expect(standings[0]).toMatchObject({ rank: 1, wins: 2, podiums: 3, roundsRun: 3 })
    expect(standings[1]).toMatchObject({ rank: 2, wins: 1, podiums: 3, roundsRun: 3 })
    expect(standings[2]).toMatchObject({ rank: 3, wins: 0, podiums: 3, roundsRun: 3 })
    expect(standings[0]!.name).toBe('Alfa')
  })

  it('breaks identical wins+podiums+time by horse number asc (edge)', () => {
    // Horses 1 and 2 each win once, each podium once-more, identical total times.
    // Final tiebreaker = lower horse number → 1 ranks above 2.
    const results: RoundResult[] = [
      round(1, [[1, 70_000], [2, 71_000]]),
      round(2, [[2, 70_000], [1, 71_000]]),
    ]

    const standings = computeStandings(results, lookup)

    expect(standings).toHaveLength(2)
    expect(standings[0]).toMatchObject({ rank: 1, horseId: 1, wins: 1, podiums: 2 })
    expect(standings[1]).toMatchObject({ rank: 2, horseId: 2, wins: 1, podiums: 2 })
    expect(standings[0]!.totalFinishTimeMs).toBe(standings[1]!.totalFinishTimeMs)
  })

  it('returns [] for empty results and omits unknown horses (sad)', () => {
    expect(computeStandings([], lookup)).toEqual([])

    // Horse 99 isn't in the roster lookup — drop it; rank others normally.
    const results: RoundResult[] = [round(1, [[99, 70_000], [1, 71_000]])]
    const standings = computeStandings(results, lookup)
    expect(standings).toHaveLength(1)
    expect(standings[0]).toMatchObject({ rank: 1, horseId: 1, wins: 0, podiums: 1, roundsRun: 1 })
  })
})
