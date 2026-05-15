import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it } from 'vitest'
import {
  HORSE_COUNT,
  LANE_COUNT,
  PHASE_FINISHED,
  PHASE_INITIAL,
  PHASE_RACING,
  ROUND_COUNT,
  ROUND_DISTANCES,
} from '../../domain/constants'
import type { Horse, Ranking, RoundResult } from '../../domain/types'
import ResultsPanel from '../ResultsPanel.vue'
import ResultRoundCard from '../ResultRoundCard.vue'

function makeHorses(): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: 60,
  }))
}

function makeRankings(): Ranking[] {
  return Array.from({ length: LANE_COUNT }, (_: unknown, index: number) => ({
    rank: index + 1,
    horseId: index + 1,
    lane: index + 1,
    finishTimeMs: 60_000 + index * 100,
  }))
}

describe('ResultsPanel', () => {
  it('always renders ROUND_COUNT cards with empty entries before any round finishes (edge: INITIAL)', () => {
    const wrapper = mount(ResultsPanel, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_INITIAL } },
            },
          }),
        ],
      },
    })
    const cards = wrapper.findAllComponents(ResultRoundCard)
    expect(cards).toHaveLength(ROUND_COUNT)
    expect(cards.map((card) => card.props().distance)).toEqual([...ROUND_DISTANCES])
    expect(cards.every((card) => card.props().entries.length === 0)).toBe(true)
  })

  it('fills entries for completed rounds and leaves later rounds empty during RACING (happy)', () => {
    const completedResults: RoundResult[] = [
      { roundNumber: 1, rankings: makeRankings() },
      { roundNumber: 2, rankings: makeRankings() },
    ]
    const wrapper = mount(ResultsPanel, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: {
                state: {
                  kind: PHASE_RACING,
                  program: [],
                  rng: () => 0.5,
                  seed: 1,
                  currentRoundIndex: 2,
                  results: completedResults,
                },
              },
            },
          }),
        ],
      },
    })
    const cards = wrapper.findAllComponents(ResultRoundCard)
    expect(cards[0]!.props().entries).toHaveLength(LANE_COUNT)
    expect(cards[1]!.props().entries).toHaveLength(LANE_COUNT)
    expect(cards[2]!.props().entries).toHaveLength(0)
    expect(cards[5]!.props().entries).toHaveLength(0)
    expect(cards[0]!.props().entries[0]).toEqual({
      position: 1,
      horse: { number: 1, name: 'Horse 1', condition: 60 },
      laneIndex: 0,
    })
  })

  it('renders cards in distance order even when results are out of order (sad — a stub iterating results would lose ROUND_DISTANCES anchoring)', () => {
    // FINISHED with results pushed out of order — the panel must still align cards to ROUND_DISTANCES.
    const shuffledResults: RoundResult[] = [
      { roundNumber: 3, rankings: makeRankings() },
      { roundNumber: 1, rankings: makeRankings() },
    ]
    const wrapper = mount(ResultsPanel, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: {
                state: {
                  kind: PHASE_FINISHED,
                  program: [],
                  seed: 1,
                  results: shuffledResults,
                },
              },
            },
          }),
        ],
      },
    })
    const cards = wrapper.findAllComponents(ResultRoundCard)
    expect(cards.map((card) => card.props().roundNumber)).toEqual([1, 2, 3, 4, 5, 6])
    expect(cards[0]!.props().entries).toHaveLength(LANE_COUNT) // round 1 filled
    expect(cards[1]!.props().entries).toHaveLength(0) // round 2 missing
    expect(cards[2]!.props().entries).toHaveLength(LANE_COUNT) // round 3 filled
  })
})
