import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import { describe, expect, it } from 'vitest'
import { HORSE_COUNT, PHASE_FINISHED } from '../../domain/constants'
import type { Horse, Ranking, RoundResult } from '../../domain/types'
import ScoreTable from '../ScoreTable.vue'

function makeHorses(): Horse[] {
  return Array.from({ length: HORSE_COUNT }, (_: unknown, index: number) => ({
    number: index + 1,
    name: `Horse ${index + 1}`,
    condition: 60,
  }))
}

function ranking(rank: number, horseId: number, finishTimeMs: number): Ranking {
  return { rank, horseId, lane: rank, finishTimeMs }
}

function mountTable(results: RoundResult[], horses: Horse[] = makeHorses()) {
  return mount(ScoreTable, {
    global: {
      plugins: [
        createTestingPinia({
          stubActions: false,
          initialState: {
            horses: { horses, isLoading: false, error: null },
            race: {
              state: { kind: PHASE_FINISHED, program: [], seed: 1, results },
            },
          },
        }),
      ],
    },
  })
}

describe('ScoreTable', () => {
  it('renders standings in computed order with the champion modifier on rank 1 (happy)', () => {
    // Horse 1 wins twice, horse 2 wins once. Expected order: 1, 2, 3.
    const results: RoundResult[] = [
      {
        roundNumber: 1,
        rankings: [ranking(1, 1, 70_000), ranking(2, 2, 71_000), ranking(3, 3, 72_000)],
      },
      {
        roundNumber: 2,
        rankings: [ranking(1, 2, 70_000), ranking(2, 1, 71_000), ranking(3, 3, 72_000)],
      },
      {
        roundNumber: 3,
        rankings: [ranking(1, 1, 70_000), ranking(2, 3, 71_000), ranking(3, 2, 72_000)],
      },
    ]
    const wrapper = mountTable(results)
    const rows = wrapper.findAll('[data-testid="score-table-row"]')
    expect(rows).toHaveLength(3)
    expect(rows[0]!.text()).toContain('Horse 1')
    expect(rows[1]!.text()).toContain('Horse 2')
    expect(rows[2]!.text()).toContain('Horse 3')
    expect(rows[0]!.classes()).toContain('score-table__row--champion')
    expect(rows[1]!.classes()).not.toContain('score-table__row--champion')
  })

  it('renders zero body rows when results are empty (edge)', () => {
    const wrapper = mountTable([])
    expect(wrapper.findAll('[data-testid="score-table-row"]')).toHaveLength(0)
  })

  it('omits rows for horses missing from the roster lookup (sad)', () => {
    // Horse 99 isn't in the roster — computeStandings drops it; only horse 1 remains.
    const results: RoundResult[] = [
      {
        roundNumber: 1,
        rankings: [ranking(1, 99, 70_000), ranking(2, 1, 71_000)],
      },
    ]
    const wrapper = mountTable(results)
    const rows = wrapper.findAll('[data-testid="score-table-row"]')
    expect(rows).toHaveLength(1)
    expect(rows[0]!.text()).toContain('Horse 1')
  })
})
