import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it } from 'vitest'
import {
  HORSE_COUNT,
  LANE_COUNT,
  PHASE_RACING,
  PHASE_READY,
  ROUND_COUNT,
  ROUND_DISTANCES,
} from '../../domain/constants'
import type { Horse, Program } from '../../domain/types'
import ProgramPanel from '../ProgramPanel.vue'
import ProgramRoundCard from '../ProgramRoundCard.vue'

function makeHorses(count = HORSE_COUNT): Horse[] {
  return Array.from({ length: count }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: 60,
  }))
}

function makeProgram(): Program {
  return ROUND_DISTANCES.map((distance: number) => ({
    distance,
    lanes: Array.from({ length: LANE_COUNT }, (_: unknown, lane: number) => lane + 1),
  }))
}

describe('ProgramPanel', () => {
  it('renders one ProgramRoundCard per round with resolved horses (happy)', () => {
    const wrapper = mount(ProgramPanel, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_READY, program: makeProgram(), rng: () => 0.5, seed: 1 } },
            },
          }),
        ],
      },
    })
    const cards = wrapper.findAllComponents(ProgramRoundCard)
    expect(cards).toHaveLength(ROUND_COUNT)
    const firstCardProps = cards[0]!.props()
    expect(firstCardProps.roundNumber).toBe(1)
    expect(firstCardProps.distance).toBe(ROUND_DISTANCES[0])
    expect(firstCardProps.entries).toHaveLength(LANE_COUNT)
    expect(firstCardProps.entries[0]).toEqual({
      laneIndex: 0,
      horse: { number: 1, name: 'Horse 1', condition: 60 },
    })
  })

  it('marks only the currentRoundIndex card as current during RACING (edge)', () => {
    const program = makeProgram()
    const wrapper = mount(ProgramPanel, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: {
                state: {
                  kind: PHASE_RACING,
                  program,
                  rng: () => 0.5,
                  seed: 1,
                  currentRoundIndex: 3,
                  results: [],
                },
              },
            },
          }),
        ],
      },
    })
    const cards = wrapper.findAllComponents(ProgramRoundCard)
    expect(cards.map((card) => card.props().isCurrent)).toEqual([
      false, false, false, true, false, false,
    ])
  })

  it('passes distinct distances and horse-name slices across rounds (sad — stub returning a single fixed card would fail)', () => {
    const program = makeProgram()
    // Make round 2 use lanes 11..20 so we can verify the panel doesn't reuse round-1 lanes.
    program[1] = {
      distance: ROUND_DISTANCES[1]!,
      lanes: Array.from({ length: LANE_COUNT }, (_: unknown, lane: number) => lane + 11),
    }
    const wrapper = mount(ProgramPanel, {
      global: {
        plugins: [
          createTestingPinia({
            stubActions: false,
            initialState: {
              horses: { horses: makeHorses(), isLoading: false, error: null },
              race: { state: { kind: PHASE_READY, program, rng: () => 0.5, seed: 1 } },
            },
          }),
        ],
      },
    })
    const cards = wrapper.findAllComponents(ProgramRoundCard)
    expect(cards[0]!.props().distance).toBe(ROUND_DISTANCES[0])
    expect(cards[1]!.props().distance).toBe(ROUND_DISTANCES[1])
    expect(cards[0]!.props().entries[0]!.horse.number).toBe(1)
    expect(cards[1]!.props().entries[0]!.horse.number).toBe(11)
  })
})
