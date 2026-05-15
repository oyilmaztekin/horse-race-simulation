import { PODIUM_RANK_MAX } from './constants'
import type { Horse, HorseId, RoundResult, Standing } from './types'

export type HorseLookup = (horseId: HorseId) => Horse | undefined

interface Aggregate {
  horseId: HorseId
  wins: number
  podiums: number
  roundsRun: number
  totalFinishTimeMs: number
}

// Pure aggregation of RoundResult[] into the end-of-meeting Standing[] rendered
// by ScoreTable.vue. Only horses with roundsRun ≥ 1 appear. Sort order:
// wins desc → podiums desc → totalFinishTimeMs asc → horseId asc (final key
// guarantees dense unique ranks). Horses unknown to the lookup are dropped so a
// stale results snapshot can't crash the table. BUSINESS_LOGIC.md §3.9.
export function computeStandings(
  results: readonly RoundResult[],
  lookupHorse: HorseLookup,
): Standing[] {
  const aggregates = new Map<HorseId, Aggregate>()

  for (const result of results) {
    for (const ranking of result.rankings) {
      const aggregate = aggregates.get(ranking.horseId) ?? {
        horseId: ranking.horseId,
        wins: 0,
        podiums: 0,
        roundsRun: 0,
        totalFinishTimeMs: 0,
      }
      aggregate.roundsRun += 1
      aggregate.totalFinishTimeMs += ranking.finishTimeMs
      if (ranking.rank === 1) aggregate.wins += 1
      if (ranking.rank <= PODIUM_RANK_MAX) aggregate.podiums += 1
      aggregates.set(ranking.horseId, aggregate)
    }
  }

  const rows: Standing[] = []
  for (const aggregate of aggregates.values()) {
    const horse = lookupHorse(aggregate.horseId)
    if (!horse) continue
    rows.push({
      rank: 0,
      horseId: aggregate.horseId,
      number: horse.number,
      name: horse.name,
      wins: aggregate.wins,
      podiums: aggregate.podiums,
      roundsRun: aggregate.roundsRun,
      totalFinishTimeMs: aggregate.totalFinishTimeMs,
    })
  }

  rows.sort((a: Standing, b: Standing) =>
    b.wins - a.wins
    || b.podiums - a.podiums
    || a.totalFinishTimeMs - b.totalFinishTimeMs
    || a.number - b.number,
  )

  return rows.map((row: Standing, index: number) => ({ ...row, rank: index + 1 }))
}
